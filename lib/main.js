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

ss.storage.activeKey = ss.storage.activeKey || ss.storage.keys[0].key;

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
	label: "FP Chat Preferences",
	icon: data.url("img/logo.png"),
	onChange: handleChange
});

var prefPanel = Panel({
	contentURL: data.url("prefs.html"),
	contentStyleFile: data.url("prefs.css"),
	contentScriptFile: [data.url("lib/jquery-2.1.3.min.js"),
						data.url('lib/crypto/ext/jsbn.min.js'),
						data.url('lib/crypto/ext/jsbn2.min.js'),
						data.url('lib/crypto/ext/prng4.min.js'),
						data.url('lib/crypto/ext/rng.min.js'),
						data.url('lib/crypto/ext/ec.min.js'),
                        data.url('lib/crypto/ext/ec-patch.min.js'),
						data.url("lib/crypto/ecdsa-modified-1.0.min.js"),
						data.url('lib/crypto/ecparam-1.0.min.js'),
						data.url("prefs.js")],
	position: button,
	onHide: handleHide,
	width: 300
});

prefPanel.port.emit("displayKeys", ss.storage.keys);

for(var i=0; i<ss.storage.keys.length; i++){
	if(ss.storage.activeKey == ss.storage.keys[i].key){
		prefPanel.port.emit("activeKeyIndex", i);
		break;
	}
}

prefPanel.port.on("setActiveKey", function(index){
	ss.storage.activeKey = ss.storage.keys[index].key;
	for(var i=0; i<workers.length; i++){
		workers[i].port.emit("secret", {active: ss.storage.activeKey, keys: ss.storage.keys});
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
		contentScriptFile: [data.url("lib/crypto/aes.js"),
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
	
	secureTextPanel.port.emit("secret", {active: ss.storage.activeKey, keys: ss.storage.keys});
	
	secureTextPanel.port.emit("panelMode");
	
	secureTextPanel.on("show", function(){
		secureTextPanel.port.emit("show");
	});
	
	pageMod.PageMod({
		include: ["*"],
		contentScriptFile: [data.url("lib/crypto/aes.js"),
							data.url("lib/jquery-2.1.3.min.js"),
							data.url("lib/mousetrap.min.js"),
							data.url("lib/linkify.min.js"),
							data.url("crypt.js")],
		contentScriptWhen: "ready",
		onAttach: function(worker){
			workers.push(worker);
			worker.on('detach', function () {
				detachWorker(this, workers);
			});
			
			worker.port.emit("secret", {active: ss.storage.activeKey, keys: ss.storage.keys});
			
			worker.port.on("copy_ciphertext", function(text){
				clipboard.set(text, "text");
			});
			
			worker.port.on("secureText", function(){
				secureTextPanel.show();
			});
		}
	});
}

function detachWorker(worker, workerArray) {
  var index = workerArray.indexOf(worker);
  if(index != -1) {
    workerArray.splice(index, 1);
  }
}