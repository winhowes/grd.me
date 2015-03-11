/** This file handles interception of frame requests for decryption */

var data = require("sdk/self").data;
var { Cc, Ci, Cu } = require('chrome');
var domUtil = Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils);
var windowController = require("sdk/window/utils");
var events = require("sdk/system/events");

Cu.import("resource://gre/modules/Services.jsm");

const frameOrigin = "https://decrypt.grd.me";

var uidMap = {}; //A map of uids to origins, secrets, and message objects

/** Returns a string of an html div with particular JSON encoded contend and an id
 * id: the id of the div tag
 * content: the content to be encoded and inserted into the html string
*/
function divWrap(id, content){
	return "<div id='"+id+"'>"+encodeURIComponent(content)+"</div>";
}

/** Intercept requests to decrypt.grd.me */
function requestListener(event){
	event.subject.QueryInterface(Ci.nsIHttpChannel);
	let url = event.subject.URI.spec;
	if(!url.indexOf(frameOrigin)) {
		let uid = event.subject.URI.path;
		uid  = uid && uid.slice(1);
		event.subject.redirectTo(Services.io.newURI("data:text/html," +
		encodeURIComponent(
		  data.load("utf8Meta.phtml") +
		  /* These values are untainted and created by grdMe and therefore don't need to be sanitized */
		  divWrap("frameSecret", uidMap[uid].secret) +
		  divWrap("uid", uid)
		), null, null));
	}
}

/** Add decrypt.grd.me as an approved content source in the csp */
function responseListener(event){
	event.subject.QueryInterface(Ci.nsIHttpChannel);
	try{
		var csp = event.subject.getResponseHeader("content-security-policy"),
		rules = csp.split(';'),
		frameFound = false,
		defaultFound = false;
		
		if(rules[rules.length - 1].length === 0){
			rules.splice(rules.length - 1, 1);
		}
		
		for(var i=0; i<rules.length; i++){
			if(!rules[i].trim().toLowerCase().indexOf("frame-src")){
				frameFound = true;
				rules[i] = rules[i].toLowerCase().replace("'none'", "") + " " + frameOrigin + " data:;";
				break;
			}
			else if(!rules[i].trim().toLowerCase().indexOf("default-src")){
				defaultFound = rules[i].trim().toLowerCase().replace("default-src", "");
				if(frameFound){
					break;
				}
			}
		}
		if(!frameFound && defaultFound !== "*"){
			rules.push("frame-src " + defaultFound + " "+ frameOrigin + " data:;");
		}
		csp = rules.join(";");
		
		event.subject.setResponseHeader('content-security-policy', csp, false);		
	}
	catch(e){}
}

events.on("http-on-modify-request", requestListener);
events.on("http-on-examine-response", responseListener);

exports.Intercept = {
	/** Add a uid to the array
	 * uid: the unique id of a message
	 * location: an object containing the host, origin, and full location of the frame's parent
	 * secret: the window's symmetric key
	 * message: the message object containing both the text and css object
	*/
	add: function(uid, location, secret, message){
		var endings = ["?", "#"];
		for(var i=0; i<endings.length; i++){
			if(location.full.indexOf(endings[i]) > 0){
				location.full = location.full.slice(0, location.full.indexOf(endings[i]));
			}
		}
		uidMap[uid] = {
			location: location,
			secret: secret,
			message: message
		}
	},
	/** Get the info for a frame with a particular uid and secret
	 * uid: the uid of the frame
	 * secret: the secret of the frame
	 * callback: a callback function to receive the info
	*/
	getInfo: function(uid, secret, callback){
		function listener(message){
			callback({
				messageText: uidMap[uid].message.text,
				locationObj: uidMap[uid].location,
				fonts: message.data.fonts,
				stylesheetCSS: message.data.css,
				childrenCSS: uidMap[uid].message.childrenCSS,
				messageCSS: uidMap[uid].message.css
			});
			messageManager.removeMessageListener("grdMe@grd.me:get-frame-css:"+uid, listener);
		}
			
		if(uidMap[uid] && uidMap[uid].secret === secret){
			var messageManager = windowController.getMostRecentBrowserWindow().gBrowser.selectedBrowser.messageManager;
			messageManager.loadFrameScript(data.url("chromeFrame.js"), false);
			messageManager.sendAsyncMessage("grdMe@grd.me:fetch-frame-css", {
				uid: uid
			});
			messageManager.addMessageListener("grdMe@grd.me:get-frame-css:"+uid, listener);
		}
		else {
			callback(false);
		}
	}
};