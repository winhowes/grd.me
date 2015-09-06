/**
 * This frame script gets the fonts and css of the main page.
 * It needs Chrome access in order to read stylesheets and manipulate elements' pseudo classes.
**/

(() => {
	const Cc = Components.classes;
	const Ci = Components.interfaces;

	const domUtil = Cc['@mozilla.org/inspector/dom-utils;1'].getService(Ci.inIDOMUtils);
	const doc = content.document;
	const window = content.window;

	/** Get the index of an element in regards to its parent
	 * @param element The element to index
	*/
	function indexEl(element) {
		const nodeList = Array.prototype.slice.call(element.parentNode.children);
		return nodeList.indexOf(element);
	}

	/** Get the unique selector for qn element
	 * @param elem The element for which to get the selector
	 * @param stop The parent the selector should be relative to
	*/
	function getUniqueSelector(elem, stop) {
		let parent = elem.parentNode;
		if (elem.hasAttribute('grdMeAnchor')) {
			return 'body ' + elem.nodeName;
		}
		let selector = '>' + elem.nodeName + ':nth-child(' + (indexEl(elem) + 1) + ')';
		while (parent && parent !== stop) {
			selector = '>' + parent.nodeName + ':nth-child(' + (indexEl(parent) + 1) + ')' + selector;
			parent = parent.parentNode;
		}
		return 'body' + selector;
	}

	/** Return an object of all CSS attributes for a given element
	 * @param element Element whose CSS attributes are to be returned
	*/
	function getCSS(element) {
		const dest = {};
		let style;
		let prop;
		if (window.getComputedStyle) {
			style = window.getComputedStyle(element, null);
			if (style) {
				let val;
				if (style.length) {
					for (let i = 0, l = style.length; i < l; i++) {
						prop = style[i];
						if (!(element.hasAttribute('grdMeAnchor') && prop.toLowerCase() === 'display')) {
							val = style.getPropertyValue(prop);
							dest[prop] = val;
						}
					}
				} else {
					for (prop in style) {
						if (style.hasOwnProperty(prop) && !(element.hasAttribute('grdMeAnchor') && prop.toLowerCase() === 'display')) {
							val = style.getPropertyValue(prop) || style[prop];
							dest[prop] = val;
						}
					}
				}
				return dest;
			}
		}
		style = element.currentStyle;
		if (style) {
			for (prop in style) {
				if (style.hasOwnProperty(prop)) {
					dest[prop] = style[prop];
				}
			}
			return dest;
		}
		style = element.style;
		if (style) {
			for (prop in style) {
				if (style.hasOwnProperty(prop) && typeof style[prop] !== 'function') {
					dest[prop] = style[prop];
				}
			}
		}
		return dest;
	}

	/** Determines whether or not a stylesheet is a page stylesheet (ie not of the browser)
	 * @param styleSheet The styleSheet in question
	*/
	function isPageStyle(styleSheet) {
		if (styleSheet.ownerNode) {
			return true;
		}

		if (styleSheet.ownerRule instanceof Ci.nsIDOMCSSImportRule) {
			return isPageStyle(styleSheet.parentStyleSheet);
		}

		return false;
	}

	/** Get custom fonts for document */
	function getFonts() {
		const fonts = [];
		for (let i = 0; i < doc.styleSheets.length; i++) {
			try {
				if (doc.styleSheets[i].cssRules) {
					for (let j = 0; j < doc.styleSheets[i].cssRules.length; j++) {
						if (!doc.styleSheets[i].cssRules[j].cssText.toLowerCase().indexOf('@font-face')) {
							fonts.push(doc.styleSheets[i].cssRules[j].cssText.replace(/javascript:/gi, ''));
						}
					}
				}
			} catch(e) {
				console.error('Error getting fonts');
			}
		}
		return fonts;
	}

	/** Return an array of selectors and css objects for children of an element
	 * @param parent Parent element to search down from
	*/
	function setupChildren(parent) {
		if (!parent) {
			return [];
		}
		const states = [{
			state: ':active',
			prop: 0x01,
		}, {
			state: ':focus',
			prop: 0x02,
		}, {
			state: ':hover',
			prop: 0x04,
		}, {
			state: ':before',
		}, {
			state: ':after',
		}];

		const cssArr = [];
		const elements = parent.querySelectorAll('*');
		for (let i = 0; i < elements.length; i++) {
			const css = {
				normal: getCSS(elements[i]),
			};
			if (elements[i].nodeName.toLowerCase() !== 'grdme') {
				for (let j = 0; j < states.length; j++) {
					if (states[j].prop) {
						domUtil.setContentState(elements[i], states[j].prop);
					}
					css[states[j].state] = getCSS(elements[i]);
					const rules = domUtil.getCSSStyleRules(elements[i]);
					if (rules) {
						const count = rules.Count();
						for (let k = 0; k < count; k++) {
							const rule = rules.GetElementAt(k);
							if (isPageStyle(rule.parentStyleSheet)) {
								for (let m = 0; m < rule.style.length; m++) {
									css[states[j].state][rule.style[m]] = rule.style[rule.style[m]];
								}
							}
						}
					}
					if (states[j].prop) {
						domUtil.setContentState(elements[i], window);
					}
				}
			}
			cssArr.push({
				selector: getUniqueSelector(elements[i], parent),
				css: css,
			});
		}
		return cssArr;
	}

	addMessageListener('grdMe@grd.me:fetch-frame-css', (message) => {
		const uid = message.data.uid;
		try {
			const element = doc.querySelector('[grdMeUID="' + uid + '"]');
			sendAsyncMessage('grdMe@grd.me:get-frame-css:' + uid, {
				css: setupChildren(element),
				fonts: getFonts(),
			});
		} catch(e) {
			sendAsyncMessage('grdMe@grd.me:get-frame-css:' + uid, {
				css: [],
				fonts: [],
			});
			console.error('Error getting frame css');
		}
	});
}());
