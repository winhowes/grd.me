var startTag = '~~grdme~~',
endTag = '~~!grdme~~',
NONCE_CHAR = "!",
DECRYPTED_MARK,
UNABLE_TO_DECRYPT = "[Unable to decrypt message]",
UNABLE_startTag = "[start tag]",
UNABLE_endTag = "[end tag]";

setTimeout(function(){
	container = $("<i>");
	$("<grdme>").attr("title", "Decrypted by Grd Me").css({
		"width": "15px",
		"height": "16px",
		"display": "inline-block",
		"background-repeat": "no-repeat",
		"vertical-align": "middle",
		"background-image": "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAQCAYAAADJViUEAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAVlpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KTMInWQAAAs9JREFUKBVtU01IVFEUPve+efPmR0XT/sykSERTSXJTUakEwRhtAmsRKEW1iBCCKKhFbyot2hQu2rQJoyAjgkxTbDFGbZLQRZgK6cJIBcefZubNz3v3ns59jlbQ2VzeOec753zfOY/BmjV3a/DypKi9MdC6IrQHtkCGAJIxxn0c7VyPc27kTugNZPMUjLlYRAaMYaijb+P4smdM08VFzc7024wXFPhhwUp7W1OCXWsN6WVmY6MD2XyPCw67RTDm+Io17iyX6L7XkfaQQ7GYiu83+1/MJllbZMgqos85CIdVU+QquGZSswVNwGM5kO/6OvsM9c4neCEgFObpBjH5Y1lweN2DthA1VxrjrqOtKa3ew7v1mXwdzZRXrPrNm24Rd+wGqOcREscQiHxTfsnnR6ODVRxsZynOMtE4DE0ITQc+7ZPWU7eogtLgBEYWMZniB4u+YIunotwv0TnIPV5w5E9ILTrAdAOEdA7FM/YtSotBViMaW20EoPbeh+vp4m1XZSaBmLRskUoIKUjYDOmcTqQdIWDG8tw/0vG+/MLWL5rCuJzrWrpKU0VF7ZgTBCZRAOc6Rym9aI9zTosBoNa2SPDgie8rcnhkdr5wHXy8q2WOSTlJyyZRUfBAHujCeTXRVlfpN1gv6H5F0UFhE4b9OFYfWFgFd6NmAmRY0hpmxJOCElHSacEWleAg2wz0TYZKBy+Xn9xDoUvjDWMRtXAIRJeegWUBaJwRTxCM76zpHL4kHdwOijtR5CIDeZp8rvKh2RVczUohOs/qh8O9sqKqScSjaapoONEkJMamkBmazQIbvMF0tHvy7tFTYNJxmUwqwTB7blA2+vE0fPs6wJlhgEcHmYonkHP6M3K9/tRCT8OO6TNuV9rVv2aarvLKWRsePF/5ZCK+6/EUll5+92uPOXh2PVl1/a+pAuqPIdtn9uytuh3pOWC+rV7NJf9fDZTvN2MXRNKRmI9oAAAAAElFTkSuQmCC)"
	}).appendTo(container);
	DECRYPTED_MARK = container.html();
}, 0);