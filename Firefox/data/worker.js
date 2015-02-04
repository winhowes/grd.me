importScripts("lib/sha256.js",
			  "lib/ecc.min.js",
			  "lib/aes.js");

onmessage = function(e) {
	var eData = JSON.parse(e.data);
	if(eData.id == "verifyShortMessage") {
		var result = verifyShortMessage(eData.data);
	}
	else if(eData.id == "decrypt"){
		var result = decryptText(eData.data.ciphertext, eData.data.keyList);
	}
	postMessage(JSON.stringify({index: eData.data.callback, data: result}));
}

/** Fast trim whitespace for string
 * str: the string to be trimmed
*/
function trim(str){
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

/** Decrypt ciphertext with all available keys. Returns false if no decryption possible
 * ciphertext: the text excluding the crypto tags to decrypt
 * keyList: an array of all key objects
*/
function decryptText(ciphertext, keyList){
	ciphertext = ciphertext.replace(/\)/g, "+").replace(/\:/g, "/");
	ciphertext = ciphertext.split("|");
	for(var i=0; i<ciphertext.length; i++){
		var plaintext;
		for(var j=0; j<keyList.length; j++){
			try{
				if(typeof keyList[j].key === "object" && keyList[j].key.priv){
					plaintext = ecc.decrypt(keyList[j].key.priv, ciphertext[i]);
				}
				else{
					plaintext = CryptoJS.AES.decrypt(ciphertext[i], keyList[j].key);
					plaintext = plaintext.toString(CryptoJS.enc.Utf8);
				}
				if(!trim(plaintext).length){
					break;
				}
				return plaintext;
			}
			catch(e){}
		}
	}
	return false;
}

/** Verify and decrypt a shortMessage
 * data: an object containing the messages, random nonce's, the hash and the keyList
*/
function verifyShortMessage(data){
	var plaintext = false;
	for(var i=0; i<data.messages.length; i++){
		if(CryptoJS.SHA256(data.messages[i].message+data.messages[i].rand).toString().slice(0, 60) == data.hash &&
		   (plaintext = decryptText(data.messages[i].message, data.keyList))){
			return plaintext;
		}
	}
	return false;
}