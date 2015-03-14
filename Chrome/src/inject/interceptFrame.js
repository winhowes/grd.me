/* This code handles the decrypted message iframe */

const padding = 5;

var decryptIndicator = true, locationObj, uid;

/** Receive a message from the content scripts */
function receiveMessage(event) {
	try{
		if(event.data.to != frameOrigin){
			return;
		}
		var data = event.data.encrypted;
		data = CryptoJS.AES.decrypt(data, FRAME_SECRET);
		data = data.toString(CryptoJS.enc.Utf8);
		if(!data){
			return;
		}
		data = JSON.parse(data);
		if(data.id == "decryptCallback"){
			$("body").trigger("callback", [data.returnId, data.plaintext]);
		}
		else if(data.id == "decryptIndicator"){
			decryptIndicator = data.decryptIndicator;
		}
		else if(data.id == "frameVerified"){
			frameVerified(data.data);
		}
	}
	catch(e){}
}

/** Send data to parent window
 * data: the data to send
*/
function msg(data) {
	data.uid = uid;
	data = CryptoJS.AES.encrypt(JSON.stringify(data), FRAME_SECRET);
	data = data.toString();
	parent.postMessage({
		encrypted: data,
		from: frameOrigin
	}, locationObj.origin);
}

/** Prepare a function to be called back and return its index
 * func: the callback function
*/
var callbackWrap;

/** Scan for any crypto on the page and decypt if possible */
function decryptInterval(){
	var elements = $(':contains("'+startTag+'"):not([crypto_mark="true"]):not([contenteditable="true"]):not(textarea):not(input):not(script)');
	elements.each(function(i, e){
		var elem = $(e);
		if(elem.find(':contains("'+startTag+'"):not([crypto_mark="true"])').length || elem.parents('[contenteditable="true"]').length){
			elem.attr('crypto_mark', true);
			return;
		}
		encryptParse(elem);
	});
}

/** Checks the height of the body and adjusts the frame height to match */
var checkHeight = (function(){
	var lastBodyHeight = 0;
	return function(){
		var outerHeight = $("body").outerHeight();
		//TODO: find out why they are off by 5
		if(lastBodyHeight - outerHeight > 5){
			lastBodyHeight = outerHeight;
			msg({
				id: "adjustHeight",
				height: lastBodyHeight + padding
			});
		}
	}
}());

/** Parse out the encrypted text and send it to be decrypted
 * elem: the element containing encrypted text
*/
function encryptParse(elem){
	elem.attr("crypto_mark", true);
	var text = elem.text();
	text = text.slice(text.indexOf(startTag) + startTag.length);
	if(text.indexOf(endTag) + 1){
		text = text.slice(0, text.indexOf(endTag));
	}
	msg({id: "decrypt", ciphertext: text, returnId: callbackWrap(function(plaintext){
		var html = elem.html();
		html = html.slice(0, html.indexOf(startTag)) + decryptMark(setupPlaintext(plaintext)) + (html.indexOf(endTag) + 1 ? html.slice(html.indexOf(endTag) + endTag.length) : "");
		elem.attr("crypto_mark", "").html(html);
		fixReferences();
	})});
}

/** Mark a piece of text as decrypted - only works if the decryptIndicator is true
 * plaintext: the text to be marked
 * NOTE: the plaintext is already sanitzed when this is called
*/
function decryptMark(plaintext){
	if(decryptIndicator){
		var wrapper = $("<i>").append($("<grdme_decrypt>").html(plaintext));
		var mark = DECRYPTED_MARK? DECRYPTED_MARK : $("<i>").append($("grdme").first().clone()).html();
		if(!DECRYPTED_MARK){
			DECRYPTED_MARK = mark;
		}
		plaintext = mark + " " + wrapper.html();
	}
	return plaintext;
}

/** Fix all references **/
function fixReferences(){
	var refs = ["href", "src"];
	for(var j=0; j<refs.length; j++){
		var key = refs[j];
		$("["+key+"]").each(function(i, e){
			if($(e).attr(key).trim().indexOf("http://") && $(e).attr(key).trim().indexOf("https://")){
				if($(e).attr(key).trim().charAt(0) === "/"){
					$(e).attr(key, locationObj.host + $(e).attr(key));
				}
				else {
					$(e).attr(key, locationObj.full + $(e).attr(key));
				}
			}
		});
	}
	$("a[href^='http']").css("cursor", "pointer");
}

/** Sanitize a string
 * str: the string to sanitize
*/
function sanitize(str){
	return $("<i>", {text: str}).html();
}

/** linkify and fix line breaks in plaintext
 * plaintext: the plaintext to modify
*/
function setupPlaintext(plaintext){
	return linkify(sanitize(plaintext).replace(/\n/g, "<br>"));
}

/** Get the unique selector for qn element
 * elem: the element for which to get the selector
*/
function getUniqueSelector(elem){
	if(elem.nodeName.toLowerCase() === "body" || elem.nodeName.toLowerCase() === "html"){
		return "[grdMeUID='"+uid+"']";
	}
    var parent = elem.parentNode;
    var selector = '>' + elem.nodeName + ':nth-child(' + ($(elem).index() + 1) + ')';
    while (parent && parent.nodeName.toLowerCase() !== 'body') {
        selector = '>' + parent.nodeName + ':nth-child(' + ($(parent).index() + 1) + ')' + selector;
        parent = parent.parentNode;
    }
    return "[grdMeUID='"+uid+"']" + selector;
}

/** Get all events for an element
 * an html element
*/
function getAllEvents(element) {
    var result = [], key;
    for (key in element) {
        if (key.indexOf('on') === 0) {
            result.push(key.slice(2));
        }
    }
    return result.join(' ');
}

/** Removes javascript from html string
 * html: the string to be cleaned
*/
function clean(html) {
	function stripHTML(){
		html = html.slice(0, strip) + html.slice(j);
		j = strip;
		strip = false;
	}
	
	var strip = false,
	lastQuote = false,
	tag = false;
	const prefix = "grdme",
	sandbox = " sandbox=''";
	
	for(var i=0; i<html.length; i++){
		if(html[i] === "<" && html[i+1] && isValidTagChar(html[i+1])) {
			i++;
			tag = false;
			/* Enter element */
			for(var j=i; j<html.length; j++){
				if(!lastQuote && html[j] === ">"){
					if(strip) {
						stripHTML();
					}
					/* sandbox iframes */
					if(tag === "iframe"){
						var index = html.slice(i, j).toLowerCase().indexOf("sandbox");
						if(index > 0) {
							html = html.slice(0, i+index) + prefix + html.slice(i+index);
							j += prefix.length;
						}
						html = html.slice(0, j) + sandbox + html.slice(j);
						j += sandbox.length;
					}
					i = j;
					break;
				}
				if(!tag && html[j] === " "){
					tag = html.slice(i, j).toLowerCase();
				}
				if(lastQuote === html[j]){
					lastQuote = false;
					continue;
				}
				if(!lastQuote && html[j-1] === "=" && (html[j] === "'" || html[j] === '"')){
					lastQuote = html[j];
				}
				/* Find on statements */
				if(!lastQuote && html[j-2] === " " && html[j-1] === "o" && html[j] === "n"){
					strip = j-2;
				}
				if(strip && html[j] === " " && !lastQuote){
					stripHTML();
				}
			}
		}
	}
	html = stripScripts(html);
	return html;
}

/** Returns whether or not the character is a valid first character in a tag
 * str: the first character
*/
function isValidTagChar(str) {
	return str.match(/[a-z?\\\/!]/i);
}

/** Strips scripts from a string of html
 * html: the string of html to be stripped
*/
function stripScripts(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    var scripts = div.getElementsByTagName('script');
    var i = scripts.length;
    while (i--) {
      scripts[i].parentNode.removeChild(scripts[i]);
    }
    return div.innerHTML;
}

/** The callback function for when the fram is verified
 * obj: an object containing the stylesheet CSS and font info
*/
function frameVerified(obj){
	stylesheetCSS = obj.stylesheetCSS || [],
	fonts = obj.fonts || [],
	
	$("html").css(messageCSS);
	var container = $("body").append(clean(messageText)).css(messageCSS);
	
	var style = $("<style>", {type: "text/css"});
	
	for(var i=0; i<fonts.length; i++){
		style.append(fonts[i]);
	}
	
	if(stylesheetCSS.length){
		for(i=0; i<stylesheetCSS.length; i++){
			for(var pseudo in stylesheetCSS[i].css){
				var pseudoClass = pseudo !== "normal"? pseudo : ""
				style.append(document.createTextNode(stylesheetCSS[i].selector + pseudoClass + "{"));
				for(key in stylesheetCSS[i].css[pseudo]){
					var value = $.trim(stylesheetCSS[i].css[pseudo][key]);
					/* Make sure there's no JS */
					if($.trim(value.toLowerCase().replace("url(", "")
							   .replace("'", "").replace('"', "")
							   .replace("/*", "").replace("*/", "")).indexOf("javascript")){
						style.append(document.createTextNode(key + ":" + value + ";"));
					}
				}
				style.append(document.createTextNode("}"));
			}
		}
	}
	else {
		for(i=0; i<childrenCSS.length; i++){
			$("body "+childrenCSS[i].selector).css(childrenCSS[i].css);
		}
	}
	
	$(document.head).append(style);
	
	$("html").bind(getAllEvents($("html").get(0)), function(e){
		msg({
			id: "event",
			event: {
				type: e.type.toString(),
				selector: getUniqueSelector(e.target)
			}
		});
	});
	
	$("body").on("click", "a", function(e){
		e.preventDefault();
		if($(this).attr("href")){
			msg({
				id: "click",
				href: $(this).attr("href"),
				target: $(this).attr("target")
			});
		}
	});
	
	$("html, body").css({
		padding: 0,
		margin: 0,
		height: "auto"
	});
	
	container.on("mouseover", "grdme", function(){
		$(this).next("grdme_decrypt").css("font-weight", $(this).next("grdme_decrypt").css("font-weight") < 700? 700 : 400);
	}).on("mouseleave", "grdme", function(){
		$(this).next("grdme_decrypt").css("font-weight", "");
	});
	
	checkHeight();
	setInterval(checkHeight, 500);
	
	fixReferences();
	
	callbackWrap = (function(){
		var callbackChain = [];
		$("body").on("callback", function(e, returnId, data){
			(typeof callbackChain[returnId] == "function") && callbackChain[returnId](data);
		});
		
		return function(func){
			return callbackChain.push(func) - 1;
		}
	}());
	
	initObserver(decryptInterval);
	
	msg({id: "ready"});
}

$(function(){
	frameVerified({});
	
	window.addEventListener("message", receiveMessage, false);
});