/** This file handles the preferences panel */

function generateECCKeys() {
	var curve = 256;
	var keys = ecc.generate(ecc.ENC_DEC, 256);
	return {pub: keys.enc, priv: keys.dec};
}

$("#addKeyError, #pubKeyError").hide();

$("#addKey").on("submit", function(e){
	e.preventDefault();
	$("#addKeyError, #pubKeyError").stop(true).hide();
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
			key = {pub: pub, priv: priv}
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
	$("#key").val("").focus();
	$("#description").val("");
	addKey({
		key: key,
		description: description
	});
});

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

$("#keyList").on("click", ".delete", function(e){
	e.stopImmediatePropagation();
	deleteKey($(this).parent().attr("index"));
});

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
		setActiveKeys(indices);
	}
	else{
		$("#keyList").find(".active").removeClass("active");
		elem.addClass("active");
		setActiveKeys([elem.attr("index")]);
		if(elem.find(".pub").length && !elem.find(".priv").length){
			$("#onlyPubWarning").stop(true).css("top", "-60px").animate({
				top: 0
			}).delay(7000).animate({
				top : "-60px"
			});
		}
	}
});

function setActiveKeys(indices){
	chrome.storage.sync.get("keys", function(keys){
		keys = keys.keys;
		var activeKeys = [];
		for(var i=0; i<indices.length; i++){
			activeKeys.push(keys[indices[i]].key);
		}
		chrome.storage.sync.set({'activeKeys': activeKeys});
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

function addKey(keyObj){
	chrome.storage.sync.get("keys", function(keys){
		keys = keys.keys;
		keys.push(keyObj);
		chrome.extension.getBackgroundPage().keyObj.keys.push(keyObj);
		chrome.storage.sync.set({'keys': keys});
		displayKeys();
	});
}

function deleteKey(index){
	chrome.storage.sync.get("keys", function(keys){
		keys = keys.keys;
		keys.splice(index, 1);
		chrome.extension.getBackgroundPage().keyObj.keys.splice(index, 1);
		chrome.storage.sync.set({'keys': keys});
		displayKeys();
	});
}

$("#onlyPubWarning").on("click", function(){
	$(this).stop(true).animate({top : "-60px"});
});
function displayKeys(){
	//alert("here");
	chrome.storage.sync.get("keys", function(keys){
		keys = keys.keys;
		var keyList = $("#keyList");
		var newKeyList = $("<ul></ul>");
		for(var i=0; i<keys.length; i++){
			newKeyList.append("<li index='"+i+"'>"+
								"<div class='key'>Key: <span>"+
								(typeof keys[i].key === "object"? "<br><b class='pub'>pub</b>: "+keys[i].key.pub+(keys[i].key.priv? "<br><b class='priv'>priv</b>: "+keys[i].key.priv : "") : $("<i></i>").text(keys[i].key).html())+
								"</span></div>"+
								"<div class='description'>"+$("<i></i>").text(keys[i].description).html()+"</div>"+
								(i? "<div class='delete'>x</div>" : "")+
								"<div class='activeIndicator'></div>"+
							   "</li>");
		}
		keyList.html(newKeyList.html());
		chrome.storage.sync.get("activeKeys", function(activeKeys){
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