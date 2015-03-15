/* This script handles communication with decrypted message iframes */

/** Receive a message from the decrypted frames */
function receiveMessage(event){
	try {
		if(event.data.from != frameOrigin){
			return;
		}
		var data = event.data.encrypted;
		data = CryptoJS.AES.decrypt(data, FRAME_SECRET);
		data = data.toString(CryptoJS.enc.Utf8);
		if(!data){
			return;
		}
		data = JSON.parse(data);
		if(data.id == "event"){
			if(data.event.type == "click"){
				document.querySelector(data.event.selector).click();
			}
			else if(data.event.type == "submit"){
				document.querySelector(data.event.selector).submit();
			}
			else{
				$(data.event.selector).trigger(data.event.type);
			}
		}
		else if(data.id == "ready"){
			$("[grdMeUID='"+data.uid+"']").children(":not(iframe[grdMeFrameUID='"+data.uid+"'])").hide();
			$("iframe[grdMeFrameUID='"+data.uid+"']").show();
			msg(data.uid, {id: "decryptIndicator", decryptIndicator: decryptIndicator});
		}
		else if(data.id == "adjustHeight"){
			$("iframe[grdMeFrameUID='"+data.uid+"']").height(data.height);
		}
		else if(data.id == "click"){
			if(data.target === "_blank"){
				port.postMessage({id: "newTab", href: data.href});
			}
			else{
				window.location.assign(data.href);
			}
		}
		else if(data.id == "decrypt"){
			var ciphertext = data.ciphertext;
			var finish = function(plaintext){
				if(!plaintext){
					plaintext = UNABLE_TO_DECRYPT+" "+UNABLE_startTag + data.ciphertext + UNABLE_endTag;
				}
				msg(data.uid, {id: "decryptCallback", plaintext: plaintext, returnId: data.returnId});
			};
			if(ciphertext.charAt(0)==NONCE_CHAR){
				var hash = ciphertext.slice(1);
				$.ajax({
					url: "https://grd.me/message/get",
					type: "GET",
					data: {
						hash: hash
					},
					success: function(data){
						if(data && data.status && data.status[0] && !data.status[0].code){
							for(var i=0; i<data.messages.length; i++){
								if(CryptoJS.SHA256(data.messages[i].message+data.messages[i].rand).toString().slice(0, 60) == hash){
									finish(decryptText(ciphertext));
									return;
								}
							}
							finish(false);
						}
						else {
							finish(false);
						}
					},
					error: function(){
						finish(false);
					}
				});
			}
			else {
				finish(decryptText(ciphertext));
			}
		}
	}
	catch(e){}
}

/** Send a message to a decrypted frame
 * uid: the uid of the frame
 * data: the data to send
*/
function msg(uid, data){
	if($("iframe[grdMeFrameUID='"+uid+"']").get(0) &&
	   !$("iframe[grdMeFrameUID='"+uid+"']").attr("src").indexOf(frameOrigin) &&
	   $("iframe[grdMeFrameUID='"+uid+"']").get(0).contentWindow){
		data = CryptoJS.AES.encrypt(JSON.stringify(data), FRAME_SECRET);
		data = data.toString();
		$("iframe[grdMeFrameUID='"+uid+"']").get(0).contentWindow.postMessage({
			encrypted: data,
			to: frameOrigin
		}, "*");
	}
}

window.addEventListener("message", receiveMessage, false);