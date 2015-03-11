/** This file handles the page encryption and decryption */

var secrets = (self.options && self.options.active) || [],
keyList = (self.options && self.options.keys) || [],
decryptIndicator = (self.options && self.options.decryptIndicator) || false,
sandboxDecrypt = (self.options && self.options.sandboxDecrypt) || false,
panelMode = false;

/** Called to update the keyring and the active keys */
self.port.on("secret", function(secret_obj){
	secrets = secret_obj.active;
	keyList = secret_obj.keys;
});

/** Called to toggle displaying the decrypt indicator */
self.port.on("decryptIndicator", function(indicate){
	decryptIndicator = indicate;
	$("[grdMeFrameUID]").each(function(i, e){
		msg($(e).attr("grdMeFrameUID"), {id: "decryptIndicator", decryptIndicator: indicate});
	});
});

/** Called to toggle sandboxed decryption */
self.port.on("sandboxDecrypt", function(indicate){
	sandboxDecrypt = indicate;
});

/** Called if crypt is to run into panel mode */
self.port.on("panelMode", function(){
	panelMode = true;
	Mousetrap.unbind('mod+alt+e');
	$("#clipboard").hide();
	self.port.on("show", function onShow() {
		$("textArea").focus().select();
	});
});

/** Notify user that their message was copied to clipboard */
self.port.on("message_add_fail", function(){
	alert("Failed to make short message.\nCiphertext copied to clipboard.");
});

/** Append iframe of decrypted message */
self.port.on("preparedIframe", function(uid){
	var elem = $("[grdMeUID='"+uid+"']");
	elem.append($("<iframe>", {src: 'https://decrypt.grd.me/'+uid, "grdMeFrameUID" : uid, seamless: "seamless"}).css({
		border: 0,
		width: elem.css("display") === "block"? elem.width() > 0 ? elem.outerWidth() : "auto" : "100%",
		height: elem.outerHeight(),
		"margin-bottom": "-7px"
	}).hide()).css("display", "block");
});

/** Create the grdMe lock icon and establish the frame secret */
setTimeout(function(){
	container = $("<i>");
	$("<grdme>").attr("title", "Decrypted with Grd Me").css({
		"width": "15px",
		"height": "16px",
		"display": "inline-block",
		"background-repeat": "no-repeat",
		"vertical-align": "middle",
		"background-image": "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAQCAYAAADJViUEAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAVlpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KTMInWQAAAs9JREFUKBVtU01IVFEUPve+efPmR0XT/sykSERTSXJTUakEwRhtAmsRKEW1iBCCKKhFbyot2hQu2rQJoyAjgkxTbDFGbZLQRZgK6cJIBcefZubNz3v3ns59jlbQ2VzeOec753zfOY/BmjV3a/DypKi9MdC6IrQHtkCGAJIxxn0c7VyPc27kTugNZPMUjLlYRAaMYaijb+P4smdM08VFzc7024wXFPhhwUp7W1OCXWsN6WVmY6MD2XyPCw67RTDm+Io17iyX6L7XkfaQQ7GYiu83+1/MJllbZMgqos85CIdVU+QquGZSswVNwGM5kO/6OvsM9c4neCEgFObpBjH5Y1lweN2DthA1VxrjrqOtKa3ew7v1mXwdzZRXrPrNm24Rd+wGqOcREscQiHxTfsnnR6ODVRxsZynOMtE4DE0ITQc+7ZPWU7eogtLgBEYWMZniB4u+YIunotwv0TnIPV5w5E9ILTrAdAOEdA7FM/YtSotBViMaW20EoPbeh+vp4m1XZSaBmLRskUoIKUjYDOmcTqQdIWDG8tw/0vG+/MLWL5rCuJzrWrpKU0VF7ZgTBCZRAOc6Rym9aI9zTosBoNa2SPDgie8rcnhkdr5wHXy8q2WOSTlJyyZRUfBAHujCeTXRVlfpN1gv6H5F0UFhE4b9OFYfWFgFd6NmAmRY0hpmxJOCElHSacEWleAg2wz0TYZKBy+Xn9xDoUvjDWMRtXAIRJeegWUBaJwRTxCM76zpHL4kHdwOijtR5CIDeZp8rvKh2RVczUohOs/qh8O9sqKqScSjaapoONEkJMamkBmazQIbvMF0tHvy7tFTYNJxmUwqwTB7blA2+vE0fPs6wJlhgEcHmYonkHP6M3K9/tRCT8OO6TNuV9rVv2aarvLKWRsePF/5ZCK+6/EUll5+92uPOXh2PVl1/a+pAuqPIdtn9uytuh3pOWC+rV7NJf9fDZTvN2MXRNKRmI9oAAAAAElFTkSuQmCC)"
	}).appendTo(container);
	DECRYPTED_MARK = container.html();
	
	FRAME_SECRET = getRandomString(64);
	
	$("body").on("mouseover", "grdme", function(){
		$(this).next("grdme_decrypt").css("font-weight", $(this).next("grdme_decrypt").css("font-weight") < 700? 700 : 400);
	}).on("mouseleave", "grdme", function(){
		$(this).next("grdme_decrypt").css("font-weight", "");
	});
}, 0);

/** Prepare a function to be called back and return its index
 * func: the callback function
*/
var callbackWrap = (function(){
	callbackChain = [];
	
	self.port.on("callback", function(obj){
		(typeof callbackChain[obj.index] == "function") && callbackChain[obj.index](obj.data);
	});
	
	return function(func){
		return callbackChain.push(func) - 1;
	}
}());

/** Get the unique selector for qn element
 * elem: the element for which to get the selector
 * stop: the parent the selector should be relative to
*/
function getUniqueSelector(elem, stop){
    var parent = elem.parentNode;
    var selector = '>' + elem.nodeName + ':nth-child(' + ($(elem).index() + 1) + ')';
    while (parent && parent !== stop) {
        selector = '>' + parent.nodeName + ':nth-child(' + ($(parent).index() + 1) + ')' + selector;
        parent = parent.parentNode;
    }
    return selector;
}

/** Return an array of selectors and css objects for children of an element
 * parent: the parent element to search down from
*/
function setupChildren(parent){
	var cssArr = [];
	var elements = parent.querySelectorAll("*");
	for(var i=0; i<elements.length; i++){
		cssArr.push({
			selector: getUniqueSelector(elements[i], parent),
			css: getCSS(elements[i])
		});
	}
	return cssArr;
}

/** Return an object of all CSS attributes for a given element
 * element: the element whose CSS attributes are to be returned
*/
function getCSS(element){
    var dest = {},
    style, prop;
    if(window.getComputedStyle){
        if((style = window.getComputedStyle(element, null))){
            var val;
            if(style.length){
                for(var i = 0, l = style.length; i < l; i++){
                    prop = style[i];
                    val = style.getPropertyValue(prop);
                    dest[prop] = val;
                }
            } else {
                for(prop in style){
                    val = style.getPropertyValue(prop) || style[prop];
                    dest[prop] = val;
                }
            }
            return dest;
        }
    }
    if((style = element.currentStyle)){
        for(prop in style){
            dest[prop] = style[prop];
        }
        return dest;
    }
    if((style = element.style)){
        for(prop in style){
            if(typeof style[prop] != 'function'){
                dest[prop] = style[prop];
            }
        }
    }
    return dest;
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

/** Generate a random string
 * length: the length of the random string
*/
function getRandomString(length) {
	var randArray = new Uint32Array(length);
	var rand = "";
	window.crypto.getRandomValues(randArray);
	for (var i = 0; i < randArray.length; i++) {
		var character = String.fromCharCode((randArray[i] % 42) + 48);
		character = (randArray[i] % 2) ? character : character.toLowerCase();
		rand += character;
	}
	return rand;
}

/** Check that a string ends with another substring
 * subject: the string to search through
 * suffix: the proposed suffix of the subject
*/
 function endsWith(subject, suffix) {
    return subject.indexOf(suffix, subject.length - suffix.length) !== -1;
}

/** Strip html tags from string
 * html: the string to have it's html tags removed
*/
function strip(html){
   var tmp = document.createElement("DIV");
   tmp.innerHTML = html;
   return tmp.textContent || tmp.innerText || "";
}

/** Remove the attributes from all elements in html string
 * html: the html string to strip attributes from
*/
function clearAttributes(html) {
	return html.replace(/<(\w+)(.|[\r\n])*?>/g, '<$1>');
}

/** Mark a piece of text as decrypted - only works if the decryptIndicator is true
 * plaintext: the text to be marked
 * NOTE: the plaintext is already sanitzed when this is called
*/
function decryptMark(plaintext){
	if(decryptIndicator){
		var wrapper = $("<i>").append($("<grdme_decrypt>").html(plaintext));
		plaintext = DECRYPTED_MARK+" "+wrapper.html();
	}
	return plaintext;
}

/** Simulte typing a key
 * character: a single character string to be pressed
 * [target]: an optional argument for where to dispatch the event. Defaults to the active element
*/
function simulateKeyPress(character, target) {
	var charCode = character.charCodeAt(0);
	target = target || unsafeWindow.document.activeElement;
	
	var evt = unsafeWindow.document.createEvent("KeyboardEvent");
	evt.initKeyEvent("keydown", true, true, unsafeWindow,
                    0, 0, 0, 0,
                    charCode, charCode);
	target.dispatchEvent(evt);
	
	evt = unsafeWindow.document.createEvent("KeyboardEvent");
	evt.initKeyEvent("keypress", true, true, unsafeWindow,
                    0, 0, 0, 0,
                    charCode, charCode);
	target.dispatchEvent(evt);
	
	evt = unsafeWindow.document.createEvent("KeyboardEvent");
	evt.initKeyEvent("keyup", true, true, unsafeWindow,
                    0, 0, 0, 0,
                    charCode, charCode);
	target.dispatchEvent(evt);
}

/** Encrypt the active element's text/value
 * shortEncrypt: a boolean indicating whether or not to do short encryption. Defaults to false.
 * 
 * Short encryption is where the ciphertext is uploaded to grd me servers and an id is
 * inserted in it's place which is used to lookup the ciphertext.
*/
function encrypt(shortEncrypt){
	var active = document.activeElement;
	while(active.shadowRoot){
		active = active.shadowRoot.activeElement;
	}
	var plaintext = active.value || active.innerHTML;
	if(!plaintext.length){
		return;
	}
	if(!active.value && active.innerHTML){
		if(!$(active).attr("contenteditable")){
			return;
		}
		/* Transfer div's into br's using endTag as intermediate as it's not in string */
		var $el = $("<i>");
		$el.html(clearAttributes(plaintext)).find("div").each(function(i,e){
			if(!$.trim($(e).text()).length){
				$(e).html("");
			}
		});
		plaintext = $el.html();
		plaintext = plaintext.replace(/<div\s*/gi, endTag+"<div ");
		var re = new RegExp(endTag, "gi");
		plaintext = !plaintext.indexOf(endTag)? plaintext.slice(endTag.length) : plaintext;
		plaintext = plaintext.replace(re, "<br>");
		/* This regex technically breaks if there's a ">" character in an attribute of a br tag*/
		plaintext = strip(plaintext.replace(/<br\s*[^>]*>/gi, "\n"));
	}
	var ciphertext = startTag;
	for(var i=0; i<secrets.length; i++){
		ciphertext += (typeof secrets[i] === "object" ? ecc.encrypt(secrets[i].pub, plaintext) : CryptoJS.AES.encrypt(plaintext, secrets[i])) + "|";
	}
	ciphertext = ciphertext.slice(0, - 1); 
	ciphertext += endTag;
	ciphertext = ciphertext.replace(/\+/g, ")").replace(/\//g, "(");
	if(shortEncrypt){
		var actualCiphertext = ciphertext.replace(startTag, "").replace(endTag, "");
		var rand = getRandomString(64);
		var hash = CryptoJS.SHA256(actualCiphertext+rand).toString().slice(0, 60);
		self.port.emit("message_add", {
			data: {
				hash: hash,
				message: actualCiphertext,
				rand: rand
			},
			ciphertext: ciphertext
		});
		ciphertext = startTag+NONCE_CHAR+hash+endTag;
	}
	if(panelMode){
		self.port.emit("copy_ciphertext", ciphertext);
		$("#clipboard").stop(true, true).fadeIn().delay(1000).fadeOut();
	}
	else if(active.value){
		active.value = ciphertext;
	}
	else if(ciphertext.length>700){
		self.port.emit("copy_ciphertext", ciphertext);
		setTimeout(function(){
			alert("ciphertext copied to clipboard!");
			document.execCommand("selectAll");
		}, 200);
	}
	else {
		document.execCommand("selectAll");
		
		setTimeout(function(){
			simulateKeyPress("\b");
		}, 0);
		
		setTimeout(function(){
			for(var i=0; i<ciphertext.length; i++){
				simulateKeyPress(ciphertext.charAt(i));
			}
			var target = active;
			while(target.childNodes.length === 1 && target.childNodes[0].innerHTML){
				target = target.childNodes[0];
			}
			target.textContent = ciphertext;
			range = document.createRange();
			range.selectNodeContents(target);
			range.collapse(false);
			selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
			var evt = unsafeWindow.document.createEvent("KeyboardEvent");
			evt.initKeyEvent("keydown", true, true, unsafeWindow,
							0, 0, 0, 0,
							39, 39);
			target.dispatchEvent(evt);
		}, 10);
	}
}

/** Decrypt an elem's text and return an object with the plaintext, ciphertext, and whether or not an end crypto tage was found.
 * elem: the jQuery element whose text should be decypted
 * callback: a callback function that takes an object containing a decryption object
*/
function decrypt(elem, callback){
	/** Report error decrypting message */
	function error(plaintext){
		elem.html(val.substring(0, index1) + sanitize(UNABLE_TO_DECRYPT+" "+UNABLE_startTag+val.substring(val.indexOf(startTag)+startTag.length).replace(endTag, UNABLE_endTag)));
		callback({endTagFound: index2>0, plaintext: plaintext, ciphertext: ciphertext});
	}
	
	/** Insert plaintext into page and call callback
	 * plaintext: the decrypted text
	 * ciphertext: the encrypted text/nonce text
	*/
	function finish(plaintext, ciphertext){
		var end = index2>0 ? html.substring(html.indexOf(endTag) + endTag.length) : "";
		var start = html.substring(0, html.indexOf(startTag));
		var uid = encodeURIComponent(getRandomString(64));
		elem.attr("grdMeUID", uid);
		val = start + decryptMark(setupPlaintext(plaintext)) + end;
		if(sandboxDecrypt){
			plaintext  = "[Decrypting Message...]";
			elem.html(start + decryptMark(plaintext) + end);
			elem.append($("<a>", {grdMeAnchor: ""}).hide());
			elem.contents().filter(function() {
				return this.nodeType===3;
			}).remove();
			self.port.emit("prepareIframe", {
				location: {
					full: window.location.href,
					host: window.location.host,
					origin: window.location.origin
				},
				message: {
					childrenCSS: setupChildren(elem.get(0)),
					css: getCSS(elem.get(0)),
					text: val
				},
				secret: FRAME_SECRET,
				uid: uid
			});
			if(elem.css("display") === "inline"){
				elem.css("display", "inline-block");
				if(elem.css("vertical-align") === "baseline"){
					elem.css("vertical-align", "-moz-middle-with-baseline");
				}
			}
		}
		else {
			elem.html(val);
		}
		callback({endTagFound: index2>0, plaintext: sanitize(plaintext), ciphertext: ciphertext});
	}
	
	if(elem.attr("crypto_mark") == "inFlight"){
		return;
	}
	
	var val = elem.text();
	if(val.toLowerCase().indexOf(endTag)>0 && endsWith(window.location.hostname, "facebook.com")){
		elem.parent().find('.text_exposed_hide').remove();
		elem.parent().find('.text_exposed_show').show();
		elem.parents(".text_exposed_root").addClass("text_exposed");
		val = elem.text();
	}
	var html = elem.html();
	var index1 = val.toLowerCase().indexOf(startTag);
	var index2 = val.toLowerCase().indexOf(endTag);
	
	if(index2<0 && callback && elem.parent(':contains("'+endTag+'"):not([contenteditable="true"])').length){
		decrypt(elem.parent().attr("crypto_mark", false));
		return;
	}
	
	callback = callback || function(){};
	
	/* This checks the case of the start tag being broken by html elements */
	if(index1>0 && html.indexOf(startTag)<0 && strip(html).indexOf(startTag)>0){
		var string, character = startTag.slice(-1), index = html.indexOf(character)+1;
		while(strip(string).indexOf(startTag)<0 && index<html.length){
			index = html.indexOf(character, index)+1;
			string = html.substring(html.indexOf(character), index);
		}
		var preCounter = 0;
		while(strip(string) != startTag){
			preCounter++;
			string = string.slice(1);
		}
		html = html.substring(0, html.indexOf(character)+preCounter) + strip(string) + html.substring(index);
	}
	
	/* This checks the case of the end tag being broken by html elements */
	if(index2>0 && html.indexOf(endTag)<0 && strip(html).indexOf(endTag)>0){
		var string, index = html.indexOf(startTag)+startTag.length, character = endTag.slice(-1);
		while(strip(string).indexOf(endTag)<0 && index<html.length){
			index = html.indexOf(character, index)+1;
			string = html.substring(html.indexOf(startTag)+startTag.length, index);
		}
		html = html.substring(0, html.indexOf(startTag)+startTag.length) + strip(string) + html.substring(index);
	}
	
	if(index2>0 && elem.attr("crypto_mark") == "false"){
		val = strip(html);
		val = html.substring(0, html.indexOf(startTag)) + val.substring(val.indexOf(startTag), val.indexOf(endTag)) + html.substring(html.indexOf(endTag));
		index1 = val.toLowerCase().indexOf(startTag);
		index2 = val.toLowerCase().indexOf(endTag);
	}
	var ciphertext = index2>0 ? val.substring(index1+startTag.length, index2) : val.substring(index1+startTag.length);
	elem.attr("crypto_mark", "inFlight");
	if(ciphertext.charAt(0)==NONCE_CHAR){
		var hash = ciphertext.slice(1);
		self.port.emit("message_get", {
			hash: hash,
			callback: callbackWrap(function(plaintext){
				if(plaintext){
					finish(plaintext, ciphertext);
				}
				else{
					error(plaintext);
				}
				elem.removeAttr("crypto_mark");
			})
		});
	}
	else{
		self.port.emit("decrypt", {
			ciphertext: ciphertext,
			callback: callbackWrap(function(plaintext){
				if(plaintext){
					finish(plaintext, ciphertext);
				}
				else{
					error(plaintext);
				}
				elem.removeAttr("crypto_mark");
			})
		});		
	}
}

/** Scan for any crypto on the page and decypt if possible */
function decryptInterval(){
	var elements = $(':contains("'+startTag+'"):not([crypto_mark="true"]):not([contenteditable="true"]):not(textarea):not(input):not(script)');
	elements.each(function(i, e){
		var elem = $(e);
		if(elem.find(':contains("'+startTag+'"):not([crypto_mark="true"])').length || elem.parents('[contenteditable="true"]').length){
			elem.attr('crypto_mark', true);
			return;
		}
		decrypt(elem, function(returnObj){
			elem.parents("[crypto_mark='true']").attr("crypto_mark", false);
			if(!returnObj.endTagFound){
				returnObj.plaintext = returnObj.plaintext || "";
				var parent = elem.parent().parent().parent();
				parent = endsWith(window.location.hostname, "facebook.com") ? (elem.parents(".UFICommentBody").length? elem.parents(".UFICommentBody") : elem.parents(".userContent").length? elem.parents(".userContent") : parent) : parent;
				parent.on("click", function(){
					elem.parents("[crypto_mark='true']").attr("crypto_mark", false);
					var inFlight = false;
					setTimeout(function(){
						if(parent.text().indexOf(endTag)>0 && !inFlight){
							inFlight = true;
							self.port.emit("recheckDecryption", {
								text: parent.text(),
								returnObj: returnObj,
								callback: callbackWrap(function(text){
									inFlight = false;
									parent.text(text);
									decrypt(parent);
								})
							});
						}
					}, 0);
				});
			}
		});
	});
};

/** Check for changes to the dom before running decryptInterval **/
setTimeout(initObserver.bind(this, decryptInterval), 50);

/** Bind the keyboard shortcuts **/

Mousetrap.bindGlobal(['mod+e'], function(e) {
	encrypt();
});

Mousetrap.bindGlobal(['mod+alt+e'], function(e) {
	e.preventDefault();
	self.port.emit("secureText");
});

Mousetrap.bindGlobal(['mod+shift+e'], function(e) {
	var active = document.activeElement;
	if(active.value || $(active).attr("contenteditable")){
		e.preventDefault();
		encrypt(true);
	}
});