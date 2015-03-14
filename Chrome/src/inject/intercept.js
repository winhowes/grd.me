/** Intercept frames for sandboxed decryption */
var Intercept = (function(){
	var uidMap = {};
	/** Get custom fonts for document */
	var fonts = (function(){
		var fonts = [];
		for(var i=0; i<document.styleSheets.length; i++){
			try{
				for(var j=0; j<document.styleSheets[i].cssRules.length; j++){
					if(!document.styleSheets[i].cssRules[j].cssText.toLowerCase().indexOf("@font-face")){
						fonts.push(document.styleSheets[i].cssRules[j].cssText.replace(/javascript:/gi, ""));
					}
				}
			}
			catch(e){}
		}
		return fonts;
	}());
	
	return {
		/** Tell the background script to add a uid to the array
		 * data: an object containing:
		 *     uid: the unique id of a message
		 *     location: an object containing the host, origin, and full location of the frame's parent
		 *     secret: the window's symmetric key
		 *     message: the message object containing both the text and css object
		*/
		add: function(data){
			data.fonts = fonts;
			port.postMessage({id: "interceptAdd", data: data});
			var endings = ["?", "#"];
			for(var i=0; i<endings.length; i++){
				if(data.location.full.indexOf(endings[i]) > 0){
					data.location.full = data.location.full.slice(0, data.location.full.indexOf(endings[i]));
				}
			}
			uidMap[data.uid] = {
				location: data.location,
				secret: data.secret,
				message: data.message,
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
		},
		/** Set up an iframe to be intercepted
		 * uid: the uid of the iframe
		*/
		prepareIframe: function(uid){
			var elem = $("[grdMeUID='"+uid+"']");
			elem.append($("<iframe>", {src: 'https://decrypt.grd.me/'+uid, "grdMeFrameUID" : uid, seamless: "seamless"}).css({
				border: 0,
				width: elem.css("display") === "block"? elem.width() > 0 ? elem.outerWidth() : "auto" : "100%",
				height: elem.outerHeight(),
				"margin-bottom": "-7px"
			}).hide()).css("display", "block");
		}
	}
}());