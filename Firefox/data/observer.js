/** This file handles observing page changes */

/** Begins running the observer
 * callback: the function to call when a change is observed and when the observer is set up
*/
var initObserver = (function(){
	return function(callback){
		var wait = false;
		var pending = false;
		var mutationHandler = function(mutations) {
			pending = true;
			if (!wait) {
				wait = true;
				pending = false;
				window.requestAnimationFrame(function() {
					callback();
					wait = false;
					if (pending) {
						mutationHandler();
					}
				});
			}
		};
		var observer = new MutationObserver(mutationHandler);
		var config = { subtree: true, childList: true, characterData: true, attributes: true };
		observer.observe(document.body, config);
		mutationHandler();
	};
}());