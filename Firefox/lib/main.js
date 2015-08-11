/** This is the main file */

var clipboard = require("sdk/clipboard");
var data = require("sdk/self").data;
var Intercept = require("intercept").Intercept;
var KeyManager = require("keyManager").keyManager;
var pageMod = require("sdk/page-mod");
var Panel = require("sdk/panel").Panel;
var preferences = require("sdk/simple-prefs");
var Request = require("sdk/request").Request;
var ss = require("sdk/simple-storage");
var tabs = require("sdk/tabs");
var workers = [];

// Their keychain
ss.storage.keys = ss.storage.keys || [{
	key: ":N5gaDV7)\P3.r5",
	description: "This is Grd Me's default shared key"
}];

// A flag indicating whether or not the keys are encrypted
ss.storage.encryptedKeys = ss.storage.encryptedKeys || false;

// A hash of their last password for keychain encryption
ss.storage.lastPass = ss.storage.lastPass || "";

// An array of unique ids they've used when publishing to the keyserver
ss.storage.uids = ss.storage.uids || [];

// A map of shared symmetric keys to a random value generated for each key as part of the protocol
ss.storage.randomMap = ss.storage.randomMap || {};

// An array of legitimate keys shared with the user
ss.storage.acceptableSharedKeys = ss.storage.acceptableSharedKeys || [];

// An array of the active encryption keys (MUST always have length >= 1)
if(!ss.storage.activeKeys){
	ss.storage.activeKeys = [ss.storage.keys[0].key];
}
for(var i=0; i<ss.storage.activeKeys.length; i++){
	ss.storage.activeKeys[JSON.stringify(ss.storage.activeKeys[i])] = true;
}

exports.main = function(options){
	var attachTo = ["top", "frame"];
	if(options.loadReason === "install"){
		attachTo.push("existing");
	}
	// Initialize the key manager, intercepter, and secureTextPanel
	KeyManager.init(workers);
	Intercept.init(workers, detachWorker);
	var secureTextPanel = require("secureTextPanel").secureTextPanel;

	pageMod.PageMod({
		include: ["*"],
		contentStyleFile: [
			data.url("lib/emojify.css")
		],
		contentScriptFile: [data.url("lib/aes.js"),
							data.url('lib/ecc.js'),
							data.url('lib/sha256.js'),
							data.url("lib/jquery-2.1.3.js"),
							data.url("lib/mousetrap.js"),
							data.url("lib/linkify.js"),
							data.url("lib/emojify.js"),
							data.url("constants.js"),
							data.url("frameComm.js"),
							data.url("observer.js"),
							data.url("crypt.js")],
		contentScriptWhen: "ready",
		contentScriptOptions: {
			active: ss.storage.activeKeys,
			keys: ss.storage.keys,
			emojis: preferences.prefs.emojis,
			decryptIndicator: preferences.prefs.decryptIndicator,
			sandboxDecrypt: preferences.prefs.sandboxDecrypt
		},
		attachTo: attachTo,
		onAttach: function(worker){
			workers.push(worker);

			worker.on('detach', function(){
				detachWorker(this, workers);
			});

			/** Send worker the latest info */
			worker.port.emit("emojis", preferences.prefs.emojis);
			worker.port.emit("decryptIndicator", preferences.prefs.decryptIndicator);
			worker.port.emit("sandboxDecrypt", preferences.prefs.sandboxDecrypt);
			worker.port.emit("secret", {active: ss.storage.activeKeys, keys: ss.storage.keys});

			var {Cu} = require("chrome");
			var {Worker} = Cu.import(data.url("chrome/dummy.jsm"));
			Cu.unload(data.url("chrome/dummy.jsm"));

			var webWorker = new Worker(data.url("chrome/worker.js"));

			webWorker.onmessage = function(event){
				worker.port.emit("callback", JSON.parse(event.data));
			};

			/** Send a message to the webworker
			 * id: the id of the messsage
			 * data: any data to send to the worker
			*/
			function sendWebWorkerMessage(id, data){
				data.keyList = ss.storage.keys;
				webWorker.postMessage(JSON.stringify({id: id, data: data}));
			}

			worker.port.on("newTab", function(href){
				tabs.open(href);
			});

			worker.port.on("prepareIframe", function(data){
				Intercept.add(data.uid, data.location, data.secret, data.message);
				worker.port.emit("preparedIframe", data.uid);
			});

			worker.port.on("decrypt", function(data){
				sendWebWorkerMessage("decrypt", data);
			});

			worker.port.on("recheckDecryption", function(data){
				sendWebWorkerMessage("recheckDecryption", data);
			});

			worker.port.on("copy_ciphertext", function(text){
				clipboard.set(text, "text");
			});

			worker.port.on("message_add", function(obj){
				var addMessageRequest = Request({
					url: "https://grd.me/message/add",
					content: obj.data,
					onComplete: function(data){
						data = data.json;
						if(!data || !data.status || !data.status[0] || data.status[0].code){
							clipboard.set(obj.ciphertext, "text");
							worker.port.emit("message_add_fail");
						}
					}
				}).post();
			});

			worker.port.on("message_get", function(obj){
				var getMessageRequest = Request({
					url: "https://grd.me/message/get",
					content: {hash: obj.hash},
					onComplete: function(data){
						data = data.json;
						if(data && data.status && data.status[0] && !data.status[0].code) {
							//Success
							data.hash = obj.hash;
							data.callback = obj.callback;
							sendWebWorkerMessage("verifyShortMessage", data);
						}
						else {
							//Error
							worker.port.emit("callback", {index: obj.callback, data: false});
						}
					}
				}).get();
			});

			worker.port.on("secureText", function(){
				secureTextPanel.show();
			});
		}
	});
}

/** Detach a worker from an array of workers
 * worker: the worker to remove
 * workerArray: the array to remove the worker from
*/
function detachWorker(worker, workerArray) {
	var index = workerArray.indexOf(worker);
	if(index != -1) {
		workerArray.splice(index, 1);
	}
}
