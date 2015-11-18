/**
 * Class for using chrome local storage for storing contacts, groups, and
 * messages.
 */

var StorageManager = function() {
    /**
     * Add (or update) a contact to local storage
     * @param {string} localName: the unique user given name
     * @param {string} publicName: the unique name for the user in server
     * @param {array} deviceIDs: array of device IDs associated with user
     * @param {function} callback: callback function after contact stored
     * @param {array} callbackArgs: array of args for callback function
     */
    this.addContact = function(localName, publicName, deviceIDs, callback,
            callbackArgs) {
        chrome.storage.local.get({contact: {}}, (result) => {
            let update = result.contact;
            update[localName] = {
              name: publicName,
              devices: deviceIDs
            };
            chrome.storage.local.set({contact: update}, () => {
                callbackArgs.unshift(update);
                callback.apply(null, callbackArgs);
            });
        });
    }
    /**
     * Gets contacts out of local storage and runs callback function with
     * results.
     * @param {function} callback: callback function after contacts retrieved
     * @param {array} callbackArgs: array of args for callback function
     */
    this.getContacts = function(callback, callbackArgs) {
        chrome.storage.local.get({contact: {}}, (result) => {
            callbackArgs.unshift(result.contact);
            callback.apply(null, callbackArgs);
        });
    }
    /**
     * Delete contact from local storage
     * @param {string} localName: the local name of the contact to be deleted
     * @param {function} callback: callback function after contact deleted
     * @param {array} callbackArgs: array of args for callback function
     */
    this.deleteContact = function(localName, callback, callbackArgs) {
        chrome.storage.local.get({contact: {}}, (result) => {
            let update = result.contact;
            update[localName] = null;
            chrome.storage.local.set({contact: update}, () => {
                callbackArgs.unshift(update);
                callback.apply(null, callbackArgs);
            });
        });
    }
    /**
     * Add a group to local storage
     * @param {string} name: group name
     * @param {string} id: group id
     * @param {array} members: local names of contacts
     * @param {function} callback: callback function after group added
     * @param {array} callbackArgs: array of args for callback function
     */
    this.addGroup = function(name, id, members, callback, callbackArgs) {
        chrome.storage.local.get({group: {}}, (result) => {
            let update = result.group;
            update[name] = {
              gid: id,
              members: members
            };
            chrome.storage.local.set({group: update}, () => {
                callbackArgs.unshift(update);
                callback.apply(null, callbackArgs);
            });
        });
    }
    /**
     * Gets groups out of local storage and runs callback function with results
     * @param {function} callback: callback function after groups retrieved
     * @param {array} callbackArgs: array of args for callback function
     */
    this.getGroups = function(callback, callbackArgs) {
        chrome.storage.local.get({group: {}}, (result) => {
            callbackArgs.unshift(result.group);
            callback.apply(null, callbackArgs);
        });
    }
    /**
    * WIP: not working, can just overwrite addgroup
    * Add member to group
    * @param {string} groupName: name of group
    * @param {string} member: localName of contact to add as member
    * @param {function} callback: callback function after member added
    * @param {array} callbackArgs: array of args for callback function
    */
    this.addGroupMember = function(groupName, member, callback, callbackArgs) {
        chrome.storage.local.get({group: {}}, (result) => {
            let update = result.group;
            update[groupName].members.push(member);
            chrome.storage.local.set({group: update}, () => {
                callbackArgs.unshift(update);
                callback.apply(null, callbackArgs);
            });
        });
    }
    /**
    * WIP: not working, can just overwrite addgroup
    * Deletes member from group in local storage
    * @param {string} groupName: name of group
    * @param {string} member: localName of contact to be deleted
    * @param {function} callback: callback function after member deleted
    * @param {array} callbackArgs: array of args for callback function
    */
    this.deleteGroupMember = function(groupName, member, callback,
        callbackArgs) {
        chrome.storage.local.get({group: {}}, (result) => {
            let update = result.group;
            for(let i = 0; update[groupName].members.length; i++){
                if(update[groupName].members[i] == member){
                    update[groupName].members.splice(i, 1);
                }
            }
            chrome.storage.local.set({contact: update}, () => {
                callbackArgs.unshift(update);
                callback.apply(null, callbackArgs);
            });
        });
    }
    /**
    * Deletes group from local storage
    * @param {string} groupName: name of group to be deleted
    * @param {function} callback: callback function after group deleted
    * @param {array} callbackArgs: array of args for callback function
    */
    this.deleteGroup = function(groupName, callback, callbackArgs) {
        chrome.storage.local.get({group: {}}, (result) => {
            let update = result.group;
            update[groupName] = null;
            chrome.storage.local.set({group: update}, (result) => {
                callbackArgs.unshift(update);
                callback.apply(null, callbackArgs);
            });
        });
    }
    /**
    * Add message to local storage
    * @param {string} id: id of message
    * @param {string} ciphertext: ciphertext message
    * @param {string} plaintext: plaintext message
    * @param {string} contact: contact associated with message (localname or
    * servername???)
    * @param {string} group: group associated with message
    * @param {number} timestamp: unix timestamp
    * @param {function} callback: callback function after message addded
    * @param {array} callbackArgs: array of args for callback function
    */
    this.addMessage = function(id, ciphertext, plaintext, contact, group,
            timestamp, callback, callbackArgs) {
        chrome.storage.local.get({message: {}}, (result) => {
            let update = result.message;
            update[id] = {
              ciphertext: ciphertext,
              plaintext: plaintext,
              contact: contact,
              group: group,
              timestamp: timestamp
            };
            chrome.storage.local.set({message: update}, () => {
                callbackArgs.unshift(update);
                callback.apply(null, callbackArgs);
            });
        });
    }
    /**
     * Gets messages out of local storage and runs callback function with
     * results, puts messages object as first argument in callbackArgs
     * @param {function} callback: callback function after groups retrieved
     * @param {array} callbackArgs: array of args for callback function
     */
    this.getMessages = function(callback, callbackArgs) {
        chrome.storage.local.get({message: {}}, (result) => {
            callbackArgs.unshift(result.message);
            callback.apply(null, callbackArgs);
        });
    }
    /**
    * Delete message from local storage
    * @param {string} id: message id
    * @param {function} callback: callback function after message deleted
    * @param {array} callbackArgs: array of args for callback function
    */
    this.deleteMessage = function(id, callback, callbackArgs) {
        chrome.storage.local.get({message: {}}, (result) => {
            let update = result.message;
            delete update[id];
            chrome.storage.local.set({message: update}, (result) => {
                callbackArgs.unshift(update);
                callback.apply(null, callbackArgs);
            });
        });
    }
}
