/** This file handles the page encryption and decryption */

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var CryptoManager = (function () {
	function CryptoManager() {
		_classCallCheck(this, CryptoManager);

		this.START_TAG = '~~grdme~~';
		this.END_TAG = '~~!grdme~~';
		this.UNABLE_TO_DECRYPT = '[Unable to decrypt message]';
		this.UNABLE_START_TAG = '[start tag]';
		this.UNABLE_END_TAG = '[end tag]';
		this.NONCE_CHAR = '!';
		this.DECRYPTED_MARK = this._getDecryptedMark();
		this.preferences = {
			decryptIndicator: true,
			emojis: true,
			sandboxDecrypt: false
		};
		this.panelMode = false;
		this.activeKeys = [];
		this.keyList = [];
		this.frameComm = {};
		this._getPreferences();

		$('body').on('mouseenter', 'grdme', function mouseEnterGrdMeHandler() {
			$(this).next('grdme_decrypt').css('font-weight', $(this).next('grdme_decrypt').css('font-weight') < 700 ? 700 : 400);
		}).on('mouseleave', 'grdme', function mouseLeaveGrdMeHandler() {
			$(this).next('grdme_decrypt').css('font-weight', '');
		});
	}

	/** Encrypt the active element's text/value
  * @param shortEncrypt Boolean indicating whether or not to do short encryption. Defaults to false.
  *
  * Short encryption is where the ciphertext is uploaded to grd me servers and an id is
  * inserted in it's place which is used to lookup the ciphertext.
 */

	_createClass(CryptoManager, [{
		key: 'encrypt',
		value: function encrypt(shortEncrypt) {
			var _this = this;

			var active = document.activeElement;
			while (active.shadowRoot) {
				active = active.shadowRoot.activeElement;
			}
			var plaintext = active.value || active.innerHTML;
			if (!plaintext.length) {
				return;
			}
			if (!active.value && active.innerHTML) {
				if (!$(active).attr('contenteditable')) {
					return;
				}
				/* Transfer div's into br's using endTag as intermediate as it's not in string */
				var $el = $('<i>');
				$el.html(this._clearAttributes(plaintext)).find('div').each(function (i, e) {
					if (!$.trim($(e).text()).length) {
						$(e).html('');
					}
				});
				plaintext = $el.html();
				plaintext = plaintext.replace(/<div\s*/gi, this.END_TAG + '<div ');
				var re = new RegExp(this.END_TAG, 'gi');
				plaintext = !plaintext.indexOf(this.END_TAG) ? plaintext.slice(this.END_TAG.length) : plaintext;
				plaintext = plaintext.replace(re, '<br>');
				/* This regex technically breaks if there's a '>' character in an attribute of a br tag*/
				plaintext = this._strip(plaintext.replace(/<br\s*[^>]*>/gi, '\n'));
			}
			var ciphertext = this.START_TAG;
			for (var i = 0; i < this.activeKeys.length; i++) {
				ciphertext += (typeof this.activeKeys[i] === 'object' ? ecc.encrypt(this.activeKeys[i].pub, plaintext) : CryptoJS.AES.encrypt(plaintext, this.activeKeys[i])) + '|';
			}
			ciphertext = ciphertext.slice(0, -1);
			ciphertext += this.END_TAG;
			ciphertext = ciphertext.replace(/\+/g, ')').replace(/\//g, '(');
			if (shortEncrypt) {
				(function () {
					var actualCiphertext = ciphertext.replace(_this.START_TAG, '').replace(_this.END_TAG, '');
					var rand = _this.getRandomString(64);
					var hash = new CryptoJS.SHA256(actualCiphertext + rand).toString().slice(0, 60);
					ciphertext = _this.START_TAG + _this.NONCE_CHAR + hash + _this.END_TAG;
					$.ajax({
						url: 'https://grd.me/message/add',
						type: 'POST',
						data: {
							hash: hash,
							message: actualCiphertext,
							rand: rand
						},
						error: function error() {
							port.postMessage({
								id: 'copy_ciphertext',
								text: _this.START_TAG + actualCiphertext + _this.END_TAG
							});
							setTimeout(function () {
								alert('Failed to make short message.\nCiphertext copied to clipboard.');
							}, 200);
						}
					});
				})();
			}
			if (this.panelMode) {
				port.postMessage({
					id: 'copy_ciphertext',
					text: ciphertext
				});
				$('#clipboard').stop(true, true).fadeIn().delay(1000).fadeOut();
			} else if (active.value) {
				active.value = ciphertext;
			} else {
				document.execCommand('selectAll');

				window.requestAnimationFrame(function () {
					var te = document.createEvent('TextEvent');
					te.initTextEvent('textInput', true, true, window, ciphertext);
					document.activeElement.dispatchEvent(te);
				});
			}
		}

		/** Decrypt an elem's text and return an object with the plaintext, ciphertext, and whether or not an end crypto tage was found.
   * @param elem The jQuery element whose text should be decypted
   * @param [cb] Function that takes an object containing a decryption object
  */
	}, {
		key: 'decryptElem',
		value: function decryptElem(elem, cb) {
			var _this2 = this;

			var callback = cb || function () {};
			var val = undefined;
			var index1 = undefined;
			var index2 = undefined;
			var html = undefined;
			var ciphertext = undefined;
			var plaintext = undefined;
			/** Report error decrypting message */
			var _error = function _error() {
				elem.html(val.substring(0, index1) + _this2._sanitize(_this2.UNABLE_TO_DECRYPT + ' ' + _this2.UNABLE_START_TAG + val.substring(val.indexOf(_this2.START_TAG) + _this2.START_TAG.length).replace(_this2.END_TAG, _this2.UNABLE_END_TAG)));
				callback({
					endTagFound: index2 > 0,
					plaintext: plaintext,
					ciphertext: ciphertext
				});
			};

			/** Insert plaintext into page and call callback
    * @param originalPlaintext The decrypted text
    * @param ciphertext The encrypted text/nonce text
   */
			var finish = function finish(originalPlaintext, ciphertext) {
				var end = index2 > 0 ? html.substring(html.indexOf(_this2.END_TAG) + _this2.END_TAG.length) : '';
				var start = html.substring(0, html.indexOf(_this2.START_TAG));
				var uid = encodeURIComponent(_this2.getRandomString(64));
				var plaintext = originalPlaintext;
				elem.attr('grdMeUID', uid);
				val = start + _this2.decryptMark(_this2.setupPlaintext(plaintext)) + end;

				if (_this2.preferences.sandboxDecrypt) {
					plaintext = '[Decrypting Message...]';
					elem.html(start + _this2.decryptMark(plaintext) + end);
					elem.append($('<a>', { grdMeAnchor: '' }).hide());
					elem.contents().filter(function filterForTextNodes() {
						return this.nodeType === 3;
					}).remove();
					if (!_this2.frameComm.FRAME_SECRET) {
						console.error('A valid frameComm must be set in the CryptoManager');
					}
					_this2.intercept.add({
						location: {
							full: window.location.href,
							host: window.location.host,
							origin: window.location.origin
						},
						message: {
							childrenCSS: _this2._setupChildren(elem.get(0)),
							css: _this2._getCSS(elem.get(0)),
							text: val
						},
						secret: _this2.frameComm.FRAME_SECRET,
						uid: uid
					});
					if (elem.css('display') === 'inline') {
						elem.css('display', 'inline-block');
						if (elem.css('vertical-align') === 'baseline') {
							elem.css('vertical-align', '-moz-middle-with-baseline');
						}
					}
				} else {
					elem.html(val);
				}

				callback({
					endTagFound: index2 > 0,
					plaintext: _this2._sanitize(plaintext),
					ciphertext: ciphertext
				});
			};

			if (elem.attr('crypto_mark') === 'inFlight') {
				return;
			}

			val = elem.text();
			if (val.toLowerCase().indexOf(this.END_TAG) > 0 && this._endsWith(window.location.hostname, 'facebook.com')) {
				elem.parent().find('.text_exposed_hide').remove();
				elem.parent().find('.text_exposed_show').show();
				elem.parents('.text_exposed_root').addClass('text_exposed');
				val = elem.text();
			}
			html = elem.html();
			index1 = val.toLowerCase().indexOf(this.START_TAG);
			index2 = val.toLowerCase().indexOf(this.END_TAG);

			if (index2 < 0 && callback && elem.parent(':contains("' + this.END_TAG + '"):not([contenteditable="true"])').length) {
				this.decryptElem(elem.parent().attr('crypto_mark', false));
				return;
			}

			/* This checks the case of the start tag being broken by html elements */
			if (index1 > 0 && html.indexOf(this.START_TAG) < 0 && this._strip(html).indexOf(this.START_TAG) > 0) {
				var character = this.START_TAG.slice(-1);
				var string = undefined;
				var index = html.indexOf(character) + 1;
				while (this._strip(string).indexOf(this.START_TAG) < 0 && index < html.length) {
					index = html.indexOf(character, index) + 1;
					string = html.substring(html.indexOf(character), index);
				}
				var preCounter = 0;
				while (this._strip(string) !== this.START_TAG) {
					preCounter++;
					string = string.slice(1);
				}
				html = html.substring(0, html.indexOf(character) + preCounter) + this._strip(string) + html.substring(index);
			}

			/* This checks the case of the end tag being broken by html elements */
			if (index2 > 0 && html.indexOf(this.END_TAG) < 0 && this._strip(html).indexOf(this.END_TAG) > 0) {
				var character = this.END_TAG.slice(-1);
				var string = undefined;
				var index = html.indexOf(this.START_TAG) + this.START_TAG.length;
				while (this._strip(string).indexOf(this.END_TAG) < 0 && index < html.length) {
					index = html.indexOf(character, index) + 1;
					string = html.substring(html.indexOf(this.START_TAG) + this.START_TAG.length, index);
				}
				html = html.substring(0, html.indexOf(this.START_TAG) + this.START_TAG.length) + this._strip(string) + html.substring(index);
			}

			if (index2 > 0 && elem.attr('crypto_mark') === 'false') {
				val = this._strip(html);
				val = html.substring(0, html.indexOf(this.START_TAG)) + val.substring(val.indexOf(this.START_TAG), val.indexOf(this.END_TAG)) + html.substring(html.indexOf(this.END_TAG));
				index1 = val.toLowerCase().indexOf(this.START_TAG);
				index2 = val.toLowerCase().indexOf(this.END_TAG);
			}
			ciphertext = index2 > 0 ? val.substring(index1 + this.START_TAG.length, index2) : val.substring(index1 + this.START_TAG.length);
			if (ciphertext.charAt(0) === this.NONCE_CHAR) {
				(function () {
					var hash = ciphertext.slice(1);
					elem.attr('crypto_mark', 'inFlight');
					$.ajax({
						url: 'https://grd.me/message/get',
						type: 'GET',
						data: {
							hash: hash
						},
						success: function success(data) {
							elem.removeAttr('crypto_mark');
							if (data && data.status && data.status[0] && !data.status[0].code) {
								plaintext = false;
								for (var i = 0; i < data.messages.length; i++) {
									plaintext = _this2.decryptText(data.messages[i].message);
									if (new CryptoJS.SHA256(data.messages[i].message + data.messages[i].rand).toString().slice(0, 60) === hash && plaintext) {
										finish(plaintext, ciphertext);
										return;
									}
								}
								_error();
							} else {
								_error();
							}
						},
						error: function error() {
							elem.removeAttr('crypto_mark');
							_error();
						}
					});
				})();
			} else {
				plaintext = this.decryptText(ciphertext);
				if (plaintext) {
					finish(plaintext, ciphertext);
				} else {
					_error();
				}
			}
		}

		/** Decrypt ciphertext with all available keys. Returns false if no decryption possible
   * @param originalCiphertext The text excluding the crypto tags to decrypt
  */
	}, {
		key: 'decryptText',
		value: function decryptText(originalCiphertext) {
			var ciphertext = originalCiphertext.replace(/\)/g, '+').replace(/\(/g, '/');
			ciphertext = ciphertext.split('|');
			var validDecryption = false;
			var plaintext = '';
			for (var i = 0; i < ciphertext.length; i++) {
				for (var j = 0; j < this.keyList.length; j++) {
					try {
						if (typeof this.keyList[j].key === 'object' && this.keyList[j].key.priv) {
							plaintext = ecc.decrypt(this.keyList[j].key.priv, ciphertext[i]);
						} else {
							plaintext = CryptoJS.AES.decrypt(ciphertext[i], this.keyList[j].key);
							plaintext = plaintext.toString(CryptoJS.enc.Utf8);
							validDecryption = true;
						}
						if (!plaintext.trim()) {
							throw new Error();
						}
						break;
					} catch (e) {
						validDecryption = false;
					}
				}
				if (validDecryption) {
					break;
				}
			}
			return validDecryption ? plaintext : false;
		}

		/** Set the FrameComm
   * @param frameComm A FrameComm object
  */
	}, {
		key: 'setFrameComm',
		value: function setFrameComm(frameComm) {
			this.frameComm = frameComm;
		}

		/** emojify, linkify and fix line breaks in plaintext
   * @param plaintext The plaintext to modify
  */
	}, {
		key: 'setupPlaintext',
		value: function setupPlaintext(plaintext) {
			var formattedStr = linkify(this._sanitize(plaintext).replace(/\n/g, '<br>'));
			if (this.preferences.emojis) {
				formattedStr = emojify(formattedStr);
			}
			return formattedStr;
		}

		/** Mark a piece of text as decrypted - only works if the decryptIndicator is true
   * @param originalPlaintext Text to be marked
   * NOTE: originalPlaintext should already sanitzed when this is called
  */
	}, {
		key: 'decryptMark',
		value: function decryptMark(originalPlaintext) {
			var plaintext = originalPlaintext;
			if (this.preferences.decryptIndicator) {
				var wrapper = $('<i>').append($('<grdme_decrypt>').html(plaintext));
				plaintext = this.DECRYPTED_MARK + ' ' + wrapper.html();
			}
			return plaintext;
		}

		/** Generate a random string
   * @param length Length of the random string
  */
	}, {
		key: 'getRandomString',
		value: function getRandomString(length) {
			var randArray = new Uint32Array(length);
			var rand = '';
			window.crypto.getRandomValues(randArray);
			for (var i = 0; i < randArray.length; i++) {
				rand += String.fromCharCode(randArray[i] % 94 + 33);
			}
			return rand;
		}

		/** Check that a string ends with another substring
   * @param subject String to search through
   * @param suffix The proposed suffix of the subject
  */
	}, {
		key: '_endsWith',
		value: function _endsWith(subject, suffix) {
			return subject.indexOf(suffix, subject.length - suffix.length) !== -1;
		}

		/** Return an array of selectors and an array of css objects for children of an element
   * @param parent The parent element to search down from
  */
	}, {
		key: '_setupChildren',
		value: function _setupChildren(parent) {
			var cssArr = [];
			var elements = parent.querySelectorAll('*');
			for (var i = 0; i < elements.length; i++) {
				var css = this._getCSS(elements[i]);
				var selector = undefined;
				if (elements[i].hasAttribute('grdMeAnchor')) {
					selector = 'A';
					delete css.display;
				} else {
					selector = this._getUniqueSelector(elements[i], parent);
				}
				cssArr.push({
					selector: selector,
					css: css
				});
			}
			return cssArr;
		}

		/** Remove the attributes from all elements in html string
   * @param html String of html to strip attributes from
  */
	}, {
		key: '_clearAttributes',
		value: function _clearAttributes(html) {
			return html.replace(/<(\w+)(.|[\r\n])*?>/g, '<$1>');
		}

		/** Return an object of all CSS attributes for a given element
   * @param element The element whose CSS attributes are to be returned
  */
	}, {
		key: '_getCSS',
		value: function _getCSS(element) {
			var dest = {};
			var style = undefined;
			var prop = undefined;
			if (window.getComputedStyle) {
				style = window.getComputedStyle(element, null);
				if (style) {
					var val = undefined;
					if (style.length) {
						for (var i = 0, l = style.length; i < l; i++) {
							prop = style[i];
							val = style.getPropertyValue(prop);
							dest[prop] = val;
						}
					} else {
						for (prop in style) {
							if (style.hasOwnProperty(prop)) {
								val = style.getPropertyValue(prop) || style[prop];
								dest[prop] = val;
							}
						}
					}
					return dest;
				}
			}
			style = element.currentStyle;
			if (style) {
				for (prop in style) {
					if (style.hasOwnProperty(prop)) {
						dest[prop] = style[prop];
					}
				}
				return dest;
			}
			style = element.style;
			if (style) {
				for (prop in style) {
					if (style.hasOwnProperty(prop) && typeof style[prop] !== 'function') {
						dest[prop] = style[prop];
					}
				}
			}
			return dest;
		}

		/** Get the unique selector for qn element
   * @param elem The element for which to get the selector
   * @param stop The parent the selector should be relative to
  */
	}, {
		key: '_getUniqueSelector',
		value: function _getUniqueSelector(elem, stop) {
			var parent = elem.parentNode;
			var selector = '>' + elem.nodeName + ':nth-child(' + ($(elem).index() + 1) + ')';
			while (parent && parent !== stop) {
				selector = '>' + parent.nodeName + ':nth-child(' + ($(parent).index() + 1) + ')' + selector;
				parent = parent.parentNode;
			}
			return selector;
		}

		/** Strip html tags from string
   * @param html String of trusted html to have tags removed
  */
	}, {
		key: '_strip',
		value: function _strip(html) {
			var tmp = document.createElement('DIV');
			tmp.innerHTML = html;
			return tmp.textContent || tmp.innerText || '';
		}

		/** Sanitize a string
   * @param str String to sanitize
  */
	}, {
		key: '_sanitize',
		value: function _sanitize(str) {
			return $('<i>', { text: str }).html();
		}

		/** Get the decrypted mark */
	}, {
		key: '_getDecryptedMark',
		value: function _getDecryptedMark() {
			var container = $('<i>');
			$('<grdme>', { title: 'Decrypted with Grd Me' }).css({
				width: '15px',
				height: '16px',
				display: 'inline-block',
				backgroundRepeat: 'no-repeat',
				verticalAlign: 'middle',
				backgroundImage: 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAQCAYAAADJViUEAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAVlpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KTMInWQAAAs9JREFUKBVtU01IVFEUPve+efPmR0XT/sykSERTSXJTUakEwRhtAmsRKEW1iBCCKKhFbyot2hQu2rQJoyAjgkxTbDFGbZLQRZgK6cJIBcefZubNz3v3ns59jlbQ2VzeOec753zfOY/BmjV3a/DypKi9MdC6IrQHtkCGAJIxxn0c7VyPc27kTugNZPMUjLlYRAaMYaijb+P4smdM08VFzc7024wXFPhhwUp7W1OCXWsN6WVmY6MD2XyPCw67RTDm+Io17iyX6L7XkfaQQ7GYiu83+1/MJllbZMgqos85CIdVU+QquGZSswVNwGM5kO/6OvsM9c4neCEgFObpBjH5Y1lweN2DthA1VxrjrqOtKa3ew7v1mXwdzZRXrPrNm24Rd+wGqOcREscQiHxTfsnnR6ODVRxsZynOMtE4DE0ITQc+7ZPWU7eogtLgBEYWMZniB4u+YIunotwv0TnIPV5w5E9ILTrAdAOEdA7FM/YtSotBViMaW20EoPbeh+vp4m1XZSaBmLRskUoIKUjYDOmcTqQdIWDG8tw/0vG+/MLWL5rCuJzrWrpKU0VF7ZgTBCZRAOc6Rym9aI9zTosBoNa2SPDgie8rcnhkdr5wHXy8q2WOSTlJyyZRUfBAHujCeTXRVlfpN1gv6H5F0UFhE4b9OFYfWFgFd6NmAmRY0hpmxJOCElHSacEWleAg2wz0TYZKBy+Xn9xDoUvjDWMRtXAIRJeegWUBaJwRTxCM76zpHL4kHdwOijtR5CIDeZp8rvKh2RVczUohOs/qh8O9sqKqScSjaapoONEkJMamkBmazQIbvMF0tHvy7tFTYNJxmUwqwTB7blA2+vE0fPs6wJlhgEcHmYonkHP6M3K9/tRCT8OO6TNuV9rVv2aarvLKWRsePF/5ZCK+6/EUll5+92uPOXh2PVl1/a+pAuqPIdtn9uytuh3pOWC+rV7NJf9fDZTvN2MXRNKRmI9oAAAAAElFTkSuQmCC)'
			}).appendTo(container);
			return container.html();
		}

		/** Retrieve the user's preferences */
	}, {
		key: '_getPreferences',
		value: function _getPreferences() {
			var _this3 = this;

			if (typeof chrome === 'undefined' || !chrome.storage) {
				return;
			}
			chrome.storage.sync.get({
				decryptIndicator: true,
				emojis: true,
				sandboxDecrypt: false
			}, function (items) {
				_this3.preferences = {
					decryptIndicator: items.decryptIndicator,
					emojis: items.emojis,
					sandboxDecrypt: items.sandboxDecrypt
				};
				if (_this3.preferences.sandboxDecrypt) {
					_this3.intercept = new Intercept();
				}
			});
		}
	}]);

	return CryptoManager;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = CryptoManager;
} else {
	window.CryptoManager = CryptoManager;
}