/** Handle interception of https://decrypt.grd.me/UID iframes */

class Intercept {
	constructor() {
		this.uidMap = {};
		const baseURL = 'https://decrypt.grd.me/';
		let metaTag;
		let jquery;
		let aes;
		let linkify;
		let emojify;
		let emojifyCss;
		let observer;
		let cryptoManager;
		let interceptFrameCryptoFinder;
		let intercept;

		this.getFile('/assets/inject/utf8Meta.phtml', (response) => {
			metaTag = response;
		});

		this.getFile('/assets/inject/lib/jquery-2.1.3.js', (response) => {
			jquery = this.scriptWrap(response);
		});

		this.getFile('/assets/inject/lib/aes.js', (response) => {
			aes = this.scriptWrap(response);
		});

		this.getFile('/assets/inject/lib/linkify.js', (response) => {
			linkify = this.scriptWrap(response);
		});

		this.getFile('/assets/inject/lib/emojify.js', (response) => {
			emojify = this.scriptWrap(response);
		});

		this.getFile('/assets/inject/lib/emojify.css', (response) => {
			emojifyCss = this.styleWrap(response);
		});

		this.getFile('/assets/inject/observer.js', (response) => {
			observer = this.scriptWrap(response);
		});

		this.getFile('/assets/inject/cryptoManager.js', (response) => {
			cryptoManager = this.scriptWrap(response);
		});

		this.getFile('/assets/inject/interceptFrameCryptoFinder.js', (response) => {
			interceptFrameCryptoFinder = this.scriptWrap(response);
		});

		this.getFile('/assets/inject/interceptFrame.js', (response) => {
			intercept = this.scriptWrap(response);
		});

		chrome.webRequest.onBeforeRequest.addListener((details) => {
			const uid = details.url.slice(baseURL.length);
			return {redirectUrl: 'data:text/html;charset=utf-8,' + encodeURIComponent(
				metaTag +
				jquery +
				aes +
				linkify +
				emojify +
				emojifyCss +
				observer +
				cryptoManager +
				interceptFrameCryptoFinder +
				this.scriptWrap(
					'locationObj=' + JSON.stringify(this.uidMap[uid].location) +
					';messageCSS=' + JSON.stringify(this.uidMap[uid].message.css) +
					';childrenCSS=' + JSON.stringify(this.uidMap[uid].message.childrenCSS) +
					';fonts=' + JSON.stringify(this.uidMap[uid].fonts) +
					';messageText=' + JSON.stringify(this.uidMap[uid].message.text) +
					';FRAME_SECRET=' + JSON.stringify(this.uidMap[uid].secret) +
					';uid=' + JSON.stringify(uid) + ';'
				) +
				intercept
			)};
		},
			{
				urls: [
					baseURL + '*',
				],
				types: ['sub_frame'],
			},
			['blocking']
		);
	}
	/** Read a packaged file
	 * @param url Url to the file
	 * @param callback Function which takes the contents of the file
	*/
	getFile(url, callback) {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', chrome.extension.getURL(url), true);
		xhr.onreadystatechange = () => {
			if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
				callback(xhr.responseText);
			}
		};
		xhr.send();
	}

	/** Wrap some js in script tags
	 * @param content The content to be wrapped
	*/
	scriptWrap(content) {
		return '<script>' + content + '</script>';
	}

	/** Wrap some css in style tags
	 * @param content The content to be wrapped
	*/
	styleWrap(content) {
		return '<style>' + content + '</style>';
	}

	/** Tell the background script to add a uid to the array
	 * @param uid The unique id of a message
	 * @param location Object containing the host, origin, and full location of the frame's parent
	 * @param secret The window's symmetric key
	 * @param message The message object containing both the text and css object
	 * @param fonts The fonts in the outer frame
	*/
	add(uid, location, secret, message, fonts) {
		const endings = ['?', '#'];
		for (let i = 0; i < endings.length; i++) {
			if (location.full.indexOf(endings[i]) > 0) {
				location.full = location.full.slice(0, location.full.indexOf(endings[i]));
			}
		}
		this.uidMap[uid] = {
			location: location,
			secret: secret,
			message: message,
			fonts: fonts,
		};
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Intercept;
} else {
	window.Intercept = Intercept;
}
