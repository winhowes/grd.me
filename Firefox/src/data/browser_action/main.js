/** This file handles the preferences panel */

(() => {
	const preferences = {
		curve: 384,
	};
	const uidManager = new UidManager(self.port);
	const popupManager = new PopupManager();
	const keyManager = new KeyManager(self.port, preferences, uidManager, popupManager);
	let latestRequest = 0;

	/** Generate a random string
	 * @param length The length of the random string
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

	$('.error, #overlay, .popup').hide();

	/** Create a dropdown providing suggestions for others' uids */
	(() => {
		return new Dropdown($('#searchUID'), $('#searchSuggestions'), (searchText, callback) => {
			latestRequest++;
			$.ajax({
				url: 'https://grd.me/key/search',
				type: 'GET',
				data: {
					uid: searchText,
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

	/** Add a dropdown for suggesting uids */
	(() => {
		return new Dropdown($('#uid'), $('#uidSuggestions'), (searchText) => {
			const text = searchText.toLowerCase();
			let count = 0;
			const results = [];
			for (let i = 0; i < uidManager.uids.length; i++) {
				if (!uidManager.uids[i].toLowerCase().indexOf(text) && text !== uidManager.uids[i].toLowerCase()) {
					count++;
					results.push($('<i></i>').text(uidManager.uids[i]).html());
					if (count > 3) {
						break;
					}
				}
			}
			return results;
		});
	}());

	/** Handle searching for a public key by uid */
	$('#searchUIDForm').on('submit', (e) => {
		e.preventDefault();
		const text = $.trim($('#searchUID').val());
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
										.append(alreadyExists ? $('<div>', {class: 'already_exists', text: '[Already in Keychain]'}) : '')
										.append($('<a>', {class: 'showHideKey', text: 'Show Key'}))
										.append(revoked ? $('<span>', {class: 'revoked_msg', text: '[Revoked]'}) : '')
										.append($('<div>')
											.append($('<span>', {class: 'key partialKey', text: 'Key: ' + data.keys[i].pub}))
											.append(!revoked ? $('<button>', {class: 'btn blue addKey', uid: data.uid, pub: data.keys[i].pub, text: 'Add'}) : ''))
										.append(revoked ? $('<div>', {class: 'timestamp', text: 'Revoked: ' + data.keys[i].revoked_at}) : '')
										.append($('<div>', {class: 'timestamp', text: 'Created: ' + data.keys[i].created_at})));
							}
						} catch(e) {
							console.error('Error verifying key', e);
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
	$('#searchResults, #shareFormMain1, #shareFormMain2').on('click', '.showHideKey', function shareShowHideKeyClickHandler(e) {
		e.stopImmediatePropagation();
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
		keyManager.add(keyVal, description, isECC, true);
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
		if ($('#ecc').is(':checked') ) {
			const keypair = keyManager.generateECCPair();
			rand = JSON.stringify(keypair);
		} else {
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
	/** Show/hide the key in the key list */
	.on('click', '.showHideKey', function showHideKeyClickHandler(e) {
		e.stopImmediatePropagation();
		$(this).next().toggle();
		$(this).text($(this).next().is(':visible') ? 'Hide key' : 'Show key');
	})
	/** Handle selecting different keys to be active */
	.on('click', 'li', function keyClickHandler(e) {
		if (e.shiftKey) {
			window.getSelection().removeAllRanges();
		}
		const $elem = $(this);
		if ($elem.hasClass('active') && $('#keyList').find('.active').length === 1) {
			return;
		}
		if (e.shiftKey) {
			$elem.toggleClass('active');
			const indices = [];
			const keyList = $('#keyList').find('.active');
			for (let i = 0; i < keyList.length; i++) {
				indices.push($(keyList.get(i)).attr('index'));
			}
			self.port.emit('setActiveKeys', indices);
		} else {
			$('#keyList').find('.active').removeClass('active');
			$elem.addClass('active');
			self.port.emit('setActiveKeys', [$elem.attr('index')]);
			if ($elem.find('.pub').length && !$elem.find('.priv').length) {
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
		const description = $.trim($(this).find('input').val());
		if (description) {
			$(this).hide()
			.siblings('.description').html(sanitize(description))
			.append($('<i>', {class: 'pencil'}))
			.show();
			self.port.emit('updateDescription', {
				description: description,
				index: $(this).parents('li').attr('index'),
			});
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
		const description = $.trim($(this).val());
		if (description) {
			$(this).parent().hide()
			.siblings('.description').html(sanitize(description))
			.append($('<i>', {class: 'pencil'}))
			.show();
			self.port.emit('updateDescription', {
				description: description,
				index: $(this).parents('li').attr('index'),
			});
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

	/** Press continue to move to page 2 of sharing a shared key */
	$('#shareFormMain1').on('click', '.continue', () => {
		sharedKeyPage2();
	});

	/** Share key */
	$('#shareFormMain2').on('click', '.continue', () => {
		const fromKey = keyManager.keyChain[$('#shareFormMain1 .active').attr('index')].key;
		const toKey = keyManager.keyChain[$('#shareFormMain2 .active').attr('index')].key;
		const sharedKey = ecc.encrypt(toKey.pub, $('#pubKey').val());
		self.port.emit('shareKey', {
			fromKey: fromKey.pub,
			toKey: toKey.pub,
			sharedKey: sharedKey,
			sendSig: JSON.stringify(ecc.sign(fromKey.priv, sharedKey)),
			rand: getRandomString(64),
		});
		popupManager.close();
	});

	/** Select which key to encrypt shared key with */
	$('#shareFormMain1, #shareFormMain2').on('click', 'li', function shareFromKeyClickHandler() {
		$(this).parent().find('.active').removeClass('active');
		$(this).addClass('active');
	});

	/** Click on the only pub warning hides the warning */
	$('#onlyPubWarning').on('click', function warningClickHandler() {
		clearTimeout($(this).data('timeout'));
		$(this).stop(true).animate({top: '-60px'});
	});

	/** Delete the key */
	$('#deleteForm').on('submit', function deleteFormSubmitHandler(e) {
		e.preventDefault();
		self.port.emit('deleteKey', $('#pubKeyIndex').val());
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
		self.port.emit('revokeKey', key);
		popupManager.close();
	});

	/** Publish the key */
	$('#publishForm').on('submit', function publishFormSubmitHandler(e) {
		e.preventDefault();
		$('.publishError').stop(true).hide();
		const uid = $.trim($('#uid').val());
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
						} catch(e) {
							console.error('Error verifying key', e);
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
						self.port.emit('publishKey', key);
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

	/** Clicking the overlay or cancel button closes the overlay and appropriate popups */
	$('#overlay, .cancel').on('click', () => {
		popupManager.close();
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
		const action = ($(this).attr('id') === 'encryptForm' ? 'encrypt' : 'decrypt') + 'Keychain';
		self.port.emit(action, {
			pass: pass,
			confirm: confirm,
			hash: new CryptoJS.SHA256(pass).toString(),
		});
		popupManager.close();
	});

	/** Remove a key from the acceptableSharedKey array */
	$('#acceptableSharedKeys').on('click', '.remove', function removeClickHandler() {
		self.port.emit('removeAcceptableSharedKey', $(this).parent().attr('index'));
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
			self.port.emit('addKey', {
				key: $(this).attr('key'),
				description: $.trim(description.val()),
			});
			$(this).find('.remove').trigger('click');
		}
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

	$('#importKeychainPopup').on('submit', (e, type) => {
		e.preventDefault();
		const importType = type || 'file';
		self.port.emit('importKeychain', importType);
	});

	$('#exportToClipboard').on('click', () => {
		$('#exportKeychainPopup').trigger('submit', ['clipboard']);
	});

	$('#exportKeychainPopup').on('submit', function exportKeychain(e, type) {
		e.preventDefault();
		popupManager.close();
		const exportType = type || 'file';
		const $pass = $(this).find('input.keyChainPassword');
		self.port.emit('exportKeychain', {
			type: exportType,
			pass: $pass.val().trim(),
		});
		$pass.val('');
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
		self.port.emit('decryptImportKeychain', {
			text: text,
			pass: pass.val().trim(),
		});
		pass.val('');
	});

	self.port.on('downloadFile', (data) => {
		window.URL = window.URL || window.webkitURL;
		const file = new Blob([data], {type: 'application/json'});
		const a = document.createElement('a');
		a.href = window.URL.createObjectURL(file);
		a.download = 'Grd Me Keychain.json';
		document.body.appendChild(a);
		a.click();
		a.remove();
		popupManager.showFlash('exportCreated');
	});

	self.port.on('mergeKeychain', (jsonKeys) => {
		keyManager.mergeKeychain(jsonKeys);
	});

	self.port.on('exportCopied', () => {
		popupManager.showFlash('exportCopied');
	});

	self.port.on('importKeychainError', () => {
		popupManager.close();
		popupManager.showFlash('importKeychainError');
	});

	self.port.on('getImportPassword', (text) => {
		popupManager.close();
		popupManager.open('importKeychainPassword');
		$('#importKeychainPassword input[type="hidden"]').val(text);
	});

	self.port.on('confirmKeyChainPassword', (pass) => {
		keyManager.showEncryptKeyChainPopup(true);
		$('#encryptForm input.keyChainPassword').val(pass);
	});

	/** Show the key list */
	self.port.on('displayKeys', (keyObj) => {
		keyManager.display(keyObj);
	});

	/** Set a particular key to being the active key */
	self.port.on('activeKeyIndex', (indices) => {
		keyManager.activeKeyIndex(indices);
	});

	/** Indicate whether a key was published or failed to publish
	 * @param obj Object containing a success boolean property and an index property when success is
	 * false of the index of the revoked key
	*/
	self.port.on('publishResult', (obj) => {
		const id = obj.success ? 'publishSuccess' : 'publishFail';
		if (!obj.success) {
			$('#keyList').find('li[index="' + obj.index + '"]').find('.publish').removeClass('disabled').prop('disabled', false);
		}
		popupManager.showFlash(id);
	});

	/** Indicate whether a key was revoked or failed to be revoked
	 * @param obj Object containing a success boolean property and an index property when success is
	 * false of the index of the revoked key
	*/
	self.port.on('revokeResult', (obj) => {
		const id = obj.success ? 'revokeSuccess' : 'revokeFail';
		if (!obj.success) {
			$('#keyList').find('li[index="' + obj.index + '"]').find('.revoke').removeClass('disabled').prop('disabled', false);
		}
		popupManager.showFlash(id);
	});

	/** Indicate whether a key was shared or failed to be shared
	 * @param success Boolean indicating whether or not the share was successful
	*/
	self.port.on('shareKeyResult', (success) => {
		const id = success ? 'shareKeySuccess' : 'shareKeyFail';
		popupManager.showFlash(id);
	});

	/** Check shared keys */
	self.port.on('checkSharedKey', (data) => {
		keyManager.checkSharedKey(data);
	});


	/** Called when the curve for ECC changes
	 * @param curve The new curve to use
	*/
	self.port.on('curve', (curve) => {
		const intCurve = parseInt(curve, 10);
		if (!isNaN(intCurve)) {
			preferences.curve = intCurve;
		}
	});

	/** Panel shown. Call function to open acceptable shared keys popup
	 * @param keys Array of acceptable shared keys that need approval
	*/
	self.port.on('show', (keys) => {
		keyManager.acceptableSharedKeysPopup(keys);
	});
}());
