/** Handle interception of https://decrypt.grd.me/UID iframes */

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Intercept = (function () {
	function Intercept() {
		var _this = this;

		_classCallCheck(this, Intercept);

		this.uidMap = {};
		var baseURL = 'https://decrypt.grd.me/';
		var metaTag = undefined;
		var jquery = undefined;
		var aes = undefined;
		var linkify = undefined;
		var emojify = undefined;
		var emojifyCss = undefined;
		var observer = undefined;
		var cryptoManager = undefined;
		var interceptFrameCryptoFinder = undefined;
		var intercept = undefined;

		this.getFile('/assets/inject/utf8Meta.phtml', function (response) {
			metaTag = response;
		});

		this.getFile('/assets/inject/lib/jquery-2.1.3.js', function (response) {
			jquery = _this.scriptWrap(response);
		});

		this.getFile('/assets/inject/lib/aes.js', function (response) {
			aes = _this.scriptWrap(response);
		});

		this.getFile('/assets/inject/lib/linkify.js', function (response) {
			linkify = _this.scriptWrap(response);
		});

		this.getFile('/assets/inject/lib/emojify.js', function (response) {
			emojify = _this.scriptWrap(response);
		});

		this.getFile('/assets/inject/lib/emojify.css', function (response) {
			emojifyCss = _this.styleWrap(response);
		});

		this.getFile('/assets/inject/observer.js', function (response) {
			observer = _this.scriptWrap(response);
		});

		this.getFile('/assets/inject/cryptoManager.js', function (response) {
			cryptoManager = _this.scriptWrap(response);
		});

		this.getFile('/assets/inject/interceptFrameCryptoFinder.js', function (response) {
			interceptFrameCryptoFinder = _this.scriptWrap(response);
		});

		this.getFile('/assets/inject/interceptFrame.js', function (response) {
			intercept = _this.scriptWrap(response);
		});

		chrome.webRequest.onBeforeRequest.addListener(function (details) {
			var uid = details.url.slice(baseURL.length);
			return { redirectUrl: 'data:text/html;charset=utf-8,' + encodeURIComponent(metaTag + jquery + aes + linkify + emojify + emojifyCss + observer + cryptoManager + interceptFrameCryptoFinder + _this.scriptWrap('locationObj=' + JSON.stringify(_this.uidMap[uid].location) + ';messageCSS=' + JSON.stringify(_this.uidMap[uid].message.css) + ';childrenCSS=' + JSON.stringify(_this.uidMap[uid].message.childrenCSS) + ';fonts=' + JSON.stringify(_this.uidMap[uid].fonts) + ';messageText=' + JSON.stringify(_this.uidMap[uid].message.text) + ';FRAME_SECRET=' + JSON.stringify(_this.uidMap[uid].secret) + ';uid=' + JSON.stringify(uid) + ';') + intercept) };
		}, {
			urls: [baseURL + '*'],
			types: ['sub_frame']
		}, ['blocking']);
	}

	/** Read a packaged file
  * @param url Url to the file
  * @param callback Function which takes the contents of the file
 */

	_createClass(Intercept, [{
		key: 'getFile',
		value: function getFile(url, callback) {
			var xhr = new XMLHttpRequest();
			xhr.open('GET', chrome.extension.getURL(url), true);
			xhr.onreadystatechange = function () {
				if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
					callback(xhr.responseText);
				}
			};
			xhr.send();
		}

		/** Wrap some js in script tags
   * @param content The content to be wrapped
  */
	}, {
		key: 'scriptWrap',
		value: function scriptWrap(content) {
			return '<script>' + content + '</script>';
		}

		/** Wrap some css in style tags
   * @param content The content to be wrapped
  */
	}, {
		key: 'styleWrap',
		value: function styleWrap(content) {
			return '<style>' + content + '</style>';
		}

		/** Tell the background script to add a uid to the array
   * @param uid The unique id of a message
   * @param location Object containing the host, origin, and full location of the frame's parent
   * @param secret The window's symmetric key
   * @param message The message object containing both the text and css object
   * @param fonts The fonts in the outer frame
  */
	}, {
		key: 'add',
		value: function add(uid, location, secret, message, fonts) {
			var endings = ['?', '#'];
			for (var i = 0; i < endings.length; i++) {
				if (location.full.indexOf(endings[i]) > 0) {
					location.full = location.full.slice(0, location.full.indexOf(endings[i]));
				}
			}
			this.uidMap[uid] = {
				location: location,
				secret: secret,
				message: message,
				fonts: fonts
			};
		}
	}]);

	return Intercept;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Intercept;
} else {
	window.Intercept = Intercept;
}