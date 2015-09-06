/** This file contains the worker manager class */

"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var WorkerManager = (function () {
	function WorkerManager() {
		_classCallCheck(this, WorkerManager);

		this.workers = [];
	}

	/** Add a worker to the array
  * @param worker: the worker to add
 */

	_createClass(WorkerManager, [{
		key: "add",
		value: function add(worker) {
			this.workers.push(worker);
		}

		/** Remove workers from array
   * @param worker: the worker to remove
  */
	}, {
		key: "remove",
		value: function remove(worker) {
			var index = this.workers.indexOf(worker);
			if (index !== -1) {
				this.workers.splice(index, 1);
			}
		}
	}]);

	return WorkerManager;
})();

exports.WorkerManager = WorkerManager;