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
class Dropdown {
	constructor(input, container, inputFunction, submitOnClick) {
		this.blurred = true;
		this.input = input;
		this.container = container;
		this.inputFunction = inputFunction;
		this.submitOnClick = submitOnClick;
		container.addClass('dropdown-container').css('border', 0);
		input
			.on('input focusin', () => {
				this.typing();
			})
			.on('focusout', () => {
				this.blur();
			})
			.on('keydown', (e) => {
				this.keyDown(e);
			})
			.parents('form').on('submit', () => {
				container.html('').css('border', 0);
			});

		container
			.on('click', 'li', (e) => {
				this.clickItem(e.target);
			})
			.on('mousedown', 'li', () => {
				this.blurred = false;
			})
			.on('mouseenter', 'li', (e) => {
				this.mouseOverItem(e.target);
			})
			.on('mouseleave', () => {
				this.mouseLeaveItem();
			});
	}

	clickItem(elem) {
		this.input.val($(elem).text().trim());
		this.container.html('').css('border', 0);
		if (this.submitOnClick) {
			this.blurred = true;
			this.container.html('').css('border', 0);
			this.input.parents('form').trigger('submit');
		}
	}

	mouseOverItem(elem) {
		this.container.find('.active').removeClass('active');
		$(elem).addClass('active');
	}

	mouseLeaveItem() {
		this.container.find('.active').removeClass('active');
		this.container.find('li').first().addClass('active');
	}

	blur() {
		if (this.blurred) {
			this.container.html('').css('border', 0);
		}
		this.blurred = true;
	}

	typing() {
		const text = $.trim(this.input.val());
		if (!text.length) {
			this.container.html('').css('border', 0);
			return;
		}

		const newSuggestions = $('<ul>').append($('<li>', {
			class: 'active',
			text: text,
		}));

		const results = this.inputFunction(text, (data) => {
			for (let i = 0; i < data.length; i++) {
				newSuggestions.append($('<li>', {text: data[i].toLowerCase()}));
			}
			this.container.html(newSuggestions.html());
			this.container.css('border', this.container.children().length > 1 ? '' : 0);
		});

		if (results) {
			for (let i = 0; i < results.length; i++) {
				newSuggestions.append($('<li>', {text: results[i].toLowerCase()}));
			}
			this.container.html(newSuggestions.html());
			this.container.css('border', this.container.children().length > 1 ? '' : 0);
		}
	}

	keyDown(e) {
		if ((e.keyCode !== 38 && e.keyCode !== 40) || !this.container.html()) {
			return;
		}
		e.preventDefault();
		let newActive;
		if (e.keyCode === 38) {
			newActive = this.container.find('.active').prev().length ? this.container.find('.active').prev() : this.container.find('li').last();
		} else {
			newActive = this.container.find('.active').next().length ? this.container.find('.active').next() : this.container.find('li').first();
		}
		this.container.find('.active').removeClass('active');
		newActive.addClass('active');
		this.input.val(newActive.text());
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Dropdown;
} else {
	window.Dropdown = Dropdown;
}
