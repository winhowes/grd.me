/** This file handles observing page changes */

/** Begins running the observer
 * callback: the function to call when a change is observed and when the observer is set up
*/
'use strict';

var initObserver = (function () {
	var config = {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['contenteditable', 'crypto_mark']
	};
	var otherDecryptTimeout = false;

	return function (callback) {
		var observer = new MutationObserver(function () {
			clearTimeout(otherDecryptTimeout);
			otherDecryptTimeout = setTimeout(function () {
				callback();
			}, 50);
		});

		observer.observe(document.body, config);
		callback();
	};
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = initObserver;
} else {
	window.initObserver = initObserver;
}