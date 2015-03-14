var savingTimeout;

function save_options() {
	clearTimeout(savingTimeout);
	var status = $('#status').stop(true).hide();
	var decryptIndicator = $('#decryptIndicator').prop("checked");
	var sandboxDecrypt = $("#sandboxDecrypt").prop("checked");
	chrome.storage.sync.set({
		decryptIndicator: decryptIndicator,
		sandboxDecrypt: sandboxDecrypt
	}, function() {
		// Update status to let user know options were saved.
		status.text("Saved").fadeIn("fast");
		savingTimeout = setTimeout(function() {
			status.fadeOut("fast");
		}, 1000);
	});
}

// Restores state using the preferences stored in chrome.storage.
$(function(){
  chrome.storage.sync.get({
    decryptIndicator: false,
	sandboxDecrypt: false
  }, function(items) {
    $('#decryptIndicator').prop("checked", items.decryptIndicator);
	$('#sandboxDecrypt').prop("checked", items.sandboxDecrypt);
	$("body").on("change", "input", save_options);
  });
});