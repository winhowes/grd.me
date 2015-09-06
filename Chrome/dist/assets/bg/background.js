/** This is the main file */

'use strict';

var globals = (function () {
	var clipboard = new Clipboard();
	var workerManager = new WorkerManager();
	var intercept = new Intercept();
	var keyList = {
		keys: [],
		activeKeys: []
	};

	(function () {
		return new SharedKeyManager(keyList);
	})();

	/** Get the active keys
  * @param keys The keys object to set the active keys if none is set
  * @param [callback] A function which takes the active keys as it's first parameter
 */
	function getActiveKeys(keys, callback) {
		chrome.storage.local.get('activeKeys', function (storedActiveKeys) {
			var activeKeys = storedActiveKeys && storedActiveKeys.activeKeys;
			if ((!activeKeys || !activeKeys.length) && keys.length && keys[0].key) {
				activeKeys = [keys[0].key];
				chrome.storage.local.set({ 'activeKeys': activeKeys }, function () {
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

		var securePopup = false;
		chrome.runtime.onConnect.addListener(function (port) {
			workerManager.add(port);

			port.postMessage({
				id: 'secret',
				active: keyList.activeKeys,
				keys: keyList.keys
			});

			if (securePopup) {
				port.postMessage({ id: 'panelMode' });
				securePopup = false;
			}

			port.onMessage.addListener(function (msg) {
				if (msg.id === 'copy_ciphertext') {
					clipboard.set(msg.text);
				} else if (msg.id === 'secureText') {
					securePopup = true;
					var w = 300;
					var h = 235;
					var left = Math.floor(screen.width / 2 - w / 2);
					var _top = Math.floor(screen.height / 2 - h / 2);
					chrome.windows.create({
						url: chrome.extension.getURL('/assets/secureTextPopup/secureTextPopup.html'),
						focused: true,
						type: 'popup',
						width: w,
						height: h,
						top: _top,
						left: left
					});
				} else if (msg.id === 'interceptAdd') {
					intercept.add(msg.data.uid, msg.data.location, msg.data.secret, msg.data.message, msg.data.fonts);
					port.postMessage({ id: 'prepareIframe', uid: msg.data.uid });
				} else if (msg.id === 'newTab') {
					chrome.tabs.create({ url: msg.href });
				}
			});

			port.onDisconnect.addListener(function (worker) {
				workerManager.remove(worker);
			});
		});
	}

	/** Initialize preferences */
	chrome.storage.sync.get(['decryptIndicator', 'sandboxDecrypt'], function (items) {
		if (items.decryptIndicator !== false && items.decryptIndicator !== true) {
			chrome.storage.sync.set({
				decryptIndicator: true
			});
		}
		if (items.sandboxDecrypt !== false && items.sandboxDecrypt !== true) {
			chrome.storage.sync.set({
				sandboxDecrypt: false
			});
		}
	});

	/** Initialize Random Map */
	chrome.storage.local.get('randomMap', function (items) {
		var randomMap = items && items.randomMap || {};
		chrome.storage.local.set({ 'randomMap': randomMap });
	});

	/** Initialize the acceptasbleSharedKeysArrar */
	chrome.storage.local.get('acceptableSharedKeys', function (keys) {
		var sharedKeys = keys && keys.acceptableSharedKeys || [];
		chrome.storage.local.set({ 'acceptableSharedKeys': sharedKeys });
	});

	/** Initialize the user's keys */
	chrome.storage.local.get('keys', function (storedKeys) {
		var keys = storedKeys && storedKeys.keys;
		if (!keys || !keys.length) {
			keys = [{
				key: ':N5gaDV7)\P3.r5',
				description: 'This is Grd Me\'s default shared key'
			}];
			chrome.storage.local.set({ 'keys': keys }, function () {
				getActiveKeys(keys, function (activeKeys) {
					main(keys, activeKeys);
				});
			});
		} else {
			getActiveKeys(keys, function (activeKeys) {
				main(keys, activeKeys);
			});
		}
	});

	/** Focus the active window on notification click */
	chrome.notifications.onClicked.addListener(function (id) {
		if (id === 'GrdMeNewSharedKey') {
			chrome.windows.getCurrent(null, function (window) {
				chrome.windows.update(window.id, { focused: true }, function () {});
			});
		}
	});

	/** Refresh the keyList
  * @param [callback] A callback function
 */
	var refreshKeyList = function refreshKeyList(callback) {
		var setKeys = function setKeys(keys, activeKeys) {
			keyList.keys = keys.slice(0);
			keyList.activeKeys = activeKeys.slice(0);
			if (callback) {
				callback();
			}
		};
		chrome.storage.local.get('keys', function (storedKeys) {
			var keys = storedKeys && storedKeys.keys;
			getActiveKeys(keys, setKeys.bind(undefined, keys));
		});
	};

	// Everything we export
	return {
		clipboard: clipboard,
		keyList: keyList,
		workerManager: workerManager,
		refreshKeyList: refreshKeyList
	};
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = globals;
} else {
	window.globals = globals;
}