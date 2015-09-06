(()=> {
	let savingTimeout;

	function saveOptions() {
		clearTimeout(savingTimeout);
		const status = $('#status').stop(true).hide();
		const decryptIndicator = $('#decryptIndicator').prop('checked');
		const sandboxDecrypt = $('#sandboxDecrypt').prop('checked');
		const emojis = $('#emojis').prop('checked');
		const eccCurve = parseInt($('#eccCurve').val(), 10);
		chrome.storage.sync.set({
			emojis: emojis,
			decryptIndicator: decryptIndicator,
			sandboxDecrypt: sandboxDecrypt,
			eccCurve: eccCurve,
		}, () => {
			// Update status to let user know options were saved.
			status.text('Saved').fadeIn('fast');
			savingTimeout = setTimeout(() => {
				status.fadeOut('fast');
			}, 1000);
		});
	}

	// Restores state using the preferences stored in chrome.storage.
	$(() => {
		chrome.storage.sync.get({
			emojis: true,
			decryptIndicator: false,
			sandboxDecrypt: false,
			eccCurve: 384,
		}, (items) => {
			$('#emojis').prop('checked', items.emojis);
			$('#decryptIndicator').prop('checked', items.decryptIndicator);
			$('#sandboxDecrypt').prop('checked', items.sandboxDecrypt);
			$('#eccCurve').find('[value="' + items.eccCurve + '"]').prop('selected', 'selected');
			$('body').on('change', 'input, select', saveOptions);
		});
	});
}());
