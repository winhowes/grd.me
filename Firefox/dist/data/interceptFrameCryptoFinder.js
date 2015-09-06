/** This code finds and parses the ciphertext in intercepted frames */

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var InterceptCryptoHelper = (function () {
	function InterceptCryptoHelper(messenger, cryptoManager, locationObj) {
		_classCallCheck(this, InterceptCryptoHelper);

		this.messenger = messenger;
		this.cryptoManager = cryptoManager;
		this.locationObj = locationObj;
		/** Prepare a function to be called back and return its index
   * @param cb Callback function
  */
		this.callbackWrap = (function () {
			var callbackChain = [];
			$('body').on('callback', function (e, returnId, data) {
				typeof callbackChain[returnId] === 'function' && callbackChain[returnId](data);
			});

			return function (cb) {
				return callbackChain.push(cb) - 1;
			};
		})();
	}

	/** Scan for any crypto on the page and decypt if possible */

	_createClass(InterceptCryptoHelper, [{
		key: 'decryptInterval',
		value: function decryptInterval() {
			var _this = this;

			var $elements = $(':contains("' + this.cryptoManager.START_TAG + '"):not([crypto_mark="true"]):not([contenteditable="true"]):not(textarea):not(input):not(script)');
			$elements.each(function (i, e) {
				var $elem = $(e);
				if ($elem.find(':contains("' + _this.cryptoManager.START_TAG + '"):not([crypto_mark="true"])').length || $elem.parents('[contenteditable="true"]').length) {
					$elem.attr('crypto_mark', true);
					return;
				}
				_this.encryptParse($elem);
			});
		}

		/** Parse out the encrypted text and send it to be decrypted
   * @param $elem The jQuery element containing encrypted text
  */
	}, {
		key: 'encryptParse',
		value: function encryptParse($elem) {
			var _this2 = this;

			$elem.attr('crypto_mark', true);
			var text = $elem.text();
			text = text.slice(text.indexOf(this.cryptoManager.START_TAG) + this.cryptoManager.START_TAG.length);
			if (text.indexOf(this.cryptoManager.END_TAG) + 1) {
				text = text.slice(0, text.indexOf(this.cryptoManager.END_TAG));
			}
			this.messenger.send({
				id: 'decrypt',
				ciphertext: text,
				returnId: this.callbackWrap(function (plaintext) {
					var html = $elem.html();
					html = html.slice(0, html.indexOf(_this2.cryptoManager.START_TAG)) + _this2.cryptoManager.decryptMark(_this2.cryptoManager.setupPlaintext(plaintext)) + (html.indexOf(_this2.cryptoManager.END_TAG) + 1 ? html.slice(html.indexOf(_this2.cryptoManager.END_TAG) + _this2.cryptoManager.END_TAG.length) : '');
					$elem.attr('crypto_mark', '').html(html);
					_this2.fixReferences();
				})
			});
		}

		/** Fix all references **/
	}, {
		key: 'fixReferences',
		value: function fixReferences() {
			var _this3 = this;

			var fixReference = function fixReference(key) {
				return function (i, e) {
					if ($(e).attr(key).trim().indexOf('http://') && $(e).attr(key).trim().indexOf('https://')) {
						if ($(e).attr(key).trim().charAt(0) === '/') {
							$(e).attr(key, _this3.locationObj.host + $(e).attr(key));
						} else {
							$(e).attr(key, _this3.locationObj.full + $(e).attr(key));
						}
					}
				};
			};
			var refs = ['href', 'src'];
			for (var j = 0; j < refs.length; j++) {
				var key = refs[j];
				$('[' + key + ']').each(fixReference(key));
			}
			$('a[href^="http"]').css('cursor', 'pointer');
		}
	}]);

	return InterceptCryptoHelper;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = InterceptCryptoHelper;
} else {
	window.InterceptCryptoHelper = InterceptCryptoHelper;
}