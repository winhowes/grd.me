/** This file handles uid management */

class UidManager {
	constructor() {
		this.uids = [];
		this._refetch();
	}

	/** Add a uid
	 @param uid The uid to add
	 @param [callback] Function to call once the uids have been added and refetched
	*/
	add(uid, callback) {
		this.uids.push(uid);
		chrome.storage.local.set({'uids': this._uniq(this.uids)}, () => {
			this._refetch(callback);
		});
	}

	/** Update the known uids
	 * @param [callback] A callback once the uids have been fetched
	*/
	_refetch(callback) {
		chrome.storage.local.get('uids', (uidsArr) => {
			this.uids = (uidsArr && uidsArr.uids) || [];
			if (typeof callback === 'function') {
				callback();
			}
		});
	}

	/** Get rid of duplicate elements in an array
	 * @param arr The array to rid of duplicates
	*/
	_uniq(arr) {
		const seen = {};
		const out = [];
		const len = arr.length;
		let j = 0;
		for (let i = 0; i < len; i++) {
			const item = arr[i];
			if (seen[item] !== 1) {
				seen[item] = 1;
				out[j++] = item;
			}
		}
		return out;
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = UidManager;
} else {
	window.UidManager = UidManager;
}
