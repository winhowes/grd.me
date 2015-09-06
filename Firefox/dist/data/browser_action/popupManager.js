/* This file handles opening and closing popups */

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var PopupManager = (function () {
	function PopupManager() {
		_classCallCheck(this, PopupManager);
	}

	/** Close the open popups and the overlay */

	_createClass(PopupManager, [{
		key: 'close',
		value: function close() {
			$('#overlay, .popup').stop(true).fadeOut('fast');
		}

		/** Open a popup with the given id
   * @param id The id of the popup
  */
	}, {
		key: 'open',
		value: function open(id) {
			$('#' + id + ', #overlay').stop(true).fadeIn();
		}

		/** Show a flash message
   * @param id The id of the flash message (has class indicator)
  */
	}, {
		key: 'showFlash',
		value: function showFlash(id) {
			$('#' + id).stop(true).css('top', '-20px').animate({
				top: 0
			}).delay(2500).animate({
				top: '-20px'
			});
		}
	}]);

	return PopupManager;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = PopupManager;
} else {
	window.PopupManager = PopupManager;
}