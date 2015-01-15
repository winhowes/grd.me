/** This is the main file */

var pageMod = require("sdk/page-mod");
var data = require("sdk/self").data;
var tabs = require("sdk/tabs");
var Panel = require("sdk/panel").Panel;
var clipboard = require("sdk/clipboard");
var ss = require("sdk/simple-storage");
var workers = [];

ss.storage.keys = ss.storage.keys || [{
	key: ":N5gaDV7)\P3.r5",
	description: "This is Grd Me's default shared key"
}];

if(!ss.storage.activeKeys){
	ss.storage.activeKeys = [ss.storage.keys[0].key];
}
for(var i=0; i<ss.storage.activeKeys.length; i++){
	ss.storage.activeKeys[JSON.stringify(ss.storage.activeKeys[i])] = true;
}

function handleChange(state) {
	if (state.checked) {
		prefPanel.show();
	}
}

function handleHide() {
	button.state('window', {checked: false});
}

var button = require("sdk/ui/button/toggle").ToggleButton({
	id: "crypt_btn",
	label: "Grd Me Key Management",
	icon: data.url("icons/icon64.png"),
	onChange: handleChange
});

var prefPanel = Panel({
	contentURL: data.url("prefs.html"),
	contentStyleFile: data.url("prefs.css"),
	contentScriptFile: [data.url("lib/jquery-2.1.3.min.js"),
						data.url('lib/ecc.min.js'),
						data.url("prefs.js")],
	position: button,
	onHide: handleHide,
	width: 300,
	height: 400
});

for(var i=0; i<ss.storage.keys.length; i++){
	if(ss.storage.activeKeys[JSON.stringify(ss.storage.keys[i].key)]){
		prefPanel.port.emit("activeKeyIndex", i);
	}
}

prefPanel.port.emit("displayKeys", ss.storage.keys);

prefPanel.port.on("setActiveKeys", function(indices){
	ss.storage.activeKeys = [];
	for(var i=0; i<indices.length; i++){
		ss.storage.activeKeys.push(ss.storage.keys[indices[i]].key);
		ss.storage.activeKeys[JSON.stringify(ss.storage.keys[indices[i]].key)] = true;
	}
	for(i=0; i<workers.length; i++){
		workers[i].port.emit("secret", {active: ss.storage.activeKeys, keys: ss.storage.keys});
	}
});

prefPanel.port.on("addKey", function(keyObj){
	ss.storage.keys.push(keyObj);
	prefPanel.port.emit("displayKeys", ss.storage.keys);
});

prefPanel.port.on("deleteKey", function(index){
	ss.storage.keys.splice(index, 1);
	prefPanel.port.emit("displayKeys", ss.storage.keys);
});

exports.main = function(options){
	var secureTextPanel = Panel({
		contentURL: data.url("secureText.html"),
		contentStyleFile: data.url("secureText.css"),
		contentScriptFile: [data.url("lib/aes.js"),
							data.url('lib/ecc.min.js'),
							data.url("lib/jquery-2.1.3.min.js"),
							data.url("lib/mousetrap.min.js"),
							data.url("lib/linkify.min.js"),
							data.url("crypt.js")],
		width: 300,
		height: 235
	});
	
	secureTextPanel.port.on("copy_ciphertext", function(text){
		clipboard.set(text, "text");
	});
	
	secureTextPanel.port.emit("secret", {active: ss.storage.activeKeys, keys: ss.storage.keys});
	
	secureTextPanel.port.emit("panelMode");
	
	secureTextPanel.on("show", function(){
		secureTextPanel.port.emit("show");
	});
	
	pageMod.PageMod({
		include: ["*"],
		contentScriptFile: [data.url("lib/aes.js"),
							data.url('lib/ecc.min.js'),
							data.url("lib/jquery-2.1.3.min.js"),
							data.url("lib/mousetrap.min.js"),
							data.url("lib/linkify.min.js"),
							data.url("crypt.js")],
		contentScriptWhen: "ready",
		attachTo: ["existing", "top", "frame"],
		onAttach: function(worker){
			workers.push(worker);
			
			worker.on('detach', function () {
				detachWorker(this, workers);
			});
			
			worker.port.emit("secret", {active: ss.storage.activeKeys, keys: ss.storage.keys});
			
			worker.port.on("copy_ciphertext", function(text){
				clipboard.set(text, "text");
			});
			
			worker.port.on("secureText", function(){
				secureTextPanel.show();
			});
			
			if(tabs.activeTab===worker.tab){
				worker.port.emit("activeTab");
			}
		}
	});
}

tabs.on("activate", function(tab){
	for(var i=0; i<workers.length; i++){
		if(workers[i].tab===tab){
			workers[i].port.emit("activeTab");
		}
	}
});

tabs.on("deactivate", function(tab){
	for(var i=0; i<workers.length; i++){
		if(workers[i].tab===tab){
			workers[i].port.emit("unactiveTab");
		}
	}
});

function detachWorker(worker, workerArray) {
  var index = workerArray.indexOf(worker);
  if(index != -1) {
    workerArray.splice(index, 1);
  }
}