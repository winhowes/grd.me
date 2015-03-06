/** This is the main file */

var workers = [];
var keyObj = {keys: [], activeKeys: []};

/** Get the active keys
 * keys: the keys object to set the active keys if none is set
 * callback: a function which takes the active keys as it's first parameter
*/
function getActiveKeys(keys, callback){
	chrome.storage.local.get("activeKeys", function(activeKeys){
		activeKeys = activeKeys&&activeKeys.activeKeys;
		if(!activeKeys||!activeKeys.length){
			activeKeys = [keys[0].key];
			chrome.storage.local.set({'activeKeys': activeKeys}, function(){
				if(callback){
				  callback(activeKeys);
				}
			});
		}
		else if(callback){
			callback(activeKeys);
		}
	});
}

/** Remove workers from array
 * worker: the worker to remove
 * workerArray: the array to remove the worker from
*/
function detachWorker(worker, workerArray) {
	var index = workerArray.indexOf(worker);
	if(index != -1) {
		workerArray.splice(index, 1);
	}
}

/** The main function
 * keys: an array of all keys
 * activeKeys: an array of all activeKeys
*/
function main(keys, activeKeys){
	keyObj.keys = keys.slice(0);
	keyObj.activeKeys = activeKeys.slice(0);
	
	var securePopup = false;
	chrome.runtime.onConnect.addListener(function(port){
		workers.push(port);
		
		port.postMessage({
			id: "secret",
			active: keyObj.activeKeys,
			keys: keyObj.keys
		});
		
		if(securePopup){
			port.postMessage({id: "panelMode"});
			securePopup = false;
		}
		
		port.onMessage.addListener(function(msg) {
			if (msg.id == "copy_ciphertext"){
				var input = document.createElement('textarea');
				document.body.appendChild(input);
				input.value = msg.text;
				input.focus();
				input.select();
				document.execCommand('Copy');
				input.remove();
			}
			else if (msg.id == "secureText"){
				securePopup = true;
				var w = 300;
				var h = 235;
				var left = Math.floor((screen.width/2)-(w/2));
				var top = Math.floor((screen.height/2)-(h/2));
				chrome.windows.create({
					url: chrome.extension.getURL('src/popup/popup.html'),
					focused: true,
					type: "popup",
					width: w,
					height: h,
					top: top,
					left: left
				});
			}
		});
		
		port.onDisconnect.addListener(function(port){
			detachWorker(port, workers);
		});	
	});
}

/** Initialize preferences */	
chrome.storage.sync.get("decryptIndicator", function(items) {
	if(items.decryptIndicator!==false){
		chrome.storage.sync.set({
			decryptIndicator: true
		});
	}
});

/** Initialize Random Map */
chrome.storage.local.get("randomMap", function(items){
	var randomMap = (items&&items.randomMap) || {};
	chrome.storage.local.set({'randomMap': randomMap});
});

/** Initialize the acceptasbleSharedKeysArrar */
chrome.storage.local.get("acceptableSharedKeys", function(keys){
	keys = (keys&&keys.acceptableSharedKeys) || [];
	chrome.storage.local.set({'acceptableSharedKeys': keys});
});

chrome.storage.local.get("keys", function(keys){
	keys = keys&&keys.keys;
	if(!keys||!keys.length){
		keys = [{
			key: ":N5gaDV7)\P3.r5",
			description: "This is Grd Me's default shared key"
		}];
		chrome.storage.local.set({'keys': keys}, function(){
			getActiveKeys(keys, function(activeKeys){
				main(keys, activeKeys);
			});
		});
	}
	else{
		getActiveKeys(keys, function(activeKeys){
			main(keys, activeKeys);
		});
	}
});

/** Post a notification of a key having been shared with the user */
function notifySharedKeys(keys){
	chrome.notifications.getPermissionLevel(function(level){
		if(level!=="granted"){
			return;
		}
		var length = keys.length;
		chrome.notifications.create("GrdMeNewSharedKey", {
			type: "basic",
			iconUrl: chrome.extension.getURL('icons/icon48.png'),
			title: "New Shared Key"+(length>1? "s" : ""),
			message: "You have "+length+" new shared key"+(length>1? "s" : "")+"!"
		}, function(){});
	});
}

/** Focus the active window on notification click */
chrome.notifications.onClicked.addListener(function(id){
	if(id==="GrdMeNewSharedKey"){
		chrome.windows.getCurrent(null, function(window){
			chrome.windows.update(window.id, {focused: true}, function(){});
		});
	}
});

/** Check shared keys */
function checkSharedKey(data){
	chrome.storage.local.get("keys", function(items){
		keyObj.keys = items.keys;
		/* Handle receiving keys shared with this user */
		var index,
		keyChain = keyObj.keys,
		original_length = data.acceptableSharedKeys.length;
		for(var i=0; i<data.received.length; i++){
			try{
				var sig = JSON.parse(data.received[i].sendSig);
				if(ecc.verify(data.received[i].fromKey, sig, data.received[i].sharedKey)){
					for(var j=0; j<keyChain.length; j++){
						if(keyChain[j].key.priv){
							try{
								var key = String(ecc.decrypt(keyChain[j].key.priv, data.received[i].sharedKey)).slice(0, 32);
								if(key){
									var from = "";
									for(var k = 0; k<keyChain.length; k++){
										if(keyChain[k].key.pub == data.received[i].fromKey){
											from = keyChain[k].description;
											break;
										}
									}
									data.acceptableSharedKeys.push({key: key, from: from});
									data.acceptableSharedKeys = uniq(data.acceptableSharedKeys);
									for(k = 0; k<data.acceptableSharedKeys.length; k++){
										if(data.acceptableSharedKeys[k].key===key && data.acceptableSharedKeys[k].from === from){
											index = k;
											break;
										}
									}
									acknowledgeKey({
										fromKey: data.received[i].fromKey,
										toKey: data.received[i].toKey,
										sharedKey: data.received[i].sharedKey,
										receiveSig: JSON.stringify(ecc.sign(keyChain[j].key.priv, data.received[i].sharedKey))
									}, index);
								}
							}
							catch(e){}
						}
					}
				}
			}
			catch(e){}
		}
		//Notify user of acceptable keys
		data.acceptableSharedKeys = uniq(data.acceptableSharedKeys);
		if(data.acceptableSharedKeys.length != original_length){
			notifySharedKeys(data.acceptableSharedKeys);
			chrome.storage.local.set({"acceptableSharedKeys": data.acceptableSharedKeys});
		}
		
		/* Handle receiving acknowledgements of shared keys */
		for(i=0; i<data.sent.length; i++){
			try{
				var sig = JSON.parse(data.sent[i].receiveSig);
				if(ecc.verify(data.sent[i].toKey, sig, data.sent[i].sharedKey)){
					deleteSharedKeyRequest({fromKey: data.sent[i].fromKey, sharedKey: data.sent[i].sharedKey});
				}
			}
			catch(e){}
		}
	});
}

/** Make a request to delete a shared key
 * keyObj: an object containing the sender's public key, the encrypted shared key and the random number
*/
function deleteSharedKeyRequest(keyObj){
	function error(){
		console.log("Error making delete shared key request");
	}
	chrome.storage.local.get("randomMap", function(items){
		var randomMap = items.randomMap;
		keyObj.rand = randomMap[keyObj.sharedKey];
		$.ajax({
			url: "https://grd.me/key/deleteSharedKey",
			type: "POST",
			data: keyObj,
			success: function(data){
				if(!data || !data.status || !data.status[0] || data.status[0].code){
					error();
				}
				else {
					delete randomMap[keyObj.sharedKey];
					chrome.storage.local.set({"randomMap": randomMap});
				}
			},
			error: error
		});
	});
}

/** Acknowledge receiving a shared key
 * keyObj: an object of key data to send
*/
function acknowledgeKey(keyObj, index){
	$.ajax({
		url: "https://grd.me/key/acceptSharedKey",
		type: "POST",
		data: keyObj,
		error: function(){
			console.log("Error acknowledging shared key received");
		}
	});
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
         var item = JSON.stringify(arr[i]);
         if(seen[item] !== 1) {
               seen[item] = 1;
               out[j++] = JSON.parse(item);
         }
    }
    return out;
}

/** Check for shared keys and delete old shared keys - run every minute */
setInterval(function(){
	chrome.storage.local.get("keys", function(items){
		keyObj.keys = items.keys;
		var keys = [];
		for(var i=0; i<keyObj.keys.length; i++){
			if(keyObj.keys[i].key.priv){
				keys.push(keyObj.keys[i].key.pub);
			}
		}
		$.ajax({
			url: "https://grd.me/key/checkSharedKey",
			type: "POST",
			data: {
				keys: keys
			},
			success: function (data) {
				if(data && data.status && data.status[0] && !data.status[0].code){
					chrome.storage.local.get("acceptableSharedKeys", function(items){
						data.acceptableSharedKeys = items.acceptableSharedKeys;
						checkSharedKey(data);
					});
				}
			}
		});
	});	
}, 60000);