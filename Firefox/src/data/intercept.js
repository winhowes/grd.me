/* This code handles the decrypted message iframe */

$(() => {
	const FRAME_SECRET = decodeURIComponent($('#frameSecret').text());
	const uid = decodeURIComponent($('#uid').text());
	const cryptoManager = new CryptoManager();
	let locationObj;
	$('#uid, #frameSecret').remove();
	try {
		self.port.emit('verifyFrame', {
			secret: FRAME_SECRET,
			uid: uid,
		});
	} catch(e) {
		console.error('Error sending verify frame message', e);
	}

	const Messenger = (() => {
		const frameOrigin = 'https://decrypt.grd.me';
		/** Receive a message from the content scripts
		 * @param event An event about a recieved message
		*/
		function receiveMessage(event) {
			try {
				if (event.data.to !== frameOrigin) {
					return;
				}
				let data = event.data.encrypted;
				data = CryptoJS.AES.decrypt(data, FRAME_SECRET);
				data = data.toString(CryptoJS.enc.Utf8);
				if (!data) {
					return;
				}
				data = JSON.parse(data);
				if (data.id === 'decryptCallback') {
					$('body').trigger('callback', [data.returnId, data.plaintext]);
				} else if (data.id === 'decryptIndicator') {
					cryptoManager.preferences.decryptIndicator = data.decryptIndicator;
				} else if (data.id === 'emojis') {
					cryptoManager.preferences.emojis = data.emojis;
				}
			} catch(e) {
				console.error('Error receiving response from frameComm', e);
			}
		}

		window.addEventListener('message', receiveMessage, false);

		return {
			/** Send data to parent window
			 * @param data The data object to send
			*/
			send: (data) => {
				data.uid = uid;
				let encryptedData = CryptoJS.AES.encrypt(JSON.stringify(data), FRAME_SECRET);
				encryptedData = encryptedData.toString();
				parent.postMessage({
					encrypted: encryptedData,
					from: frameOrigin,
				}, locationObj.origin);
			},
		};
	}());

	const cryptoHelper = new InterceptCryptoHelper(Messenger, cryptoManager, locationObj);

	/** Checks the height of the body and adjusts the frame height to match */
	const checkHeight = (() => {
		const padding = 5;
		let lastBodyHeight = 0;
		return () => {
			const outerHeight = $('body').outerHeight();
			if (lastBodyHeight !== outerHeight) {
				lastBodyHeight = outerHeight;
				Messenger.send({
					id: 'adjustHeight',
					height: lastBodyHeight + padding,
				});
			}
		};
	}());

	/** Get the unique selector for qn element
	 * @param elem Element for which to get the selector
	*/
	function getUniqueSelector(elem) {
		if (elem.nodeName.toLowerCase() === 'body' || elem.nodeName.toLowerCase() === 'html') {
			return '[grdMeUID="' + uid + '"]';
		}
		let parent = elem.parentNode;
		let selector = '>' + elem.nodeName + ':nth-child(' + ($(elem).index() + 1) + ')';
		while (parent && parent.nodeName.toLowerCase() !== 'body') {
			selector = '>' + parent.nodeName + ':nth-child(' + ($(parent).index() + 1) + ')' + selector;
			parent = parent.parentNode;
		}
		return '[grdMeUID="' + uid + '"]' + selector;
	}

	/** Get all events for an element
	 * @param element An html element
	*/
	function getAllEvents(element) {
		const result = [];
		for (const key in element) {
			if (element.hasOwnProperty(key) && key.indexOf('on') === 0) {
				result.push(key.slice(2));
			}
		}
		return result.join(' ');
	}

	/** Returns whether or not the character is a valid first character in a tag
	 * @param character The first character
	*/
	function isValidTagChar(character) {
		return character.match(/[a-z?\\\/!]/i);
	}

	/** Strips scripts from a string of html
	 * @param originalHTML String of html to be stripped
	*/
	function stripScripts(originalHTML) {
		let html = originalHTML;
		let lowerHTML = html.toLowerCase();
		let index1 = lowerHTML.indexOf('<script');
		let index2 = lowerHTML.indexOf('>', lowerHTML.indexOf('</script', index1));
		while (index1 !== -1) {
			html = html.substring(0, index1) + html.substring(index2 + 1);
			lowerHTML = html.toLowerCase();
			index1 = lowerHTML.indexOf('<script');
			index2 = lowerHTML.indexOf('>', lowerHTML.indexOf('</script', index1));
		}
		return html;
	}

	/** Removes javascript from html string
	 * @param originalHTML String to be cleaned
	*/
	function clean(originalHTML) {
		const prefix = 'grdme';
		const sandbox = ' sandbox=""';
		let strip = false;
		let lastQuote = false;
		let tag = false;
		let html = originalHTML;

		/** Strip out some of the html */
		function stripHTML() {
			html = html.slice(0, strip) + html.slice(j);
			j = strip;
			strip = false;
		}

		for (let i = 0; i < html.length; i++) {
			if (html[i] === '<' && html[i + 1] && isValidTagChar(html[i + 1])) {
				i++;
				tag = false;
				/* Enter element */
				for (let j = i; j < html.length; j++) {
					if (!lastQuote && html[j] === '>') {
						if (strip) {
							stripHTML();
						}
						/* sandbox iframes */
						if (tag === 'iframe') {
							const index = html.slice(i, j).toLowerCase().indexOf('sandbox');
							if (index > 0) {
								html = html.slice(0, i + index) + prefix + html.slice(i + index);
								j += prefix.length;
							}
							html = html.slice(0, j) + sandbox + html.slice(j);
							j += sandbox.length;
						}
						i = j;
						break;
					}
					if (!tag && html[j] === ' ') {
						tag = html.slice(i, j).toLowerCase();
					}
					if (lastQuote === html[j]) {
						lastQuote = false;
						continue;
					}
					if (!lastQuote && html[j - 1] === '=' && (html[j] === '\'' || html[j] === '"')) {
						lastQuote = html[j];
					}
					/* Find on statements */
					if (!lastQuote && html[j - 2] === ' ' && html[j - 1] === 'o' && html[j] === 'n') {
						strip = j - 2;
					}
					if (strip && html[j] === ' ' && !lastQuote) {
						stripHTML();
					}
				}
			}
		}
		html = stripScripts(html);
		return html;
	}

	self.port.on('frameVerified', (obj) => {
		const messageCSS = obj.messageCSS;
		const stylesheetCSS = obj.stylesheetCSS;
		const childrenCSS = obj.childrenCSS;
		const fonts = obj.fonts;
		const messageText = obj.messageText;
		const $style = $('<style>', {type: 'text/css'});
		locationObj = obj.locationObj;

		$('html').css(messageCSS);
		$('body').append(clean(messageText)).css(messageCSS);

		for (let i = 0; i < fonts.length; i++) {
			$style.append(fonts[i]);
		}

		if (stylesheetCSS.length) {
			for (let i = 0; i < stylesheetCSS.length; i++) {
				for (const pseudo in stylesheetCSS[i].css) {
					if (stylesheetCSS[i].css.hasOwnProperty(pseudo)) {
						const pseudoClass = pseudo !== 'normal' ? pseudo : '';
						$style.append(document.createTextNode(stylesheetCSS[i].selector + pseudoClass + '{'));
						for (const key in stylesheetCSS[i].css[pseudo]) {
							if (stylesheetCSS[i].css[pseudo].hasOwnProperty(key)) {
								const value = $.trim(stylesheetCSS[i].css[pseudo][key]);
								/* Make sure there's no JS */
								if ($.trim(value.toLowerCase().replace('url(', '')
										   .replace('\'', '').replace('"', '')
										   .replace('/*', '').replace('*/', '')).indexOf('javascript')) {
									$style.append(document.createTextNode(key + ':' + value + ';'));
								}
							}
						}
						$style.append(document.createTextNode('}'));
					}
				}
			}
		} else {
			for (let i = 0; i < childrenCSS.length; i++) {
				$('body ' + childrenCSS[i].selector).css(childrenCSS[i].css);
			}
		}

		$(document.head).append($style);

		$('html').bind(getAllEvents($('html').get(0)), (e) => {
			Messenger.send({
				id: 'event',
				event: {
					type: e.type.toString(),
					selector: getUniqueSelector(e.target),
				},
			});
		});

		$('body').on('click', 'a', function anchorClickHandler(e) {
			e.preventDefault();
			if ($(this).attr('href')) {
				Messenger.send({
					id: 'click',
					href: $(this).attr('href'),
					target: $(this).attr('target'),
				});
			}
		});

		$('html, body').css({
			padding: 0,
			margin: 0,
			height: 'auto',
		});

		setInterval(() => {
			checkHeight();
		}, 500);

		cryptoHelper.fixReferences();

		initObserver(() => {
			cryptoHelper.decryptInterval();
		});

		Messenger.send({id: 'ready'});
	});

	self.port.on('frameFailed', () => {
		if (uid.length && FRAME_SECRET.length) {
			console.error('Error Decrypting');
			$('body').append(cryptoManager.decryptMark('Error Decrypting'));
			Messenger.send({id: 'ready'});
		}
	});
}());
