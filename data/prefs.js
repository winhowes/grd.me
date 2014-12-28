/** This file handles the preferences panel */

var activeIndex = 0;

function generateECCKeys() {
	var curve = 256;
	var keys = ecc.generate(ecc.ENC_DEC, 256);
	return {pub: keys.enc, priv: keys.dec};
}

$("#addKeyError, #pubKeyError").hide();

$("#addKey").on("submit", function(e){
	e.preventDefault();
	$("#addKeyError, #pubKeyError").stop(true).hide();
	var key = $("#ecc").is(":checked")? JSON.parse($("#key").val()) : $.trim($("#key").val());
	var description = $.trim($("#description").val());
	if(!key || !description){
		$("#addKeyError").fadeIn();
		return;
	}
	if(typeof key === "object"){
		/* Check that it's a valid public/private key */
		var plaintext = "Hello World";
		try{
			var ciphertext = ecc.encrypt(key.pub, plaintext);
			if(plaintext != ecc.decrypt(key.priv, ciphertext)){
				throw true;
			}
		}
		catch(e){
			$("#pubKeyError").fadeIn();
			return;
		}
	}
	$("#key").val("").focus();
	$("#description").val("");
	self.port.emit("addKey", {
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
	self.port.emit("deleteKey", $(this).parent().attr("index"));
});

$("#keyList").on("click", "li", function(){
	if(!$(this).hasClass("active")){
		$("#keyList").find(".active").removeClass("active");
		$(this).addClass("active");
		self.port.emit("setActiveKey", $(this).attr("index"));
	}
});

self.port.on("displayKeys", function(keys){
	var keyList = $("#keyList");
	var newKeyList = $("<ul></ul>");
	for(var i=0; i<keys.length; i++){
		newKeyList.append("<li index='"+i+"' "+(i===activeIndex? "class='active'" : "")+">"+
							"<div class='key'>Key: <span>"+
							(typeof keys[i].key === "object"? "<br><b>pub</b>: "+keys[i].key.pub+"<br><b>priv</b>: "+keys[i].key.priv : $("<i></i>").text(keys[i].key).html())+
							"</span></div>"+
							"<div class='description'>"+$("<i></i>").text(keys[i].description).html()+"</div>"+
							(i? "<div class='delete'>x</div>" : "")+
							"<div class='activeIndicator'></div>"+
						   "</li>");
	}
	keyList.html(newKeyList.html());
});

self.port.on("activeKeyIndex", function(index){
	activeIndex = index;
	$("#keyList [index='"+index+"']").addClass("active");
});