/** This file manages shared keys */

class SharedKeyManager {
	constructor(keyList) {
		this.keyList = keyList;
		setInterval(() => {
			this._initCheck();
		}, 60 * 1000);
	}

	/** Check for shared keys and delete old shared keys - run every minute */
	_initCheck() {
		chrome.storage.local.get('keys', (items) => {
			if (typeof items.keys !== 'object') {
				return;
			}
			this.keyList.keys = items.keys;
			const keys = [];
			for (let i = 0; i < this.keyList.keys.length; i++) {
				if (this.keyList.keys[i].key.priv) {
					keys.push(this.keyList.keys[i].key.pub);
				}
			}
			$.ajax({
				url: 'https://grd.me/key/checkSharedKey',
				type: 'POST',
				data: {
					keys: keys,
				},
				success: (data) => {
					if (data && data.status && data.status[0] && !data.status[0].code) {
						chrome.storage.local.get(['keys', 'acceptableSharedKeys'], (items) => {
							// Keys may not be an object when the keychain is encrypted
							if (typeof items.keys !== 'object') {
								return;
							}
							data.acceptableSharedKeys = items.acceptableSharedKeys;
							this.check(data);
						});
					}
				},
				error: (data) => {
					console.error('Error checking for shared keys:', data);
				},
			});
		});
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
			const item = JSON.stringify(arr[i]);
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
	notify(keys) {
		chrome.notifications.getPermissionLevel((level) => {
			if (level !== 'granted') {
				return;
			}
			const length = keys.length;
			chrome.notifications.create('GrdMeNewSharedKey', {
				type: 'basic',
				iconUrl: chrome.extension.getURL('icons/icon48.png'),
				title: 'New Shared Key' + (length > 1 ? 's' : ''),
				message: 'You have ' + length + ' new shared key' + (length > 1 ? 's' : '') + '!',
			}, () => {});
		});
	}

	/** Check to see if any new keys have been shared and if user's shared keys have been recieved
	 * @param data Object with information about sent/recieved keys
	*/
	check(data) {
		chrome.storage.local.get('keys', (items) => {
			this.keyList.keys = items.keys;

			/* Handle receiving keys shared with this user */
			const keyChain = this.keyList.keys;
			const originalLength = data.acceptableSharedKeys.length;
			let index;
			for (let i = 0; i < data.received.length; i++) {
				try {
					const sig = JSON.parse(data.received[i].sendSig);
					if (ecc.verify(data.received[i].fromKey, sig, data.received[i].sharedKey)) {
						for (let j = 0; j < keyChain.length; j++) {
							if (keyChain[j].key.priv) {
								try {
									const key = String(ecc.decrypt(keyChain[j].key.priv, data.received[i].sharedKey)).slice(0, 64);
									if (key) {
										let from = '';
										let k;
										for (k = 0; k < keyChain.length; k++) {
											if (keyChain[k].key.pub === data.received[i].fromKey) {
												from = keyChain[k].description;
												break;
											}
										}
										data.acceptableSharedKeys.push({key: key, from: from});
										data.acceptableSharedKeys = this._uniq(data.acceptableSharedKeys);
										for (k = 0; k < data.acceptableSharedKeys.length; k++) {
											if (data.acceptableSharedKeys[k].key === key && data.acceptableSharedKeys[k].from === from) {
												index = k;
												break;
											}
										}
										this.acknowledgeKey({
											fromKey: data.received[i].fromKey,
											toKey: data.received[i].toKey,
											sharedKey: data.received[i].sharedKey,
											receiveSig: JSON.stringify(ecc.sign(keyChain[j].key.priv, data.received[i].sharedKey)),
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
			data.acceptableSharedKeys = this._uniq(data.acceptableSharedKeys);
			if (data.acceptableSharedKeys.length !== originalLength) {
				this.notify(data.acceptableSharedKeys);
				chrome.storage.local.set({
					acceptableSharedKeys: data.acceptableSharedKeys,
				});
			}

			// Handle receiving acknowledgements of shared keys
			for (let i = 0; i < data.sent.length; i++) {
				try {
					const sig = JSON.parse(data.sent[i].receiveSig);
					if (ecc.verify(data.sent[i].toKey, sig, data.sent[i].sharedKey)) {
						this.deleteRequest({
							fromKey: data.sent[i].fromKey,
							sharedKey: data.sent[i].sharedKey,
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
	deleteRequest(keyObj) {
		function error() {
			console.error('Error making delete shared key request');
		}
		chrome.storage.local.get('randomMap', (items) => {
			const randomMap = items.randomMap;
			keyObj.rand = randomMap[keyObj.sharedKey];
			$.ajax({
				url: 'https://grd.me/key/deleteSharedKey',
				type: 'POST',
				data: keyObj,
				success: (data) => {
					if (!data || !data.status || !data.status[0] || data.status[0].code) {
						error();
					} else {
						delete randomMap[keyObj.sharedKey];
						chrome.storage.local.set({'randomMap': randomMap});
					}
				},
				error: error,
			});
		});
	}

	/** Acknowledge receiving a shared key
	 * @param keyObj An object of the key data to send
	*/
	acknowledgeKey(keyObj) {
		$.ajax({
			url: 'https://grd.me/key/acceptSharedKey',
			type: 'POST',
			data: keyObj,
			error: () => {
				console.error('Error acknowledging shared key received');
			},
		});
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = SharedKeyManager;
} else {
	window.SharedKeyManager = SharedKeyManager;
}
