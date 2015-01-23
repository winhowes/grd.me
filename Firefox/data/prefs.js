/** This file handles the preferences panel */

var activeIndex = [], uids = [], latestRequest = 0;

/** Generate an ECC pub/priv keypair */
function generateECCKeys() {
	var curve = 384;
	var keys = ecc.generate(ecc.ENC_DEC, curve);
	return {pub: keys.enc, priv: keys.dec};
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
							count++;
							$("#searchResults").append("<li>"+
														  (revoked? "<div class='revoked'>" : "")+
															"<a class='showHideKey'>Show Key</a>"+
															(revoked? "<span class='revoked_msg'>[Revoked]</span>" : "")+
															"<div>"+
															  "<span class='key'>Key: "+data.keys[i].pub+"</span>"+
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

/** Toggle the key's visibility in the search result popup */
$("#searchResults").on("click", ".showHideKey", function(){
	var key = $(this).parent().find(".key");
	key.toggleClass("keyShown");
	$(this).text(key.hasClass("keyShown")? "Hide Key" : "Show Key");
})
/** Insert the pub key data and description into the appropriate fields and close the popup/overlay */
.on("click", ".addKey", function(){
	$("#key").val($(this).attr("pub"));
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
			key = {pub: key};
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
	self.port.emit("addKey", {
		key: key,
		description: description
	});
});

/** Handle checing the pub/priv checkbox. If appropriate, generate a ecc key */
$("#ecc").on("click", function(){
	if($(this).is(":checked")){
		var keyPair = generateECCKeys();
		$("#key").val(JSON.stringify(keyPair)).removeAttr("maxlength", "").data("key", keyPair);
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
		$("#ecc").data("key", keypair);
	}
	else{
		/* BROWSER COMPATIBILITY IS IFFY */
		var length = Math.floor(Math.random()*24+8);
		var randArray = new Uint32Array(length);
		var rand = "";
		window.crypto.getRandomValues(randArray);
		for (var i = 0; i < randArray.length; i++) {
			var character = String.fromCharCode((randArray[i] % 42) + 48);
			character = (randArray[i] % 2) ? character : character.toLowerCase();
			rand += character;
		}
	}
	$("#key").val(rand);
	$("#description").focus();
});

/** Handle selecting different keys to be active */
$("#keyList").on("click", "li", function(e){
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
});

/** Click on the only pub warning hides the warning */
$("#onlyPubWarning").on("click", function(){
	clearTimeout($(this).data("timeout"));
	$(this).stop(true).animate({top : "-60px"});
});

/** Handle clicking delete key */
$("#keyList").on("click", ".delete", function(e){
	e.stopImmediatePropagation();
	$("#pubKeyIndex").val($(this).parent().attr("index"));
	$("#deleteForm, #overlay").stop(true).fadeIn();
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

/** Delete the key */
$("#deleteForm").on("submit", function(e){
	e.preventDefault();
	self.port.emit("deleteKey", $("#pubKeyIndex").val());
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
	$("#keyList").find("li[index='"+$("#pubKeyIndex").val()+"']").find(".revoke").addClass("disabled");
	self.port.emit("revokeKey", key);
	$("#overlay").trigger("click");
});

/** Publish the key */
$("#publishForm").on("submit", function(e){
	e.preventDefault();
	$("#uidError").stop(true).hide();
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
	var key = {
		pub: $("#pubKey").val(),
		index: $("#pubKeyIndex").val(),
		uid: uid,
		sig: JSON.stringify(ecc.sign($("#privKey").val(), uid.toLowerCase()))
	}
	self.port.emit("publishKey", key);
	$("#overlay").trigger("click");
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

/** Show the key list */
self.port.on("displayKeys", function(keys){
	var keyList = $("#keyList");
	var newKeyList = $("<ul></ul>");
	for(var i=0; i<keys.length; i++){
		newKeyList.append("<li index='"+i+"' "+(activeIndex[i]? "class='active'" : "")+">"+
						    "<a class='showHideKey'>Show key</a>"+
							"<div class='key'>Key: <span>"+
							(typeof keys[i].key === "object"? "<br><b class='pub'>pub</b>: "+keys[i].key.pub+(keys[i].key.priv? "<br><b class='priv'>priv</b>: "+keys[i].key.priv : "") : $("<i></i>").text(keys[i].key).html())+
							"</span></div>"+
							"<div class='description'>"+$("<i></i>").text(keys[i].description).html()+"</div>"+
							(i && !keys[i].key.published? "<div class='delete'>x</div>" : "")+
							"<div class='activeIndicator'></div>"+
							(typeof keys[i].key === "object" && keys[i].key.priv && !keys[i].key.published?
								"<button class='publish blue btn' pub='"+keys[i].key.pub+"' priv='"+keys[i].key.priv+"'>Publish Public Key</button>" :
								typeof keys[i].key === "object" && keys[i].key.priv && keys[i].key.published?
								"<button class='revoke red btn' pub='"+keys[i].key.pub+"' priv='"+keys[i].key.priv+"'>Revoke</button>" : "")+
						   "</li>");
	}
	keyList.html(newKeyList.html());
});

/** Set a particular key to being the active key */
self.port.on("activeKeyIndex", function(index){
	activeIndex[index] = true;
	$("#keyList [index='"+index+"']").addClass("active");
});

/** Indicate whether a key was published or failed to publish */
self.port.on("publishResult", function(success){
	var id = success? "publishSuccess" : "publishFail";
	$("#"+id).stop(true).css("top", "-20px").animate({
		top: 0
	}).delay(2500).animate({
		top : "-20px"
	});
});

/** Indicate whether a key was revoked or failed to be revoked
 * obj: an object containing a success boolean property and an index property when success is
 * false of the index of the revoked key
*/
self.port.on("revokeResult", function(obj){
	var id = obj.success? "revokeSuccess" : "revokeFail";
	if(!obj.success){
		$("#keyList").find("li[index='"+obj.index+"']").find(".revoke").removeClass("disabled_btn");
	}
	$("#"+id).stop(true).css("top", "-20px").animate({
		top: 0
	}).delay(2500).animate({
		top : "-20px"
	});
});

/** Update the known uids */
self.port.on("uids", function(uidsArr){
	uids = uidsArr;
});