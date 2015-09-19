/** This file handles the key management */

class KeyManager {
	/** Construct a new key manager
	 * @param port The port to communicate with the background scripts
	 * @param preferences An object contining the preferences
	 * @param uidManager A UidManager object
	 * @param popupManager A PopupManager object
	*/
	constructor(port, preferences, uidManager, popupManager) {
		this.port = port;
		this.importKeychainInterval = false;
		this.hasOthersPubKey = false;
		this.hasPrivateKey = false;
		this.pubKeyMap = {};
		this.keyChain = [];
		this.activeIndex = [];
		this.preferences = preferences;
		this.uidManager = uidManager;
		this.popupManager = popupManager;
	}

	/** Add a key to the keychain
	 * @param keyVal The key, either a string or object
	 * @param description A description of the key
	 * @param isECC Boolean indicating whether or not the key is for ECC
	 * @param showError Boolean indicating whether or not to show errors on fail
	*/
	add(keyVal, description, isECC, showError) {
		if (showError) {
			$('.error').stop(true).hide();
		}
		let key;
		try {
			key = isECC && typeof keyVal !== 'object' ? JSON.parse(keyVal) : keyVal;
		} catch (e) {
			if (keyVal[0] !== '"' && keyVal[0] !== '\'') {
				try {
					key = JSON.parse('"' + keyVal + '"');
				} catch (e) {
					if (showError) {
						$('#pubKeyError').fadeIn();
					}
					return false;
				}
			} else {
				if (showError) {
					$('#pubKeyError').fadeIn();
				}
				return false;
			}
		}
		if (!key || !description) {
			if (showError) {
				$('#description').focus();
				$('#addKeyError').fadeIn();
			}
			return false;
		}
		if (isECC) {
			if (typeof key !== 'object') {
				key = key.split(',');
				key = {
					pub: $.trim(key[0]),
					priv: key[1] ? $.trim(key[1]) : undefined,
				};
			}
			const hexRegex = /[^A-F0-9]/gi;
			const plaintext = 'Hello World';
			if (key.priv) {
				// Check that it's a valid public/private key
				try {
					const pub = key.pub.replace(hexRegex, '');
					const priv = key.priv.replace(hexRegex, '');
					const ciphertext = ecc.encrypt(pub, plaintext);
					if (plaintext !== ecc.decrypt(priv, ciphertext)) {
						throw new Error();
					}
					key = {
						pub: pub,
						priv: priv,
						published: false,
					};
				} catch (e) {
					if (showError) {
						$('#pubKeyError').fadeIn();
					}
					return false;
				}
				for (let i = 0; i < this.keyChain.length; i++) {
					if (this.keyChain[i].key.pub === key.pub &&
					   this.keyChain[i].key.priv === key.priv) {
						if (showError) {
							$('#keyExistsError').fadeIn();
						}
						return false;
					}
				}
			} else {
				try {
					key.pub = key.pub.replace(hexRegex, '');
					if (!key.pub) {
						throw new Error();
					}
					ecc.encrypt(key.pub, plaintext);
				} catch (e) {
					if (showError) {
						$('#pubKeyError').fadeIn();
					}
					return false;
				}
				key = {pub: key.pub};
				for (let i = 0; i < this.keyChain.length; i++) {
					if (this.keyChain[i].key.pub === key.pub && !this.keyChain[i].key.priv) {
						if (showError) {
							$('#keyExistsError').fadeIn();
						}
						return false;
					}
				}
			}
		} else if (key.length < 6) {
			if (showError) {
				$('#key').focus();
				$('#keyLengthError').fadeIn();
			}
			return false;
		} else {
			for (let i = 0; i < this.keyChain.length; i++) {
				if (this.keyChain[i].key === key) {
					if (showError) {
						$('#keyExistsError').fadeIn();
					}
					return false;
				}
			}
		}
		if (showError) {
			$('#key').val('').focus();
			$('#description').val('');
		}
		this.port.emit('addKey', {
			key: key,
			description: description,
		});
		return true;
	}

  /** Validate the shared keys
	 * @param data An object containing the recieved shared keys
	*/
	checkSharedKey(data) {
		/* Handle receiving keys shared with this user */
		const originalLength = data.acceptableSharedKeys.length;
		let index;
		for (let i = 0; i < data.received.length; i++) {
			try {
				const sig = JSON.parse(data.received[i].sendSig);
				if (ecc.verify(data.received[i].fromKey, sig, data.received[i].sharedKey)) {
					for (let j = 0; j < this.keyChain.length; j++) {
						if (this.keyChain[j].key.priv) {
							try {
								const key = String(ecc.decrypt(this.keyChain[j].key.priv, data.received[i].sharedKey)).slice(0, 64);
								if (key) {
									let from = '';
									for (let k = 0; k < this.keyChain.length; k++) {
										if (this.keyChain[k].key.pub === data.received[i].fromKey) {
											from = this.keyChain[k].description;
											break;
										}
									}
									data.acceptableSharedKeys.push({key: key, from: from});
									data.acceptableSharedKeys = this._uniq(data.acceptableSharedKeys);
									for (let k = 0; k < data.acceptableSharedKeys.length; k++) {
										if (data.acceptableSharedKeys[k].key === key && data.acceptableSharedKeys[k].from === from) {
											index = k;
											break;
										}
									}
									this.acknowledge({
										fromKey: data.received[i].fromKey,
										toKey: data.received[i].toKey,
										sharedKey: data.received[i].sharedKey,
										receiveSig: JSON.stringify(ecc.sign(this.keyChain[j].key.priv, data.received[i].sharedKey)),
									}, index);
								}
							} catch (e) {
								console.error('Error acknowledging shared key', e);
							}
						}
					}
				}
			} catch (e) {
				console.error('Error verifying shared key', e);
			}
		}
		// Notify user of acceptable keys
		data.acceptableSharedKeys = this._uniq(data.acceptableSharedKeys);
		if (data.acceptableSharedKeys.length !== originalLength) {
			this.port.emit('notifySharedKeys', data.acceptableSharedKeys);
			this.acceptableSharedKeysPopup(data.acceptableSharedKeys);
		}

		/* Handle receiving acknowledgements of shared keys */
		for (let i = 0; i < data.sent.length; i++) {
			try {
				const sig = JSON.parse(data.sent[i].receiveSig);
				if (ecc.verify(data.sent[i].toKey, sig, data.sent[i].sharedKey)) {
					this.port.emit('deleteSharedKeyRequest', {fromKey: data.sent[i].fromKey, sharedKey: data.sent[i].sharedKey});
				}
			} catch (e) {
				console.error('Error verifying shared key');
			}
		}
	}

	/** Layout the keys and highlight the active keys
	 * @param keyObj An object containing the user's keys
	*/
	display(keyObj) {
		const getKeyText = (key) => {
			const $return = $('<span>');
			typeof key === 'object' ?
				$return.append($('<br>'))
				.append($('<b>', {class: 'pub', text: 'pub'}))
				.append(': ' + this._sanitize(key.pub)) : $return.append(this._sanitize(key));
			key.priv ?
				$return.append($('<br>'))
				.append($('<b>', {class: 'priv', text: 'priv'}))
				.append(': ' + this._sanitize(key.priv)) : '';
			return $return.html();
		};

		const keys = keyObj.keys;
		this.keyChain = keys;
		this.pubKeyMap = {};
		this.hasPrivateKey = false;
		this.hasOthersPubKey = false;
		const $keyList = $('#keyList');
		const $newKeyList = $('<ul></ul>');
		if (keyObj.encrypted || typeof keys !== 'object') {
			this._toggleInputBlock(true);
			this.showDecryptKeyChainPopup();
			$newKeyList.append($('<li>', {text: 'Keychain is encrypted.'})
				.append($('<div>')
					.append($('<a>', {id: 'decryptKeychain', text: 'Decrypt Keychain'}))
				)
			);
			$('#encryptKeychain').parents('.flex_container').hide();
		} else {
			this._toggleInputBlock(false);
			$('#encryptKeychain').parents('.flex_container').show();
			for (let i = 0; i < keys.length; i++) {
				if (keys[i].key.pub) {
					this.hasPrivateKey = this.hasPrivateKey || !!keys[i].key.priv;
					this.hasOthersPubKey = this.hasOthersPubKey || !keys[i].key.priv;
					this.pubKeyMap[keys[i].key.pub] = true;
				}

				let actionBtn = '';
				if (typeof keys[i].key === 'object' && keys[i].key.priv && !keys[i].key.published) {
					actionBtn = $('<button>', {class: 'publish blue btn', pub: keys[i].key.pub, priv: keys[i].key.priv, text: 'Publish Public Key'});
				} else if (typeof keys[i].key === 'object' && keys[i].key.priv && keys[i].key.published) {
					actionBtn = [
						$('<button>', {class: 'revoke red btn', pub: keys[i].key.pub, priv: keys[i].key.priv, text: 'Revoke'}),
						$('<button>', {class: 'publish blue btn', pub: keys[i].key.pub, priv: keys[i].key.priv, text: 'Republish Public Key'}),
					];
				} else if (typeof keys[i].key !== 'object' && i) {
					actionBtn = $('<button>', {class: 'share blue btn', key: keys[i].key, text: 'Share Key'});
				}

				$newKeyList.append($('<li>').attr({
					index: i,
					class: this.activeIndex[i] ? 'active' : '',
				})
				.append($('<a>', {class: 'showHideKey', text: 'Show Key'}))
				.append($('<div>', {class: 'key fullToggle', text: 'Key: '})
					.append($('<span>')
						.append(getKeyText(keys[i].key))
					)
				)
				.append($('<div>', {class: 'description', text: keys[i].description})
					.append(i ? $('<i>', {class: 'pencil'}) : ''))
				.append(i ? $('<form>', {class: 'descriptionForm'})
					.append($('<input>', {placeholder: 'Description', maxlength: 50})) :
					$('<span>', {class: 'not_secure', text: '[Not Secure]'}))
				.append(i && !keys[i].key.published ? $('<div>', {class: 'delete', text: 'x'}) : '')
				.append($('<div>', {class: 'activeIndicator'}))
				.append(actionBtn));
			}
		}
		$keyList.html($newKeyList.html());
	}

	/** Acknowledge receiving a shared key
	 * @param keyObj Object of key data to send
	*/
	acknowledge(keyObj) {
		$.ajax({
			url: 'https://grd.me/key/acceptSharedKey',
			type: 'POST',
			data: keyObj,
			error: () => {
				console.error('Error acknowledging shared key received');
			},
		});
	}

	/** Panel shown. Display any acceptable shared keys
	 * @param keys Array of acceptable shared keys that need approval
	*/
	acceptableSharedKeysPopup(keys) {
		if (keys.length) {
			const list = $('<ul></ul>');
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i].key;
				list.append($('<li>')
					.append($('<form>').attr({key: key, index: i})
						.append($('<div>', {text: 'Key: ' + key}))
						.append($('<input>', {placeholder: 'Description', maxlength: 50, value: this._sanitize(keys[i].from)}))
						.append($('<button>', {class: 'blue btn', type: 'submit', text: 'Add'}))
						.append($('<button>', {class: 'red btn remove', type: 'button', text: 'Ignore'}))));
			}
			$('#acceptableSharedKeys ul').html(list.html());
			this.popupManager.open('acceptableSharedKeys');
		}
	}

	/** Open the decrypt keychain popup */
	showDecryptKeyChainPopup() {
		this.popupManager.open('decryptForm');
		$('#decryptForm input.keyChainPassword').focus();
	}

	/** Open the encrypt keychain popup
	 * @param confirm Boolean determines whether or not to show the confirm input field
	*/
	showEncryptKeyChainPopup(confirm) {
		this.popupManager.open('encryptForm');
		$('#encryptForm input.keyChainPassword').val('').focus();
		const $confirmInput = $('#encryptForm input.confirmKeyChainPassword').toggle(confirm);
		const $error = $('#encryptForm .error').stop(true).hide();
		if (confirm) {
			$error.text('Please confirm your passphrase.').fadeIn();
			$confirmInput.focus();
		}
	}

	/** Set a key to active
	 * @param indices An array of indices in the key array to set to active
	*/
	activeKeyIndex(indices) {
		this.activeIndex = indices;
		$('#keyList .active').removeClass('active');
		for (let i = 0; i < indices.length; i++) {
			if (indices[i]) {
				$('#keyList [index="' + i + '"]').addClass('active');
			}
		}
	}

	/** Generate an ECC pub/priv keypair */
	generateECCPair() {
		const keys = ecc.generate(ecc.ENC_DEC, this.preferences.curve);
		return {
			pub: keys.enc,
			priv: keys.dec,
		};
	}

	/** Merge imported keychain with existing keychain
	 * @param jsonKey Array of keys to be imported
	*/
	mergeKeychain(jsonKeys) {
		this.popupManager.close();
		const keys = JSON.parse(jsonKeys);
		for (let i = 0; i < keys.length; i++) {
			let notFound = true;
			if (!keys[i].key || !keys[i].description) {
				continue;
			}
			for (let j = 0; j < this.keyChain.length; j++) {
				if (keys[i].key === this.keyChain[j].key && (keys[i].key.priv || keys[i].description === this.keyChain[j].description)) {
					notFound = false;
					break;
				}
			}
			if (notFound) {
				this.add(keys[i].key, keys[i].description, !!keys[i].key.pub, false);
			}
		}
		this.popupManager.showFlash('importKeychainSuccess');
	}

	/** Get rid of duplicate elements in an array
	 * @param arr: Array to rid of duplicates
	*/
	_uniq(arr) {
		const seen = {};
		const out = [];
		const len = arr.length;
		let j = 0;
		for (let i = 0; i < len; i++) {
			const item = JSON.stringify(arr[i]);
			if (seen[item] !== 1) {
				seen[item] = 1;
				out[j++] = JSON.parse(item);
			}
		}
		return out;
	}

	/** Sanitize a string
	 * str: the string to sanitize
	*/
	_sanitize(str) {
		return $('<i>', {text: str}).html();
	}

	/** Toggle whether or not a user can type in main input fields
	 * @param block Boolean indicating whether or not to block input
	*/
	_toggleInputBlock(block) {
		const elems = $('#searchUID, #key, #description');
		if (block) {
			elems.attr('readonly', 'readonly').val('');
		} else {
			elems.removeAttr('readonly');
		}
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = KeyManager;
} else {
	window.KeyManager = KeyManager;
}
