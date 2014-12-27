/** This file handles the preferences panel */

var activeIndex = 0;

$("#addKeyError").hide();

$("#addKey").on("submit", function(e){
	e.preventDefault();
	$("#addKeyError").stop(true).hide();
	var key = $.trim($("#key").val());
	var description = $.trim($("#description").val());
	if(!key || !description){
		$("#addKeyError").fadeIn();
		return;
	}
	var btn = $(this).find("#addKeyBtn");
	btn.text("Key Added");
	setTimeout(function(){
		btn.text("Add Key");
	}, 1500);
	$("#key").val("").focus();
	$("#description").val("");
	self.port.emit("addKey", {
		key: key,
		description: description
	});
});

$("#keyGen").on("click", function(){
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
							"<div class='key'>Key: <span>"+$("<i></i>").text(keys[i].key).html()+"</span></div>"+
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