/** This file handles observing page changes */

/** Begins running the observer
 * callback: the function to call when a change is observed and when the observer is set up
*/
var initObserver = (function(){
	var otherDecryptTimeout = false,
	config = {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: ['contenteditable', 'crypto_mark']
	};
	
	return function(callback){
		var observer = new MutationObserver(function(mutations) {
			clearTimeout(otherDecryptTimeout);
			otherDecryptTimeout = setTimeout(callback, 100);
		});
		
		observer.observe(document.body, config);
		callback();
	};
}());