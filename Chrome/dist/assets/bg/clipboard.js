/** This file handles clipboard operations */

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Clipboard = (function () {
	function Clipboard() {
		_classCallCheck(this, Clipboard);
	}

	/** Copy text to clipboard
  * text: the text to be copied
 */

	_createClass(Clipboard, [{
		key: 'set',
		value: function set(text) {
			var input = document.createElement('textarea');
			document.body.appendChild(input);
			input.value = text;
			input.focus();
			input.select();
			document.execCommand('Copy');
			input.remove();
		}

		/** Get Clipboard content */
	}, {
		key: 'get',
		value: function get() {
			var input = document.createElement('textarea');
			document.body.appendChild(input);
			input.focus();
			input.select();
			document.execCommand('Paste');
			var val = input.value;
			input.remove();
			return val;
		}
	}]);

	return Clipboard;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Clipboard;
} else {
	window.Clipboard = Clipboard;
}