/* This file handles opening and closing popups */

class PopupManager {
	constructor() {}
	/** Close the open popups and the overlay */
	close() {
		$('#overlay, .popup').stop(true).fadeOut('fast');
	}

	/** Open a popup with the given id
	 * @param id The id of the popup
	*/
	open(id) {
		$('#' + id + ', #overlay').stop(true).fadeIn();
	}

	/** Show a flash message
	 * @param id The id of the flash message (has class indicator)
	*/
	showFlash(id) {
		$('#' + id).stop(true).css('top', '-20px').animate({
			top: 0,
		}).delay(2500).animate({
			top: '-20px',
		});
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = PopupManager;
} else {
	window.PopupManager = PopupManager;
}
