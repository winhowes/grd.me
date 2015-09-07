/* This script handles communication with decrypted message iframes */

class FrameComm {
	/** Constructor for creating a new FrameComm
	 * @param port The port to communicate with the background script
	 * @param cryptoManager A CryptoManager object
	 * @param callbackWrap A function to wrap around background script callbacks
	*/
	constructor(port, cryptoManager, callbackWrap) {
		this.port = port;
		this.cryptoManager = cryptoManager;
		this.callbackWrap = callbackWrap;
		this.frameOrigin = 'https://decrypt.grd.me';
		this.FRAME_SECRET = cryptoManager.getRandomString(64);
		window.addEventListener('message', this.receiveMessage.bind(this), false);
	}

	/** Receive a message from the decrypted frames
	 * @param event An event generated by message passing
	*/
	receiveMessage(event) {
		try {
			if (event.data.from !== this.frameOrigin) {
				return;
			}
			let data = event.data.encrypted;
			data = CryptoJS.AES.decrypt(data, this.FRAME_SECRET);
			data = data.toString(CryptoJS.enc.Utf8);
			if (!data) {
				return;
			}
			data = JSON.parse(data);
			if (data.id === 'event') {
				if (data.event.type === 'click') {
					document.querySelector(data.event.selector).click();
				} else if (data.event.type === 'submit') {
					document.querySelector(data.event.selector).submit();
				} else {
					$(data.event.selector).trigger(data.event.type);
				}
			} else if (data.id === 'ready') {
				$('[grdMeUID="' + data.uid + '"]').children(':not(iframe[grdMeFrameUID="' + data.uid + '"])').hide();
				$('iframe[grdMeFrameUID="' + data.uid + '"]').show();
				this.msg(data.uid, {id: 'decryptIndicator', decryptIndicator: this.cryptoManager.preferences.decryptIndicator});
				this.msg(data.uid, {id: 'emojis', emojis: this.cryptoManager.preferences.emojis});
			} else if (data.id === 'adjustHeight') {
				$('iframe[grdMeFrameUID="' + data.uid + '"]').height(data.height);
			}	else if (data.id === 'click') {
				if (data.target === '_blank') {
					this.port.emit('newTab', data.href);
				} else {
					window.location.assign(data.href);
				}
			}	else if (data.id === 'decrypt') {
				const ciphertext = data.ciphertext;
				const callback = this.callbackWrap((originalPlaintext) => {
					let plaintext = originalPlaintext;
					if (!plaintext) {
						plaintext = this.cryptoManager.UNABLE_TO_DECRYPT + ' ' + this.cryptoManager.UNABLE_START_TAG + data.ciphertext + this.cryptoManager.UNABLE_END_TAG;
					}
					this.msg(data.uid, {id: 'decryptCallback', plaintext: plaintext, returnId: data.returnId});
				});
				if (ciphertext.charAt(0) === this.cryptoManager.NONCE_CHAR) {
					const hash = ciphertext.slice(1);
					this.port.emit('message_get', {
						hash: hash,
						callback: callback,
					});
				} else {
					this.port.emit('decrypt', {
						ciphertext: ciphertext,
						callback: callback,
					});
				}
			}
		}	catch(e) {
			console.log('INFO unable to receive and decrypt message - this usually happens when the message comes from someone other than grd me.', e);
		}
	}

	/** Send a message to a decrypted frame
	 * @param uid The uid of the frame
	 * @param data The data to send
	*/
	msg(uid, data) {
		const $frame = $('iframe[grdMeFrameUID="' + uid + '"]');
		if ($frame.get(0) &&
		   !$frame.attr('src').indexOf(this.frameOrigin) &&
		   $frame.get(0).contentWindow) {
			const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(data), this.FRAME_SECRET).toString();
			$frame.get(0).contentWindow.postMessage({
				encrypted: encryptedData,
				to: this.frameOrigin,
			}, '*');
		}
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = FrameComm;
} else {
	window.FrameComm = FrameComm;
}