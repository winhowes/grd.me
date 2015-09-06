/** This file handles uid management */

'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var UidManager = function UidManager(port) {
	var _this = this;

	_classCallCheck(this, UidManager);

	this.uids = [];
	port.on('uids', function (uidsArr) {
		_this.uids = uidsArr;
	});
};

if (typeof module !== 'undefined' && module.exports) {
	module.exports = UidManager;
} else {
	window.UidManager = UidManager;
}