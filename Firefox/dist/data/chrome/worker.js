/** This file handles cryptographic verification and decryption */
'use strict';

(function () {
	importScripts('../lib/sha256.js', '../lib/ecc.js', '../lib/aes.js');

	var cryptoUtil = (function () {
		// TODO: these are duplicated from the crypto manager. Centralize them
		var START_TAG = '~~grdme~~';
		var END_TAG = '~~!grdme~~';
		var UNABLE_TO_DECRYPT = '[Unable to decrypt message]';
		var UNABLE_START_TAG = '[start tag]';
		/** Decrypt ciphertext with all available keys. Returns false if no decryption possible
   * @param originalCiphertext The text excluding the crypto tags to decrypt
   * @param keyList Array of all key objects
  */
		function decryptText(originalCiphertext, keyList) {
			var ciphertext = originalCiphertext;
			ciphertext = ciphertext.replace(/\)/g, '+').replace(/\(/g, '/');
			ciphertext = ciphertext.split('|');
			var plaintext = '';
			for (var i = 0; i < ciphertext.length; i++) {
				for (var j = 0; j < keyList.length; j++) {
					try {
						if (typeof keyList[j].key === 'object' && keyList[j].key.priv) {
							plaintext = ecc.decrypt(keyList[j].key.priv, ciphertext[i]);
						} else {
							plaintext = CryptoJS.AES.decrypt(ciphertext[i], keyList[j].key);
							plaintext = plaintext.toString(CryptoJS.enc.Utf8);
						}
						if (plaintext.trim().length) {
							return plaintext;
						}
					} catch (e) {
						console.log('INFO failed to decrypt with given key', e);
					}
				}
			}
			return false;
		}

		/** When an endTag is detected, reset the the decryption so it can be properly re-decrypted
   * @param elemText The element's current text
   * @param returnObj Object returned from a decryption
   * @param keyList The current list of keys
  */
		function recheckDecryption(elemText, returnObj, keyList) {
			while (returnObj.plaintext.indexOf(START_TAG) + 1 && returnObj.plaintext.indexOf(END_TAG) + 1) {
				var pre = returnObj.plaintext.substring(0, returnObj.plaintext.indexOf(START_TAG));
				var ciphertext = returnObj.plaintext.substring(returnObj.plaintext.indexOf(START_TAG) + START_TAG.length, returnObj.plaintext.indexOf(END_TAG));
				var post = returnObj.plaintext.substring(returnObj.plaintext.indexOf(END_TAG) + END_TAG.length);
				returnObj.plaintext = pre + decryptText(ciphertext, keyList) + post;
			}
			var text = elemText;
			if (returnObj.plaintext.length) {
				returnObj.plaintext = returnObj.plaintext.trimLeft();
				text = text.trimLeft();
				var index = Math.max(text.indexOf(returnObj.plaintext), 0);
				return text.substring(0, index) + START_TAG + returnObj.ciphertext.trim() + text.substring(index + returnObj.plaintext.length).trimLeft();
			}
			return text.replace(UNABLE_TO_DECRYPT + ' ' + UNABLE_START_TAG, START_TAG);
		}

		/** Verify and decrypt a shortMessage
   * @param data Object containing the messages, random nonce's, the hash and the keyList
  */
		function verifyShortMessage(data) {
			var plaintext = false;
			for (var i = 0; i < data.messages.length; i++) {
				plaintext = decryptText(data.messages[i].message, data.keyList);
				if (new CryptoJS.SHA256(data.messages[i].message + data.messages[i].rand).toString().slice(0, 60) === data.hash && plaintext) {
					return plaintext;
				}
			}
			return false;
		}

		return {
			decrypt: decryptText,
			recheck: recheckDecryption,
			verify: verifyShortMessage
		};
	})();

	onmessage = function (e) {
		var eData = JSON.parse(e.data);
		var result = undefined;
		if (eData.id === 'verifyShortMessage') {
			result = cryptoUtil.verify(eData.data);
		} else if (eData.id === 'decrypt') {
			result = cryptoUtil.decrypt(eData.data.ciphertext, eData.data.keyList);
		} else if (eData.id === 'recheckDecryption') {
			result = cryptoUtil.recheck(eData.data.text, eData.data.returnObj, eData.data.keyList);
		}
		postMessage(JSON.stringify({
			index: eData.data.callback,
			data: result
		}));
	};
})();