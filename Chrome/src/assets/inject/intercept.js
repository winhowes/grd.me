/** Intercept frames for sandboxed decryption */
class Intercept {
	constructor() {
		this.uidMap = {};
		this.fonts = this._getFonts();
	}

	/** Tell the background script to add a uid to the array
	 * @param data Object containing:
	 *     uid: the unique id of a message
	 *     location: an object containing the host, origin, and full location of the frame's parent
	 *     secret: the window's symmetric key
	 *     message: the message object containing both the text and css object
	*/
	add(data) {
		data.fonts = this.fonts;
		port.postMessage({
			id: 'interceptAdd',
			data: data,
		});
		const endings = ['?', '#'];
		for (let i = 0; i < endings.length; i++) {
			if (data.location.full.indexOf(endings[i]) > 0) {
				data.location.full = data.location.full.slice(0, data.location.full.indexOf(endings[i]));
			}
		}
		this.uidMap[data.uid] = {
			location: data.location,
			secret: data.secret,
			message: data.message,
		};
	}

	/** Get the info for a frame with a particular uid and secret
	 * @param uid The uid of the frame
	 * @param secret The secret of the frame
	 * @param callback A callback function to receive the info
	*/
	getInfo(uid, secret, callback) {
		const listener = (message) => {
			callback({
				messageText: this.uidMap[uid].message.text,
				locationObj: this.uidMap[uid].location,
				fonts: message.data.fonts,
				stylesheetCSS: message.data.css,
				childrenCSS: this.uidMap[uid].message.childrenCSS,
				messageCSS: this.uidMap[uid].message.css,
			});
			messageManager.removeMessageListener('grdMe@grd.me:get-frame-css:' + uid, listener);
		};

		if (this.uidMap[uid] && this.uidMap[uid].secret === secret) {
			const messageManager = windowController.getMostRecentBrowserWindow().gBrowser.selectedBrowser.messageManager;
			messageManager.loadFrameScript(data.url('chromeFrame.js'), false);
			messageManager.sendAsyncMessage('grdMe@grd.me:fetch-frame-css', {
				uid: uid,
			});
			messageManager.addMessageListener('grdMe@grd.me:get-frame-css:' + uid, listener);
		} else {
			callback(false);
		}
	}

	/** Set up an iframe to be intercepted
	 * @param uid The uid of the iframe
	*/
	prepareIframe(uid) {
		const elem = $('[grdMeUID="' + uid + '"]');
		let width = '100%';
		if (elem.css('display') === 'block') {
			if (elem.width() > 0) {
				width = elem.outerWidth();
			} else {
				width = 'auto';
			}
		}
		elem.append($('<iframe>', {
			src: 'https://decrypt.grd.me/' + uid,
			'grdMeFrameUID': uid,
			seamless: 'seamless',
		}).css({
			border: 0,
			width: width,
			height: elem.outerHeight(),
			marginBottom: '-7px',
		}).hide()).css('display', 'block');
	}

	/** Get the page's fonts */
	_getFonts() {
		const fonts = [];
		for (let i = 0; i < document.styleSheets.length; i++) {
			try {
				if (document.styleSheets[i].cssRules) {
					for (let j = 0; j < document.styleSheets[i].cssRules.length; j++) {
						if (!document.styleSheets[i].cssRules[j].cssText.toLowerCase().indexOf('@font-face')) {
							fonts.push(document.styleSheets[i].cssRules[j].cssText.replace(/javascript:/gi, ''));
						}
					}
				}
			} catch (e) {
				console.error('Error getting fonts', e);
			}
		}
		return fonts;
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Intercept;
} else {
	window.Intercept = Intercept;
}
