/** This file handles clipboard operations */

class Clipboard {
	constructor() {}

	/** Copy text to clipboard
	 * text: the text to be copied
	*/
	set(text) {
		const input = document.createElement('textarea');
		document.body.appendChild(input);
		input.value = text;
		input.focus();
		input.select();
		document.execCommand('Copy');
		input.remove();
	}

	/** Get Clipboard content */
	get() {
		const input = document.createElement('textarea');
		document.body.appendChild(input);
		input.focus();
		input.select();
		document.execCommand('Paste');
		const val = input.value;
		input.remove();
		return val;
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Clipboard;
} else {
	window.Clipboard = Clipboard;
}
