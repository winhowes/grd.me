/** This file handles the preferences panel */


(() => {
	const preferences = {
		curve: 384,
	};
	const uidManager = new UidManager();
	const popupManager = new PopupManager();
	const keyManager = new KeyManager(preferences, uidManager, popupManager);
	let latestRequest = 0;

	/** Generate a random string
	 * @param length Length of the random string
	*/
	function getRandomString(length) {
		const randArray = new Uint32Array(length);
		let rand = '';
		window.crypto.getRandomValues(randArray);
		for (let i = 0; i < randArray.length; i++) {
			rand += String.fromCharCode((randArray[i] % 94) + 33);
		}
		return rand;
	}

	/** Sanitize a string
	 * @param str String to sanitize
	*/
	function sanitize(str) {
		return $('<i>', {text: str}).html();
	}

	/** Hide the first page and show second page of sharing shared key */
	function sharedKeyPage2() {
		$('#shareFormMain1').hide();
		$('#shareFormMain2').show();
		const keyList = $('<ul></ul>');
		let count = 0;
		for (let i = 0; i < keyManager.keyChain.length; i++) {
			if (keyManager.keyChain[i].key.pub && !keyManager.keyChain[i].key.priv) {
				keyList.append($('<li>').attr({index: i, class: (count ? '' : 'active')})
					.append($('<a>', {class: 'showHideKey', text: 'Show Key'}))
					.append($('<div>')
						.append($('<div>', {class: 'key partialKey', text: 'Key: '})
							.append($('<span>')
								.append($('<br>'))
								.append($('<b>', {class: 'pub', text: 'pub'}))
								.append(': ' + sanitize(keyManager.keyChain[i].key.pub)))))
					.append($('<div>', {class: 'description', text: keyManager.keyChain[i].description}))
					.append($('<div>', {class: 'activeIndicator'})));
				count++;
			}
		}
		$('#shareFormMain2 ul').html(keyList.html());
	}

	/** Panel shown. Display any acceptable shared keys
	 * @param keys Array of acceptable shared keys that need approval
	*/
	function acceptableSharedKeysPopup(keys) {
		if (keys.length) {
			const list = $('<ul></ul>');
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i].key;
				list.append($('<li>')
					.append($('<form>').attr({key: key, index: i})
						.append($('<div>', {text: 'Key: ' + key}))
						.append($('<input>', {placeholder: 'Description', maxlength: 50, value: sanitize(keys[i].from)}))
						.append($('<button>', {class: 'blue btn', type: 'submit', text: 'Add'}))
						.append($('<button>', {class: 'red btn remove', type: 'button', text: 'Ignore'}))));
			}
			$('#acceptableSharedKeys ul').html(list.html());
			popupManager.open('acceptableSharedKeys');
		}
	}

	/** Handle searching for a public key by uid */
	$('#searchUIDForm').on('submit', (e) => {
		e.preventDefault();
		const text = $('#searchUID').val().trim();
		if (!text) {
			$('#searchUID').focus();
			return;
		}
		$('#searchResults').html('');
		$('#searchLoading').show();
		$('#searchResultsContainer').find('.title').text(text);
		popupManager.open('searchResultsContainer');
		$.ajax({
			url: 'https://grd.me/key/get',
			type: 'GET',
			data: {uid: text},
			success: (data) => {
				$('#searchLoading').hide();
				if (data && data.status && data.status[0] && !data.status[0].code) {
					let count = 0;
					for (let i = 0; i < data.keys.length; i++) {
						try {
							if (ecc.verify(data.keys[i].pub, JSON.parse(data.keys[i].sig), data.uid.toLowerCase())) {
								const revoked = data.keys[i].revoke_sig && ecc.verify(data.keys[i].pub, JSON.parse(data.keys[i].revoke_sig), 'REVOKED');
								const alreadyExists = !revoked && keyManager.pubKeyMap[data.keys[i].pub];
								count++;
								$('#searchResults')
									.append($('<li>')
										.append(revoked ? $('<div>', {class: 'revoked'}) : '')
										.append(alreadyExists ? $('<div>', {class: 'alreadyExists', text: '[Already in Keychain]'}) : '')
										.append($('<a>', {class: 'showHideKey', text: 'Show Key'}))
										.append(revoked ? $('<span>', {class: 'revoked_msg', text: '[Revoked]'}) : '')
										.append($('<div>')
											.append($('<span>', {class: 'key partialKey', text: 'Key: ' + data.keys[i].pub}))
											.append(!revoked ? $('<button>', {class: 'btn blue addKey', uid: data.uid, pub: data.keys[i].pub, text: 'Add'}) : ''))
										.append(revoked ? $('<div>', {class: 'timestamp', text: 'Revoked: ' + data.keys[i].revoked_at}) : '')
										.append($('<div>', {class: 'timestamp', text: 'Created: ' + data.keys[i].created_at})));
							}
						} catch (err) {
							console.log('Error verifying key', err);
						}
					}
					if (!count) {
						$('#searchResults').html($('<li>', {text: 'No results found'}));
					}
				} else {
					$('#searchResults').html($('<li>', {text: 'No results found'}));
				}
			},
			error: () => {
				$('#searchLoading').hide();
				$('#searchResults').html($('<li>', {text: 'Error fetching results'}));
			},
		});
	});

	/** Toggle the key's visibility in various popups */
	$('#searchResults, #shareFormMain1, #shareFormMain2').on('click', '.showHideKey', function shareShowHideKeyClickHandler() {
		const key = $(this).parent().find('.key');
		key.toggleClass('keyShown');
		$(this).text(key.hasClass('keyShown') ? 'Hide Key' : 'Show Key');
	})
	/** Insert the pub key data and description into the appropriate fields and close the popup/overlay */
	.on('click', '.addKey', function addKeyClickHandler() {
		$('#key').val($(this).attr('pub')).removeAttr('maxlength');
		$('#description').focus().val($(this).attr('uid'));
		$('#ecc').prop('checked', true);
		$('#addKey').trigger('submit');
		popupManager.close();
	});

	/** Add a key to the key list */
	$('#addKey').on('submit', function addKeySubmit(e) {
		e.preventDefault();
		const keyVal = $('#key').val().trim();
		const description = $('#description').val().trim();
		const isECC = $('#ecc').is(':checked');
		keyManager.verifyAndAdd(keyVal, description, isECC, true);
	});

	/** Handle checing the pub/priv checkbox. If appropriate, generate a ecc key */
	$('#ecc').on('click', function eccClickHandler() {
		if ($(this).is(':checked')) {
			const keyPair = keyManager.generateECCPair();
			$('#key').val(JSON.stringify(keyPair)).removeAttr('maxlength');
			$('#description').focus();
		} else {
			$('#key').val('').focus().attr('maxlength', 64);
		}
	});

	/** Generate a key and insert it into the key input */
	$('#keyGen').on('click', function keyGenClickHandler() {
		let rand;
		if ($('#ecc').is(':checked')) {
			const keypair = keyManager.generateECCPair();
			rand = JSON.stringify(keypair);
		}	else {
			/* BROWSER COMPATIBILITY IS IFFY */
			rand = getRandomString(64);
		}
		$('#key').val(rand);
		$('#description').focus();
	});

	/** Handle clicking delete key */
	$('#keyList').on('click', '.delete', function deleteClickHandler(e) {
		e.stopImmediatePropagation();
		$('#pubKeyIndex').val($(this).parent().attr('index'));
		popupManager.open('deleteForm');
	})
	/** Handle selecting different keys to be active */
	.on('click', 'li', function keyClickHandler(e) {
		if (e.shiftKey) {
			window.getSelection().removeAllRanges();
		}
		const elem = $(this);
		if (elem.hasClass('active') && $('#keyList').find('.active').length === 1) {
			return;
		}
		if (e.shiftKey) {
			elem.toggleClass('active');
			const indices = [];
			const keyList = $('#keyList').find('.active');
			for (let i = 0; i < keyList.length; i++) {
				indices.push($(keyList.get(i)).attr('index'));
			}
			keyManager.setActive(indices);
		} else {
			$('#keyList').find('.active').removeClass('active');
			elem.addClass('active');
			keyManager.setActive([elem.attr('index')]);
			if (elem.find('.pub').length && !elem.find('.priv').length) {
				clearTimeout($('#onlyPubWarning').data('timeout'));
				$('#onlyPubWarning').stop(true).css('top', '-60px').animate({
					top: 0,
				});
				$('#onlyPubWarning').data('timeout', setTimeout(() => {
					$('#onlyPubWarning').animate({
						top: '-60px',
					});
				}, 7000));
			}
		}
	})
	/** Show/hide the key in the key list */
	.on('click', '.showHideKey', function showHideKeyClickHandler(e) {
		e.stopImmediatePropagation();
		$(this).next().toggle();
		$(this).text($(this).next().is(':visible') ? 'Hide key' : 'Show key');
	})
	/** Handle clicking the publish button in the key list */
	.on('click', '.publish', function publishClickHandler(e) {
		e.stopImmediatePropagation();
		popupManager.open('publishForm');
		$('#uidError').hide();
		$('#uid').focus();
		$('#pubKey').val($(this).attr('pub'));
		$('#privKey').val($(this).attr('priv'));
		$('#pubKeyIndex').val($(this).parent().attr('index'));
	})
	/** Handle clicking the revoke button in the key list */
	.on('click', '.revoke', function revokeClickHandler(e) {
		e.stopImmediatePropagation();
		popupManager.open('revokeForm');
		$('#pubKey').val($(this).attr('pub'));
		$('#privKey').val($(this).attr('priv'));
		$('#pubKeyIndex').val($(this).parent().attr('index'));
	})
	/** Handle clicking the pencil icon to edit description */
	.on('click', '.pencil', function pencilClickHandler(e) {
		e.stopImmediatePropagation();
		$(this).parent().hide();
		$(this).parents('li').find('.descriptionForm').show()
		.find('input').focus().val($(this).parent().text());
	})
	/** Change the description */
	.on('submit', '.descriptionForm', function descriptionFormSubmitHandler(e) {
		e.preventDefault();
		const description = $(this).find('input').val().trim();
		if (description) {
			$(this).hide()
			.siblings('.description').html(sanitize(description))
			.append($('<i>', {class: 'pencil'}))
			.show();
			keyManager.updateDescription($(this).parents('li').attr('index'), description);
		} else {
			$(this).find('input').focus();
		}
	})
	/** Prevent clicking the description field setting the key to active */
	.on('click', '.descriptionForm input', (e) => {
		e.stopImmediatePropagation();
	})
	/** Handle blurring the editable description field */
	.on('focusout', '.descriptionForm input', function descriptionFormBlurHandler() {
		const description = $(this).val().trim();
		if (description) {
			$(this).parent().hide()
			.siblings('.description').html(sanitize(description))
			.append($('<i>', {class: 'pencil'}))
			.show();
			keyManager.updateDescription($(this).parents('li').attr('index'), description);
		} else {
			$(this).parent().hide()
			.siblings('.description').show();
		}
	})
	/** Handle clicking he share button in the key list */
	.on('click', '.share', function shareClickHandler(e) {
		e.stopImmediatePropagation();
		popupManager.open('shareForm');
		$('.shareFormMessage').hide();
		if (!keyManager.hasPrivateKey) {
			$('#noPrivateKey').show();
		} else if (!keyManager.hasOthersPubKey) {
			$('#noOtherPubKey').show();
		} else {
			$('#pubKey').val($(this).attr('key'));
			$('#shareFormMain1').show();
			let count = 0;
			const keyList = $('<ul></ul>');
			for (let i = 0; i < keyManager.keyChain.length; i++) {
				if (keyManager.keyChain[i].key.pub && keyManager.keyChain[i].key.priv) {
					keyList.append($('<li>').attr({index: i, class: (count ? '' : 'active')})
						.append($('<a>', {class: 'showHideKey', text: 'Show Key'}))
						.append($('<div>')
							.append($('<div>', {class: 'key partialKey', text: 'Key: '})
								.append($('<span>')
									.append($('<br>'))
									.append($('<b>', {class: 'pub', text: 'pub'}))
									.append(': ' + sanitize(keyManager.keyChain[i].key.pub))
									.append($('<br>'))
									.append($('<b>', {class: 'priv', text: 'priv'}))
									.append(': ' + sanitize(keyManager.keyChain[i].key.priv)))))
						.append($('<div>', {class: 'description', text: keyManager.keyChain[i].description}))
						.append($('<div>', {class: 'activeIndicator'})));
					count++;
				}
			}
			$('#shareFormMain1 ul').html(keyList.html());
			if (count === 1) {
				sharedKeyPage2();
			}
		}
	});

	/** Clicking on the only pub warning closes the warning */
	$('#onlyPubWarning').on('click', function warningClickHandler() {
		clearTimeout($(this).data('timeout'));
		$(this).stop(true).animate({
			top: '-60px',
		});
	});

	/** Delete the key */
	$('#deleteForm').on('submit', function deleteFormSubmitHandler(e) {
		e.preventDefault();
		keyManager.delete($('#pubKeyIndex').val());
		popupManager.close();
	});

	/** Revoke the key */
	$('#revokeForm').on('submit', function revokeFormSubmitHandler(e) {
		e.preventDefault();
		const key = {
			pub: $('#pubKey').val(),
			index: $('#pubKeyIndex').val(),
			sig: JSON.stringify(ecc.sign($('#privKey').val(), 'REVOKED')),
		};
		$('#keyList').find('li[index="' + $('#pubKeyIndex').val() + '"]').find('.revoke').addClass('disabled').prop('disabled', true);
		keyManager.revoke(key);
		popupManager.close();
	});

	/** Publish the key */
	$('#publishForm').on('submit', function publishFormSubmitHandler(e) {
		e.preventDefault();
		$('.publishError').stop(true).hide();
		const uid = $('#uid').val().trim();
		if (!uid) {
			$('#uid').focus();
			return;
		}
		if (uid.length < 3) {
			$('#uid').focus();
			$('#uidError').stop(true).fadeIn();
			return;
		}
		const pub = $('#pubKey').val();
		$.ajax({
			url: 'https://grd.me/key/get',
			type: 'GET',
			data: {
				uid: uid,
				pub: pub,
			},
			success: (data) => {
				if (data && data.status) {
					data.keys = data.keys || [];
					let notFound = true;
					for (let i = 0; i < data.keys.length; i++) {
						try {
							if (uid.toLowerCase() === data.uid.toLowerCase() &&
							   pub === data.keys[i].pub &&
							   ecc.verify(data.keys[i].pub, JSON.parse(data.keys[i].sig), data.uid.toLowerCase())) {
								notFound = false;
							}
						} catch (err) {
							console.log('Error verifying key', err);
						}
					}
					if (notFound) {
						const key = {
							pub: pub,
							index: $('#pubKeyIndex').val(),
							uid: uid,
							sig: JSON.stringify(ecc.sign($('#privKey').val(), uid.toLowerCase())),
						};
						$('#keyList').find('li[index="' + $('#pubKeyIndex').val() + '"]').find('.publish').addClass('disabled').prop('disabled', true);
						keyManager.publish(key);
						popupManager.close();
					} else {
						$('#existsError').stop(true).fadeIn();
					}
				} else {
					$('#publishingError').stop(true).fadeIn();
				}
			},
			error: () => {
				$('#publishingError').stop(true).fadeIn();
			},
		});
	});

	/** Clicking the overlay closes the overlay and appropriate popups */
	$('#overlay').on('click', () => {
		popupManager.close();
	});

	/** Close the overlay on clicking a cancel btn */
	$('.cancel').on('click', () => {
		popupManager.close();
	});

	/** Press continue to move to page 2 of sharing a shared key */
	$('#shareFormMain1').on('click', '.continue', () => {
		sharedKeyPage2();
	});

	/** Share key */
	$('#shareFormMain2').on('click', '.continue', () => {
		const fromKey = keyManager.keyChain[$('#shareFormMain1 .active').attr('index')].key;
		const toKey = keyManager.keyChain[$('#shareFormMain2 .active').attr('index')].key;
		const sharedKey = ecc.encrypt(toKey.pub, $('#pubKey').val());
		keyManager.share({
			fromKey: fromKey.pub,
			toKey: toKey.pub,
			sharedKey: sharedKey,
			sendSig: JSON.stringify(ecc.sign(fromKey.priv, sharedKey)),
			rand: getRandomString(64),
		});
		console.log('SHARED KEY', $('#pubKey').val(), $('#pubKey').val().length, sharedKey.length, sharedKey);
		popupManager.close();
	});

	/** Select which key to encrypt shared key with */
	$('#shareFormMain1, #shareFormMain2').on('click', 'li', function shareFromKeyClickHandler() {
		$(this).parent().find('.active').removeClass('active');
		$(this).addClass('active');
	});

	/** Remove a key from the acceptableSharedKey array */
	$('#acceptableSharedKeys').on('click', '.remove', function removeClickHandler() {
		const index =  $(this).parent().attr('index');
		chrome.storage.local.get('acceptableSharedKeys', (items) => {
			const keys = items.acceptableSharedKeys;
			keys.splice(index, 1);
			chrome.storage.local.set({'acceptableSharedKeys': keys});
		});
		$(this).parents('li').fadeOut('fast', function keyFadeOutCallback() {
			$(this).remove();
			if (!$('#acceptableSharedKeys').find('li').length) {
				popupManager.close();
			}
		});
	})
	/** Handle adding an acceptableSharedKey to the normal key array */
	.on('submit', 'form', function acceptableSharedKeySubmitHandler(e) {
		e.preventDefault();
		const description = $(this).find('input');
		if (!description.val().trim()) {
			description.focus();
		} else {
			keyManager.add({
				key: $(this).attr('key'),
				description: description.val().trim(),
			});
			$(this).find('.remove').trigger('click');
		}
	});

	$('#encryptKeychain').on('click', () => {
		keyManager.showEncryptKeyChainPopup(false);
	});

	$('body').on('click', '#decryptKeychain', () => {
		keyManager.showDecryptKeyChainPopup();
	});

	$('#encryptForm, #decryptForm').on('submit', function encryptFormSubmitHandler(e) {
		e.preventDefault();
		$(this).find('.error').stop(true).hide();
		const passInput = $(this).find('input.keyChainPassword');
		const pass = passInput.val().trim();
		if (!pass) {
			passInput.focus();
			return;
		}
		const confirmInput = $(this).find('input.confirmKeyChainPassword');
		const confirm = confirmInput.is(':visible') ? confirmInput.val().trim() : null;
		if (confirmInput.is(':visible') && confirm !== pass) {
			confirmInput.focus();
			$(this).find('.error').text('Your passphrases don\'t match.').stop(true).hide().fadeIn();
			return;
		}
		$(this).find('input').val('');
		if ($(this).attr('id') === 'encryptForm') {
			keyManager.encryptKeychain({
				pass: pass,
				confirm: confirm,
				hash: new CryptoJS.SHA256(pass).toString(),
			});
		} else {
			keyManager.decryptKeychain(pass);
		}
		popupManager.close();
	});

	$('#exportKeychain').on('click', () => {
		popupManager.open('exportKeychainPopup');
	});

	$('#importKeychain').on('click', () => {
		popupManager.open('importKeychainPopup');
	});

	$('#importFromClipboard').on('click', () => {
		$('#importKeychainPopup').trigger('submit', ['clipboard']);
	});

	$('#openImportFile').on('click', () => {
		$('#importKeychainPopup').trigger('submit', ['open']);
	});

	$('#importKeychainPopup').on('submit', (e, type) => {
		e.preventDefault();
		keyManager.importKeychain(type || 'file');
	});

	$('#exportToClipboard').on('click', () => {
		$('#exportKeychainPopup').trigger('submit', ['clipboard']);
	});

	$('#exportKeychainPopup').on('submit', function exportKeySubmitHandler(e, importType) {
		e.preventDefault();
		popupManager.close();
		const type = importType || 'file';
		const pass = $(this).find('input.keyChainPassword');
		keyManager.exportKeychain({
			type: type,
			pass: pass.val().trim(),
		});
		pass.val('');
	});

	$('#importKeychainPassword').on('submit', function importKeySubmitHandler(e) {
		e.preventDefault();
		const pass = $(this).find('.keyChainPassword');
		if (!pass.val().trim()) {
			pass.val('').focus();
			return;
		}
		popupManager.close();
		const text = $(this).find('input[type="hidden"]').val();
		keyManager.decryptImportKeychain({
			text: text,
			pass: pass.val().trim(),
		});
		pass.val('');
	});

	$('.error, #overlay, .popup').hide();

	/** Add a dropdown for suggesting uids */
	(() => {
		return new Dropdown($('#uid'), $('#uidSuggestions'), (inputText) => {
			text = inputText.toLowerCase();
			let count = 0;
			const results = [];
			for (let i = 0; i < uidManager.uids.length; i++) {
				if (!uidManager.uids[i].toLowerCase().indexOf(text) && text !== uidManager.uids[i].toLowerCase()) {
					count++;
					results.push(sanitize(uidManager.uids[i]));
					if (count > 3) {
						break;
					}
				}
			}
			return results;
		});
	}());

	/** Create a dropdown providing suggestions for others' uids */
	(() => {
		return new Dropdown($('#searchUID'), $('#searchSuggestions'), (text, callback) => {
			latestRequest++;
			$.ajax({
				url: 'https://grd.me/key/search',
				type: 'GET',
				data: {
					uid: text,
					returnVal: latestRequest,
				},
				success: (data) => {
					if (data && !isNaN(data.returnVal) && parseInt(data.returnVal, 10) === latestRequest && data.status && data.status[0] && !data.status[0].code) {
						callback(data.uids);
					} else {
						callback([]);
					}
				},
				error: (data) => {
					console.error('Error getting search suggestions', data);
				},
			});
			return false;
		}, true);
	}());

	/** Panel shown. Call function to open acceptable shared keys popup */
	chrome.storage.local.get('acceptableSharedKeys', (items) => {
		const keys = items.acceptableSharedKeys;
		acceptableSharedKeysPopup(keys);
	});

	/** Get the ECC Curve */
	chrome.storage.sync.get({
		eccCurve: 384,
	}, (items) => {
		const intCurve = parseInt(items.eccCurve, 10);
		if (!isNaN(intCurve)) {
			preferences.curve = intCurve;
		}
	});

	keyManager.display();
}());
