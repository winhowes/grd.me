/** This file handles the preferences panel */

var uids = [],
latestRequest = 0,
pubKeyMap = {},
hasPrivateKey = false,
hasOthersPubKey = false,
keyChain = [];

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

$(".inputError, #overlay, .popup").hide();

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
	$("#overlay, #searchResultsContainer").fadeIn();
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
							$("#searchResults").append("<li>"+
														  (revoked? "<div class='revoked'>" : "")+
														    (already_exists? "<div class='already_exists'>[Already in Keychain]</div>" : "")+
															"<a class='showHideKey'>Show Key</a>"+
															(revoked? "<span class='revoked_msg'>[Revoked]</span>" : "")+
															"<div>"+
															  "<span class='key partialKey'>Key: "+data.keys[i].pub+"</span>"+
															  (revoked? "" : "<button class='btn blue addKey' uid='"+data.uid+"' pub='"+data.keys[i].pub+"'>Add</button>")+
															"</div>"+
															(revoked? "<div class='timestamp'>"+
															  "Revoked: "+$("<i></i>").text(data.keys[i].revoked_at).html()+
															"</div>" : "")+
															"<div class='timestamp'>"+
															  "Created: "+$("<i></i>").text(data.keys[i].created_at).html()+
															"</div>"+
														  (revoked? "</div>" : "")+
													   "</li>");
						}
					}
					catch(e){
						console.log("Error verifying key", e);
					}
				}
				if(!count){
					$("#searchResults").html("<li>No results found</li>");
				}
			}
			else{
				$("#searchResults").html("<li>No results found</li>");
			}
		},
		error: function(){
			$("#searchLoading").hide();
			$("#searchResults").html("<li>Error fetching results</li>");
		}
	});
});

/** Toggle the key's visibility in various popups */
$("#searchResults, #shareFormMain1, #shareFormMain2").on("click", ".showHideKey", function(){
	var key = $(this).parent().find(".key");
	key.toggleClass("keyShown");
	$(this).text(key.hasClass("keyShown")? "Hide Key" : "Show Key");
})
/** Insert the pub key data and description into the appropriate fields and close the popup/overlay */
.on("click", ".addKey", function(){
	$("#key").val($(this).attr("pub")).removeAttr("maxlength");
	$("#description").focus().val($(this).attr("uid"));
	$("#ecc").prop('checked', true);
	$("#overlay").trigger("click");
});

/** Add a key to the key list */
$("#addKey").on("submit", function(e){
	e.preventDefault();
	$(".inputError").stop(true).hide();
	var keyVal = $.trim($("#key").val());
	try{
		var key = $("#ecc").is(":checked")? JSON.parse(keyVal) : keyVal;
	}
	catch(e){
		if(keyVal[0] != '"' && keyVal[0] != "'"){
			try{
				var key = JSON.parse('"'+keyVal+'"');
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
		}
	}
	else if(key.length<6){
		$("#key").focus();
		$("#keyLengthError").fadeIn();
		return;
	}
	$("#key").val("").focus();
	$("#description").val("");
	addKey({
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
		$("#key").val("").focus().attr("maxlength", 32);
	}
});

/** Generate a key and insert it into the key input */
$("#keyGen").on("click", function(){
	if($("#ecc").is(":checked")){
		var keypair = generateECCKeys();
		var rand = JSON.stringify(keypair);
	}
	else{
		/* BROWSER COMPATIBILITY IS IFFY */
		var length = Math.floor(Math.random()*24+8);
		var rand = getRandomString(length);
	}
	$("#key").val(rand);
	$("#description").focus();
});

/** Handle clicking delete key */
$("#keyList").on("click", ".delete", function(e){
	e.stopImmediatePropagation();
	$("#pubKeyIndex").val($(this).parent().attr("index"));
	$("#deleteForm, #overlay").stop(true).fadeIn();
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
		setActiveKeys(indices);
	}
	else{
		$("#keyList").find(".active").removeClass("active");
		elem.addClass("active");
		setActiveKeys([elem.attr("index")]);
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
/** Show/hide the key in the key list */
.on("click", ".showHideKey", function(e){
	e.stopImmediatePropagation();
	$(this).next().toggle();
	$(this).text($(this).next().is(":visible")? "Hide key": "Show key");
})
/** Handle clicking the publish button in the key list */
.on("click", ".publish", function(e){
	e.stopImmediatePropagation();
	$("#publishForm, #overlay").stop(true).fadeIn();
	$("#uidError").hide();
	$("#uid").focus();
	$("#pubKey").val($(this).attr("pub"));
	$("#privKey").val($(this).attr("priv"));
	$("#pubKeyIndex").val($(this).parent().attr("index"));
})
/** Handle clicking the revoke button in the key list */
.on("click", ".revoke", function(e){
	e.stopImmediatePropagation();
	$("#revokeForm, #overlay").stop(true).fadeIn();
	$("#pubKey").val($(this).attr("pub"));
	$("#privKey").val($(this).attr("priv"));
	$("#pubKeyIndex").val($(this).parent().attr("index"));
});

/** Clicking on the only pub warning closes the warning */
$("#onlyPubWarning").on("click", function(){
	clearTimeout($(this).data("timeout"));
	$(this).stop(true).animate({top : "-60px"});
});

/** Delete the key */
$("#deleteForm").on("submit", function(e){
	e.preventDefault();
	deleteKey($("#pubKeyIndex").val());
	$("#overlay").trigger("click");
});

/** Revoke the key */
$("#revokeForm").on("submit", function(e){
	e.preventDefault();
	var key = {
		pub: $("#pubKey").val(),
		index: $("#pubKeyIndex").val(),
		sig: JSON.stringify(ecc.sign($("#privKey").val(), "REVOKED"))
	}
	$("#keyList").find("li[index='"+$("#pubKeyIndex").val()+"']").find(".revoke").addClass("disabled").prop("disabled", true);
	revokeKey(key);
	$("#overlay").trigger("click");
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
			if(data && data.status && data.status[0] && !data.status[0].code){
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
					$("#keyList").find("li[index='"+$("#pubKeyIndex").val()+"']").find(".publish").addClass("disabled").prop("disabled", true);
					publishKey(key);
					$("#overlay").trigger("click");
				}
				else {
					$("#existsError").stop(true).fadeIn();
				}
			}
		},
		error: function(){
			$("#publishingError").stop(true).fadeIn();
		}
	});
});

/** Clicking the overlay closes the overlay and appropriate popups */
$("#overlay").on("click", function(){
	$("#overlay, .popup").stop(true).fadeOut("fast");
});

/** Close the overlay on clicking a cancel btn */
$(".cancel").on("click", function(){
	$("#overlay").trigger("click");
});

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

/** Publish a key to the key server
 * key: the key object to publish containing the pub key, a signature, and a uid
*/
function publishKey(key){
	function error(){
		publishResult({success: false, index: key.index});
		
	}
	$.ajax({
		url: "https://grd.me/key/add",
		type: "POST",
		data: {
			uid: key.uid,
			pub: key.pub,
			sig: key.sig
		},
		success: function (data) {
			if(!data || !data.status || !data.status[0] || data.status[0].code){
				error();
			}
			else {
				uids.push(key.uid);
				chrome.storage.local.set({'uids': uniq(uids)}, function() {
					publishResult({success: true, index: key.index});
					getUIDS();
					chrome.storage.local.get("keys", function(keys){
						keys = keys.keys;
						keys[key.index].key.published = true;
						chrome.storage.local.set({'keys': keys}, function() {
							displayKeys();
						});
					});
				});
			}
		},
		error: error
	});	
}

/** Revoke a key
 * key: the key object to publish containing the pub key, a revocation signature
*/
function revokeKey(key){
	function error(){
		revokeResult({success: false, index: key.index});
	}
	
	$.ajax({
		url: "https://grd.me/key/revoke",
		type: "POST",
		data: {
			pub: key.pub,
			sig: key.sig
		},
		success: function (data) {
			if(!data || !data.status || !data.status[0] || data.status[0].code){
				error();
			}
			else {
				deleteKey(key.index);
				revokeResult({success: true, index: key.index});
			}
		},
		error: error
	});
}

/** Share a shared key with another user
 * keyObj: a key object containing the sender and receiver's public key, a signature,
 * a random string, and the encrypted shared key
*/
function shareKey(keyObj){
	function error(){
		shareKeyResult(false);
	}
	
	$.ajax({
		url: "https://grd.me/key/shareKey",
		type: "POST",
		data: keyObj,
		success: function (data) {
			if(!data || !data.status || !data.status[0] || data.status[0].code){
				error();
			}
			else {
				shareKeyResult(true);
				chrome.storage.local.get("randomMap", function(items){
					randomMap = items.randomMap;
					randomMap[keyObj.sharedKey] = keyObj.rand;
					chrome.storage.local.set({'randomMap': randomMap});
				});
			}
		},
		error: error
	});
}

/** Set various active keys
 * indices: the indices of the keys to be made active in the array of keys
*/
function setActiveKeys(indices){
	chrome.storage.local.get("keys", function(keys){
		keys = keys.keys;
		var activeKeys = [];
		for(var i=0; i<indices.length; i++){
			activeKeys.push(keys[indices[i]].key);
		}
		chrome.storage.local.set({'activeKeys': activeKeys});
		var workers = chrome.extension.getBackgroundPage().workers.slice(0);
		chrome.extension.getBackgroundPage().keyObj.activeKeys = activeKeys.slice(0);
		for(i=0; i<workers.length; i++){
			workers[i].postMessage({
				id: "secret",
				active: activeKeys,
				keys: keys
			});
		}
	});
}

/** Add a new key
 * keyObj: a key object
*/
function addKey(keyObj){
	chrome.storage.local.get("keys", function(keys){
		keys = keys.keys;
		keys.push(keyObj);
		chrome.extension.getBackgroundPage().keyObj.keys.push(keyObj);
		chrome.storage.local.set({'keys': keys}, function(){
			displayKeys();
		});
	});
}

/** Delete a key
 * index: the index of the key to delete in the array of keys
*/
function deleteKey(index){
	chrome.storage.local.get("keys", function(keys){
		keys = keys.keys;
		keys.splice(index, 1);
		chrome.extension.getBackgroundPage().keyObj.keys.splice(index, 1);
		chrome.storage.local.set({'keys': keys}, function(){
			displayKeys();
		});
	});
}

/** Show/hide a key in the key list */
$("#keyList").on("click", ".showHideKey", function(e){
	e.stopImmediatePropagation();
	$(this).next().toggle();
	$(this).text($(this).next().is(":visible")? "Hide key": "Show key");
})
/** Handle clicking he share button in the key list */
.on("click", ".share", function(e){
	e.stopImmediatePropagation();
	$("#shareForm, #overlay").stop(true).fadeIn();
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
				keyList.append("<li index='"+i+(count? "" : "' class='active")+"'>"+
									"<a class='showHideKey'>Show key</a>"+
									"<div><div class='key partialKey'>Key: <span>"+
									"<br><b class='pub'>pub</b>: "+keyChain[i].key.pub+
									"<br><b class='priv'>priv</b>: "+keyChain[i].key.priv+
									"</span></div></div>"+
									"<div class='description'>"+$("<i></i>").text(keyChain[i].description).html()+"</div>"+
									"<div class='activeIndicator'></div>"+
								"</li>");
				count++;
			}
		}
		$("#shareFormMain1 ul").html(keyList.html());
		if(count===1){
			sharedKeyPage2();
		}
	}
});

/** Hide the first page and show second page of sharing shared key */
function sharedKeyPage2(){
	$("#shareFormMain1").hide();
	$("#shareFormMain2").show();
	keyList = $("<ul></ul>");
	var count = 0;
	for(var i=0; i<keyChain.length; i++){
		if(keyChain[i].key.pub && !keyChain[i].key.priv){
			keyList.append("<li index='"+i+(count? "" : "' class='active")+"'>"+
							"<a class='showHideKey'>Show key</a>"+
							"<div><div class='key partialKey'>Key: <span>"+
							"<br><b class='pub'>pub</b>: "+keyChain[i].key.pub+
							"</span></div></div>"+
							"<div class='description'>"+$("<i></i>").text(keyChain[i].description).html()+"</div>"+
							"<div class='activeIndicator'></div>"+
						"</li>");
			count++;
		}
	}
	$("#shareFormMain2 ul").html(keyList.html());
}

/** Press continue to move to page 2 of sharing a shared key */
$("#shareFormMain1").on("click", ".continue", function(e){
	sharedKeyPage2();
});

/** Share key */
$("#shareFormMain2").on("click", ".continue", function(e){
	var fromKey = keyChain[$("#shareFormMain1 .active").attr("index")].key;
	var toKey = keyChain[$("#shareFormMain2 .active").attr("index")].key;
	var sharedKey = ecc.encrypt(toKey.pub, $("#pubKey").val());
	shareKey({
			fromKey: fromKey.pub,
			toKey: toKey.pub,
			sharedKey: sharedKey,
			sendSig: JSON.stringify(ecc.sign(fromKey.priv, sharedKey)),
			rand: getRandomString(64)
	});
	$("#overlay").trigger("click");
});

/** Select which key to encrypt shared key with */
$("#shareFormMain1, #shareFormMain2").on("click", "li", function(){
	$(this).parent().find(".active").removeClass("active");
	$(this).addClass("active");
});

/** Layout the keys and highlight the active keys */
function displayKeys(){
	pubKeyMap = {};
	chrome.storage.local.get("keys", function(keys){
		keys = keys.keys;
		keyChain = keys;
		var keyList = $("#keyList");
		var newKeyList = $("<ul></ul>");
		for(var i=0; i<keys.length; i++){
			if(keys[i].key.pub){
				hasPrivateKey = hasPrivateKey || !!keys[i].key.priv;
				hasOthersPubKey = hasOthersPubKey || !keys[i].key.priv
				pubKeyMap[keys[i].key.pub] = true;
			}
			newKeyList.append("<li index='"+i+"'>"+
								"<a class='showHideKey'>Show key</a>"+
								"<div class='key'>Key: <span>"+
								(typeof keys[i].key === "object"? "<br><b class='pub'>pub</b>: "+keys[i].key.pub+(keys[i].key.priv? "<br><b class='priv'>priv</b>: "+keys[i].key.priv : "") : $("<i></i>").text(keys[i].key).html())+
								"</span></div>"+
								"<div class='description'>"+$("<i></i>").text(keys[i].description).html()+"</div>"+
								(i? "" : "<span class='not_secure'>[Not Secure]</span>")+
								(i && !keys[i].key.published? "<div class='delete'>x</div>" : "")+
								"<div class='activeIndicator'></div>"+
								/* Add the appropriate buttons (revoke, publish, share) */
								(typeof keys[i].key === "object" && keys[i].key.priv && !keys[i].key.published?
									"<button class='publish blue btn' pub='"+keys[i].key.pub+"' priv='"+keys[i].key.priv+"'>Publish Public Key</button>" :
									typeof keys[i].key === "object" && keys[i].key.priv && keys[i].key.published?
										"<button class='revoke red btn' pub='"+keys[i].key.pub+"' priv='"+keys[i].key.priv+"'>Revoke</button> "+
										"<button class='publish blue btn' pub='"+keys[i].key.pub+"' priv='"+keys[i].key.priv+"'>Republish Public Key</button>" :
										typeof keys[i].key !== "object" && i? "<button class='share blue btn' key='"+$("<i></i>").text(keys[i].key).html()+"'>Share Key</button>" : "")+
							   "</li>");			
		}
		keyList.html(newKeyList.html());
		chrome.storage.local.get("activeKeys", function(activeKeys){
			activeKeys = activeKeys.activeKeys;
			for(var i=0; i<activeKeys.length; i++){
				for(var j=0; j<keys.length; j++){
					if(JSON.stringify(activeKeys[i]) === JSON.stringify(keys[j].key)){
						$("#keyList [index='"+j+"']").addClass("active");
						break;
					}
				}
			}
		});
	});
}
displayKeys();

/** Indicate whether a key was published or failed to publish
 * obj: an object containing a success boolean property and an index property when success is
 * false of the index of the published key
*/
function publishResult(obj){
	var id = obj.success? "#publishSuccess" : "#publishFail";
	if(!obj.success){
		$("#keyList").find("li[index='"+obj.index+"']").find(".publish").removeClass("disabled").prop("disabled", false);
	}
	$(id).stop(true).css("top", "-20px").animate({
		top: 0
	}).delay(2500).animate({
		top : "-20px"
	});
}

/** Indicate whether a key was revoked or failed to be revoked
 * obj: an object containing a success boolean property and an index property when success is
 * false of the index of the revoked key
*/
function revokeResult(obj){
	var id = obj.success? "#revokeSuccess" : "#revokeFail";
	if(!obj.success){
		$("#keyList").find("li[index='"+obj.index+"']").find(".revoke").removeClass("disabled").prop("disabled", false);
	}
	$(id).stop(true).css("top", "-20px").animate({
		top: 0
	}).delay(2500).animate({
		top : "-20px"
	});
}

/** Indicate whether a key was shared or failed to be shared
 * success: a boolean indicating whether or not the share was successful
*/
function shareKeyResult(success){
	var id = success? "#shareKeySuccess" : "#shareKeyFail";
	$(id).stop(true).css("top", "-20px").animate({
		top: 0
	}).delay(2500).animate({
		top : "-20px"
	});
}

/** Update the known uids */
function getUIDS(){
	chrome.storage.local.get("uids", function(uidsArr){
		uids = (uidsArr && uidsArr.uids) || [];
	});
}
getUIDS();

/** Panel shown. Call function to open acceptable shared keys popup */
$(function(){
	chrome.storage.local.get("acceptableSharedKeys", function(keys){
		keys = keys.acceptableSharedKeys;
		acceptableSharedKeysPopup(keys);
	});
});

/** Panel shown. Display any acceptable shared keys
 * keys: an array of acceptable shared keys that need approval
*/
function acceptableSharedKeysPopup(keys){
	if(keys.length){
		var list = $("<ul></ul>");
		for(var i=0; i<keys.length; i++){
			var key = $.trim($("<i></i>").text(keys[i].key).html());
			list.append("<li>"+
							"<form key='"+key+"' index='"+i+"'>"+
								"<div>Key: "+key+"</div>"+
								"<input placeholder='Description' maxlength='50' value='"+$("<i></i>").text(keys[i].from).html()+"'>"+
								"<button class='blue btn' type='submit'>Add</button>"+
								"<button class='red btn remove' type='button'>Ignore</button>"+
							"</form>"+
						"</li>");
		}
		$("#acceptableSharedKeys ul").html(list.html());
		$("#overlay, #acceptableSharedKeys").show();
	}
}

/** Remove a key from the acceptableSharedKey array */
$("#acceptableSharedKeys").on("click", ".remove", function(){
	var index =  $(this).parent().attr("index");
	chrome.storage.local.get("acceptableSharedKeys", function(keys){
		keys = keys.acceptableSharedKeys;
		keys.splice(index, 1);
		chrome.storage.local.set({'acceptableSharedKeys': keys});
	});
	$(this).parents("li").fadeOut("fast", function(){
		$(this).remove();
		if(!$("#acceptableSharedKeys").find("li").length){
			$("#overlay").trigger("click");
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
		addKey({
			key: $(this).attr("key"),
			description: $.trim(description.val())
		});
		$(this).find(".remove").trigger("click");
	}
});

/** Get rid of duplicate elements in an array
 * arr: the array to do such to
*/
function uniq(arr) {
    var seen = {};
    var out = [];
    var len = arr.length;
    var j = 0;
    for(var i = 0; i < len; i++) {
        var item = arr[i];
        if(seen[item] !== 1) {
            seen[item] = 1;
           out[j++] = item;
        }
    }
    return out;
}