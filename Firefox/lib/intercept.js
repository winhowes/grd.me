/** This file handles interception of frame requests for decryption */

var data = require("sdk/self").data;
var { Cc, Ci, Cu } = require('chrome')
var domUtil = Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils);
var windowController = require("sdk/window/utils");
var events = require("sdk/system/events");

Cu.import("resource://gre/modules/Services.jsm");

const failMessage = data.load("interceptFail.phtml"),
frameOrigin = "https://decrypt.grd.me";

var uidMap = {}; //A map of uids to origins, secrets, and message objects

/** Wrap a piece of JS in script tags
 * js: the JS to wrap
*/
function scriptWrap(js){
	return "<script>"+js+"</script>";
}

/** Get the index of an element in regards to its parent
 * element: the element to index
*/
function indexEl(element){
	var nodeList = Array.prototype.slice.call(element.parentNode.children);
	return nodeList.indexOf(element);
}

/** Get the unique selector for qn element
 * elem: the element for which to get the selector
 * stop: the parent the selector should be relative to
*/
function getUniqueSelector(elem, stop){
    var parent = elem.parentNode;
	if(elem.hasAttribute("grdMeAnchor")){
		return "body "+elem.nodeName;
	}
    var selector = '>' + elem.nodeName + ':nth-child(' + (indexEl(elem) + 1) + ')';
    while (parent && parent !== stop) {
        selector = '>' + parent.nodeName + ':nth-child(' + (indexEl(parent) + 1) + ')' + selector;
        parent = parent.parentNode;
    }
    return "body"+selector;
}

/** Get custom fonts for document
 * doc: the document
*/
function getFonts(doc){
	var fonts = [];
	for(var i=0; i<doc.styleSheets.length; i++){
		try{
			for(var j=0; j<doc.styleSheets[i].cssRules.length; j++){
				if(!doc.styleSheets[i].cssRules[j].cssText.toLowerCase().indexOf("@font-face")){
					fonts.push(doc.styleSheets[i].cssRules[j].cssText.replace(/javascript:/i, ""));
				}
			}
		}
		catch(e){}
	}
	return fonts;
}

/** Determines whether or not a stylesheet is a page stylesheet (ie not of the browser)
 * styleSheet: the styleSheet in question
*/
function isPageStyle(styleSheet){
  if(styleSheet.ownerNode){
    return true;
  }

  if(styleSheet.ownerRule instanceof Ci.nsIDOMCSSImportRule){
    return isPageStyle(styleSheet.parentStyleSheet);
  }

  return false;
}

/** Return an array of selectors and css objects for children of an element
 * parent: the parent element to search down from
 * window: the element's window
*/
function setupChildren(parent, window){
	const states = [{
		state: ":active",
		prop: 0x01
	},
	{
		state: ":focus",
		prop: 0x02
	},
	{
		state: ":hover",
		prop: 0x04
	},
	{
		state: ":before"
	},
	{
		state: ":after"
	}];
	
	var cssArr = [];
	var elements = parent.querySelectorAll("*");
	for(var i=0; i<elements.length; i++){
		var css = {
			normal: getCSS(elements[i], window)
		};
		if(elements[i].nodeName.toLowerCase() !== "grdme"){
			for(var j=0; j<states.length; j++){
				if(states[j].prop){
					domUtil.setContentState(elements[i], states[j].prop);
				}
				css[states[j].state] = getCSS(elements[i], window);
				var rules = domUtil.getCSSStyleRules(elements[i]);
				if(rules){
					for(var k=0; k<rules.Count(); k++){
						var rule = rules.GetElementAt(k);
						if(isPageStyle(rule.parentStyleSheet)){
							for(var m=0; m<rule.style.length; m++){
								css[states[j].state][rule.style[m]] = rule.style[rule.style[m]];
							}
						}
					}
				}
				if(states[j].prop){
					domUtil.setContentState(elements[i], window);
				}
			}
		}
		cssArr.push({
			selector: getUniqueSelector(elements[i], parent),
			css: css
		});
	}
	return cssArr;
}

/** Return an object of all CSS attributes for a given element
 * element: the element whose CSS attributes are to be returned
 * window: the element's window
*/
function getCSS(element, window){
    var dest = {},
    style, prop;
    if (window.getComputedStyle) {
        if (style = window.getComputedStyle(element, null)) {
            var val;
            if (style.length) {
                for (var i = 0, l = style.length; i < l; i++) {
                    prop = style[i];
					if(!(element.hasAttribute("grdMeAnchor") && prop.toLowerCase() === "display")){
						val = style.getPropertyValue(prop);
						dest[prop] = val;
					}
                }
            } else {
                for (prop in style) {
					if(!(element.hasAttribute("grdMeAnchor") && prop.toLowerCase() === "display")){
						val = style.getPropertyValue(prop) || style[prop];
						dest[prop] = val;
					}
                }
            }
            return dest;
        }
    }
    if (style = element.currentStyle) {
        for (prop in style) {
            dest[prop] = style[prop];
        }
        return dest;
    }
    if (style = element.style) {
        for (prop in style) {
            if (typeof style[prop] != 'function') {
                dest[prop] = style[prop];
            }
        }
    }
    return dest;
}

/** Intercept requests to decrypt.grd.me */
function requestListener(event){
	event.subject.QueryInterface(Ci.nsIHttpChannel);
	let url = event.subject.URI.spec;
	if(!url.indexOf(frameOrigin)) {
		let uid = event.subject.URI.path;
		uid  = uid && uid.slice(1);
		var cssArr = [],
		fonts = [];
		browserWindow = windowController.getMostRecentBrowserWindow();
		if(browserWindow && "gBrowser" in browserWindow){
			var doc = browserWindow.gBrowser.contentDocument;
			var element = doc.querySelector("[grdMeUID='"+uid+"']");
			cssArr = setupChildren(element, browserWindow);
			fonts = getFonts(doc);
		}
		event.subject.redirectTo(Services.io.newURI("data:text/html," +
			encodeURIComponent(
			  data.load("utf8Meta.phtml") +
			  scriptWrap(
				  uidMap[uid]? "uid=" + JSON.stringify(uid) +
				  ";locationObj=" + JSON.stringify(uidMap[uid].location) +
				  ";FRAME_SECRET=" + JSON.stringify(uidMap[uid].secret) +
				  ";messageText=" + JSON.stringify(uidMap[uid].message.text) +
				  ";fonts=" + JSON.stringify(fonts) +
				  ";fullCSS=" + JSON.stringify(cssArr) +
				  ";childrenCSS=" + JSON.stringify(uidMap[uid].message.childrenCSS) +
				  ";messageCSS=" + JSON.stringify(uidMap[uid].message.css) + ";" +
				  data.load("lib/jquery-2.1.3.min.js") +
				  data.load("lib/linkify.min.js") +
				  data.load("lib/aes.js") +
				  data.load("observer.js") +
				  data.load("constants.js") + 
				  data.load("intercept.js") : failMessage
			  )
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
		if(!frameFound){
			if(defaultFound !== "*"){
				rules.push("frame-src " + defaultFound + " "+ frameOrigin + " data:;");
			}
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
	}
};