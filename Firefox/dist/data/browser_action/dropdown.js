/** This file handles search dropdowns */

/** Sets up dropdown results for an input field
 * 	input: a jQuery object of the input field
 * 	container: a jQuery object of a <ul> container to contain the dropdown results
 * 	inputFunction: a function that takes the inputs value and an optional callback function (for async use)
 * 	as its parameters and runs on focusin and on input that calculates and returns an array of the
 * 	dropdown results. The results array is not sanitized.
 * 	[submitOnClick]: A boolean value indicating whether or not to submit the input's form on clicking a
 * 	value in the dropdown. Defaults to false.
*/
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Dropdown = (function () {
	function Dropdown(input, container, inputFunction, submitOnClick) {
		var _this = this;

		_classCallCheck(this, Dropdown);

		this.blurred = true;
		this.input = input;
		this.container = container;
		this.inputFunction = inputFunction;
		this.submitOnClick = submitOnClick;
		container.addClass('dropdown-container').css('border', 0);
		input.on('input focusin', function () {
			_this.typing();
		}).on('focusout', function () {
			_this.blur();
		}).on('keydown', function (e) {
			_this.keyDown(e);
		}).parents('form').on('submit', function () {
			container.html('').css('border', 0);
		});

		container.on('click', 'li', function (e) {
			_this.clickItem(e.target);
		}).on('mousedown', 'li', function () {
			_this.blurred = false;
		}).on('mouseenter', 'li', function (e) {
			_this.mouseOverItem(e.target);
		}).on('mouseleave', function () {
			_this.mouseLeaveItem();
		});
	}

	_createClass(Dropdown, [{
		key: 'clickItem',
		value: function clickItem(elem) {
			this.input.val($(elem).text().trim());
			this.container.html('').css('border', 0);
			if (this.submitOnClick) {
				this.blurred = true;
				this.container.html('').css('border', 0);
				this.input.parents('form').trigger('submit');
			}
		}
	}, {
		key: 'mouseOverItem',
		value: function mouseOverItem(elem) {
			this.container.find('.active').removeClass('active');
			$(elem).addClass('active');
		}
	}, {
		key: 'mouseLeaveItem',
		value: function mouseLeaveItem() {
			this.container.find('.active').removeClass('active');
			this.container.find('li').first().addClass('active');
		}
	}, {
		key: 'blur',
		value: function blur() {
			if (this.blurred) {
				this.container.html('').css('border', 0);
			}
			this.blurred = true;
		}
	}, {
		key: 'typing',
		value: function typing() {
			var _this2 = this;

			var text = $.trim(this.input.val());
			if (!text.length) {
				this.container.html('').css('border', 0);
				return;
			}

			var newSuggestions = $('<ul>').append($('<li>', {
				'class': 'active',
				text: text
			}));

			var results = this.inputFunction(text, function (data) {
				for (var i = 0; i < data.length; i++) {
					newSuggestions.append($('<li>', { text: data[i].toLowerCase() }));
				}
				_this2.container.html(newSuggestions.html());
				_this2.container.css('border', _this2.container.children().length > 1 ? '' : 0);
			});

			if (results) {
				for (var i = 0; i < results.length; i++) {
					newSuggestions.append($('<li>', { text: results[i].toLowerCase() }));
				}
				this.container.html(newSuggestions.html());
				this.container.css('border', this.container.children().length > 1 ? '' : 0);
			}
		}
	}, {
		key: 'keyDown',
		value: function keyDown(e) {
			if (e.keyCode !== 38 && e.keyCode !== 40 || !this.container.html()) {
				return;
			}
			e.preventDefault();
			var newActive = undefined;
			if (e.keyCode === 38) {
				newActive = this.container.find('.active').prev().length ? this.container.find('.active').prev() : this.container.find('li').last();
			} else {
				newActive = this.container.find('.active').next().length ? this.container.find('.active').next() : this.container.find('li').first();
			}
			this.container.find('.active').removeClass('active');
			newActive.addClass('active');
			this.input.val(newActive.text());
		}
	}]);

	return Dropdown;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Dropdown;
} else {
	window.Dropdown = Dropdown;
}