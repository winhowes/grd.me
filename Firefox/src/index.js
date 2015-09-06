/** This is the main file */

const ajax = require('sdk/request').Request;
const clipboard = require('sdk/clipboard');
const data = require('sdk/self').data;
const Intercept = require('intercept').Intercept;
const KeyManager = require('keyManager').keyManager;
const pageMod = require('sdk/page-mod');
const preferences = require('sdk/simple-prefs');
const ss = require('sdk/simple-storage');
const tabs = require('sdk/tabs');
const wm = require('workerManager');

// Their keychain
ss.storage.keys = ss.storage.keys || [{
	key: ':N5gaDV7)\P3.r5',
	description: 'This is Grd Me\'s default shared key',
}];

// A flag indicating whether or not the keys are encrypted
ss.storage.encryptedKeys = ss.storage.encryptedKeys || false;

// A hash of their last password for keychain encryption
ss.storage.lastPass = ss.storage.lastPass || '';

// An array of unique ids they've used when publishing to the keyserver
ss.storage.uids = ss.storage.uids || [];

// A map of shared symmetric keys to a random value generated for each key as part of the protocol
ss.storage.randomMap = ss.storage.randomMap || {};

// An array of legitimate keys shared with the user
ss.storage.acceptableSharedKeys = ss.storage.acceptableSharedKeys || [];

// An array of the active encryption keys (MUST always have length >= 1)
if (!ss.storage.activeKeys) {
	ss.storage.activeKeys = [ss.storage.keys[0].key];
}
for (let i = 0; i < ss.storage.activeKeys.length; i++) {
	ss.storage.activeKeys[JSON.stringify(ss.storage.activeKeys[i])] = true;
}

exports.main = (options) => {
	const attachTo = ['top', 'frame'];
	const workerManager = new wm.WorkerManager();
	if (options.loadReason === 'install') {
		attachTo.push('existing');
	}
	// Initialize the key manager, intercepter, and secureTextPanel
	KeyManager.init(workerManager.workers);
	Intercept.init(workerManager);
	const secureTextPanel = require('secureTextPanel').secureTextPanel;

	pageMod.PageMod({
		include: ['*'],
		contentStyleFile: [
			data.url('lib/emojify.css'),
		],
		contentScriptFile: [data.url('lib/aes.js'),
							data.url('lib/ecc.js'),
							data.url('lib/sha256.js'),
							data.url('lib/jquery-2.1.3.js'),
							data.url('lib/mousetrap.js'),
							data.url('lib/linkify.js'),
							data.url('lib/emojify.js'),
							data.url('frameComm.js'),
							data.url('observer.js'),
							data.url('cryptoManager.js'),
							data.url('main.js')],
		contentScriptWhen: 'ready',
		contentScriptOptions: {
			active: ss.storage.activeKeys,
			keys: ss.storage.keys,
		},
		attachTo: attachTo,
		onAttach: (worker) => {
			workerManager.add(worker);

			worker.on('detach', function detach() {
				workerManager.remove(this);
			});

			worker.port.emit('preferences', preferences.prefs);

			/** Send worker the latest info */
			// worker.port.emit('emojis', preferences.prefs.emojis);
			// worker.port.emit('decryptIndicator', preferences.prefs.decryptIndicator);
			// worker.port.emit('sandboxDecrypt', preferences.prefs.sandboxDecrypt);
			worker.port.emit('secret', {active: ss.storage.activeKeys, keys: ss.storage.keys});

			const {Cu} = require('chrome');
			const {Worker} = Cu.import(data.url('chrome/dummy.jsm'));
			Cu.unload(data.url('chrome/dummy.jsm'));

			const webWorker = new Worker(data.url('chrome/worker.js'));

			webWorker.onmessage = (event) => {
				worker.port.emit('callback', JSON.parse(event.data));
			};

			/** Send a message to the webworker
			 * @param id The id of the messsage
			 * @param data Any data to send to the worker
			*/
			function sendWebWorkerMessage(id, data) {
				data.keyList = ss.storage.keys;
				webWorker.postMessage(JSON.stringify({id: id, data: data}));
			}

			worker.port.on('newTab', (href) => {
				tabs.open(href);
			});

			worker.port.on('prepareIframe', (data) => {
				Intercept.add(data.uid, data.location, data.secret, data.message);
				worker.port.emit('preparedIframe', data.uid);
			});

			worker.port.on('decrypt', (data) => {
				sendWebWorkerMessage('decrypt', data);
			});

			worker.port.on('recheckDecryption', (data) => {
				sendWebWorkerMessage('recheckDecryption', data);
			});

			worker.port.on('copy_ciphertext', (text) => {
				clipboard.set(text, 'text');
			});

			worker.port.on('message_add', (obj) => {
				ajax({
					url: 'https://grd.me/message/add',
					content: obj.data,
					onComplete: (response) => {
						const data = response.json;
						if (!data || !data.status || !data.status[0] || data.status[0].code) {
							clipboard.set(obj.ciphertext, 'text');
							worker.port.emit('message_add_fail');
						}
					},
				}).post();
			});

			worker.port.on('message_get', (obj) => {
				ajax({
					url: 'https://grd.me/message/get',
					content: {hash: obj.hash},
					onComplete: (response) => {
						const data = response.json;
						if (data && data.status && data.status[0] && !data.status[0].code) {
							// Success
							data.hash = obj.hash;
							data.callback = obj.callback;
							sendWebWorkerMessage('verifyShortMessage', data);
						} else {
							// Error
							worker.port.emit('callback', {index: obj.callback, data: false});
						}
					},
				}).get();
			});

			worker.port.on('secureText', () => {
				secureTextPanel.show();
			});
		},
	});
};
