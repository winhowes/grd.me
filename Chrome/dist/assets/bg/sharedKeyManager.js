/** This file manages shared keys */

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var SharedKeyManager = (function () {
	function SharedKeyManager(keyList) {
		var _this = this;

		_classCallCheck(this, SharedKeyManager);

		this.keyList = keyList;
		setInterval(function () {
			_this._initCheck();
		}, 60 * 1000);
	}

	/** Check for shared keys and delete old shared keys - run every minute */

	_createClass(SharedKeyManager, [{
		key: '_initCheck',
		value: function _initCheck() {
			var _this2 = this;

			chrome.storage.local.get('keys', function (items) {
				if (typeof items.keys !== 'object') {
					return;
				}
				_this2.keyList.keys = items.keys;
				var keys = [];
				for (var i = 0; i < _this2.keyList.keys.length; i++) {
					if (_this2.keyList.keys[i].key.priv) {
						keys.push(_this2.keyList.keys[i].key.pub);
					}
				}
				$.ajax({
					url: 'https://grd.me/key/checkSharedKey',
					type: 'POST',
					data: {
						keys: keys
					},
					success: function success(data) {
						if (data && data.status && data.status[0] && !data.status[0].code) {
							chrome.storage.local.get(['keys', 'acceptableSharedKeys'], function (items) {
								// Keys may not be an object when the keychain is encrypted
								if (typeof items.keys !== 'object') {
									return;
								}
								data.acceptableSharedKeys = items.acceptableSharedKeys;
								_this2.check(data);
							});
						}
					},
					error: function error(data) {
						console.error('Error checking for shared keys:', data);
					}
				});
			});
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
				var item = JSON.stringify(arr[i]);
				if (seen[item] !== 1) {
					seen[item] = 1;
					out[j++] = JSON.parse(item);
				}
			}
			return out;
		}

		/** Post a notification of a key having been shared with the user
   * @param keys The array of keys that have been shared with the user
  */
	}, {
		key: 'notify',
		value: function notify(keys) {
			chrome.notifications.getPermissionLevel(function (level) {
				if (level !== 'granted') {
					return;
				}
				var length = keys.length;
				chrome.notifications.create('GrdMeNewSharedKey', {
					type: 'basic',
					iconUrl: chrome.extension.getURL('icons/icon48.png'),
					title: 'New Shared Key' + (length > 1 ? 's' : ''),
					message: 'You have ' + length + ' new shared key' + (length > 1 ? 's' : '') + '!'
				}, function () {});
			});
		}

		/** Check to see if any new keys have been shared and if user's shared keys have been recieved
   * @param data Object with information about sent/recieved keys
  */
	}, {
		key: 'check',
		value: function check(data) {
			var _this3 = this;

			chrome.storage.local.get('keys', function (items) {
				_this3.keyList.keys = items.keys;

				/* Handle receiving keys shared with this user */
				var keyChain = _this3.keyList.keys;
				var originalLength = data.acceptableSharedKeys.length;
				var index = undefined;
				for (var i = 0; i < data.received.length; i++) {
					try {
						var sig = JSON.parse(data.received[i].sendSig);
						if (ecc.verify(data.received[i].fromKey, sig, data.received[i].sharedKey)) {
							for (var j = 0; j < keyChain.length; j++) {
								if (keyChain[j].key.priv) {
									try {
										var key = String(ecc.decrypt(keyChain[j].key.priv, data.received[i].sharedKey)).slice(0, 64);
										if (key) {
											var from = '';
											var k = undefined;
											for (k = 0; k < keyChain.length; k++) {
												if (keyChain[k].key.pub === data.received[i].fromKey) {
													from = keyChain[k].description;
													break;
												}
											}
											data.acceptableSharedKeys.push({ key: key, from: from });
											data.acceptableSharedKeys = _this3._uniq(data.acceptableSharedKeys);
											for (k = 0; k < data.acceptableSharedKeys.length; k++) {
												if (data.acceptableSharedKeys[k].key === key && data.acceptableSharedKeys[k].from === from) {
													index = k;
													break;
												}
											}
											_this3.acknowledgeKey({
												fromKey: data.received[i].fromKey,
												toKey: data.received[i].toKey,
												sharedKey: data.received[i].sharedKey,
												receiveSig: JSON.stringify(ecc.sign(keyChain[j].key.priv, data.received[i].sharedKey))
											}, index);
										}
									} catch (e) {
										console.error('Error checking shared key', e);
									}
								}
							}
						}
					} catch (e) {
						console.error('Error checking shared key', e);
					}
				}
				// Notify user of acceptable keys
				data.acceptableSharedKeys = _this3._uniq(data.acceptableSharedKeys);
				if (data.acceptableSharedKeys.length !== originalLength) {
					_this3.notify(data.acceptableSharedKeys);
					chrome.storage.local.set({
						acceptableSharedKeys: data.acceptableSharedKeys
					});
				}

				// Handle receiving acknowledgements of shared keys
				for (var i = 0; i < data.sent.length; i++) {
					try {
						var sig = JSON.parse(data.sent[i].receiveSig);
						if (ecc.verify(data.sent[i].toKey, sig, data.sent[i].sharedKey)) {
							_this3.deleteRequest({
								fromKey: data.sent[i].fromKey,
								sharedKey: data.sent[i].sharedKey
							});
						}
					} catch (e) {
						console.error('Error checking shared key', e);
					}
				}
			});
		}

		/** Make a request to delete a shared key
   * @param keyObj An object containing the sender's public key, the encrypted shared key and the random number
  */
	}, {
		key: 'deleteRequest',
		value: function deleteRequest(keyObj) {
			function error() {
				console.error('Error making delete shared key request');
			}
			chrome.storage.local.get('randomMap', function (items) {
				var randomMap = items.randomMap;
				keyObj.rand = randomMap[keyObj.sharedKey];
				$.ajax({
					url: 'https://grd.me/key/deleteSharedKey',
					type: 'POST',
					data: keyObj,
					success: function success(data) {
						if (!data || !data.status || !data.status[0] || data.status[0].code) {
							error();
						} else {
							delete randomMap[keyObj.sharedKey];
							chrome.storage.local.set({ 'randomMap': randomMap });
						}
					},
					error: error
				});
			});
		}

		/** Acknowledge receiving a shared key
   * @param keyObj An object of the key data to send
  */
	}, {
		key: 'acknowledgeKey',
		value: function acknowledgeKey(keyObj) {
			$.ajax({
				url: 'https://grd.me/key/acceptSharedKey',
				type: 'POST',
				data: keyObj,
				error: function error() {
					console.error('Error acknowledging shared key received');
				}
			});
		}
	}]);

	return SharedKeyManager;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = SharedKeyManager;
} else {
	window.SharedKeyManager = SharedKeyManager;
}