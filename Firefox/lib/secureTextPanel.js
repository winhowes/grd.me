/** This file handles the secure text box chrome logic */
var clipboard = require("sdk/clipboard");
var data = require("sdk/self").data;
var Panel = require("sdk/panel").Panel;
var ss = require("sdk/simple-storage");

var secureTextPanel = Panel({
	contentURL: data.url("secureTextPanel/secureText.html"),
	contentStyleFile: data.url("secureTextPanel/secureText.css"),
	contentScriptFile: [data.url("lib/aes.js"),
						data.url('lib/ecc.js'),
						data.url('lib/sha256.js'),
						data.url("lib/jquery-2.1.3.js"),
						data.url("lib/mousetrap.js"),
						data.url("lib/linkify.js"),
						data.url("constants.js"),
						data.url("observer.js"),
						data.url("crypt.js")],
	width: 300,
	height: 235
});

secureTextPanel.port.on("copy_ciphertext", function(text){
	clipboard.set(text, "text");
});

secureTextPanel.port.emit("panelMode");

secureTextPanel.on("show", function(){
	secureTextPanel.port.emit("secret", {active: ss.storage.activeKeys, keys: ss.storage.keys});
	secureTextPanel.port.emit("show");
});

exports.secureTextPanel = secureTextPanel;