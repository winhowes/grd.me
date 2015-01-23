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