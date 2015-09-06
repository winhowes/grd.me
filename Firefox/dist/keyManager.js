/** This file handles the key manager */

'use strict';

var _require = require('chrome');

var Cc = _require.Cc;
var Ci = _require.Ci;
var Cu = _require.Cu;

var nsIFilePicker = Ci.nsIFilePicker;

var _Cu$import = Cu['import']('resource://gre/modules/osfile.jsm', {});

var OS = _Cu$import.OS;

var ajax = require('sdk/request').Request;
var clipboard = require('sdk/clipboard');
var CryptoJS = require('lib/aes').CryptoJS;
var data = require('sdk/self').data;
var fp = Cc['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
var notifications = require('sdk/notifications');
var Panel = require('sdk/panel').Panel;
var preferences = require('sdk/simple-prefs');
var ss = require('sdk/simple-storage');
var timers = require('sdk/timers');
var ToggleButton = require('sdk/ui/button/toggle').ToggleButton;
var wm = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
var workers = [];
var sharedKeyInterval = undefined;

var button = new ToggleButton({
	id: 'grdMe_btn',
	label: 'Grd Me Key Manager',
	icon: data.url('icons/icon64.png')
});

var keyManager = new Panel({
	contentURL: data.url('browser_action/popup.html'),
	contentStyleFile: data.url('browser_action/popup.css'),
	contentScriptFile: [data.url('lib/jquery-2.1.3.js'), data.url('lib/ecc.js'), data.url('lib/sha256.js'), data.url('browser_action/dropdown.js'), data.url('browser_action/keyManager.js'), data.url('browser_action/popupManager.js'), data.url('browser_action/uidManager.js'), data.url('browser_action/main.js')],
	position: button,
	width: 300,
	height: 400
});

button.on('change', function (state) {
	if (state.checked) {
		keyManager.show();
	}
});

/** Get rid of duplicate elements in an array
 * arr: the array to do such to
*/
function uniq(arr) {
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

/** Show a import keychain error */
function importKeychainError() {
	keyManager.port.emit('importKeychainError');
}

/** Verify imported keychain is an actual keychain and merge it
 * @param JSONtext The JSON stringified keychain to be imported
*/
function mergeImportKeychain(JSONtext) {
	try {
		var text = JSON.parse(JSONtext);
		if (!text) {
			throw Error();
		}
		if (text.encrypted) {
			keyManager.port.emit('getImportPassword', JSON.stringify(text));
		} else if (text.file) {
			keyManager.port.emit('mergeKeychain', text.file);
		} else {
			throw Error();
		}
	} catch (e) {
		importKeychainError();
	}
}

preferences.on('eccCurve', function () {
	keyManager.port.emit('curve', preferences.prefs.eccCurve);
});

keyManager.on('hide', function () {
	button.state('window', { checked: false });
});

keyManager.on('show', function () {
	button.state('window', { checked: true });
});

/** Refresh the displayed keys in the pref panel */
keyManager.refreshKeys = function () {
	keyManager.port.emit('displayKeys', {
		keys: ss.storage.keys,
		encrypted: ss.storage.encryptedKeys
	});
};

keyManager.port.on('encryptKeychain', function (passwordObj) {
	var password = passwordObj.pass;
	var confirm = passwordObj.confirm;
	var hash = passwordObj.hash;
	if (!password) {
		return;
	}
	if (!confirm && hash !== ss.storage.lastPass) {
		keyManager.port.emit('confirmKeyChainPassword', password);
		return;
	} else if (confirm) {
		if (confirm !== password) {
			return;
		}
		ss.storage.lastPass = hash;
	}
	ss.storage.keys = CryptoJS.AES.encrypt(JSON.stringify(ss.storage.keys), password).toString();
	ss.storage.encryptedKeys = true;
	keyManager.refreshKeys();
});

keyManager.port.on('decryptKeychain', function (passwordObj) {
	var password = passwordObj.pass;
	if (!password) {
		return;
	}
	var plaintext = CryptoJS.AES.decrypt(ss.storage.keys, password);
	try {
		plaintext = plaintext.toString(CryptoJS.enc.Utf8);
		if (!plaintext) {
			throw new Error();
		}
		ss.storage.keys = JSON.parse(plaintext);
		ss.storage.encryptedKeys = false;
	} catch (e) {
		console.error('Error decrypting keychain', e);
	}
	keyManager.refreshKeys();
});

keyManager.port.on('exportKeychain', function (passwordObj) {
	if (ss.storage.encryptedKeys) {
		return;
	}
	var password = passwordObj.pass;
	var jsonKeys = JSON.stringify(ss.storage.keys);
	var exported = JSON.stringify({
		encrypted: !!password,
		file: password ? CryptoJS.AES.encrypt(jsonKeys, password).toString() : jsonKeys
	});
	switch (passwordObj.type) {
		case 'clipboard':
			clipboard.set(exported, 'text');
			keyManager.port.emit('exportCopied');
			break;
		case 'file':
		default:
			keyManager.port.emit('downloadFile', exported);
			break;
	}
});

keyManager.port.on('decryptImportKeychain', function (passwordObj) {
	var password = passwordObj.pass;
	try {
		var text = JSON.parse(passwordObj.text);
		var plaintext = CryptoJS.AES.decrypt(text.file, password);
		plaintext = plaintext.toString(CryptoJS.enc.Utf8);
		if (!plaintext) {
			throw new Error();
		}
		mergeImportKeychain(JSON.stringify({
			encrypted: false,
			file: plaintext
		}));
	} catch (e) {
		importKeychainError();
	}
});

keyManager.port.on('importKeychain', function (type) {
	if (ss.storage.encryptedKeys) {
		return;
	}
	switch (type) {
		case 'clipboard':
			mergeImportKeychain(clipboard.get('text'));
			break;
		case 'file':
		default:
			var win = wm.getMostRecentWindow('');
			fp.init(win, 'Choose your Grd Me Keychain', nsIFilePicker.modeOpen);
			fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);

			var rv = fp.show();
			keyManager.show();
			if (rv === nsIFilePicker.returnOK || rv === nsIFilePicker.returnReplace) {
				var promise = OS.File.read(fp.file.path, { encoding: 'utf-8' });
				promise.then(function (text) {
					mergeImportKeychain(text);
				})['catch'](function () {
					importKeychainError();
				});
			}
			break;
	}
});

keyManager.port.on('setActiveKeys', function (indices) {
	ss.storage.activeKeys = [];
	if (typeof ss.storage.keys === 'object') {
		var newIndices = [];
		for (var i = 0; i < indices.length; i++) {
			ss.storage.activeKeys.push(ss.storage.keys[indices[i]].key);
			ss.storage.activeKeys[JSON.stringify(ss.storage.keys[indices[i]].key)] = true;
			newIndices[indices[i]] = true;
		}
		keyManager.port.emit('activeKeyIndex', newIndices);
	}
	for (var i = 0; i < workers.length; i++) {
		workers[i].port.emit('secret', { active: ss.storage.activeKeys, keys: ss.storage.keys });
	}
});

keyManager.port.on('addKey', function (keyObj) {
	ss.storage.keys.push(keyObj);
	keyManager.refreshKeys();
	if (keyObj.key.priv && !keyObj.key.published) {
		ajax({
			url: 'https://grd.me/key/pubKeyExists',
			content: {
				pub: keyObj.key.pub
			},
			onComplete: function onComplete(response) {
				var data = response.json;
				if (data && data.exists) {
					var keys = ss.storage.keys;
					for (var i = keys.length - 1; i >= 0; i--) {
						if (keys[i].key.pub === keyObj.key.pub && keys[i].key.priv === keyObj.key.priv && keys[i].key.published === keyObj.key.published && keys[i].description === keyObj.description) {
							keys[i].key.published = true;
							ss.storage.keys = keys;
							keyManager.refreshKeys();
							return;
						}
					}
				}
			}
		}).get();
	}
});

keyManager.port.on('deleteKey', function (index) {
	ss.storage.keys.splice(index, 1);
	keyManager.refreshKeys();
});

/** Update a key's description
 * @param obj Object containing the index of the key to change and the updated description
*/
keyManager.port.on('updateDescription', function (obj) {
	ss.storage.keys[obj.index].description = obj.description;
});

keyManager.port.on('removeAcceptableSharedKey', function (index) {
	ss.storage.acceptableSharedKeys.splice(index, 1);
});

/** Make a request to publish a public key */
keyManager.port.on('publishKey', function (key) {
	ajax({
		url: 'https://grd.me/key/add',
		content: {
			uid: key.uid,
			pub: key.pub,
			sig: key.sig
		},
		onComplete: function onComplete(response) {
			var data = response.json;
			if (!data || !data.status || !data.status[0] || data.status[0].code) {
				keyManager.port.emit('publishResult', { success: false, index: key.index });
			} else {
				ss.storage.uids.push(key.uid);
				ss.storage.uids = uniq(ss.storage.uids);
				ss.storage.keys[key.index].key.published = true;
				keyManager.port.emit('publishResult', { success: true, index: key.index });
				keyManager.port.emit('uids', ss.storage.uids);
				keyManager.refreshKeys();
			}
		}
	}).post();
});

/** Make a request to revoke a public key */
keyManager.port.on('revokeKey', function (key) {
	ajax({
		url: 'https://grd.me/key/revoke',
		content: {
			pub: key.pub,
			sig: key.sig
		},
		onComplete: function onComplete(response) {
			var data = response.json;
			if (!data || !data.status || !data.status[0] || data.status[0].code) {
				keyManager.port.emit('revokeResult', { success: false, index: key.index });
			} else {
				ss.storage.keys.splice(key.index, 1);
				keyManager.port.emit('revokeResult', { success: true, index: key.index });
				keyManager.refreshKeys();
			}
		}
	}).post();
});

/** Share a shared key with another user */
keyManager.port.on('shareKey', function (key) {
	ajax({
		url: 'https://grd.me/key/shareKey',
		content: key,
		onComplete: function onComplete(response) {
			var data = response.json;
			if (!data || !data.status || !data.status[0] || data.status[0].code) {
				keyManager.port.emit('shareKeyResult', false);
			} else {
				keyManager.port.emit('shareKeyResult', true);
				ss.storage.randomMap[key.sharedKey] = key.rand;
			}
		}
	}).post();
});

/** Make a request to delete a shared key */
keyManager.port.on('deleteSharedKeyRequest', function (key) {
	key.rand = ss.storage.randomMap[key.sharedKey];
	ajax({
		url: 'https://grd.me/key/deleteSharedKey',
		content: key,
		onComplete: function onComplete(response) {
			var data = response.json;
			if (!data || !data.status || !data.status[0] || data.status[0].code) {
				console.error('Error making delete shared key request');
			} else {
				delete ss.storage.randomMap[key.sharedKey];
			}
		}
	}).post();
});

/** Notify user of any symmetric keys shared with them */
keyManager.port.on('notifySharedKeys', function (keys) {
	ss.storage.acceptableSharedKeys = keys;
	var length = keys.length;
	notifications.notify({
		title: 'New Shared Key' + (length > 1 ? 's' : ''),
		text: 'You have ' + length + ' new shared key' + (length > 1 ? 's' : '') + '!',
		iconURL: data.url('icons/icon64.png'),
		onClick: function onClick() {
			timers.setTimeout(function () {
				button.state('window', { checked: true });
				keyManager.show();
			}, 0);
		}
	});
});

/** Prefpanel show event handler */
keyManager.on('show', function () {
	keyManager.port.emit('show', ss.storage.acceptableSharedKeys);
});

exports.keyManager = {
	/** Initialize the key manager
  * workerArray: the workers array
 */
	init: function init(workerArray) {
		workers = workerArray;

		var indices = [];
		for (var i = 0; i < ss.storage.keys.length; i++) {
			if (ss.storage.activeKeys[JSON.stringify(ss.storage.keys[i].key)]) {
				indices[i] = true;
			} else {
				indices[i] = false;
			}
		}
		keyManager.port.emit('activeKeyIndex', indices);

		keyManager.refreshKeys();

		keyManager.port.emit('uids', ss.storage.uids);

		timers.clearInterval(sharedKeyInterval);

		/** Check for shared keys and delete old shared keys - run every minute */
		sharedKeyInterval = timers.setInterval(function () {
			if (typeof ss.storage.keys !== 'object') {
				return;
			}
			var keys = [];
			for (var i = 0; i < ss.storage.keys.length; i++) {
				if (ss.storage.keys[i].key.priv) {
					keys.push(ss.storage.keys[i].key.pub);
				}
			}
			ajax({
				url: 'https://grd.me/key/checkSharedKey',
				content: {
					keys: keys
				},
				onComplete: function onComplete(response) {
					// Keys may not be an object when the keychain is encrypted
					if (typeof ss.storage.keys !== 'object') {
						return;
					}
					var data = response.json;
					if (data && data.status && data.status[0] && !data.status[0].code) {
						data.acceptableSharedKeys = ss.storage.acceptableSharedKeys;
						keyManager.port.emit('checkSharedKey', data);
					}
				}
			}).post();
		}, 60 * 1000);
	}
};