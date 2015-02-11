var savingTimeout;

function save_options() {
	clearTimeout(savingTimeout);
	var status = $('#status').stop(true).hide();
	var decryptIndicator = $('#decryptIndicator').prop("checked");
	chrome.storage.sync.set({
		decryptIndicator: decryptIndicator
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
    decryptIndicator: false
  }, function(items) {
    $('#decryptIndicator').prop("checked", items.decryptIndicator);
	$("body").on("change", "input", save_options);
  });
});