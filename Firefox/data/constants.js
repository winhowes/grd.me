var startTag = '~~grdme~~',
endTag = '~~!grdme~~',
NONCE_CHAR = "!",
DECRYPTED_MARK = "<grdme style='font-weight:bold;'>&#x1f512;</grdme>",
UNABLE_TO_DECRYPT = "[Unable to decrypt message]",
UNABLE_startTag = "[start tag]",
UNABLE_endTag = "[end tag]";

setTimeout(function(){
	var charCheck,
	css_obj = {
		"display": "inline",
		"width": "auto"
	};
	$("body").append(charCheck = $("<div>").css("visibility", "hidden")
		.append($("<span>").html("&#x1f512;").css(css_obj))
		.append($("<span>").html("&#xfffff;").css(css_obj)));
	DECRYPTED_MARK = "<grdme style='font-weight:bold;'>" +
		(charCheck.find("span").first().width() ===
		charCheck.find("span").last().width()? "[Decrypted Text]" :
		"&#x1f512;") + "</grdme>";
}, 0);