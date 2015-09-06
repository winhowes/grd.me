/** This file handles the page encryption and decryption */

/** Prepare a function to be called back and return its index
 * @param cb The callback function
*/
'use strict';

var callbackWrap = (function () {
	var callbackChain = [];

	self.port.on('callback', function (obj) {
		typeof callbackChain[obj.index] === 'function' && callbackChain[obj.index](obj.data);
	});

	return function (cb) {
		return callbackChain.push(cb) - 1;
	};
})();
var cryptoManager = new CryptoManager(self.port, callbackWrap);
var frameComm = new FrameComm(self.port, cryptoManager, callbackWrap);
cryptoManager.setFrameComm(frameComm);

/** Called to update the keyring and the active keys */
self.port.on('secret', function (secretObj) {
	if (typeof secretObj.keys === 'object') {
		cryptoManager.activeKeys = secretObj.active;
		cryptoManager.keyList = secretObj.keys;
		// Rerender parts of the page
		$('body').attr('crypto_mark', false);
	} else {
		cryptoManager.activeKeys = [];
		cryptoManager.keyList = [];
	}
});

/** Called if crypt is to run into panel mode */
self.port.on('panelMode', function () {
	cryptoManager.panelMode = true;
	Mousetrap.unbind('mod+alt+e');
	$('#clipboard').hide();
	self.port.on('show', function onShow() {
		$('textArea').focus().select();
	});
});

/** Notify user that their message was copied to clipboard */
self.port.on('message_add_fail', function () {
	alert('Failed to make short message.\nCiphertext copied to clipboard.');
});

/** Append iframe of decrypted message */
self.port.on('preparedIframe', function (uid) {
	var $elem = $('[grdMeUID="' + uid + '"]');
	var width = '100%';
	if ($elem.css('display') === 'block') {
		if ($elem.width() > 0) {
			width = $elem.outerWidth();
		} else {
			width = 'auto';
		}
	}
	$elem.append($('<iframe>', { src: 'https://decrypt.grd.me/' + uid, 'grdMeFrameUID': uid, seamless: 'seamless' }).css({
		border: 0,
		width: width,
		height: $elem.outerHeight(),
		marginBottom: '-7px'
	}).hide()).css('display', 'block');
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
	$(':contains("' + cryptoManager.START_TAG + '"):not([crypto_mark="true"]):not([contenteditable="true"]):not(textarea):not(input):not(script)').each(function (i, e) {
		var $elem = $(e);
		if ($elem.find(':contains("' + cryptoManager.START_TAG + '"):not([crypto_mark="true"])').length || $elem.parents('[contenteditable="true"]').length) {
			$elem.attr('crypto_mark', true);
			return;
		}
		cryptoManager.decrypt($elem, function (returnObj) {
			$elem.parents('[crypto_mark="true"]').attr('crypto_mark', false);
			if (!returnObj.endTagFound) {
				(function () {
					returnObj.plaintext = returnObj.plaintext || '';
					var $parent = $elem.parent().parent().parent();
					if (endsWith(window.location.hostname, 'facebook.com')) {
						if ($elem.parents('.UFICommentBody').length) {
							$parent = $elem.parents('.UFICommentBody');
						} else if ($elem.parents('.userContent').length) {
							$parent = $elem.parents('.userContent');
						}
					}
					$parent.on('click', function () {
						$elem.parents('[crypto_mark="true"]').attr('crypto_mark', false);
						var inFlight = false;
						window.requestAnimationFrame(function () {
							if ($parent.text().indexOf(cryptoManager.END_TAG) > 0 && !inFlight) {
								inFlight = true;
								self.port.emit('recheckDecryption', {
									text: $parent.text(),
									returnObj: returnObj,
									callback: callbackWrap(function (text) {
										inFlight = false;
										$parent.text(text);
										cryptoManager.decrypt($parent);
									})
								});
							}
						});
					});
				})();
			}
		});
	});
}

/** Check for changes to the dom before running decryptInterval **/
initObserver(decryptInterval);

/** Bind the keyboard shortcuts **/
Mousetrap.bindGlobal(['mod+e'], function (e) {
	var active = document.activeElement;
	if (cryptoManager.keyList.length && (active.value || $(active).attr('contenteditable'))) {
		e.preventDefault();
		cryptoManager.encrypt();
	}
});

Mousetrap.bindGlobal(['mod+alt+e'], function (e) {
	if (cryptoManager.keyList.length) {
		e.preventDefault();
		self.port.emit('secureText');
	}
});

Mousetrap.bindGlobal(['mod+shift+e'], function (e) {
	var active = document.activeElement;
	if (cryptoManager.keyList.length && (active.value || $(active).attr('contenteditable'))) {
		e.preventDefault();
		cryptoManager.encrypt(true);
	}
});