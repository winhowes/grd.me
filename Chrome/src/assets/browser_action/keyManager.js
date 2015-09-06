/** This file handles the key management */

class KeyManager {
	constructor(preferences, uidManager, popupManager) {
		this.importKeychainInterval = false;
		this.hasOthersPubKey = false;
		this.hasPrivateKey = false;
		this.pubKeyMap = {};
		this.keyChain = [];
		this.preferences = preferences;
		this.uidManager = uidManager;
		this.popupManager = popupManager;
	}

	/** Publish a key to the key server
	 * @param key The key object to publish containing the pub key, a signature, and a uid
	*/
	publish(key) {
		const error = () => {
			this._publishResult({
				success: false,
				index: key.index,
			});
		};

		$.ajax({
			url: 'https://grd.me/key/add',
			type: 'POST',
			data: {
				uid: key.uid,
				pub: key.pub,
				sig: key.sig,
			},
			success: (data) => {
				if (!data || !data.status || !data.status[0] || data.status[0].code) {
					error();
					return;
				}
				uidManager.add(key.uid, () => {
					this._publishResult({success: true, index: key.index});
					chrome.storage.local.get('keys', (items) => {
						const keys = items.keys;
						keys[key.index].key.published = true;
						chrome.storage.local.set({'keys': keys}, () => {
							this.display();
						});
					});
				});
			},
			error: error,
		});
	}

	/** Revoke a key
	 * @param key The key object to publish containing the pub key, a revocation signature
	*/
	revoke(key) {
		const error = () => {
			this._revokeResult({
				success: false,
				index: key.index,
			});
		};

		$.ajax({
			url: 'https://grd.me/key/revoke',
			type: 'POST',
			data: {
				pub: key.pub,
				sig: key.sig,
			},
			success: (data) => {
				if (!data || !data.status || !data.status[0] || data.status[0].code) {
					error();
					return;
				}
				this.delete(key.index);
				this._revokeResult({
					success: true,
					index: key.index,
				});
			},
			error: error,
		});
	}

	/** Share a shared key with another user
	 * @param keyObj A key object containing the sender and receiver's public key, a signature,
	 * a random string, and the encrypted shared key
	*/
	share(keyObj) {
		const error = () => {
			this._shareResult(false);
		};

		$.ajax({
			url: 'https://grd.me/key/shareKey',
			type: 'POST',
			data: keyObj,
			success: (data) => {
				if (!data || !data.status || !data.status[0] || data.status[0].code) {
					error();
					return;
				}
				this._shareResult(true);
				chrome.storage.local.get('randomMap', (items) => {
					const randomMap = items.randomMap;
					randomMap[keyObj.sharedKey] = keyObj.rand;
					chrome.storage.local.set({
						'randomMap': randomMap,
					});
				});
			},
			error: error,
		});
	}

	/** Set various active keys
	 * @param indices The indices of the keys to be made active in the array of keys
	*/
	setActive(indices) {
		if (!indices.length) {
			return;
		}
		chrome.storage.local.get('keys', (storedKeys) => {
			const keys = storedKeys.keys;
			const activeKeys = [];
			if (!keys[indices]) {
				// This should only happen if the keychain is encrypted
				return;
			}
			for (let i = 0; i < indices.length; i++) {
				activeKeys.push(keys[indices[i]].key);
			}
			chrome.storage.local.set({'activeKeys': activeKeys});
			const workers = chrome.extension.getBackgroundPage().globals.workerManager.workers.slice(0);
			chrome.extension.getBackgroundPage().globals.keyList.activeKeys = activeKeys.slice(0);
			for (let i = 0; i < workers.length; i++) {
				workers[i].postMessage({
					id: 'secret',
					active: activeKeys,
					keys: keys,
				});
			}
		});
	}

	/** Add a new key
	 * @param keyObj A key object
	*/
	add(keyObj) {
		this.keyChain.push(keyObj);
		chrome.extension.getBackgroundPage().globals.keyList.keys.push(keyObj);
		chrome.storage.local.set({'keys': this.keyChain}, () => {
			this.display();
		});
		if (keyObj.key.priv && !keyObj.key.published) {
			$.ajax({
				url: 'https://grd.me/key/pubKeyExists',
				type: 'GET',
				data: {
					pub: keyObj.key.pub,
				},
				success: (data) => {
					if (data.exists) {
						chrome.storage.local.get('keys', (items) => {
							const keys = items.keys;
							for (let i = keys.length - 1; i >= 0; i--) {
								if (keys[i].key.pub === keyObj.key.pub &&
								   keys[i].key.priv === keyObj.key.priv &&
								   keys[i].key.published === keyObj.key.published &&
								   keys[i].description === keyObj.description) {
									keys[i].key.published = true;
									chrome.storage.local.set({'keys': keys}, () => {
										this.display();
									});
									break;
								}
							}
						});
					}
				},
			});
		}
	}

	/** Delete a key
	 * @param index The index of the key to delete in the array of keys
	*/
	delete(index) {
		chrome.storage.local.get('keys', (storedKeys) => {
			const keys = storedKeys.keys;
			keys.splice(index, 1);
			chrome.extension.getBackgroundPage().globals.keyList.keys.splice(index, 1);
			chrome.storage.local.set({'keys': keys}, () => {
				this.display();
			});
		});
	}

	/** Verify and add a key to the keychain
	 * @param keyVal The key, either a string or object
	 * @param description A string description of the key
	 * @param isECC Boolean indicating whether or not the key is for ECC
	 * @param showError Boolean indicating whether or not to show errors on fail
	*/
	verifyAndAdd(keyVal, description, isECC, showError) {
		if (showError) {
			$('.error').stop(true).hide();
		}
		let key;
		try {
			key = isECC && typeof keyVal !== 'object' ? JSON.parse(keyVal) : keyVal;
		} catch(e) {
			if (keyVal[0] !== '"' && keyVal[0] !== '\'') {
				try {
					key = JSON.parse('"' + keyVal + '"');
				} catch(err) {
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
				/* Check that it's a valid public/private key */
				let pub;
				let priv;
				try {
					pub = key.pub.replace(hexRegex, '');
					priv = key.priv.replace(hexRegex, '');
					const ciphertext = ecc.encrypt(pub, plaintext);
					if (plaintext !== ecc.decrypt(priv, ciphertext)) {
						throw new Error();
					}
				} catch(e) {
					if (showError) {
						$('#pubKeyError').fadeIn();
					}
					return false;
				}
				key = {
					pub: pub,
					priv: priv,
					published: false,
				};
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
				} catch(e) {
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
		this.add({
			key: key,
			description: description,
		});
		return true;
	}

	/** Layout the keys and highlight the active keys */
	display() {
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

		this.pubKeyMap = {};
		chrome.storage.local.get(['keys', 'encrypted'], (items) => {
			const keys = items.keys;
			this.keyChain = keys;
			const keyList = $('#keyList');
			const newKeyList = $('<ul></ul>');
			if (items.encrypted || typeof keys !== 'object') {
				this._toggleInputBlock(true);
				this.showDecryptKeyChainPopup();
				newKeyList.append($('<li>', {text: 'Keychain is encrypted.'})
					.append($('<div>')
						.append($('<a>', {id: 'decryptKeychain', text: 'Decrypt Keychain'}))
					)
				);
				$('#encryptKeychain').parents('.flex_container').hide();
				keyList.html(newKeyList.html());
			} else {
				this._toggleInputBlock(false);
				$('#encryptKeychain').parents('.flex_container').show();
				for (let i = 0; i < keys.length; i++) {
					if (keys[i].key.pub) {
						this.hasPrivateKey = this.hasPrivateKey || !!keys[i].key.priv;
						this.hasOthersPubKey = this.hasOthersPubKey || !keys[i].key.priv;
						this.pubKeyMap[keys[i].key.pub] = true;
					}

					/* Add the appropriate buttons (revoke, publish, share) */
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

					newKeyList.append($('<li>').attr({
						index: i,
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
				keyList.html(newKeyList.html());
				chrome.storage.local.get('activeKeys', (storedActiveKeys) => {
					const activeKeys = storedActiveKeys.activeKeys;
					for (let i = 0; i < activeKeys.length; i++) {
						for (let j = 0; j < keys.length; j++) {
							if (JSON.stringify(activeKeys[i]) === JSON.stringify(keys[j].key)) {
								$('#keyList [index="' + j + '"]').addClass('active');
								break;
							}
						}
					}
				});
			}
		});
	}

	/** Update a key's description
	 * @param index The index of the key to have its description updated
	 * @param description The updated description
	*/
	updateDescription(index, description) {
		chrome.storage.local.get('keys', (storedKeys) => {
			const keys = storedKeys.keys;
			keys[index].description = description;
			chrome.extension.getBackgroundPage().globals.keyList.keys[index].description = description;
			chrome.storage.local.set({
				'keys': keys,
			});
		});
	}

	/** Generate an ECC pub/priv keypair */
	generateECCPair() {
		const keys = ecc.generate(ecc.ENC_DEC, this.preferences.curve);
		return {
			pub: keys.enc,
			priv: keys.dec,
		};
	}

	/** Encrypt the keychain
	 * @param passwordObj An object containing the encryption password, the last hash of the last password used, and a confirmation of the password
	*/
	encryptKeychain(passwordObj) {
		const password = passwordObj.pass;
		const confirm = passwordObj.confirm;
		const hash = passwordObj.hash;
		if (!password) {
			return;
		}
		chrome.storage.local.get('lastPass', (items) => {
			let lastPass = items.lastPass;
			if (!confirm && hash !== lastPass) {
				this._confirmKeyChainPassword(password);
				return;
			} else if (confirm) {
				if (confirm !== password) {
					return;
				}
				lastPass = hash;
			}
			chrome.storage.local.set({
				'keys': CryptoJS.AES.encrypt(JSON.stringify(this.keyChain), password).toString(),
				'encryptedKeys': true,
				'lastPass': lastPass,
				'activeKeys': [],
			}, () => {
				chrome.extension.getBackgroundPage().globals.refreshKeyList(() => {
					this.display();
				});
			});
		});
	}

	/** Decrypt the keychain
	 * @param password The decryption password
	*/
	decryptKeychain(password) {
		if (!password) {
			return;
		}
		let plaintext = CryptoJS.AES.decrypt(this.keyChain, password);
		try {
			plaintext = plaintext.toString(CryptoJS.enc.Utf8);
			if (!plaintext) {
				throw new Error();
			}
			chrome.storage.local.set({
				'keys': JSON.parse(plaintext),
				'encryptedKeys': false,
			}, () => {
				chrome.extension.getBackgroundPage().globals.refreshKeyList(() => {
					this.display();
				});
			});
		} catch(e) {
			this.display();
		}
	}

	/** Decrypt the imported keychain
	 * @param passwordObj Object containing the text to be decrypted and the password to decrypt with
	*/
	decryptImportKeychain(passwordObj) {
		const password = passwordObj.pass;
		try {
			const text = JSON.parse(passwordObj.text);
			let plaintext = CryptoJS.AES.decrypt(text.file, password);
			plaintext = plaintext.toString(CryptoJS.enc.Utf8);
			if (!plaintext) {
				throw new Error();
			}
			this.verifyMergeImportKeychain(JSON.stringify({
				encrypted: false,
				file: plaintext,
			}));
		} catch(e) {
			this.importKeychainError();
		}
	}

	/** Import a keychain
	 * @param type Either 'clipboard', 'open' (for import file window), or 'file' for file import
	*/
	importKeychain(type) {
		const readImportedFile = () => {
			if (fileChooser.files.length) {
				const file = fileChooser.files[0];
				const reader = new FileReader();

				reader.onload = (() => {
					return () => {
						if (reader.result) {
							this.verifyMergeImportKeychain(reader.result);
						} else {
							this.importKeychainError();
						}
					};
				})();

				reader.readAsText(file);
			}
			fileChooser.remove();
		};

		switch (type) {
		case 'clipboard':
			this.verifyMergeImportKeychain(chrome.extension.getBackgroundPage().globals.clipboard.get());
			break;
		case 'open':
			chrome.tabs.create({'url': chrome.extension.getURL('/assets/browser_action/upload.html')});
			break;
		case 'file':
		default:
			const fileChooser = document.createElement('input');
			fileChooser.type = 'file';
			fileChooser.value = '';
			fileChooser.addEventListener('change', () => {
				clearInterval(this.importKeychainInterval);
				readImportedFile();
			}, false);
			fileChooser.click();

			this.importKeychainInterval = setInterval(() => {
				if (fileChooser.files.length) {
					clearInterval(this.importKeychainInterval);
					readImportedFile();
				}
			}, 2000);
			break;
		}
	}

	/** Open the import password window
	 * @param text Text string to be decrypted
	*/
	getImportPassword(text) {
		this.popupManager.close();
		this.popupManager.open('importKeychainPassword');
		$('#importKeychainPassword .keyChainPassword').focus();
		$('#importKeychainPassword input[type="hidden"]').val(text);
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
				this.verifyAndAdd(keys[i].key, keys[i].description, !!keys[i].key.pub, false);
			}
		}
		this.popupManager.showFlash('importKeychainSuccess');
	}

	/** Verify imported keychain is an actual keychain and merge it
	 * @param jsonText JSON stringified keychain to be imported
	*/
	verifyMergeImportKeychain(jsonText) {
		try {
			const text = JSON.parse(jsonText);
			if (!text) {
				throw new Error();
			}
			if (text.encrypted) {
				this.getImportPassword(JSON.stringify(text));
			} else if (text.file) {
				this.mergeKeychain(text.file);
			} else {
				throw new Error();
			}
		} catch(e) {
			console.error('Error importing keychain: ', e);
			this.importKeychainError();
		}
	}

	/** Show a import keychain error */
	importKeychainError() {
		this.popupManager.close();
		this.popupManager.showFlash('importKeychainError');
	}

	/** Export the keychain
	 * @param passwordObj Object containing the type of export and the password to export under
	*/
	exportKeychain(passwordObj) {
		const password = passwordObj.pass;
		const jsonKeys = JSON.stringify(this.keyChain);
		const exported = JSON.stringify({
			encrypted: !!password,
			file: password ? CryptoJS.AES.encrypt(jsonKeys, password).toString() : jsonKeys,
		});
		switch (passwordObj.type) {
		case 'clipboard':
			chrome.extension.getBackgroundPage().globals.clipboard.set(exported);
			this.popupManager.showFlash('exportCopied');
			break;
		case 'file':
		default:
			window.URL = window.URL || window.webkitURL;
			const file = new Blob([exported], {type: 'application/json'});
			const a = document.createElement('a');
			a.href = window.URL.createObjectURL(file);
			a.download = 'Grd Me Keychain.json';
			document.body.appendChild(a);
			a.click();
			a.remove();
			this.popupManager.showFlash('exportCreated');
			break;
		}
	}

	/** Open the encrypt keychain popup
	 * confirm: if true, will show the confirm input, otherwise hides it
	*/
	showEncryptKeyChainPopup(confirm) {
		this.popupManager.open('encryptForm');
		$('#encryptForm input.keyChainPassword').val('').focus();
		const confirmInput = $('#encryptForm input.confirmKeyChainPassword').toggle(confirm);
		const error = $('#encryptForm .error').stop(true).hide();
		if (confirm) {
			error.text('Please confirm your passphrase.').fadeIn();
			confirmInput.focus();
		}
	}

	/** Open the decrypt keychain popup */
	showDecryptKeyChainPopup() {
		this.popupManager.open('decryptForm');
		$('#decryptForm input.keyChainPassword').focus();
	}

	/** Get rid of duplicate elements in an array
	 * @param arr The array to rid of duplicates
	*/
	_uniq(arr) {
		const seen = {};
		const out = [];
		const len = arr.length;
		let j = 0;
		for (let i = 0; i < len; i++) {
			const item = arr[i];
			if (seen[item] !== 1) {
				seen[item] = 1;
				out[j++] = item;
			}
		}
		return out;
	}

	/** Ask the user to confirm their password
	 * @param pass The value they entered as their password
	*/
	_confirmKeyChainPassword(pass) {
		this.showEncryptKeyChainPopup(true);
		$('#encryptForm input.keyChainPassword').val(pass);
	}

	/** Indicate whether a key was published or failed to publish
	 * @param obj Object containing a success boolean property and an index property when success is
	 * false of the index of the published key
	*/
	_publishResult(obj) {
		const id = obj.success ? 'publishSuccess' : 'publishFail';
		if (!obj.success) {
			$('#keyList').find('li[index="' + obj.index + '"]').find('.publish').removeClass('disabled').prop('disabled', false);
		}
		this.popupManager.showFlash(id);
	}

	/** Indicate whether a key was revoked or failed to be revoked
	 * @param obj Object containing a success boolean property and an index property when success is
	 * false of the index of the revoked key
	*/
	_revokeResult(obj) {
		const id = obj.success ? 'revokeSuccess' : 'revokeFail';
		if (!obj.success) {
			$('#keyList').find('li[index="' + obj.index + '"]').find('.revoke').removeClass('disabled').prop('disabled', false);
		}
		this.popupManager.showFlash(id);
	}

	/** Indicate whether a key was shared or failed to be shared
	 * @param success Boolean indicating whether or not the share was successful
	*/
	_shareResult(success) {
		const id = success ? 'shareKeySuccess' : 'shareKeyFail';
		this.popupManager.showFlash(id);
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
