/** This is the main file */

const globals = (() => {
	const clipboard = new Clipboard();
	const workerManager = new WorkerManager();
	const intercept = new Intercept();
	const keyList = {
		keys: [],
		activeKeys: [],
	};

	(() => {
		return new SharedKeyManager(keyList);
	}());

	/** Get the active keys
	 * @param keys The keys object to set the active keys if none is set
	 * @param [callback] A function which takes the active keys as it's first parameter
	*/
	function getActiveKeys(keys, callback) {
		chrome.storage.local.get('activeKeys', (storedActiveKeys) => {
			let activeKeys = storedActiveKeys && storedActiveKeys.activeKeys;
			if ((!activeKeys || !activeKeys.length) && keys.length && keys[0].key) {
				activeKeys = [keys[0].key];
				chrome.storage.local.set({'activeKeys': activeKeys}, () => {
					if (callback) {
						callback(activeKeys);
					}
				});
			} else if (callback) {
				callback(activeKeys);
			}
		});
	}

	/** The main function - kicks everything else off
	 * @param keys An array of all keys
	 * @param activeKeys An array of all activeKeys
	*/
	function main(keys, activeKeys) {
		keyList.keys = keys.slice(0);
		keyList.activeKeys = activeKeys.slice(0);

		let securePopup = false;
		chrome.runtime.onConnect.addListener((port) => {
			workerManager.add(port);

			port.postMessage({
				id: 'secret',
				active: keyList.activeKeys,
				keys: keyList.keys,
			});

			if (securePopup) {
				port.postMessage({id: 'panelMode'});
				securePopup = false;
			}

			port.onMessage.addListener((msg) => {
				if (msg.id === 'copy_ciphertext') {
					clipboard.set(msg.text);
				}	else if (msg.id === 'secureText') {
					securePopup = true;
					const w = 300;
					const h = 235;
					const left = Math.floor((screen.width / 2) - (w / 2));
					const top = Math.floor((screen.height / 2) - (h / 2));
					chrome.windows.create({
						url: chrome.extension.getURL('/assets/secureTextPopup/secureTextPopup.html'),
						focused: true,
						type: 'popup',
						width: w,
						height: h,
						top: top,
						left: left,
					});
				} else if (msg.id === 'interceptAdd') {
					intercept.add(msg.data.uid, msg.data.location, msg.data.secret, msg.data.message, msg.data.fonts);
					port.postMessage({id: 'prepareIframe', uid: msg.data.uid});
				} else if (msg.id === 'newTab') {
					chrome.tabs.create({url: msg.href});
				}
			});

			port.onDisconnect.addListener((worker) => {
				workerManager.remove(worker);
			});
		});
	}

	/** Initialize preferences */
	chrome.storage.sync.get(['decryptIndicator', 'sandboxDecrypt'], (items) => {
		if (items.decryptIndicator !== false && items.decryptIndicator !== true) {
			chrome.storage.sync.set({
				decryptIndicator: true,
			});
		}
		if (items.sandboxDecrypt !== false && items.sandboxDecrypt !== true) {
			chrome.storage.sync.set({
				sandboxDecrypt: false,
			});
		}
	});

	/** Initialize Random Map */
	chrome.storage.local.get('randomMap', (items) => {
		const randomMap = (items && items.randomMap) || {};
		chrome.storage.local.set({'randomMap': randomMap});
	});

	/** Initialize the acceptasbleSharedKeysArrar */
	chrome.storage.local.get('acceptableSharedKeys', (keys) => {
		const sharedKeys = (keys && keys.acceptableSharedKeys) || [];
		chrome.storage.local.set({'acceptableSharedKeys': sharedKeys});
	});

	/** Initialize the user's keys */
	chrome.storage.local.get('keys', (storedKeys) => {
		let keys = storedKeys && storedKeys.keys;
		if (!keys || !keys.length) {
			keys = [{
				key: ':N5gaDV7)\P3.r5',
				description: 'This is Grd Me\'s default shared key',
			}];
			chrome.storage.local.set({'keys': keys}, () => {
				getActiveKeys(keys, (activeKeys) => {
					main(keys, activeKeys);
				});
			});
		} else {
			getActiveKeys(keys, (activeKeys) => {
				main(keys, activeKeys);
			});
		}
	});

	/** Focus the active window on notification click */
	chrome.notifications.onClicked.addListener((id) => {
		if (id === 'GrdMeNewSharedKey') {
			chrome.windows.getCurrent(null, (window) => {
				chrome.windows.update(window.id, {focused: true}, () => {});
			});
		}
	});

	/** Refresh the keyList
	 * @param [callback] A callback function
	*/
	const refreshKeyList = (callback) => {
		const setKeys = (keys, activeKeys) => {
			keyList.keys = keys.slice(0);
			keyList.activeKeys = activeKeys.slice(0);
			if (callback) {
				callback();
			}
		};
		chrome.storage.local.get('keys', (storedKeys) => {
			const keys = storedKeys && storedKeys.keys;
			getActiveKeys(keys, setKeys.bind(this, keys));
		});
	};

	// Everything we export
	return {
		clipboard: clipboard,
		keyList: keyList,
		workerManager: workerManager,
		refreshKeyList: refreshKeyList,
	};
}());

if (typeof module !== 'undefined' && module.exports) {
	module.exports = globals;
} else {
	window.globals = globals;
}
