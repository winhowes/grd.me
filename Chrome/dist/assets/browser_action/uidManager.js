/** This file handles uid management */

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var UidManager = (function () {
	function UidManager() {
		_classCallCheck(this, UidManager);

		this.uids = [];
		this._refetch();
	}

	/** Add a uid
  @param uid The uid to add
  @param [callback] Function to call once the uids have been added and refetched
 */

	_createClass(UidManager, [{
		key: 'add',
		value: function add(uid, callback) {
			var _this = this;

			this.uids.push(uid);
			chrome.storage.local.set({ 'uids': this._uniq(this.uids) }, function () {
				_this._refetch(callback);
			});
		}

		/** Update the known uids
   * @param [callback] A callback once the uids have been fetched
  */
	}, {
		key: '_refetch',
		value: function _refetch(callback) {
			var _this2 = this;

			chrome.storage.local.get('uids', function (uidsArr) {
				_this2.uids = uidsArr && uidsArr.uids || [];
				if (typeof callback === 'function') {
					callback();
				}
			});
		}

		/** Get rid of duplicate elements in an array
   * @param arr The array to rid of duplicates
  */
	}, {
		key: '_uniq',
		value: function _uniq(arr) {
			var seen = {};
			var out = [];
			var len = arr.length;
			var j = 0;
			for (var i = 0; i < len; i++) {
				var item = arr[i];
				if (seen[item] !== 1) {
					seen[item] = 1;
					out[j++] = item;
				}
			}
			return out;
		}
	}]);

	return UidManager;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = UidManager;
} else {
	window.UidManager = UidManager;
}