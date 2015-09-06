/** This file handles uid management */

class UidManager {
	constructor(port) {
		this.uids = [];
		port.on('uids', (uidsArr) => {
			this.uids = uidsArr;
		});
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = UidManager;
} else {
	window.UidManager = UidManager;
}
