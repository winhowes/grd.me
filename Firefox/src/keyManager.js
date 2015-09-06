/** This file handles the key manager */

const { Cc, Ci, Cu } = require('chrome');
const nsIFilePicker = Ci.nsIFilePicker;
const { OS } = Cu.import('resource://gre/modules/osfile.jsm', {});

const ajax = require('sdk/request').Request;
const clipboard = require('sdk/clipboard');
const CryptoJS = require('lib/aes').CryptoJS;
const data = require('sdk/self').data;
const fp = Cc['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
const notifications = require('sdk/notifications');
const Panel = require('sdk/panel').Panel;
const preferences = require('sdk/simple-prefs');
const ss = require('sdk/simple-storage');
const timers = require('sdk/timers');
const ToggleButton = require('sdk/ui/button/toggle').ToggleButton;
const wm = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
let workers = [];
let sharedKeyInterval;

const button = new ToggleButton({
	id: 'grdMe_btn',
	label: 'Grd Me Key Manager',
	icon: data.url('icons/icon64.png'),
});

const keyManager = new Panel({
	contentURL: data.url('browser_action/popup.html'),
	contentStyleFile: data.url('browser_action/popup.css'),
	contentScriptFile: [data.url('lib/jquery-2.1.3.js'),
						data.url('lib/ecc.js'),
						data.url('lib/sha256.js'),
						data.url('browser_action/dropdown.js'),
						data.url('browser_action/keyManager.js'),
						data.url('browser_action/popupManager.js'),
						data.url('browser_action/uidManager.js'),
						data.url('browser_action/main.js')],
	position: button,
	width: 300,
	height: 400,
});

button.on('change', (state) => {
	if (state.checked) {
		keyManager.show();
	}
});

/** Get rid of duplicate elements in an array
 * arr: the array to do such to
*/
function uniq(arr) {
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

/** Show a import keychain error */
function importKeychainError() {
	keyManager.port.emit('importKeychainError');
}

/** Verify imported keychain is an actual keychain and merge it
 * @param JSONtext The JSON stringified keychain to be imported
*/
function mergeImportKeychain(JSONtext) {
	try {
		const text = JSON.parse(JSONtext);
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
	} catch(e) {
		importKeychainError();
	}
}

preferences.on('eccCurve', () => {
	keyManager.port.emit('curve', preferences.prefs.eccCurve);
});

keyManager.on('hide', () => {
	button.state('window', {checked: false});
});

keyManager.on('show', () => {
	button.state('window', {checked: true});
});

/** Refresh the displayed keys in the pref panel */
keyManager.refreshKeys = () => {
	keyManager.port.emit('displayKeys', {
		keys: ss.storage.keys,
		encrypted: ss.storage.encryptedKeys,
	});
};

keyManager.port.on('encryptKeychain', (passwordObj) => {
	const password = passwordObj.pass;
	const confirm = passwordObj.confirm;
	const hash = passwordObj.hash;
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

keyManager.port.on('decryptKeychain', (passwordObj) => {
	const password = passwordObj.pass;
	if (!password) {
		return;
	}
	let plaintext = CryptoJS.AES.decrypt(ss.storage.keys, password);
	try {
		plaintext = plaintext.toString(CryptoJS.enc.Utf8);
		if (!plaintext) {
			throw new Error();
		}
		ss.storage.keys = JSON.parse(plaintext);
		ss.storage.encryptedKeys = false;
	} catch(e) {
		console.error('Error decrypting keychain', e);
	}
	keyManager.refreshKeys();
});

keyManager.port.on('exportKeychain', (passwordObj) => {
	if (ss.storage.encryptedKeys) {
		return;
	}
	const password = passwordObj.pass;
	const jsonKeys = JSON.stringify(ss.storage.keys);
	const exported = JSON.stringify({
		encrypted: !!password,
		file: password ? CryptoJS.AES.encrypt(jsonKeys, password).toString() : jsonKeys,
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

keyManager.port.on('decryptImportKeychain', (passwordObj) => {
	const password = passwordObj.pass;
	try {
		const text = JSON.parse(passwordObj.text);
		let plaintext = CryptoJS.AES.decrypt(text.file, password);
		plaintext = plaintext.toString(CryptoJS.enc.Utf8);
		if (!plaintext) {
			throw new Error();
		}
		mergeImportKeychain(JSON.stringify({
			encrypted: false,
			file: plaintext,
		}));
	} catch(e) {
		importKeychainError();
	}
});

keyManager.port.on('importKeychain', (type) => {
	if (ss.storage.encryptedKeys) {
		return;
	}
	switch (type) {
	case 'clipboard':
		mergeImportKeychain(clipboard.get('text'));
		break;
	case 'file':
	default:
		const win = wm.getMostRecentWindow('');
		fp.init(win, 'Choose your Grd Me Keychain', nsIFilePicker.modeOpen);
		fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);

		const rv = fp.show();
		keyManager.show();
		if (rv === nsIFilePicker.returnOK || rv === nsIFilePicker.returnReplace) {
			const promise = OS.File.read(fp.file.path, {encoding: 'utf-8'});
			promise.then((text) => {
				mergeImportKeychain(text);
			}).catch(() => {
				importKeychainError();
			});
		}
		break;
	}
});

keyManager.port.on('setActiveKeys', (indices) => {
	ss.storage.activeKeys = [];
	if (typeof ss.storage.keys === 'object') {
		const newIndices = [];
		for (let i = 0; i < indices.length; i++) {
			ss.storage.activeKeys.push(ss.storage.keys[indices[i]].key);
			ss.storage.activeKeys[JSON.stringify(ss.storage.keys[indices[i]].key)] = true;
			newIndices[indices[i]] = true;
		}
		keyManager.port.emit('activeKeyIndex', newIndices);
	}
	for (let i = 0; i < workers.length; i++) {
		workers[i].port.emit('secret', {active: ss.storage.activeKeys, keys: ss.storage.keys});
	}
});

keyManager.port.on('addKey', (keyObj) => {
	ss.storage.keys.push(keyObj);
	keyManager.refreshKeys();
	if (keyObj.key.priv && !keyObj.key.published) {
		ajax({
			url: 'https://grd.me/key/pubKeyExists',
			content: {
				pub: keyObj.key.pub,
			},
			onComplete: (response) => {
				const data = response.json;
				if (data && data.exists) {
					const keys = ss.storage.keys;
					for (let i = keys.length - 1; i >= 0; i--) {
						if (keys[i].key.pub === keyObj.key.pub &&
						   keys[i].key.priv === keyObj.key.priv &&
						   keys[i].key.published === keyObj.key.published &&
						   keys[i].description === keyObj.description) {
							keys[i].key.published = true;
							ss.storage.keys = keys;
							keyManager.refreshKeys();
							return;
						}
					}
				}
			},
		}).get();
	}
});

keyManager.port.on('deleteKey', (index) => {
	ss.storage.keys.splice(index, 1);
	keyManager.refreshKeys();
});

/** Update a key's description
 * @param obj Object containing the index of the key to change and the updated description
*/
keyManager.port.on('updateDescription', (obj) => {
	ss.storage.keys[obj.index].description = obj.description;
});

keyManager.port.on('removeAcceptableSharedKey', (index) => {
	ss.storage.acceptableSharedKeys.splice(index, 1);
});

/** Make a request to publish a public key */
keyManager.port.on('publishKey', (key) => {
	ajax({
		url: 'https://grd.me/key/add',
		content: {
			uid: key.uid,
			pub: key.pub,
			sig: key.sig,
		},
		onComplete: (response) => {
			const data = response.json;
			if (!data || !data.status || !data.status[0] || data.status[0].code) {
				keyManager.port.emit('publishResult', {success: false, index: key.index});
			} else {
				ss.storage.uids.push(key.uid);
				ss.storage.uids = uniq(ss.storage.uids);
				ss.storage.keys[key.index].key.published = true;
				keyManager.port.emit('publishResult', {success: true, index: key.index});
				keyManager.port.emit('uids', ss.storage.uids);
				keyManager.refreshKeys();
			}
		},
	}).post();
});

/** Make a request to revoke a public key */
keyManager.port.on('revokeKey', (key) => {
	ajax({
		url: 'https://grd.me/key/revoke',
		content: {
			pub: key.pub,
			sig: key.sig,
		},
		onComplete: (response) => {
			const data = response.json;
			if (!data || !data.status || !data.status[0] || data.status[0].code) {
				keyManager.port.emit('revokeResult', {success: false, index: key.index});
			} else {
				ss.storage.keys.splice(key.index, 1);
				keyManager.port.emit('revokeResult', {success: true, index: key.index});
				keyManager.refreshKeys();
			}
		},
	}).post();
});

/** Share a shared key with another user */
keyManager.port.on('shareKey', (key) => {
	ajax({
		url: 'https://grd.me/key/shareKey',
		content: key,
		onComplete: (response) => {
			const data = response.json;
			if (!data || !data.status || !data.status[0] || data.status[0].code) {
				keyManager.port.emit('shareKeyResult', false);
			} else {
				keyManager.port.emit('shareKeyResult', true);
				ss.storage.randomMap[key.sharedKey] = key.rand;
			}
		},
	}).post();
});

/** Make a request to delete a shared key */
keyManager.port.on('deleteSharedKeyRequest', (key) => {
	key.rand = ss.storage.randomMap[key.sharedKey];
	ajax({
		url: 'https://grd.me/key/deleteSharedKey',
		content: key,
		onComplete: (response) => {
			const data = response.json;
			if (!data || !data.status || !data.status[0] || data.status[0].code) {
				console.error('Error making delete shared key request');
			} else {
				delete ss.storage.randomMap[key.sharedKey];
			}
		},
	}).post();
});

/** Notify user of any symmetric keys shared with them */
keyManager.port.on('notifySharedKeys', (keys) => {
	ss.storage.acceptableSharedKeys = keys;
	const length = keys.length;
	notifications.notify({
		title: 'New Shared Key' + (length > 1 ? 's' : ''),
		text: 'You have ' + length + ' new shared key' + (length > 1 ? 's' : '') + '!',
		iconURL: data.url('icons/icon64.png'),
		onClick: () => {
			timers.setTimeout(() => {
				button.state('window', {checked: true});
				keyManager.show();
			}, 0);
		},
	});
});

/** Prefpanel show event handler */
keyManager.on('show', () => {
	keyManager.port.emit('show', ss.storage.acceptableSharedKeys);
});

exports.keyManager = {
	/** Initialize the key manager
	 * workerArray: the workers array
	*/
	init: (workerArray) => {
		workers = workerArray;

		const indices = [];
		for (let i = 0; i < ss.storage.keys.length; i++) {
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
		sharedKeyInterval = timers.setInterval(() => {
			if (typeof ss.storage.keys !== 'object') {
				return;
			}
			const keys = [];
			for (let i = 0; i < ss.storage.keys.length; i++) {
				if (ss.storage.keys[i].key.priv) {
					keys.push(ss.storage.keys[i].key.pub);
				}
			}
			ajax({
				url: 'https://grd.me/key/checkSharedKey',
				content: {
					keys: keys,
				},
				onComplete: (response) => {
					// Keys may not be an object when the keychain is encrypted
					if (typeof ss.storage.keys !== 'object') {
						return;
					}
					const data = response.json;
					if (data && data.status && data.status[0] && !data.status[0].code) {
						data.acceptableSharedKeys = ss.storage.acceptableSharedKeys;
						keyManager.port.emit('checkSharedKey', data);
					}
				},
			}).post();
		}, 60 * 1000);
	},
};
