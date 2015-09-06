/** This file handles the key management */

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var KeyManager = (function () {
	function KeyManager(preferences, uidManager, popupManager) {
		_classCallCheck(this, KeyManager);

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

	_createClass(KeyManager, [{
		key: 'publish',
		value: function publish(key) {
			var _this = this;

			var error = function error() {
				_this._publishResult({
					success: false,
					index: key.index
				});
			};

			$.ajax({
				url: 'https://grd.me/key/add',
				type: 'POST',
				data: {
					uid: key.uid,
					pub: key.pub,
					sig: key.sig
				},
				success: function success(data) {
					if (!data || !data.status || !data.status[0] || data.status[0].code) {
						error();
						return;
					}
					uidManager.add(key.uid, function () {
						_this._publishResult({ success: true, index: key.index });
						chrome.storage.local.get('keys', function (items) {
							var keys = items.keys;
							keys[key.index].key.published = true;
							chrome.storage.local.set({ 'keys': keys }, function () {
								_this.display();
							});
						});
					});
				},
				error: error
			});
		}

		/** Revoke a key
   * @param key The key object to publish containing the pub key, a revocation signature
  */
	}, {
		key: 'revoke',
		value: function revoke(key) {
			var _this2 = this;

			var error = function error() {
				_this2._revokeResult({
					success: false,
					index: key.index
				});
			};

			$.ajax({
				url: 'https://grd.me/key/revoke',
				type: 'POST',
				data: {
					pub: key.pub,
					sig: key.sig
				},
				success: function success(data) {
					if (!data || !data.status || !data.status[0] || data.status[0].code) {
						error();
						return;
					}
					_this2['delete'](key.index);
					_this2._revokeResult({
						success: true,
						index: key.index
					});
				},
				error: error
			});
		}

		/** Share a shared key with another user
   * @param keyObj A key object containing the sender and receiver's public key, a signature,
   * a random string, and the encrypted shared key
  */
	}, {
		key: 'share',
		value: function share(keyObj) {
			var _this3 = this;

			var error = function error() {
				_this3._shareResult(false);
			};

			$.ajax({
				url: 'https://grd.me/key/shareKey',
				type: 'POST',
				data: keyObj,
				success: function success(data) {
					if (!data || !data.status || !data.status[0] || data.status[0].code) {
						error();
						return;
					}
					_this3._shareResult(true);
					chrome.storage.local.get('randomMap', function (items) {
						var randomMap = items.randomMap;
						randomMap[keyObj.sharedKey] = keyObj.rand;
						chrome.storage.local.set({
							'randomMap': randomMap
						});
					});
				},
				error: error
			});
		}

		/** Set various active keys
   * @param indices The indices of the keys to be made active in the array of keys
  */
	}, {
		key: 'setActive',
		value: function setActive(indices) {
			if (!indices.length) {
				return;
			}
			chrome.storage.local.get('keys', function (storedKeys) {
				var keys = storedKeys.keys;
				var activeKeys = [];
				if (!keys[indices]) {
					// This should only happen if the keychain is encrypted
					return;
				}
				for (var i = 0; i < indices.length; i++) {
					activeKeys.push(keys[indices[i]].key);
				}
				chrome.storage.local.set({ 'activeKeys': activeKeys });
				var workers = chrome.extension.getBackgroundPage().globals.workerManager.workers.slice(0);
				chrome.extension.getBackgroundPage().globals.keyList.activeKeys = activeKeys.slice(0);
				for (var i = 0; i < workers.length; i++) {
					workers[i].postMessage({
						id: 'secret',
						active: activeKeys,
						keys: keys
					});
				}
			});
		}

		/** Add a new key
   * @param keyObj A key object
  */
	}, {
		key: 'add',
		value: function add(keyObj) {
			var _this4 = this;

			this.keyChain.push(keyObj);
			chrome.extension.getBackgroundPage().globals.keyList.keys.push(keyObj);
			chrome.storage.local.set({ 'keys': this.keyChain }, function () {
				_this4.display();
			});
			if (keyObj.key.priv && !keyObj.key.published) {
				$.ajax({
					url: 'https://grd.me/key/pubKeyExists',
					type: 'GET',
					data: {
						pub: keyObj.key.pub
					},
					success: function success(data) {
						if (data.exists) {
							chrome.storage.local.get('keys', function (items) {
								var keys = items.keys;
								for (var i = keys.length - 1; i >= 0; i--) {
									if (keys[i].key.pub === keyObj.key.pub && keys[i].key.priv === keyObj.key.priv && keys[i].key.published === keyObj.key.published && keys[i].description === keyObj.description) {
										keys[i].key.published = true;
										chrome.storage.local.set({ 'keys': keys }, function () {
											_this4.display();
										});
										break;
									}
								}
							});
						}
					}
				});
			}
		}

		/** Delete a key
   * @param index The index of the key to delete in the array of keys
  */
	}, {
		key: 'delete',
		value: function _delete(index) {
			var _this5 = this;

			chrome.storage.local.get('keys', function (storedKeys) {
				var keys = storedKeys.keys;
				keys.splice(index, 1);
				chrome.extension.getBackgroundPage().globals.keyList.keys.splice(index, 1);
				chrome.storage.local.set({ 'keys': keys }, function () {
					_this5.display();
				});
			});
		}

		/** Verify and add a key to the keychain
   * @param keyVal The key, either a string or object
   * @param description A string description of the key
   * @param isECC Boolean indicating whether or not the key is for ECC
   * @param showError Boolean indicating whether or not to show errors on fail
  */
	}, {
		key: 'verifyAndAdd',
		value: function verifyAndAdd(keyVal, description, isECC, showError) {
			if (showError) {
				$('.error').stop(true).hide();
			}
			var key = undefined;
			try {
				key = isECC && typeof keyVal !== 'object' ? JSON.parse(keyVal) : keyVal;
			} catch (e) {
				if (keyVal[0] !== '"' && keyVal[0] !== '\'') {
					try {
						key = JSON.parse('"' + keyVal + '"');
					} catch (err) {
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
						priv: key[1] ? $.trim(key[1]) : undefined
					};
				}
				var hexRegex = /[^A-F0-9]/gi;
				var plaintext = 'Hello World';
				if (key.priv) {
					/* Check that it's a valid public/private key */
					var pub = undefined;
					var priv = undefined;
					try {
						pub = key.pub.replace(hexRegex, '');
						priv = key.priv.replace(hexRegex, '');
						var ciphertext = ecc.encrypt(pub, plaintext);
						if (plaintext !== ecc.decrypt(priv, ciphertext)) {
							throw new Error();
						}
					} catch (e) {
						if (showError) {
							$('#pubKeyError').fadeIn();
						}
						return false;
					}
					key = {
						pub: pub,
						priv: priv,
						published: false
					};
					for (var i = 0; i < this.keyChain.length; i++) {
						if (this.keyChain[i].key.pub === key.pub && this.keyChain[i].key.priv === key.priv) {
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
					key = { pub: key.pub };
					for (var i = 0; i < this.keyChain.length; i++) {
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
				for (var i = 0; i < this.keyChain.length; i++) {
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
				description: description
			});
			return true;
		}

		/** Layout the keys and highlight the active keys */
	}, {
		key: 'display',
		value: function display() {
			var _this6 = this;

			var getKeyText = function getKeyText(key) {
				var $return = $('<span>');
				typeof key === 'object' ? $return.append($('<br>')).append($('<b>', { 'class': 'pub', text: 'pub' })).append(': ' + _this6._sanitize(key.pub)) : $return.append(_this6._sanitize(key));
				key.priv ? $return.append($('<br>')).append($('<b>', { 'class': 'priv', text: 'priv' })).append(': ' + _this6._sanitize(key.priv)) : '';
				return $return.html();
			};

			this.pubKeyMap = {};
			chrome.storage.local.get(['keys', 'encrypted'], function (items) {
				var keys = items.keys;
				_this6.keyChain = keys;
				var keyList = $('#keyList');
				var newKeyList = $('<ul></ul>');
				if (items.encrypted || typeof keys !== 'object') {
					_this6._toggleInputBlock(true);
					_this6.showDecryptKeyChainPopup();
					newKeyList.append($('<li>', { text: 'Keychain is encrypted.' }).append($('<div>').append($('<a>', { id: 'decryptKeychain', text: 'Decrypt Keychain' }))));
					$('#encryptKeychain').parents('.flex_container').hide();
					keyList.html(newKeyList.html());
				} else {
					_this6._toggleInputBlock(false);
					$('#encryptKeychain').parents('.flex_container').show();
					for (var i = 0; i < keys.length; i++) {
						if (keys[i].key.pub) {
							_this6.hasPrivateKey = _this6.hasPrivateKey || !!keys[i].key.priv;
							_this6.hasOthersPubKey = _this6.hasOthersPubKey || !keys[i].key.priv;
							_this6.pubKeyMap[keys[i].key.pub] = true;
						}

						/* Add the appropriate buttons (revoke, publish, share) */
						var actionBtn = '';
						if (typeof keys[i].key === 'object' && keys[i].key.priv && !keys[i].key.published) {
							actionBtn = $('<button>', { 'class': 'publish blue btn', pub: keys[i].key.pub, priv: keys[i].key.priv, text: 'Publish Public Key' });
						} else if (typeof keys[i].key === 'object' && keys[i].key.priv && keys[i].key.published) {
							actionBtn = [$('<button>', { 'class': 'revoke red btn', pub: keys[i].key.pub, priv: keys[i].key.priv, text: 'Revoke' }), $('<button>', { 'class': 'publish blue btn', pub: keys[i].key.pub, priv: keys[i].key.priv, text: 'Republish Public Key' })];
						} else if (typeof keys[i].key !== 'object' && i) {
							actionBtn = $('<button>', { 'class': 'share blue btn', key: keys[i].key, text: 'Share Key' });
						}

						newKeyList.append($('<li>').attr({
							index: i
						}).append($('<a>', { 'class': 'showHideKey', text: 'Show Key' })).append($('<div>', { 'class': 'key fullToggle', text: 'Key: ' }).append($('<span>').append(getKeyText(keys[i].key)))).append($('<div>', { 'class': 'description', text: keys[i].description }).append(i ? $('<i>', { 'class': 'pencil' }) : '')).append(i ? $('<form>', { 'class': 'descriptionForm' }).append($('<input>', { placeholder: 'Description', maxlength: 50 })) : $('<span>', { 'class': 'not_secure', text: '[Not Secure]' })).append(i && !keys[i].key.published ? $('<div>', { 'class': 'delete', text: 'x' }) : '').append($('<div>', { 'class': 'activeIndicator' })).append(actionBtn));
					}
					keyList.html(newKeyList.html());
					chrome.storage.local.get('activeKeys', function (storedActiveKeys) {
						var activeKeys = storedActiveKeys.activeKeys;
						for (var i = 0; i < activeKeys.length; i++) {
							for (var j = 0; j < keys.length; j++) {
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
	}, {
		key: 'updateDescription',
		value: function updateDescription(index, description) {
			chrome.storage.local.get('keys', function (storedKeys) {
				var keys = storedKeys.keys;
				keys[index].description = description;
				chrome.extension.getBackgroundPage().globals.keyList.keys[index].description = description;
				chrome.storage.local.set({
					'keys': keys
				});
			});
		}

		/** Generate an ECC pub/priv keypair */
	}, {
		key: 'generateECCPair',
		value: function generateECCPair() {
			var keys = ecc.generate(ecc.ENC_DEC, this.preferences.curve);
			return {
				pub: keys.enc,
				priv: keys.dec
			};
		}

		/** Encrypt the keychain
   * @param passwordObj An object containing the encryption password, the last hash of the last password used, and a confirmation of the password
  */
	}, {
		key: 'encryptKeychain',
		value: function encryptKeychain(passwordObj) {
			var _this7 = this;

			var password = passwordObj.pass;
			var confirm = passwordObj.confirm;
			var hash = passwordObj.hash;
			if (!password) {
				return;
			}
			chrome.storage.local.get('lastPass', function (items) {
				var lastPass = items.lastPass;
				if (!confirm && hash !== lastPass) {
					_this7._confirmKeyChainPassword(password);
					return;
				} else if (confirm) {
					if (confirm !== password) {
						return;
					}
					lastPass = hash;
				}
				chrome.storage.local.set({
					'keys': CryptoJS.AES.encrypt(JSON.stringify(_this7.keyChain), password).toString(),
					'encryptedKeys': true,
					'lastPass': lastPass,
					'activeKeys': []
				}, function () {
					chrome.extension.getBackgroundPage().globals.refreshKeyList(function () {
						_this7.display();
					});
				});
			});
		}

		/** Decrypt the keychain
   * @param password The decryption password
  */
	}, {
		key: 'decryptKeychain',
		value: function decryptKeychain(password) {
			var _this8 = this;

			if (!password) {
				return;
			}
			var plaintext = CryptoJS.AES.decrypt(this.keyChain, password);
			try {
				plaintext = plaintext.toString(CryptoJS.enc.Utf8);
				if (!plaintext) {
					throw new Error();
				}
				chrome.storage.local.set({
					'keys': JSON.parse(plaintext),
					'encryptedKeys': false
				}, function () {
					chrome.extension.getBackgroundPage().globals.refreshKeyList(function () {
						_this8.display();
					});
				});
			} catch (e) {
				this.display();
			}
		}

		/** Decrypt the imported keychain
   * @param passwordObj Object containing the text to be decrypted and the password to decrypt with
  */
	}, {
		key: 'decryptImportKeychain',
		value: function decryptImportKeychain(passwordObj) {
			var password = passwordObj.pass;
			try {
				var text = JSON.parse(passwordObj.text);
				var plaintext = CryptoJS.AES.decrypt(text.file, password);
				plaintext = plaintext.toString(CryptoJS.enc.Utf8);
				if (!plaintext) {
					throw new Error();
				}
				this.verifyMergeImportKeychain(JSON.stringify({
					encrypted: false,
					file: plaintext
				}));
			} catch (e) {
				this.importKeychainError();
			}
		}

		/** Import a keychain
   * @param type Either 'clipboard', 'open' (for import file window), or 'file' for file import
  */
	}, {
		key: 'importKeychain',
		value: function importKeychain(type) {
			var _this9 = this;

			var readImportedFile = function readImportedFile() {
				if (fileChooser.files.length) {
					(function () {
						var file = fileChooser.files[0];
						var reader = new FileReader();

						reader.onload = (function () {
							return function () {
								if (reader.result) {
									_this9.verifyMergeImportKeychain(reader.result);
								} else {
									_this9.importKeychainError();
								}
							};
						})();

						reader.readAsText(file);
					})();
				}
				fileChooser.remove();
			};

			switch (type) {
				case 'clipboard':
					this.verifyMergeImportKeychain(chrome.extension.getBackgroundPage().globals.clipboard.get());
					break;
				case 'open':
					chrome.tabs.create({ 'url': chrome.extension.getURL('/assets/browser_action/upload.html') });
					break;
				case 'file':
				default:
					var fileChooser = document.createElement('input');
					fileChooser.type = 'file';
					fileChooser.value = '';
					fileChooser.addEventListener('change', function () {
						clearInterval(_this9.importKeychainInterval);
						readImportedFile();
					}, false);
					fileChooser.click();

					this.importKeychainInterval = setInterval(function () {
						if (fileChooser.files.length) {
							clearInterval(_this9.importKeychainInterval);
							readImportedFile();
						}
					}, 2000);
					break;
			}
		}

		/** Open the import password window
   * @param text Text string to be decrypted
  */
	}, {
		key: 'getImportPassword',
		value: function getImportPassword(text) {
			this.popupManager.close();
			this.popupManager.open('importKeychainPassword');
			$('#importKeychainPassword .keyChainPassword').focus();
			$('#importKeychainPassword input[type="hidden"]').val(text);
		}

		/** Merge imported keychain with existing keychain
   * @param jsonKey Array of keys to be imported
  */
	}, {
		key: 'mergeKeychain',
		value: function mergeKeychain(jsonKeys) {
			this.popupManager.close();
			var keys = JSON.parse(jsonKeys);
			for (var i = 0; i < keys.length; i++) {
				var notFound = true;
				if (!keys[i].key || !keys[i].description) {
					continue;
				}
				for (var j = 0; j < this.keyChain.length; j++) {
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
	}, {
		key: 'verifyMergeImportKeychain',
		value: function verifyMergeImportKeychain(jsonText) {
			try {
				var text = JSON.parse(jsonText);
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
			} catch (e) {
				console.error('Error importing keychain: ', e);
				this.importKeychainError();
			}
		}

		/** Show a import keychain error */
	}, {
		key: 'importKeychainError',
		value: function importKeychainError() {
			this.popupManager.close();
			this.popupManager.showFlash('importKeychainError');
		}

		/** Export the keychain
   * @param passwordObj Object containing the type of export and the password to export under
  */
	}, {
		key: 'exportKeychain',
		value: function exportKeychain(passwordObj) {
			var password = passwordObj.pass;
			var jsonKeys = JSON.stringify(this.keyChain);
			var exported = JSON.stringify({
				encrypted: !!password,
				file: password ? CryptoJS.AES.encrypt(jsonKeys, password).toString() : jsonKeys
			});
			switch (passwordObj.type) {
				case 'clipboard':
					chrome.extension.getBackgroundPage().globals.clipboard.set(exported);
					this.popupManager.showFlash('exportCopied');
					break;
				case 'file':
				default:
					window.URL = window.URL || window.webkitURL;
					var file = new Blob([exported], { type: 'application/json' });
					var a = document.createElement('a');
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
	}, {
		key: 'showEncryptKeyChainPopup',
		value: function showEncryptKeyChainPopup(confirm) {
			this.popupManager.open('encryptForm');
			$('#encryptForm input.keyChainPassword').val('').focus();
			var confirmInput = $('#encryptForm input.confirmKeyChainPassword').toggle(confirm);
			var error = $('#encryptForm .error').stop(true).hide();
			if (confirm) {
				error.text('Please confirm your passphrase.').fadeIn();
				confirmInput.focus();
			}
		}

		/** Open the decrypt keychain popup */
	}, {
		key: 'showDecryptKeyChainPopup',
		value: function showDecryptKeyChainPopup() {
			this.popupManager.open('decryptForm');
			$('#decryptForm input.keyChainPassword').focus();
		}

		/** Get rid of duplicate elements in an array
   * @param arr The array to rid of duplicates
  */
	}, {
		key: '_uniq',
		value: function _uniq(arr) {
			var seen = {};
			var out = [];
			var len = arr.length;
			var j = 0;
			for (var i = 0; i < len; i++) {
				var item = arr[i];
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
	}, {
		key: '_confirmKeyChainPassword',
		value: function _confirmKeyChainPassword(pass) {
			this.showEncryptKeyChainPopup(true);
			$('#encryptForm input.keyChainPassword').val(pass);
		}

		/** Indicate whether a key was published or failed to publish
   * @param obj Object containing a success boolean property and an index property when success is
   * false of the index of the published key
  */
	}, {
		key: '_publishResult',
		value: function _publishResult(obj) {
			var id = obj.success ? 'publishSuccess' : 'publishFail';
			if (!obj.success) {
				$('#keyList').find('li[index="' + obj.index + '"]').find('.publish').removeClass('disabled').prop('disabled', false);
			}
			this.popupManager.showFlash(id);
		}

		/** Indicate whether a key was revoked or failed to be revoked
   * @param obj Object containing a success boolean property and an index property when success is
   * false of the index of the revoked key
  */
	}, {
		key: '_revokeResult',
		value: function _revokeResult(obj) {
			var id = obj.success ? 'revokeSuccess' : 'revokeFail';
			if (!obj.success) {
				$('#keyList').find('li[index="' + obj.index + '"]').find('.revoke').removeClass('disabled').prop('disabled', false);
			}
			this.popupManager.showFlash(id);
		}

		/** Indicate whether a key was shared or failed to be shared
   * @param success Boolean indicating whether or not the share was successful
  */
	}, {
		key: '_shareResult',
		value: function _shareResult(success) {
			var id = success ? 'shareKeySuccess' : 'shareKeyFail';
			this.popupManager.showFlash(id);
		}

		/** Sanitize a string
   * str: the string to sanitize
  */
	}, {
		key: '_sanitize',
		value: function _sanitize(str) {
			return $('<i>', { text: str }).html();
		}

		/** Toggle whether or not a user can type in main input fields
   * @param block Boolean indicating whether or not to block input
  */
	}, {
		key: '_toggleInputBlock',
		value: function _toggleInputBlock(block) {
			var elems = $('#searchUID, #key, #description');
			if (block) {
				elems.attr('readonly', 'readonly').val('');
			} else {
				elems.removeAttr('readonly');
			}
		}
	}]);

	return KeyManager;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = KeyManager;
} else {
	window.KeyManager = KeyManager;
}