/** This file handles the preferences panel */

var uids = [],
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
		rand += String.fromCharCode((randArray[i] % 87) + 40);
	}
	return rand;
}

/** Sanitize a string
 * str: the string to sanitize
*/
function sanitize(str){
	return $("<i>", {text: str}).html();
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
        var item = arr[i];
        if(seen[item] !== 1) {
            seen[item] = 1;
           out[j++] = item;
        }
    }
    return out;
}

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
					chrome.storage.local.get("keys", function(items){
						keys = items.keys;
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
	keyChain.push(keyObj);
	chrome.extension.getBackgroundPage().keyObj.keys.push(keyObj);
	chrome.storage.local.set({'keys': keyChain}, function(){
		displayKeys();
	});
	if(keyObj.key.priv && !keyObj.key.published){
		$.ajax({
			url: "https://grd.me/key/pubKeyExists",
			type: "GET",
			data: {
				pub: keyObj.key.pub
			},
			success: function(data){
				if(data.exists){
					chrome.storage.local.get("keys", function(items){
						keys = items.keys;
						for(var i = keys.length - 1; i>=0; i--){
							if(keys[i].key.pub === keyObj.key.pub &&
							   keys[i].key.priv === keyObj.key.priv &&
							   keys[i].key.published === keyObj.key.published &&
							   keys[i].description === keyObj.description){
								keys[i].key.published = true;
								chrome.storage.local.set({'keys': keys}, function() {
									displayKeys();
								});
								return;
							}
						}
					});
				}
			}
		});
	}
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

/** Update a key's description
 * index: the index of the key to have its description updated
 * description: the updated description
*/
function updateDescription(index, description){
	chrome.storage.local.get("keys", function(keys){
		keys = keys.keys;
		keys[index].description = description;
		chrome.extension.getBackgroundPage().keyObj.keys[index].description = description;
		chrome.storage.local.set({'keys': keys});
	});
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

/** Ask the user to confirm their password
 * pass: the value they entered as their password
*/
function confirmKeyChainPassword(pass){
	showEncryptKeyChainPopup(true);
	$("#encryptForm input.keyChainPassword").val(pass);
}

/** Encrypt the keychain
 * passwordObj: an object containing the encryption password, the last hash of the last password used, and a confirmation of the password
*/
function encryptKeychain(passwordObj){
	var password = passwordObj.pass;
	var confirm = passwordObj.confirm;
	var hash = passwordObj.hash;
	if(!password){
		return;
	}
	chrome.storage.local.get("lastPass", function(items){
		lastPass = items.lastPass;
		if(!confirm && hash != lastPass){
			confirmKeyChainPassword(password);
			return;
		}
		else if(confirm){
			if(confirm != password){
				return;
			}
			lastPass = hash;
		}
		chrome.storage.local.set({
			'keys': CryptoJS.AES.encrypt(JSON.stringify(keyChain), password).toString(),
			"encryptedKeys": true,
			"lastPass": lastPass
		}, function() {
			displayKeys();
		});
	});
}

/** Decrypt the keychain
 * password: the decryption password
*/
function decryptKeychain(password){
	if(!password){
		return;
	}
	plaintext = CryptoJS.AES.decrypt(keyChain, password);
	try{
		plaintext = plaintext.toString(CryptoJS.enc.Utf8);
		if(!plaintext){
			throw true;
		}
		chrome.storage.local.set({
			'keys': JSON.parse(plaintext),
			"encryptedKeys": false,
		}, function() {
			displayKeys();
		});
	}
	catch(e){
		displayKeys();
	}
}

/** Hide the first page and show second page of sharing shared key */
function sharedKeyPage2(){
	$("#shareFormMain1").hide();
	$("#shareFormMain2").show();
	var keyList = $("<ul></ul>");
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
							.append(": "+sanitize(keyChain[i].key.pub)))))
				.append($("<div>", {class: "description", text: keyChain[i].description}))
				.append($("<div>", {class: "activeIndicator"})));
			count++;
		}
	}
	$("#shareFormMain2 ul").html(keyList.html());
}

/** Panel shown. Display any acceptable shared keys
 * keys: an array of acceptable shared keys that need approval
*/
function acceptableSharedKeysPopup(keys){
	if(keys.length){
		var list = $("<ul></ul>");
		for(var i=0; i<keys.length; i++){
			var key = keys[i].key;
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

/** Layout the keys and highlight the active keys */
function displayKeys(){
	pubKeyMap = {};
	chrome.storage.local.get(["keys", "encrypted"], function(items){
		keys = items.keys;
		keyChain = keys;
		var keyList = $("#keyList");
		var newKeyList = $("<ul></ul>");
		if(items.encrypted || typeof keys !== "object"){
			toggleInputBlock(true);
			showDecryptKeyChainPopup();
			newKeyList.append($("<li>", {text: "Keychain is encrypted."})
				.append($("<div>")
					.append($("<a>", {id: "decryptKeychain", text: "Decrypt Keychain"}))
				)
			);
			$("#encryptKeychain").parents(".flex_container").hide();
			keyList.html(newKeyList.html());
		}
		else {
			toggleInputBlock(false);
			$("#encryptKeychain").parents(".flex_container").show();
			for(var i=0; i<keys.length; i++){
				if(keys[i].key.pub){
					hasPrivateKey = hasPrivateKey || !!keys[i].key.priv;
					hasOthersPubKey = hasOthersPubKey || !keys[i].key.priv
					pubKeyMap[keys[i].key.pub] = true;
				}
				newKeyList.append($("<li>").attr({index: i})
				.append($("<a>", {class: "showHideKey", text: "Show Key"}))
				.append($("<div>", {class: "key fullToggle", text: "Key: "})
					.append($("<span>")
						.append(function(){
							var $return = $("<span>");
							typeof keys[i].key === "object"?
								$return.append($("<br>"))
								.append($("<b>", {class: "pub", text: "pub"}))
								.append(": "+sanitize(keys[i].key.pub)) : $return.append(sanitize(keys[i].key));
							keys[i].key.priv?
								$return.append($("<br>"))
								.append($("<b>", {class: "priv", text: "priv"}))
								.append(": "+sanitize(keys[i].key.priv)) : "";
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
		}
	});
}

/** Indicate whether a key was published or failed to publish
 * obj: an object containing a success boolean property and an index property when success is
 * false of the index of the published key
*/
function publishResult(obj){
	var id = obj.success? "#publishSuccess" : "#publishFail";
	if(!obj.success){
		$("#keyList").find("li[index='"+obj.index+"']").find(".publish").removeClass("disabled").prop("disabled", false);
	}
	showFlash(id);
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
	showFlash(id);
}

/** Indicate whether a key was shared or failed to be shared
 * success: a boolean indicating whether or not the share was successful
*/
function shareKeyResult(success){
	var id = success? "#shareKeySuccess" : "#shareKeyFail";
	showFlash(id);
}

/** Update the known uids */
function getUIDS(){
	chrome.storage.local.get("uids", function(uidsArr){
		uids = (uidsArr && uidsArr.uids) || [];
	});
}

/** Verify and add a key to the keychain
 * keyVal: the key, either a string or object
 * description: a description of the key
 * isECC: boolean indicating whether or not the key is for ECC
 * showError: boolean indicating whether or not to show errors on fail
*/
function verifyAddKey(keyVal, description, isECC, showError){
	if(showError){
		$(".error").stop(true).hide();
	}
	try{
		var key = isECC && typeof keyVal !== "object" ? JSON.parse(keyVal) : keyVal;
	}
	catch(e){
		if(keyVal[0] != '"' && keyVal[0] != "'"){
			try{
				var key = JSON.parse('"' + keyVal + '"');
			}
			catch(e){
				if(showError){
					$("#pubKeyError").fadeIn();
				}
				return false;
			}
		}
		else{
			if(showError){
				$("#pubKeyError").fadeIn();
			}
			return false;
		}
	}
	if(!key || !description){
		if(showError){
			$("#description").focus();
			$("#addKeyError").fadeIn();
		}
		return false;
	}
	if(isECC){
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
				if(showError){
					$("#pubKeyError").fadeIn();
				}
				return false;
			}
			key = {
				pub: pub,
				priv: priv,
				published: false
			}
			for(var i = 0; i<keyChain.length; i++){
				if(keyChain[i].key.pub === key.pub &&
				   keyChain[i].key.priv === key.priv){
					if(showError){
						$("#keyExistsError").fadeIn();
					}
					return false;
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
				if(showError){
					$("#pubKeyError").fadeIn();
				}
				return false;
			}
			key = {pub: key.pub};
			for(var i = 0; i<keyChain.length; i++){
				if(keyChain[i].key.pub === key.pub && !keyChain[i].key.priv){
					if(showError){
						$("#keyExistsError").fadeIn();
					}
					return false;
				}
			}
		}
	}
	else if(key.length<6){
		if(showError){
			$("#key").focus();
			$("#keyLengthError").fadeIn();
		}
		return false;
	}
	else {
		for(var i = 0; i<keyChain.length; i++){
			if(keyChain[i].key === key){
				if(showError){
					$("#keyExistsError").fadeIn();
				}
				return false;
			}
		}
	}
	if(showError){
		$("#key").val("").focus();
		$("#description").val("");
	}
	addKey({
		key: key,
		description: description
	});
	return true;
}

/** Decrypt the imported keychain
 * passwordObj: an object containing the text to be decrypted and the password to decrypt with
*/
function decryptImportKeychain(passwordObj){
	var password = passwordObj.pass;
	try{
		var text = JSON.parse(passwordObj.text);
		plaintext = CryptoJS.AES.decrypt(text.file, password);
		plaintext = plaintext.toString(CryptoJS.enc.Utf8);
		if(!plaintext){
			throw true;
		}
		verifyMergeImportKeychain(JSON.stringify({
			encrypted: false,
			file: plaintext
		}));
	}
	catch(e){
		importKeychainError();
	}
}

/** Import a keychain
 * type: either "clipboard", "open" (for import file window), or "file" for file import
*/
function importKeychain(type){
	function readImportedFile(){
		if(fileChooser.files.length){
			var file = fileChooser.files[0],
			reader = new FileReader();
			
			reader.onload = (function(theFile){
				return function(e){
					if(reader.result){
						verifyMergeImportKeychain(reader.result);
					}
					else {
						importKeychainError();
					}
				};
			})(file);
			
			reader.readAsText(file);
		}
		fileChooser.remove();
	}
	
	switch(type){
		case "clipboard":
			verifyMergeImportKeychain(chrome.extension.getBackgroundPage().getClipboard());
			break;
		case "open":
			chrome.tabs.create({'url': chrome.extension.getURL('/src/browser_action/upload.html')});
			break;
		case "file":
		default:
			var fileChooser = document.createElement('input');
			fileChooser.type = 'file';
			fileChooser.value = '';
			fileChooser.addEventListener('change', function(){
				clearInterval(importKeychain.interval);
				readImportedFile();
			}, false);
			fileChooser.click();
			
			importKeychain.interval = setInterval(function(){
				if(fileChooser.files.length){
					clearInterval(importKeychain.interval);
				readImportedFile();
				}
			}, 2000);
			break;
	}
}

/** Open the import password window
 * text: the text to be decrypted
*/
function getImportPassword(text){
	closePopup();
	openPopup("importKeychainPassword");
	$("#importKeychainPassword .keyChainPassword").focus();
	$("#importKeychainPassword input[type='hidden']").val(text);
}

/** Merge imported keychain with existing keychain
 * keys: the array of keys to be imported
*/
function mergeKeychain(keys){
	closePopup();
	keys = JSON.parse(keys);
	for(var i=0; i<keys.length; i++){
		var notFound = true;
		if(!keys[i].key || !keys[i].description){
			continue;
		}
		for(var j=0; j<keyChain.length; j++){
			if(keys[i].key === keyChain[j].key && (keys[i].key.priv || keys[i].description == keyChain[j].description)){
				notFound = false;
				break;
			}
		}
		if(notFound){
			verifyAddKey(keys[i].key, keys[i].description, !!keys[i].key.pub, false);
		}
	}
	showFlash("importKeychainSuccess");
}

/** Verify imported keychain is an actual keychain and merge it
 * text: the JSON stringified keychain to be imported
*/
function verifyMergeImportKeychain(text){
	try{
		text = JSON.parse(text);
		if(!text){
			throw true;
		}
		if(text.encrypted){
			getImportPassword(JSON.stringify(text));
		}
		else if(text.file){
			mergeKeychain(text.file);
		}
		else{
			throw true;
		}
	}
	catch(e){
		importKeychainError();
	}
}

/** Show a import keychain error */
function importKeychainError(){
	closePopup();
	showFlash("importKeychainError");
}

/** Export the keychain
 * passwordObj: an object containing the type of export and the password to export under
*/
function exportKeychain(passwordObj){
	var password = passwordObj.pass;
	var jsonKeys = JSON.stringify(keyChain);
	var exported = JSON.stringify({
		encrypted: !!password,
		file: password? CryptoJS.AES.encrypt(jsonKeys, password).toString() : jsonKeys
	});
	switch(passwordObj.type){
		case "clipboard":
			chrome.extension.getBackgroundPage().setClipboard(exported);
			showFlash("exportCopied");
			break;
		case "file":
		default:
			window.URL = window.URL || window.webkitURL;
			var file = new Blob([exported], {type: 'application/json'}),
			a = document.createElement('a');
			a.href = window.URL.createObjectURL(file);
			a.download = 'Grd Me Keychain.json';
			document.body.appendChild(a);
			a.click();
			a.remove();
			showFlash("exportCreated");
			break;
	}
}

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
										.append($("<span>", {class: 'key partialKey', text: "Key: "+data.keys[i].pub}))
										.append(!revoked? $("<button>", {class: 'btn blue addKey', uid: data.uid, pub: data.keys[i].pub, text: "Add"}) : ""))
									.append(revoked? $("<div>", {class: 'timestamp', text: "Revoked: "+data.keys[i].revoked_at}): "")
									.append($("<div>", {class: 'timestamp', text: "Created: "+data.keys[i].created_at})));
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
	$("#addKey").trigger("submit");
	closePopup();
});

/** Add a key to the key list */
$("#addKey").on("submit", function(e){
	e.preventDefault();
	var keyVal = $("#key").val().trim(),
	description = $("#description").val().trim(),
	isECC = $("#ecc").is(":checked");
	verifyAddKey(keyVal, description, isECC, true);
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
		/* BROWSER COMPATIBILITY IS IFFY */
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
	$("#keyList").find("li[index='"+$("#pubKeyIndex").val()+"']").find(".revoke").addClass("disabled").prop("disabled", true);
	revokeKey(key);
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
					$("#keyList").find("li[index='"+$("#pubKeyIndex").val()+"']").find(".publish").addClass("disabled").prop("disabled", true);
					publishKey(key);
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

/** Clicking the overlay closes the overlay and appropriate popups */
$("#overlay").on("click", function(){
	closePopup();
});

/** Close the overlay on clicking a cancel btn */
$(".cancel").on("click", function(){
	closePopup();
});

/** Show/hide a key in the key list */
$("#keyList").on("click", ".showHideKey", function(e){
	e.stopImmediatePropagation();
	$(this).next().toggle();
	$(this).text($(this).next().is(":visible")? "Hide key": "Show key");
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
		updateDescription($(this).parents("li").attr("index"), description);
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
		updateDescription($(this).parents("li").attr("index"), description);
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
								.append(": "+sanitize(keyChain[i].key.pub))
								.append($("<br>"))
								.append($("<b>", {class: "priv", text: "priv"}))
								.append(": "+sanitize(keyChain[i].key.priv)))))
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
	shareKey({
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
		addKey({
			key: $(this).attr("key"),
			description: $.trim(description.val())
		});
		$(this).find(".remove").trigger("click");
	}
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
	if($(this).attr("id") === "encryptForm"){
		encryptKeychain({
			pass: pass,
			confirm: confirm,
			hash: CryptoJS.SHA256(pass).toString()
		});
	}
	else {
		decryptKeychain(pass);
	}
	closePopup();
});

$("#exportKeychain").on("click", function(){
	openPopup("exportKeychainPopup");
});

$("#importKeychain").on("click", function(){
	openPopup("importKeychainPopup");
});

$("#importFromClipboard").on("click", function(){
	$("#importKeychainPopup").trigger("submit", ["clipboard"]);
});

$("#openImportFile").on("click", function(){
	$("#importKeychainPopup").trigger("submit", ["open"]);
});

$("#importKeychainPopup").on("submit", function(e, type){
	e.preventDefault();
	importKeychain(type || "file");
});

$("#exportToClipboard").on("click", function(){
	$("#exportKeychainPopup").trigger("submit", ["clipboard"]);
});

$("#exportKeychainPopup").on("submit", function(e, type){
	e.preventDefault();
	closePopup();
	type = type || "file";
	var pass = $(this).find("input.keyChainPassword");
	exportKeychain({
		type: type,
		pass: pass.val().trim()
	});
	pass.val("");
});

$("#importKeychainPassword").on("submit", function(e){
	e.preventDefault();
	var pass = $(this).find(".keyChainPassword");
	if(!pass.val().trim()){
		pass.val("").focus();
		return;
	}
	closePopup();
	var text = $(this).find("input[type='hidden']").val();
	decryptImportKeychain({
		text: text,
		pass: pass.val().trim()
	});
	pass.val("");
});

(function(){
	$(".error, #overlay, .popup").hide();
	
	/** Add a dropdown for suggesting uids */
	var uidDropdown = new dropdowns($("#uid"), $("#uidSuggestions"), function(text){
		text = text.toLowerCase();
		var count = 0;
		var results = [];
		for(var i=0; i<uids.length; i++){
			if(!uids[i].toLowerCase().indexOf(text) && text != uids[i].toLowerCase()){
				count++;
				results.push(sanitize(uids[i]));
				if(count>3){
					break;
				}
			}
		}
		return results;
	});
	
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
	
	/** Panel shown. Call function to open acceptable shared keys popup */
	chrome.storage.local.get("acceptableSharedKeys", function(keys){
		keys = keys.acceptableSharedKeys;
		acceptableSharedKeysPopup(keys);
	});
	
	displayKeys();
	
	getUIDS();
}());