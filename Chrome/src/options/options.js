var savingTimeout;

function save_options() {
	clearTimeout(savingTimeout);
	var status = $('#status').stop(true).hide();
	var decryptIndicator = $('#decryptIndicator').prop("checked");
	var sandboxDecrypt = $("#sandboxDecrypt").prop("checked");
	var emojis = $("#emojis").prop("checked");
	var eccCurve = parseInt($("#eccCurve").val());
	chrome.storage.sync.set({
		emojis: emojis,
		decryptIndicator: decryptIndicator,
		sandboxDecrypt: sandboxDecrypt,
		eccCurve: eccCurve
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
	emojis: true,
    decryptIndicator: false,
	sandboxDecrypt: false,
	eccCurve: 384
  }, function(items) {
	$('#emojis').prop("checked", items.emojis);
    $('#decryptIndicator').prop("checked", items.decryptIndicator);
	$('#sandboxDecrypt').prop("checked", items.sandboxDecrypt);
	$('#eccCurve').find("[value='"+items.eccCurve+"']").prop("selected", "selected");
	$("body").on("change", "input, select", save_options);
  });
});