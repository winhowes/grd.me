/** This file handles controls injected scripts */

const cryptoManager = new CryptoManager();
const frameComm = new FrameComm(cryptoManager);
cryptoManager.setFrameComm(frameComm);

const port = chrome.runtime.connect();
port.onMessage.addListener((msg) => {
	if (msg.id === 'secret') {
		if (typeof msg.keys === 'object') {
			cryptoManager.activeKeys = msg.active;
			cryptoManager.keyList = msg.keys;
			// Rerender parts of the page
			$('body').attr('crypto_mark', false);
		} else {
			cryptoManager.activeKeys = [];
			cryptoManager.keyList = [];
		}
	} else if (msg.id === 'panelMode') {
		cryptoManager.panelMode = true;
		Mousetrap.unbind('mod+alt+e');
		$('#clipboard').css('display', 'block').hide();
		$('textArea').focus().select();
		$(window).blur(() => {
			window.close();
		}).on('keydown', (e) => {
			if (e.keyCode === 27) {
				window.close();
			}
		});
	} else if (msg.id === 'prepareIframe') {
		cryptoManager.intercept.prepareIframe(msg.uid);
	}
});

/** Check that a string ends with another substring
 * @param subject String to search through
 * @param suffix The proposed suffix of the subject
*/
function endsWith(subject, suffix) {
	return subject.indexOf(suffix, subject.length - suffix.length) !== -1;
}

/** Scan for any crypto on the page and decypt if possible */
function decryptInterval() {
	if (!cryptoManager.keyList.length) {
		return;
	}
	$(':contains("' + cryptoManager.START_TAG + '"):not([crypto_mark="true"]):not([contenteditable="true"]):not(textarea):not(input):not(script)').each((i, e) => {
		const $elem = $(e);
		if ($elem.find(':contains("' + cryptoManager.START_TAG + '"):not([crypto_mark="true"])').length || $elem.parents('[contenteditable="true"]').length) {
			// ASSUMPTION: an element not containing a crypto message itself will never contain a crypto message
			$elem.attr('crypto_mark', true);
			return;
		}
		cryptoManager.decryptElem($elem, (returnObj) => {
			$elem.parents('[crypto_mark="true"]').attr('crypto_mark', false);
			if (!returnObj.endTagFound) {
				returnObj.plaintext = returnObj.plaintext || '';
				let $parent = $elem.parent().parent().parent();
				if (endsWith(window.location.hostname, 'facebook.com')) {
					if ($elem.parents('.UFICommentBody').length) {
						$parent = $elem.parents('.UFICommentBody');
					} else if ($elem.parents('.userContent').length) {
						$parent = $elem.parents('.userContent');
					}
				}
				$parent.on('click', () => {
					window.requestAnimationFrame(() => {
						if ($parent.text().indexOf(cryptoManager.END_TAG) > 0) {
							let text = $parent.text();
							/* Handle the case of ciphertext in plaintext */
							while (returnObj.plaintext.indexOf(cryptoManager.START_TAG) + 1 && returnObj.plaintext.indexOf(cryptoManager.END_TAG) + 1) {
								const pre = returnObj.plaintext.substring(0, returnObj.plaintext.indexOf(cryptoManager.START_TAG));
								const ciphertext = returnObj.plaintext.substring(returnObj.plaintext.indexOf(cryptoManager.START_TAG) + cryptoManager.START_TAG.length, returnObj.plaintext.indexOf(cryptoManager.END_TAG));
								const post = returnObj.plaintext.substring(returnObj.plaintext.indexOf(cryptoManager.END_TAG) + cryptoManager.END_TAG.length);
								returnObj.plaintext = pre + cryptoManager.decryptText(ciphertext) + post;
							}
							if (returnObj.plaintext.length) {
								text = text.trimLeft();
								returnObj.plaintext = returnObj.plaintext.trimLeft();
								const index = Math.max(text.indexOf(returnObj.plaintext), 0);
								$parent.text(text.substring(0, index) +
									cryptoManager.START_TAG +
									returnObj.ciphertext.trim() +
									text.substring(index + returnObj.plaintext.length).trimLeft()
								);
							} else {
								$parent.text(text.replace(cryptoManager.UNABLE_TO_DECRYPT + ' ' + cryptoManager.UNABLE_START_TAG, cryptoManager.START_TAG));
							}
							cryptoManager.decryptElem($parent);
						}
					});
				});
			}
		});
	});
}

/** Check for changes to the dom before running decryptInterval **/
initObserver(decryptInterval);

Mousetrap.bindGlobal(['mod+e'], (e) => {
	const active = document.activeElement;
	if (cryptoManager.keyList.length && (active.value || $(active).attr('contenteditable'))) {
		e.preventDefault();
		cryptoManager.encrypt();
	}
});

Mousetrap.bindGlobal(['mod+alt+e'], (e) => {
	if (cryptoManager.keyList.length) {
		e.preventDefault();
		port.postMessage({id: 'secureText'});
	}
});

Mousetrap.bindGlobal(['mod+shift+e'], (e) => {
	const active = document.activeElement;
	if (cryptoManager.keyList.length && (active.value || $(active).attr('contenteditable'))) {
		e.preventDefault();
		cryptoManager.encrypt(true);
	}
});
