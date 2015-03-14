/** This file handles the key manager */

var CryptoJS = require("lib/aes").CryptoJS;
var data = require("sdk/self").data;
var notifications = require("sdk/notifications");
var Panel = require("sdk/panel").Panel;
var Request = require("sdk/request").Request;
var ss = require("sdk/simple-storage");
var timers = require("sdk/timers");
var workers = [];

/** Keep the panel visibility in sync with the button state
 * state: the button state
*/
function handleChange(state) {
	if (state.checked) {
		keyManager.show();
	}
}

/** Sync the button with the panel hiding */
function handleHide() {
	button.state('window', {checked: false});
}

/** Get rid of duplicate elements in an array
 * arr: the array to do such to
*/
function uniq(arr) {
    var seen = {};
    var out = [];
    var len = arr.length;
    var j = 0;
    for(var i = 0; i < len; i++) {
         var item = arr[i];
         if(seen[item] !== 1) {
               seen[item] = 1;
               out[j++] = item;
         }
    }
    return out;
}

var button = require("sdk/ui/button/toggle").ToggleButton({
	id: "crypt_btn",
	label: "Grd Me Key Manager",
	icon: data.url("icons/icon64.png"),
	onChange: handleChange
});

var keyManager = Panel({
	contentURL: data.url("keyManager/keyManager.html"),
	contentStyleFile: data.url("keyManager/keyManager.css"),
	contentScriptFile: [data.url("lib/jquery-2.1.3.min.js"),
						data.url('lib/ecc.min.js'),
						data.url('lib/sha256.js'),
						data.url('dropdown.js'),
						data.url("keyManager/keyManager.js")],
	position: button,
	onHide: handleHide,
	width: 300,
	height: 400
});

/** Refresh the displayed keys in the pref panel */
keyManager.refreshKeys = function(){
	keyManager.port.emit("displayKeys", {
		keys: ss.storage.keys,
		encrypted: ss.storage.encryptedKeys
	});
}

keyManager.port.on("encryptKeychain", function(passwordObj){
	var password = passwordObj.pass;
	var confirm = passwordObj.confirm;
	var hash = passwordObj.hash;
	if(!password){
		return;
	}
	if(!confirm && hash != ss.storage.lastPass){
		keyManager.port.emit("confirmKeyChainPassword", password);
		return;
	}
	else if(confirm){
		if(confirm != password){
			return;
		}
		ss.storage.lastPass = hash;
	}
	ss.storage.keys = CryptoJS.AES.encrypt(JSON.stringify(ss.storage.keys), password).toString();
	ss.storage.encryptedKeys = true;
	keyManager.refreshKeys();
});

keyManager.port.on("decryptKeychain", function(passwordObj){
	var password = passwordObj.pass;
	if(!password){
		return;
	}
	plaintext = CryptoJS.AES.decrypt(ss.storage.keys, password);
	try{
		plaintext = plaintext.toString(CryptoJS.enc.Utf8);
		if(!plaintext){
			throw true;
		}
		ss.storage.keys = JSON.parse(plaintext);
		ss.storage.encryptedKeys = false;
	}
	catch(e){}
	keyManager.refreshKeys();
});

keyManager.port.on("setActiveKeys", function(indices){
	ss.storage.activeKeys = [];
	if(typeof ss.storage.keys === "object"){
		for(var i=0; i<indices.length; i++){
			ss.storage.activeKeys.push(ss.storage.keys[indices[i]].key);
			ss.storage.activeKeys[JSON.stringify(ss.storage.keys[indices[i]].key)] = true;
		}
	}
	for(i=0; i<workers.length; i++){
		workers[i].port.emit("secret", {active: ss.storage.activeKeys, keys: ss.storage.keys});
	}
});

keyManager.port.on("addKey", function(keyObj){
	ss.storage.keys.push(keyObj);
	keyManager.refreshKeys();
});

keyManager.port.on("deleteKey", function(index){
	ss.storage.keys.splice(index, 1);
	keyManager.refreshKeys();
});

/** Update a key's description
 * obj: an object containing the index of the key to change and the updated description
*/
keyManager.port.on("updateDescription", function(obj){
	ss.storage.keys[obj.index].description = obj.description;
});

keyManager.port.on("removeAcceptableSharedKey", function(index){
	ss.storage.acceptableSharedKeys.splice(index, 1);
});

/** Make a request to publish a public key */
keyManager.port.on("publishKey", function(key){
	var addKeyRequest = Request({
		url: "https://grd.me/key/add",
		content: {
			uid: key.uid,
			pub: key.pub,
			sig: key.sig
		},
		onComplete: function (data) {
			data = data.json;
			if(!data || !data.status || !data.status[0] || data.status[0].code){
				keyManager.port.emit("publishResult", {success: false, index: key.index});				
			}
			else {
				ss.storage.uids.push(key.uid);
				ss.storage.uids = uniq(ss.storage.uids);
				ss.storage.keys[key.index].key.published = true;
				keyManager.port.emit("publishResult", {success: true, index: key.index});
				keyManager.port.emit("uids", ss.storage.uids);
				keyManager.refreshKeys();
			}
		}
	}).post();
});

/** Make a request to revoke a public key */
keyManager.port.on("revokeKey", function(key){
	var revokeKeyRequest = Request({
		url: "https://grd.me/key/revoke",
		content: {
			pub: key.pub,
			sig: key.sig
		},
		onComplete: function (data) {
			data = data.json;
			if(!data || !data.status || !data.status[0] || data.status[0].code){
				keyManager.port.emit("revokeResult", {success: false, index: key.index});
			}
			else {
				ss.storage.keys.splice(key.index, 1);
				keyManager.port.emit("revokeResult", {success: true, index: key.index});
				keyManager.refreshKeys();
			}
		}
	}).post();
});

/** Share a shared key with another user */
keyManager.port.on("shareKey", function(key){
	var shareKeyRequest = Request({
		url: "https://grd.me/key/shareKey",
		content: key,
		onComplete: function (data) {
			data = data.json;
			if(!data || !data.status || !data.status[0] || data.status[0].code){
				keyManager.port.emit("shareKeyResult", false);
			}
			else {
				keyManager.port.emit("shareKeyResult", true);
				ss.storage.randomMap[key.sharedKey] = key.rand;
			}
		}
	}).post();
});

/** Make a request to delete a shared key */
keyManager.port.on("deleteSharedKeyRequest", function(key){
	key.rand = ss.storage.randomMap[key.sharedKey];
	var deleteSharedKeyRequest = Request({
		url: "https://grd.me/key/deleteSharedKey",
		content: key,
		onComplete: function (data) {
			data = data.json;
			if(!data || !data.status || !data.status[0] || data.status[0].code){
				console.log("Error making delete shared key request");
			}
			else {
				delete ss.storage.randomMap[key.sharedKey];
			}
		}
	}).post();
});

/** Notify user of any symmetric keys shared with them */
keyManager.port.on("notifySharedKeys", function(keys){
	ss.storage.acceptableSharedKeys = keys;
	var length = keys.length;
	notifications.notify({
		title: "New Shared Key"+(length>1? "s" : ""),
		text: "You have "+length+" new shared key"+(length>1? "s" : "")+"!",
		iconURL: data.url("icons/icon64.png"),
		onClick: function(){
			timers.setTimeout(function(){
				button.state('window', {checked: true});
				keyManager.show();
			}, 0);
		}
	});
});

/** Prefpanel show event handler */
keyManager.on("show", function(){
	keyManager.port.emit("show", ss.storage.acceptableSharedKeys);
});

exports.keyManager = {
	/** Initialize the key manager
	 * workerArray: the workers array
	*/
	init: function(workerArray){
		workers = workerArray;
		
		for(var i=0; i<ss.storage.keys.length; i++){
			if(ss.storage.activeKeys[JSON.stringify(ss.storage.keys[i].key)]){
				keyManager.port.emit("activeKeyIndex", i);
			}
		}
		
		keyManager.refreshKeys();
	
		keyManager.port.emit("uids", ss.storage.uids);
		
		/** Check for shared keys and delete old shared keys - run every minute */
		timers.setInterval(function(){
			var keys = [];
			for(var i=0; i<ss.storage.keys.length; i++){
				if(ss.storage.keys[i].key.priv){
					keys.push(ss.storage.keys[i].key.pub);
				}
			}
			var checkShareKeyRequest = Request({
				url: "https://grd.me/key/checkSharedKey",
				content: {
					keys: keys
				},
				onComplete: function (data) {
					data = data.json;
					if(data && data.status && data.status[0] && !data.status[0].code){
						data.acceptableSharedKeys = ss.storage.acceptableSharedKeys;
						keyManager.port.emit("checkSharedKey", data);
					}
				}
			}).post();
		}, 60000);
	}
}