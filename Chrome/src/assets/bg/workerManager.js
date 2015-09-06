/** This file contains the worker manager class */

class WorkerManager {
	constructor() {
		this.workers = [];
	}

	/** Add a worker to the array
	 * @param worker: the worker to add
	*/
	add(worker) {
		this.workers.push(worker);
	}

	/** Remove workers from array
	 * @param worker: the worker to remove
	*/
	remove(worker) {
		const index = this.workers.indexOf(worker);
		if (index !== -1) {
			this.workers.splice(index, 1);
		}
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = WorkerManager;
} else {
	window.WorkerManager = WorkerManager;
}
