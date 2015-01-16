/** This file handles the page encryption and decryption */

var startTag = '~~crypt~~',
endTag = '~~/crypt~~',
secrets = [],
keyList = [],
panelMode = false,
decryptTimeout = false;

self.port.on("secret", function(secret_obj){
	secrets = secret_obj.active;
	keyList = secret_obj.keys;
});

self.port.on("panelMode", function(){
	panelMode = true;
	Mousetrap.unbind('mod+alt+e');
	$("#clipboard").hide();
	self.port.on("show", function onShow() {
		$("textArea").focus().select();
	});
});

/** Check that a string ends with another substring
 * subject: the string to search through
 * suffix: the proposed suffix of the subject
*/
 function endsWith(subject, suffix) {
    return subject.indexOf(suffix, subject.length - suffix.length) !== -1;
};

/** Strip html tags from string
 * html: the string to have it's html tags removed
*/
function strip(html){
   var tmp = document.createElement("DIV");
   tmp.innerHTML = html;
   return tmp.textContent || tmp.innerText || "";
}

/** Simulte typing a key
 * character: a single character string to be pressed
 * [target]: an optional argument for where to dispatch the event. Defaults to the active element
*/
function simulateKeyPress(character, target) {
	target = target || unsafeWindow.document.activeElement;
	var evt = unsafeWindow.document.createEvent("KeyboardEvent");
	evt.initKeyEvent("keydown", true, true, unsafeWindow,
                    0, 0, 0, 0,
                    character.charCodeAt(0), character.charCodeAt(0));
	target.dispatchEvent(evt);
	
	evt = unsafeWindow.document.createEvent("KeyboardEvent");
	evt.initKeyEvent("keypress", true, true, unsafeWindow,
                    0, 0, 0, 0,
                    character.charCodeAt(0), character.charCodeAt(0));
	target.dispatchEvent(evt);
	
	evt = unsafeWindow.document.createEvent("KeyboardEvent");
	evt.initKeyEvent("keyup", true, true, unsafeWindow,
                    0, 0, 0, 0,
                    character.charCodeAt(0), character.charCodeAt(0));
	target.dispatchEvent(evt);
}

/** Encrypt the active element's text/value */
function encrypt(){
	var active = document.activeElement;
	var plaintext = active.value || active.innerHTML;
	if(!active.value && active.innerHTML){
		if(!$(active).attr("contenteditable")){
			return;
		}
		/* This regex technically breaks if there's a ">" character in an attribute of a br tag*/
		plaintext = strip(plaintext.replace(/<br\s*[^>]*>/gi, "\n"));
	}
	var ciphertext = startTag;
	for(var i=0; i<secrets.length; i++){
		ciphertext += (typeof secrets[i] === "object" ? ecc.encrypt(secrets[i].pub, plaintext) : CryptoJS.AES.encrypt(plaintext, secrets[i])) + "|";
	}
	ciphertext = ciphertext.slice(0, - 1); 
	ciphertext += endTag;
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
		
		for(var i=0; i<plaintext.length; i++){
			setTimeout(function(){
				simulateKeyPress("\b");
			}, i);
		}
		
		setTimeout(function(){
			active.textContent = ciphertext;
			for(i=0; i<ciphertext.length; i++){
				simulateKeyPress(ciphertext.charAt(i));
			}
		}, plaintext.length);
	}
}

/** Decrypt an elem's text and return an object with the plaintext, ciphertext, and whether or not an end crypto tage was found.
 * elem: the jQuery element whose text should be decypted
*/
function decrypt(elem){
	var val = elem.text();
	if(val.toLowerCase().indexOf(endTag)>0 && endsWith(window.location.hostname, "facebook.com")){
		elem.parent().find('.text_exposed_hide').remove();
		val = elem.text();
	}
	var html = elem.html();
	var index1 = val.toLowerCase().indexOf(startTag);
	var index2 = val.toLowerCase().indexOf(endTag);
	
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
	var plaintext = decryptText(ciphertext);
	if(plaintext){
		var end = index2>0 ? html.substring(html.indexOf(endTag) + endTag.length) : "";
		var start = html.substring(0, html.indexOf(startTag));
		val = start + plaintext + end;
		elem.html(val);
	}
	else{
		index2 = 1;
		elem.html(val.substring(0, index1) + $("<i></i>").text("[Unable to decrypt message] [start tag]"+val.substring(val.indexOf(startTag)+startTag.length).replace(endTag, "[end tag]")).html());
	}
	return {endTagFound: index2>0, plaintext: plaintext, ciphertext: ciphertext};
}

/** Decrypt ciphertext with all available keys. Returns false if no decryption possible
 * ciphertext: the text excluding the crypto tags to decrypt
*/
function decryptText(ciphertext){
	ciphertext = ciphertext.split("|");
	for(var i=0; i<ciphertext.length; i++){
		var plaintext;
		for(var j=0; j<keyList.length; j++){
			var validDecryption = true;
			try{
				if(typeof keyList[j].key === "object" && keyList[j].key.priv){
					plaintext = ecc.decrypt(keyList[j].key.priv, ciphertext[i]);
				}
				else{
					plaintext = CryptoJS.AES.decrypt(ciphertext[i], keyList[j].key);
					plaintext = plaintext.toString(CryptoJS.enc.Utf8);
				}
				if(!$.trim(plaintext)){
					throw true;
				}
				break;
			}
			catch(e){
				validDecryption = false;
			}
		}
		if(validDecryption){
			break;
		}
	}
	return validDecryption? linkify($("<i></i>").text(plaintext).html().replace(/\n/g, "<br>")) : false;
}

/** Scan for any crypto on the page and decypt if possible */
function decryptInterval(){
	var elements = $('*:contains("'+startTag+'"):not([crypto_mark="true"]):not([contenteditable="true"])');
	elements.each(function(i, e){
		var elem = $(e);
		if(elem.find(':contains("'+startTag+'"):not([crypto_mark="true"])').length || elem.parents('[contenteditable="true"]').length){
			//ASSUMPTION: an element not containing a crypto message itself will never contain a crypto message
			elem.attr('crypto_mark', true);
			return;
		}
		var returnObj = decrypt(elem);
		elem.parents("[crypto_mark='true']").attr("crypto_mark", false);
		if(!returnObj.endTagFound){
			var parent = elem.parents(".UFICommentBody").length? elem.parents(".UFICommentBody") : elem.parents(".userContent").length? elem.parents(".userContent") : elem.parent().parent().parent();
			var clickHandled = false;
			parent.on("click", function(){
				elem.parents("[crypto_mark='true']").attr("crypto_mark", false);
				setTimeout(function(){
					if(clickHandled){return;}
					clickHandled = true;
					if(parent.text().indexOf(endTag)>0){
						var text = parent.text();
						/* Handle the case of ciphertext in plaintext */
						while(returnObj.plaintext.indexOf(startTag)+1 && returnObj.plaintext.indexOf(endTag)+1){
							var pre = returnObj.plaintext.substring(0, returnObj.plaintext.indexOf(startTag)),
							ciphertext = returnObj.plaintext.substring(returnObj.plaintext.indexOf(startTag) + startTag.length, returnObj.plaintext.indexOf(endTag)),
							post = returnObj.plaintext.substring(returnObj.plaintext.indexOf(endTag) + endTag.length);
							returnObj.plaintext = pre+decryptText(ciphertext)+post;
						}
						parent.text(text.substring(0, text.indexOf(returnObj.plaintext+""))+
								  startTag+
								  returnObj.ciphertext+
								  text.substring(text.indexOf(returnObj.plaintext+"") + (returnObj.plaintext+"").length));
						decrypt(parent);
					}
				}, 0);
			});
		}
	});
};

/** Check for changes to the dom before running decryptInterval */
(function(){
	var otherDecryptTimeout = false;
	var observer = new MutationObserver(function(mutations) {
		clearTimeout(otherDecryptTimeout);
		otherDecryptTimeout = setTimeout(decryptInterval, 50);
	});
	
	var config = { subtree: true, childList: true, characterData: true, attributes: true };
	
	observer.observe(document.body, config);
}());

Mousetrap.bindGlobal(['mod+e'], function(e) {
    encrypt();
});

Mousetrap.bindGlobal(['mod+alt+e'], function(e) {
	e.preventDefault();
    self.port.emit("secureText");
});