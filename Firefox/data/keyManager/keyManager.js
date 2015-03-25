/** This file handles the preferences panel */

var activeIndex = [],
uids = [],
latestRequest = 0,
pubKeyMap = {},
hasPrivateKey = false,
hasOthersPubKey = false,
keyChain = [];

/** Show a flash message
 * id: id of the flash message (has class indicator)
*/
function showFlash(id){
	$("#"+id).stop(true).css("top", "-20px").animate({
		top: 0
	}).delay(2500).animate({
		top : "-20px"
	});
}

/** Close the open popups and the overlay */
function closePopup(){
	$("#overlay, .popup").stop(true).fadeOut("fast");
}

/** Open a popup with the given id
 * id: the id of the popup
*/
function openPopup(id){
	$("#"+id+", #overlay").stop(true).fadeIn();
}

/** Generate an ECC pub/priv keypair */
function generateECCKeys() {
	var curve = 384;
	var keys = ecc.generate(ecc.ENC_DEC, curve);
	return {pub: keys.enc, priv: keys.dec};
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

/** Sanitize a string
 * str: the string to sanitize
*/
function sanitize(str){
	return $("<i>", {text: str}).html();
}

/** Hide the first page and show second page of sharing shared key */
function sharedKeyPage2(){
	$("#shareFormMain1").hide();
	$("#shareFormMain2").show();
	keyList = $("<ul></ul>");
	var count = 0;
	for(var i=0; i<keyChain.length; i++){
		if(keyChain[i].key.pub && !keyChain[i].key.priv){
			keyList.append($("<li>").attr({index: i, class: (count? "" : "active")})
				.append($("<a>", {class: 'showHideKey', text: "Show Key"}))
				.append($("<div>")
					.append($("<div>", {class: 'key partialKey', text: "Key: "})
						.append($("<span>")
							.append($("<br>"))
							.append($("<b>", {class: "pub", text: "pub"}))
							.append(": " + sanitize(keyChain[i].key.pub)))))
				.append($("<div>", {class: "description", text: keyChain[i].description}))
				.append($("<div>", {class: "activeIndicator"})));
			count++;
		}
	}
	$("#shareFormMain2 ul").html(keyList.html());
}

/** Toggle whether or not a user can type in main input fields
 * block: whether or not to block input
*/
function toggleInputBlock(block){
	var elems = $("#searchUID, #key, #description");
	if(block){
		elems.attr("readonly", "readonly").val("");
	}
	else {
		elems.removeAttr("readonly");
	}
}

/** Open the encrypt keychain popup
 * confirm: if true, will show the confirm input, otherwise hides it
*/
function showEncryptKeyChainPopup(confirm){
	openPopup("encryptForm");
	$("#encryptForm input.keyChainPassword").val("").focus();
	var confirmInput = $("#encryptForm input.confirmKeyChainPassword").toggle(confirm);
	var error = $("#encryptForm .error").stop(true).hide();
	if(confirm){
		error.text("Please confirm your passphrase.").fadeIn();
		confirmInput.focus();
	}
}

/** Open the decrypt keychain popup */
function showDecryptKeyChainPopup(){
	openPopup("decryptForm");
	$("#decryptForm input.keyChainPassword").focus();
}

/** Acknowledge receiving a shared key
 * keyObj: an object of key data to send
*/
function acknowledgeKey(keyObj, index){
	$.ajax({
		url: "https://grd.me/key/acceptSharedKey",
		type: "POST",
		data: keyObj,
		error: function(){
			console.log("Error acknowledging shared key received");
		}
	});
}

/** Panel shown. Display any acceptable shared keys
 * keys: an array of acceptable shared keys that need approval
*/
function acceptableSharedKeysPopup(keys){
	if(keys.length){
		var list = $("<ul></ul>");
		for(var i=0; i<keys.length; i++){
			var key = $.trim($("<i></i>").text(keys[i].key).html());
			list.append($("<li>")
				.append($("<form>").attr({key: key, index: i})
					.append($("<div>", {text: "Key: " + key}))
					.append($("<input>", {placeholder: "Description", maxlength: 50, value: sanitize(keys[i].from)}))
					.append($("<button>", {class: "blue btn", type: "submit", text: "Add"}))
					.append($("<button>", {class: "red btn remove", type: "button", text: "Ignore"}))));
		}
		$("#acceptableSharedKeys ul").html(list.html());
		openPopup("acceptableSharedKeys");
	}
}

/** Get rid of duplicate elements in an array
 * arr: the array to do such to
*/
function uniq(arr) {
    var seen = {};
    var out = [];
    var len = arr.length;
    var j = 0;
    for(var i = 0; i < len; i++) {
         var item = JSON.stringify(arr[i]);
         if(seen[item] !== 1) {
               seen[item] = 1;
               out[j++] = JSON.parse(item);
         }
    }
    return out;
}

$(".error, #overlay, .popup").hide();

/** Create a dropdown providing suggestions for others' uids */
var searchDropdown = new dropdowns($("#searchUID"), $("#searchSuggestions"), function(text, callback){
	latestRequest++;
	$.ajax({
		url: "https://grd.me/key/search",
		type: "GET",
		data: {
			uid: text,
			returnVal: latestRequest
		},
		success: function(data){
			if(data && data.returnVal == latestRequest && data.status && data.status[0] && !data.status[0].code){
				callback(data.uids);
			}
			else{
				callback([]);
			}
		}
	});
	return false;
}, true);

/** Add a dropdown for suggesting uids */
var uidDropdown = new dropdowns($("#uid"), $("#uidSuggestions"), function(text){
	text = text.toLowerCase();
	var count = 0;
	var results = [];
	for(var i=0; i<uids.length; i++){
		if(!uids[i].toLowerCase().indexOf(text) && text != uids[i].toLowerCase()){
			count++;
			results.push($("<i></i>").text(uids[i]).html());
			if(count>3){
				break;
			}
		}
	}
	return results;
});

/** Handle searching for a public key by uid */
$("#searchUIDForm").on("submit", function(e){
	e.preventDefault();
	var text = $.trim($("#searchUID").val());
	if(!text){
		$("#searchUID").focus();
		return;
	}
	$("#searchResults").html("");
	$("#searchLoading").show();
	$("#searchResultsContainer").find(".title").text(text);
	openPopup("searchResultsContainer");
	$.ajax({
		url: "https://grd.me/key/get",
		type: "GET",
		data: {uid: text},
		success: function(data){
			$("#searchLoading").hide();
			if(data && data.status && data.status[0] && !data.status[0].code){
				var count = 0;
				for(var i=0; i<data.keys.length; i++){
					try{
						if(ecc.verify(data.keys[i].pub, JSON.parse(data.keys[i].sig), data.uid.toLowerCase())){
							var revoked = data.keys[i].revoke_sig && ecc.verify(data.keys[i].pub, JSON.parse(data.keys[i].revoke_sig), "REVOKED");
							var already_exists = !revoked && pubKeyMap[data.keys[i].pub];
							count++;
							$("#searchResults")
								.append($("<li>")
									.append(revoked? $("<div>", {class: "revoked"}) : "")
									.append(already_exists? $("<div>", {class: 'already_exists', text: '[Already in Keychain]'}) : "")
									.append($("<a>", {class: 'showHideKey', text: "Show Key"}))
									.append(revoked? $("<span>", {class: 'revoked_msg', text: '[Revoked]'}) : "")
									.append($("<div>")
										.append($("<span>", {class: 'key partialKey', text: "Key: " + data.keys[i].pub}))
										.append(!revoked? $("<button>", {class: 'btn blue addKey', uid: data.uid, pub: data.keys[i].pub, text: "Add"}) : ""))
									.append(revoked? $("<div>", {class: 'timestamp', text: "Revoked: " + data.keys[i].revoked_at}): "")
									.append($("<div>", {class: 'timestamp', text: "Created: " + data.keys[i].created_at})));
						}
					}
					catch(e){
						console.log("Error verifying key", e);
					}
				}
				if(!count){
					$("#searchResults").html($("<li>", {text: "No results found"}));
				}
			}
			else{
				$("#searchResults").html($("<li>", {text: "No results found"}));
			}
		},
		error: function(){
			$("#searchLoading").hide();
			$("#searchResults").html($("<li>", {text: "Error fetching results"}));
		}
	});
});

/** Toggle the key's visibility in various popups */
$("#searchResults, #shareFormMain1, #shareFormMain2").on("click", ".showHideKey", function(e){
	e.stopImmediatePropagation();
	var key = $(this).parent().find(".key");
	key.toggleClass("keyShown");
	$(this).text(key.hasClass("keyShown")? "Hide Key" : "Show Key");
})
/** Insert the pub key data and description into the appropriate fields and close the popup/overlay */
.on("click", ".addKey", function(){
	$("#key").val($(this).attr("pub")).removeAttr("maxlength");
	$("#description").focus().val($(this).attr("uid"));
	$("#ecc").prop('checked', true);
	$("#addKey").trigger("submit");
	closePopup();
});

/** Add a key to the key list */
$("#addKey").on("submit", function(e){
	e.preventDefault();
	$(".error").stop(true).hide();
	var keyVal = $.trim($("#key").val());
	try{
		var key = $("#ecc").is(":checked")? JSON.parse(keyVal) : keyVal;
	}
	catch(e){
		if(keyVal[0] != '"' && keyVal[0] != "'"){
			try{
				var key = JSON.parse('"' + keyVal + '"');
			}
			catch(e){
				$("#pubKeyError").fadeIn();
				return;
			}
		}
		else{
			$("#pubKeyError").fadeIn();
			return;
		}
	}
	var description = $.trim($("#description").val());
	if(!key || !description){
		$("#description").focus();
		$("#addKeyError").fadeIn();
		return;
	}
	if($("#ecc").is(":checked")){
		if(typeof key !== "object"){
			key = key.split(",");
			key = {
				pub: $.trim(key[0]),
				priv: key[1]? $.trim(key[1]) : undefined
			};
		}
		var hexRegex = /[^A-F0-9]/gi;
		var plaintext = "Hello World";
		if(key.priv){
			/* Check that it's a valid public/private key */
			try{
				var pub = key.pub.replace(hexRegex, "");
				var priv = key.priv.replace(hexRegex, "");
				var ciphertext = ecc.encrypt(pub, plaintext);
				if(plaintext != ecc.decrypt(priv, ciphertext)){
					throw true;
				}
			}
			catch(e){
				$("#pubKeyError").fadeIn();
				return;
			}
			key = {
				pub: pub,
				priv: priv,
				published: false
			}
			for(var i = 0; i<keyChain.length; i++){
				if(keyChain[i].key.pub === key.pub &&
				   keyChain[i].key.priv === key.priv){
					$("#keyExistsError").fadeIn();
					return;
				}
			}
		}
		else{
			try{
				key.pub = key.pub.replace(hexRegex, "");
				if(!key.pub){
					throw true;
				}
				ecc.encrypt(key.pub, plaintext);
			}
			catch(e){
				$("#pubKeyError").fadeIn();
				return;
			}
			key = {pub: key.pub};
			for(var i = 0; i<keyChain.length; i++){
				if(keyChain[i].key.pub === key.pub && !keyChain[i].key.priv){
					$("#keyExistsError").fadeIn();
					return;
				}
			}
		}
	}
	else if(key.length<6){
		$("#key").focus();
		$("#keyLengthError").fadeIn();
		return;
	}
	else {
		for(var i = 0; i<keyChain.length; i++){
			if(keyChain[i].key === key){
				$("#keyExistsError").fadeIn();
				return;
			}
		}
	}
	$("#key").val("").focus();
	$("#description").val("");
	self.port.emit("addKey", {
		key: key,
		description: description
	});
});

/** Handle checing the pub/priv checkbox. If appropriate, generate a ecc key */
$("#ecc").on("click", function(){
	if($(this).is(":checked")){
		var keyPair = generateECCKeys();
		$("#key").val(JSON.stringify(keyPair)).removeAttr("maxlength");
		$("#description").focus();
	}
	else {
		$("#key").val("").focus().attr("maxlength", 64);
	}
});

/** Generate a key and insert it into the key input */
$("#keyGen").on("click", function(){
	if($("#ecc").is(":checked")){
		var keypair = generateECCKeys();
		var rand = JSON.stringify(keypair);
	}
	else{
		var rand = getRandomString(64);
	}
	$("#key").val(rand);
	$("#description").focus();
});

/** Handle clicking delete key */
$("#keyList").on("click", ".delete", function(e){
	e.stopImmediatePropagation();
	$("#pubKeyIndex").val($(this).parent().attr("index"));
	openPopup("deleteForm");
})
/** Show/hide the key in the key list */
.on("click", ".showHideKey", function(e){
	e.stopImmediatePropagation();
	$(this).next().toggle();
	$(this).text($(this).next().is(":visible")? "Hide key": "Show key");
})
/** Handle selecting different keys to be active */
.on("click", "li", function(e){
	if(e.shiftKey){
		window.getSelection().removeAllRanges();
	}
	var elem = $(this);
	if(elem.hasClass("active") && $("#keyList").find(".active").length === 1){
		return;
	}
	if(e.shiftKey){
		elem.toggleClass("active");
		var indices = [];
		var keyList = $("#keyList").find(".active");
		for(var i=0; i<keyList.length; i++){
			indices.push($(keyList.get(i)).attr("index"));
		}
		self.port.emit("setActiveKeys", indices);
	}
	else{
		$("#keyList").find(".active").removeClass("active");
		elem.addClass("active");
		self.port.emit("setActiveKeys", [elem.attr("index")]);
		if(elem.find(".pub").length && !elem.find(".priv").length){
			clearTimeout($("#onlyPubWarning").data("timeout"));
			$("#onlyPubWarning").stop(true).css("top", "-60px").animate({
				top: 0
			});
			$("#onlyPubWarning").data("timeout", setTimeout(function(){
				$("#onlyPubWarning").animate({
					top : "-60px"
				});
			}, 7000));
		}
	}
})
/** Handle clicking the publish button in the key list */
.on("click", ".publish", function(e){
	e.stopImmediatePropagation();
	openPopup("publishForm");
	$("#uidError").hide();
	$("#uid").focus();
	$("#pubKey").val($(this).attr("pub"));
	$("#privKey").val($(this).attr("priv"));
	$("#pubKeyIndex").val($(this).parent().attr("index"));
})
/** Handle clicking the revoke button in the key list */
.on("click", ".revoke", function(e){
	e.stopImmediatePropagation();
	openPopup("revokeForm");
	$("#pubKey").val($(this).attr("pub"));
	$("#privKey").val($(this).attr("priv"));
	$("#pubKeyIndex").val($(this).parent().attr("index"));
})
/** Handle clicking the pencil icon to edit description */
.on("click", ".pencil", function(e){
	e.stopImmediatePropagation();
	$(this).parent().hide();
	$(this).parents("li").find(".descriptionForm").show()
	.find("input").focus().val($(this).parent().text());
})
/** Change the description */
.on("submit", ".descriptionForm", function(e){
	e.preventDefault();
	var description = $.trim($(this).find("input").val());
	if(description){
		$(this).hide()
		.siblings(".description").html(sanitize(description))
		.append($("<i>", {class: 'pencil'}))
		.show();
		self.port.emit("updateDescription", {
			description: description,
			index: $(this).parents("li").attr("index")
		});
	}
	else {
		$(this).find("input").focus();
	}
})
/** Prevent clicking the description field setting the key to active */
.on("click", ".descriptionForm input", function(e){
	e.stopImmediatePropagation();
})
/** Handle blurring the editable description field */
.on("focusout", ".descriptionForm input", function(){
	var description = $.trim($(this).val());
	if(description){
		$(this).parent().hide()
		.siblings(".description").html(sanitize(description))
		.append($("<i>", {class: 'pencil'}))
		.show();
		self.port.emit("updateDescription", {
			description: description,
			index: $(this).parents("li").attr("index")
		});
	}
	else {
		$(this).parent().hide()
		.siblings(".description").show();
	}
})
/** Handle clicking he share button in the key list */
.on("click", ".share", function(e){
	e.stopImmediatePropagation();
	openPopup("shareForm");
	$(".shareFormMessage").hide();
	if(!hasPrivateKey){
		$("#noPrivateKey").show();
	}
	else if(!hasOthersPubKey){
		$("#noOtherPubKey").show();
	}
	else {
		$("#pubKey").val($(this).attr("key"));
		$("#shareFormMain1").show();
		var count = 0;
		var keyList = $("<ul></ul>");
		for(var i=0; i<keyChain.length; i++){
			if(keyChain[i].key.pub && keyChain[i].key.priv){
				keyList.append($("<li>").attr({index: i, class: (count? "" : "active")})
					.append($("<a>", {class: 'showHideKey', text: "Show Key"}))
					.append($("<div>")
						.append($("<div>", {class: 'key partialKey', text: "Key: "})
							.append($("<span>")
								.append($("<br>"))
								.append($("<b>", {class: "pub", text: "pub"}))
								.append(": " + sanitize(keyChain[i].key.pub))
								.append($("<br>"))
								.append($("<b>", {class: "priv", text: "priv"}))
								.append(": " + sanitize(keyChain[i].key.priv)))))
					.append($("<div>", {class: "description", text: keyChain[i].description}))
					.append($("<div>", {class: "activeIndicator"})));
				count++;
			}
		}
		$("#shareFormMain1 ul").html(keyList.html());
		if(count===1){
			sharedKeyPage2();
		}
	}
});

/** Press continue to move to page 2 of sharing a shared key */
$("#shareFormMain1").on("click", ".continue", function(e){
	sharedKeyPage2();
});

/** Share key */
$("#shareFormMain2").on("click", ".continue", function(e){
	var fromKey = keyChain[$("#shareFormMain1 .active").attr("index")].key;
	var toKey = keyChain[$("#shareFormMain2 .active").attr("index")].key;
	var sharedKey = ecc.encrypt(toKey.pub, $("#pubKey").val());
	self.port.emit("shareKey", {
			fromKey: fromKey.pub,
			toKey: toKey.pub,
			sharedKey: sharedKey,
			sendSig: JSON.stringify(ecc.sign(fromKey.priv, sharedKey)),
			rand: getRandomString(64)
	});
	closePopup();
});

/** Select which key to encrypt shared key with */
$("#shareFormMain1, #shareFormMain2").on("click", "li", function(){
	$(this).parent().find(".active").removeClass("active");
	$(this).addClass("active");
});

/** Click on the only pub warning hides the warning */
$("#onlyPubWarning").on("click", function(){
	clearTimeout($(this).data("timeout"));
	$(this).stop(true).animate({top : "-60px"});
});

/** Delete the key */
$("#deleteForm").on("submit", function(e){
	e.preventDefault();
	self.port.emit("deleteKey", $("#pubKeyIndex").val());
	closePopup();
});

/** Revoke the key */
$("#revokeForm").on("submit", function(e){
	e.preventDefault();
	var key = {
		pub: $("#pubKey").val(),
		index: $("#pubKeyIndex").val(),
		sig: JSON.stringify(ecc.sign($("#privKey").val(), "REVOKED"))
	}
	$("#keyList").find("li[index='" + $("#pubKeyIndex").val() + "']").find(".revoke").addClass("disabled").prop("disabled", true);
	self.port.emit("revokeKey", key);
	closePopup();
});

/** Publish the key */
$("#publishForm").on("submit", function(e){
	e.preventDefault();
	$(".publishError").stop(true).hide();
	var uid = $.trim($("#uid").val());
	if(!uid){
		$("#uid").focus();
		return;
	}
	if(uid.length<3){
		$("#uid").focus();
		$("#uidError").stop(true).fadeIn();
		return;
	}
	var pub = $("#pubKey").val();
	$.ajax({
		url: "https://grd.me/key/get",
		type: "GET",
		data: {
			uid: uid,
			pub: pub
		},
		success: function(data){
			if(data && data.status){
				data.keys = data.keys || [];
				var notFound = true;
				for(var i=0; i<data.keys.length; i++){
					try{
						if(uid.toLowerCase() == data.uid.toLowerCase() &&
						   pub == data.keys[i].pub &&
						   ecc.verify(data.keys[i].pub, JSON.parse(data.keys[i].sig), data.uid.toLowerCase())){
							notFound = false;
						}
					}
					catch(e){}
				}
				if(notFound){
					var key = {
						pub: pub,
						index: $("#pubKeyIndex").val(),
						uid: uid,
						sig: JSON.stringify(ecc.sign($("#privKey").val(), uid.toLowerCase()))
					}
					$("#keyList").find("li[index='" + $("#pubKeyIndex").val() + "']").find(".publish").addClass("disabled").prop("disabled", true);
					self.port.emit("publishKey", key);
					closePopup();
				}
				else {
					$("#existsError").stop(true).fadeIn();
				}
			}
			else {
				$("#publishingError").stop(true).fadeIn();
			}
		},
		error: function(){
			$("#publishingError").stop(true).fadeIn();
		}
	});
});

/** Clicking the overlay or cancel button closes the overlay and appropriate popups */
$("#overlay, .cancel").on("click", function(){
	closePopup();
});

$("#encryptKeychain").on("click", function(){
	showEncryptKeyChainPopup(false);
});

$("body").on("click", "#decryptKeychain", function(){
	showDecryptKeyChainPopup();
});

$("#encryptForm, #decryptForm").on("submit", function(e){
	e.preventDefault();
	$(this).find(".error").stop(true).hide();
	var passInput = $(this).find("input.keyChainPassword");
	var pass = passInput.val().trim();
	if(!pass){
		passInput.focus();
		return;
	}
	var confirmInput = $(this).find("input.confirmKeyChainPassword");
	confirm = confirmInput.is(":visible")? confirmInput.val().trim() : null;
	if(confirmInput.is(":visible") && confirm != pass){
		confirmInput.focus();
		$(this).find(".error").text("Your passphrases don't match.").stop(true).hide().fadeIn();
		return;
	}
	$(this).find("input").val("");
	var action = ($(this).attr("id") === "encryptForm"? "encrypt" : "decrypt") + "Keychain";
	self.port.emit(action, {
		pass: pass,
		confirm: confirm,
		hash: CryptoJS.SHA256(pass).toString()
	});
	closePopup();
});

/** Remove a key from the acceptableSharedKey array */
$("#acceptableSharedKeys").on("click", ".remove", function(){
	self.port.emit("removeAcceptableSharedKey", $(this).parent().attr("index"));
	$(this).parents("li").fadeOut("fast", function(){
		$(this).remove();
		if(!$("#acceptableSharedKeys").find("li").length){
			closePopup();
		}
	});
})
/** Handle adding an acceptableSharedKey to the normal key array */
.on("submit", "form", function(e){
	e.preventDefault();
	var description = $(this).find("input");
	if(!$.trim(description.val())){
		description.focus();
	}
	else {
		self.port.emit("addKey", {
			key: $(this).attr("key"),
			description: $.trim(description.val())
		});
		$(this).find(".remove").trigger("click");
	}
});

$("#exportKeychain").on("click", function(){
	openPopup("exportKeychainPopup");
});

$("#exportToClipboard").on("click", function(){
	$("#exportKeychainPopup").trigger("submit", ["clipboard"]);
});

$("#exportKeychainPopup").on("submit", function(e, type){
	e.preventDefault();
	closePopup();
	type = type || "file";
	var pass = $(this).find("input.keyChainPassword");
	self.port.emit("exportKeychain", {
		type: type,
		pass: pass.val().trim()
	});
	pass.val("");
});

self.port.on("exportCopied", function(){
	showFlash("exportCopied");
});

self.port.on("exportCreated", function(){
	showFlash("exportCreated");
});

self.port.on("confirmKeyChainPassword", function(pass){
	showEncryptKeyChainPopup(true);
	$("#encryptForm input.keyChainPassword").val(pass);
});

/** Show the key list */
self.port.on("displayKeys", function(keyObj){
	var keys = keyObj.keys;
	keyChain = keys;
	pubKeyMap = {};
	hasPrivateKey = false;
	hasOthersPubKey = false;
	var keyList = $("#keyList");
	var newKeyList = $("<ul></ul>");
	if(keyObj.encrypted || typeof keys !== "object"){
		toggleInputBlock(true);
		showDecryptKeyChainPopup();
		newKeyList.append($("<li>", {text: "Keychain is encrypted."})
			.append($("<div>")
				.append($("<a>", {id: "decryptKeychain", text: "Decrypt Keychain"}))
			)
		);
		$("#encryptKeychain").hide();
	}
	else {
		toggleInputBlock(false);
		$("#encryptKeychain").show();
		for(var i=0; i<keys.length; i++){
			if(keys[i].key.pub){
				hasPrivateKey = hasPrivateKey || !!keys[i].key.priv;
				hasOthersPubKey = hasOthersPubKey || !keys[i].key.priv;
				pubKeyMap[keys[i].key.pub] = true;
			}
			newKeyList.append($("<li>").attr({
					index: i,
					class: activeIndex[i]? "active" : ""
				})
				.append($("<a>", {class: "showHideKey", text: "Show Key"}))
				.append($("<div>", {class: "key fullToggle", text: "Key: "})
					.append($("<span>")
						.append(function(){
							var $return = $("<span>");
							typeof keys[i].key === "object"?
								$return.append($("<br>"))
								.append($("<b>", {class: "pub", text: "pub"}))
								.append(": " + sanitize(keys[i].key.pub)) : $return.append(sanitize(keys[i].key));
							keys[i].key.priv?
								$return.append($("<br>"))
								.append($("<b>", {class: "priv", text: "priv"}))
								.append(": " + sanitize(keys[i].key.priv)) : "";
							return $return.html();
						})
					)
				)
				.append($("<div>", {class: "description", text: keys[i].description})
					.append(i? $("<i>", {class: "pencil"}) : ""))
				.append(i? $("<form>", {class: "descriptionForm"})
					.append($("<input>", {placeholder: "Description", maxlength: 50})) :
					$("<span>", {class: "not_secure", text: "[Not Secure]"}))
				.append(i && !keys[i].key.published? $("<div>", {class: "delete", text: "x"}) : "")
				.append($("<div>", {class: "activeIndicator"}))
				/* Add the appropriate buttons (revoke, publish, share) */
				.append(typeof keys[i].key === "object" && keys[i].key.priv && !keys[i].key.published?
					$("<button>", {class: "publish blue btn", pub: keys[i].key.pub, priv: keys[i].key.priv, text: "Publish Public Key"}) :
					typeof keys[i].key === "object" && keys[i].key.priv && keys[i].key.published?
						[$("<button>", {class: "revoke red btn", pub: keys[i].key.pub, priv: keys[i].key.priv, text: "Revoke"}),
						$("<button>", {class: "publish blue btn", pub: keys[i].key.pub, priv: keys[i].key.priv, text: "Republish Public Key"})] :
						typeof keys[i].key !== "object" && i? $("<button>", {class: "share blue btn", key: keys[i].key, text: "Share Key"}) : "")
			);
		}
	}
	keyList.html(newKeyList.html());
});

/** Set a particular key to being the active key */
self.port.on("activeKeyIndex", function(index){
	activeIndex[index] = true;
	$("#keyList [index='" + index + "']").addClass("active");
});

/** Indicate whether a key was published or failed to publish
 * obj: an object containing a success boolean property and an index property when success is
 * false of the index of the revoked key
*/
self.port.on("publishResult", function(obj){
	var id = obj.success? "publishSuccess" : "publishFail";
	if(!obj.success){
		$("#keyList").find("li[index='" + obj.index + "']").find(".publish").removeClass("disabled").prop("disabled", false);
	}
	showFlash(id);
});

/** Indicate whether a key was revoked or failed to be revoked
 * obj: an object containing a success boolean property and an index property when success is
 * false of the index of the revoked key
*/
self.port.on("revokeResult", function(obj){
	var id = obj.success? "revokeSuccess" : "revokeFail";
	if(!obj.success){
		$("#keyList").find("li[index='" + obj.index + "']").find(".revoke").removeClass("disabled").prop("disabled", false);
	}
	showFlash(id);
});

/** Indicate whether a key was shared or failed to be shared
 * success: a boolean indicating whether or not the share was successful
*/
self.port.on("shareKeyResult", function(success){
	var id = success? "shareKeySuccess" : "shareKeyFail";
	showFlash(id);
});

/** Update the known uids */
self.port.on("uids", function(uidsArr){
	uids = uidsArr;
});

/** Check shared keys */
self.port.on("checkSharedKey", function(data){
	/* Handle receiving keys shared with this user */
	var index,
	original_length = data.acceptableSharedKeys.length;
	for(var i=0; i<data.received.length; i++){
		try{
			var sig = JSON.parse(data.received[i].sendSig);
			if(ecc.verify(data.received[i].fromKey, sig, data.received[i].sharedKey)){
				for(var j=0; j<keyChain.length; j++){
					if(keyChain[j].key.priv){
						try{
							var key = String(ecc.decrypt(keyChain[j].key.priv, data.received[i].sharedKey)).slice(0, 64);
							if(key){
								var from = "";
								for(var k = 0; k<keyChain.length; k++){
									if(keyChain[k].key.pub == data.received[i].fromKey){
										from = keyChain[k].description;
										break;
									}
								}
								data.acceptableSharedKeys.push({key: key, from: from});
								data.acceptableSharedKeys = uniq(data.acceptableSharedKeys);
								for(k = 0; k<data.acceptableSharedKeys.length; k++){
									if(data.acceptableSharedKeys[k].key===key && data.acceptableSharedKeys[k].from === from){
										index = k;
										break;
									}
								}
								acknowledgeKey({
									fromKey: data.received[i].fromKey,
									toKey: data.received[i].toKey,
									sharedKey: data.received[i].sharedKey,
									receiveSig: JSON.stringify(ecc.sign(keyChain[j].key.priv, data.received[i].sharedKey))
								}, index);
							}
						}
						catch(e){}
					}
				}
			}
		}
		catch(e){}
	}
	//Notify user of acceptable keys
	data.acceptableSharedKeys = uniq(data.acceptableSharedKeys);
	if(data.acceptableSharedKeys.length != original_length){
		self.port.emit("notifySharedKeys", data.acceptableSharedKeys);
		acceptableSharedKeysPopup(data.acceptableSharedKeys);
	}
	
	/* Handle receiving acknowledgements of shared keys */
	for(i=0; i<data.sent.length; i++){
		try{
			var sig = JSON.parse(data.sent[i].receiveSig);
			if(ecc.verify(data.sent[i].toKey, sig, data.sent[i].sharedKey)){
				self.port.emit("deleteSharedKeyRequest", {fromKey: data.sent[i].fromKey, sharedKey: data.sent[i].sharedKey});
			}
		}
		catch(e){}
	}
});

/** Panel shown. Call function to open acceptable shared keys popup
 * keys: an array of acceptable shared keys that need approval
*/
self.port.on("show", function(keys){
	acceptableSharedKeysPopup(keys);
});