/** This code finds and parses the ciphertext in intercepted frames */

class InterceptCryptoHelper {
	constructor(messenger, cryptoManager, locationObj) {
		this.messenger = messenger;
		this.cryptoManager = cryptoManager;
		this.locationObj = locationObj;
		/** Prepare a function to be called back and return its index
		 * @param cb Callback function
		*/
		this.callbackWrap = (() => {
			const callbackChain = [];
			$('body').on('callback', (e, returnId, data) => {
				(typeof callbackChain[returnId] === 'function') && callbackChain[returnId](data);
			});

			return (cb) => {
				return callbackChain.push(cb) - 1;
			};
		}());
	}

	/** Scan for any crypto on the page and decypt if possible */
	decryptInterval() {
		const elements = $(':contains("' + this.cryptoManager.START_TAG + '"):not([crypto_mark="true"]):not([contenteditable="true"]):not(textarea):not(input):not(script)');
		elements.each((i, e) => {
			const elem = $(e);
			if (elem.find(':contains("' + this.cryptoManager.START_TAG + '"):not([crypto_mark="true"])').length || elem.parents('[contenteditable="true"]').length) {
				elem.attr('crypto_mark', true);
				return;
			}
			this.encryptParse(elem);
		});
	}

	/** Parse out the encrypted text and send it to be decrypted
	 * @param elem The element containing encrypted text
	*/
	encryptParse(elem) {
		elem.attr('crypto_mark', true);
		let text = elem.text();
		text = text.slice(text.indexOf(this.cryptoManager.START_TAG) + this.cryptoManager.START_TAG.length);
		if (text.indexOf(this.cryptoManager.END_TAG) + 1) {
			text = text.slice(0, text.indexOf(this.cryptoManager.END_TAG));
		}
		this.messenger.send({
			id: 'decrypt',
			ciphertext: text,
			returnId: this.callbackWrap((plaintext) => {
				let html = elem.html();
				html = html.slice(0, html.indexOf(this.cryptoManager.START_TAG)) + this.cryptoManager.decryptMark(this.cryptoManager.setupPlaintext(plaintext)) + (html.indexOf(this.cryptoManager.END_TAG) + 1 ? html.slice(html.indexOf(this.cryptoManager.END_TAG) + this.cryptoManager.END_TAG.length) : '');
				elem.attr('crypto_mark', '').html(html);
				this.fixReferences();
			}),
		});
	}

	/** Fix all references **/
	fixReferences() {
		const fixReference = (key) => {
			return (i, e) => {
				if ($(e).attr(key).trim().indexOf('http://') && $(e).attr(key).trim().indexOf('https://')) {
					if ($(e).attr(key).trim().charAt(0) === '/') {
						$(e).attr(key, this.locationObj.host + $(e).attr(key));
					} else {
						$(e).attr(key, this.locationObj.full + $(e).attr(key));
					}
				}
			};
		};
		const refs = ['href', 'src'];
		for (let j = 0; j < refs.length; j++) {
			const key = refs[j];
			$('[' + key + ']').each(fixReference(key));
		}
		$('a[href^="http"]').css('cursor', 'pointer');
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = InterceptCryptoHelper;
} else {
	window.InterceptCryptoHelper = InterceptCryptoHelper;
}
