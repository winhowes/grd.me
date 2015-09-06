/* This code handles the decrypted message iframe
The following variables are passed in through the background intercept script:
	locationObj
	messageCSS
	childrenCSS
	fonts
	messageText
	FRAME_SECRET
	uid
*/

'use strict';

$(function () {
	var cryptoManager = new CryptoManager();

	var Messenger = (function () {
		var frameOrigin = 'https://decrypt.grd.me';
		/** Receive a message from the content scripts
   * @param event An event about a recieved message
  */
		function receiveMessage(event) {
			try {
				if (event.data.to !== frameOrigin) {
					return;
				}
				var data = event.data.encrypted;
				data = CryptoJS.AES.decrypt(data, FRAME_SECRET);
				data = data.toString(CryptoJS.enc.Utf8);
				if (!data) {
					return;
				}
				data = JSON.parse(data);
				if (data.id === 'decryptCallback') {
					$('body').trigger('callback', [data.returnId, data.plaintext]);
				} else if (data.id === 'decryptIndicator') {
					cryptoManager.preferences.decryptIndicator = data.decryptIndicator;
				} else if (data.id === 'emojis') {
					cryptoManager.preferences.emojis = data.emojis;
				}
			} catch (e) {
				console.error('Error', e);
			}
		}

		window.addEventListener('message', receiveMessage, false);

		return {
			/** Send data to parent window
    * @param data The data object to send
   */
			send: function send(data) {
				data.uid = uid;
				var encryptedData = CryptoJS.AES.encrypt(JSON.stringify(data), FRAME_SECRET);
				encryptedData = encryptedData.toString();
				parent.postMessage({
					encrypted: encryptedData,
					from: frameOrigin
				}, locationObj.origin);
			}
		};
	})();

	var cryptoHelper = new InterceptCryptoHelper(Messenger, cryptoManager, locationObj);

	/** Checks the height of the body and adjusts the frame height to match */
	var checkHeight = (function () {
		var padding = 5;
		var lastBodyHeight = 0;
		return function () {
			var outerHeight = $('body').outerHeight();
			// TODO: find out why they are off by 5
			if (Math.abs(lastBodyHeight - outerHeight) > padding) {
				lastBodyHeight = outerHeight;
				Messenger.send({
					id: 'adjustHeight',
					height: lastBodyHeight + padding
				});
			}
		};
	})();

	/** Get the unique selector for qn element
  * @param elem The element for which to get the selector
 */
	function getUniqueSelector(elem) {
		if (elem.nodeName.toLowerCase() === 'body' || elem.nodeName.toLowerCase() === 'html') {
			return '[grdMeUID="' + uid + '"]';
		}
		var parent = elem.parentNode;
		var selector = '>' + elem.nodeName + ':nth-child(' + ($(elem).index() + 1) + ')';
		while (parent && parent.nodeName.toLowerCase() !== 'body') {
			selector = '>' + parent.nodeName + ':nth-child(' + ($(parent).index() + 1) + ')' + selector;
			parent = parent.parentNode;
		}
		return '[grdMeUID="' + uid + '"]' + selector;
	}

	/** Get all events for an element
  * @param element An html element
 */
	function getAllEvents(element) {
		var result = [];
		for (var key in element) {
			if (key.indexOf('on') === 0) {
				result.push(key.slice(2));
			}
		}
		return result.join(' ');
	}

	/** Returns whether or not the character is a valid first character in a tag
  * @param character The first character
 */
	function isValidTagChar(character) {
		return character.match(/[a-z?\\\/!]/i);
	}

	/** Strips scripts from a string of html
  * @param html String of html to be stripped
 */
	function stripScripts(html) {
		var div = document.createElement('div');
		var scripts = div.getElementsByTagName('script');
		var i = scripts.length;
		div.innerHTML = html;
		while (i--) {
			scripts[i].parentNode.removeChild(scripts[i]);
		}
		return div.innerHTML;
	}

	/** Removes javascript from html string
  * @param originalHTML String to be cleaned
 */
	function clean(originalHTML) {
		var prefix = 'grdme';
		var sandbox = ' sandbox=""';
		var strip = false;
		var lastQuote = false;
		var tag = false;
		var html = originalHTML;

		/** Strip out some of the html */
		function stripHTML() {
			html = html.slice(0, strip) + html.slice(j);
			j = strip;
			strip = false;
		}

		for (var i = 0; i < html.length; i++) {
			if (html[i] === '<' && html[i + 1] && isValidTagChar(html[i + 1])) {
				i++;
				tag = false;
				/* Enter element */
				for (var _j = i; _j < html.length; _j++) {
					if (!lastQuote && html[_j] === '>') {
						if (strip) {
							stripHTML();
						}
						/* sandbox iframes */
						if (tag === 'iframe') {
							var index = html.slice(i, _j).toLowerCase().indexOf('sandbox');
							if (index > 0) {
								html = html.slice(0, i + index) + prefix + html.slice(i + index);
								_j += prefix.length;
							}
							html = html.slice(0, _j) + sandbox + html.slice(_j);
							_j += sandbox.length;
						}
						i = _j;
						break;
					}
					if (!tag && html[_j] === ' ') {
						tag = html.slice(i, _j).toLowerCase();
					}
					if (lastQuote === html[_j]) {
						lastQuote = false;
						continue;
					}
					if (!lastQuote && html[_j - 1] === '=' && (html[_j] === '\'' || html[_j] === '"')) {
						lastQuote = html[_j];
					}
					/* Find on statements */
					if (!lastQuote && html[_j - 2] === ' ' && html[_j - 1] === 'o' && html[_j] === 'n') {
						strip = _j - 2;
					}
					if (strip && html[_j] === ' ' && !lastQuote) {
						stripHTML();
					}
				}
			}
		}
		html = stripScripts(html);
		return html;
	}

	/** The callback function for when the frame is verified
  * @param obj Object containing the stylesheet CSS and font info
 */
	function frameVerified(obj) {
		var stylesheetCSS = obj.stylesheetCSS || [];
		var fonts = obj.fonts || [];
		var style = $('<style>', { type: 'text/css' });

		$('html').css(messageCSS);
		$('body').append(clean(messageText)).css(messageCSS);

		for (var i = 0; i < fonts.length; i++) {
			style.append(fonts[i]);
		}

		if (stylesheetCSS.length) {
			for (var i = 0; i < stylesheetCSS.length; i++) {
				for (var pseudo in stylesheetCSS[i].css) {
					if (stylesheetCSS[i].css.hasOwnProperty(pseudo)) {
						var pseudoClass = pseudo !== 'normal' ? pseudo : '';
						style.append(document.createTextNode(stylesheetCSS[i].selector + pseudoClass + '{'));
						for (var key in stylesheetCSS[i].css[pseudo]) {
							if (stylesheetCSS[i].css[pseudo].hasOwnProperty(key)) {
								var value = $.trim(stylesheetCSS[i].css[pseudo][key]);
								/* Make sure there's no JS */
								if ($.trim(value.toLowerCase().replace('url(', '').replace('\'', '').replace('"', '').replace('/*', '').replace('*/', '')).indexOf('javascript')) {
									style.append(document.createTextNode(key + ':' + value + ';'));
								}
							}
						}
						style.append(document.createTextNode('}'));
					}
				}
			}
		} else {
			for (var i = 0; i < childrenCSS.length; i++) {
				$('body ' + childrenCSS[i].selector).css(childrenCSS[i].css);
			}
		}

		$(document.head).append(style);

		$('html').bind(getAllEvents($('html').get(0)), function (e) {
			Messenger.send({
				id: 'event',
				event: {
					type: e.type.toString(),
					selector: getUniqueSelector(e.target)
				}
			});
		});

		$('body').on('click', 'a', function anchorClickHandler(e) {
			e.preventDefault();
			if ($(this).attr('href')) {
				Messenger.send({
					id: 'click',
					href: $(this).attr('href'),
					target: $(this).attr('target')
				});
			}
		});

		$('html, body').css({
			padding: 0,
			margin: 0,
			height: 'auto'
		});

		setInterval(function () {
			checkHeight();
		}, 500);

		cryptoHelper.fixReferences();

		initObserver(function () {
			cryptoHelper.decryptInterval();
		});

		Messenger.send({ id: 'ready' });
	}

	frameVerified({});
});