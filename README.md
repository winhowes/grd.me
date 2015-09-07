Grd Me
======

Grd Me (/ɡärd mē/) is an open source browser plugin that provides encrypted communication across any web platform.  We support aes and ecc. Available at https://grd.me.

How to Use
==========

1. To encrypt text simply type in a text box and press `ctrl`/`cmd`+`e` to encrypt the text. In certain textboxes if your text is too long, the encrypted text (ciphertext) may be copied to your clipboard, in which case you must paste it in the textbox.
2. If your post is space constrained use `ctrl`/`cmd`+`shift`+`e` to send the encrypted message to our server and post a shortened hash of that message instead. The message will be fetched and then decrypted just like any other encrypted message.
3. To type in a JavaScript-protected textbox, press `ctrl`/`cmd`+`alt`+`e` to open a protected textbox and write your message there. To encrypt that text press `ctrl`/`cmd`+`e` and the ciphertex will be copied to your clipboard.
4. To add a new key press the lock icon in the browser toolbar and enter/generate your new key and description. To toggle which key is active simply click on the key (`shift`+click for multiple keys). Note that you may have to refresh the page to see some decryptions when adding a new key.
5. Encrypt stuff!

For more details about Grd Me features and protocols, visit https://grd.me/docs.

Compatibility
==============
Right now this browser plugin is supported in Firefox (≥ 26) and Chrome (≥ 11).

Dev Setup
==============
### 1. Install
```bash
npm install
```
### 2. Build
```bash
gulp
```
This will watch for file changes, lint, and babelify files.
### 3. Test
To run tests use:
```bash
gulp test
```
If you want to manually test Chrome, drag the `Chrome/dist` folder into your extensions page (`chrome://extensions/`) on chrome.
To manually test of Firefox, run the following inside `Firefox/dist`
```bash
jpm run
```
For more details about jpm please visit https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/jpm.
### 4. Package
```bash
gulp package
```
This will output a zipped `.zip` file for chrome which can be uploaded to the chrome web store. It will also output a zipped `.xpi` for Firefox which can be opened with Firefox and installed.
Cryptography Notice
======================

This distribution includes cryptographic software. The country in which you currently reside may have restrictions on the import, possession, use, and/or re-export to another country, of encryption software.
BEFORE using any encryption software, please check your country's laws, regulations and policies concerning the import, possession, or use, and re-export of encryption software, to see if this is permitted.
See <http://www.wassenaar.org/> for more information.

The U.S. Government Department of Commerce, Bureau of Industry and Security (BIS), has classified this software as Export Commodity Control Number (ECCN) 5D002.C.1, which includes information security software using or performing cryptographic functions with asymmetric algorithms.
The form and manner of this distribution makes it eligible for export under the License Exception ENC Technology Software Unrestricted (TSU) exception (see the BIS Export Administration Regulations, Section 740.13) for both object code and source code.

