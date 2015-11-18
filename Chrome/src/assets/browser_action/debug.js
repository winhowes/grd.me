document.addEventListener('DOMContentLoaded', () => {
    $('#message_button').on('click', () => {
        newMessage();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#contact_button').on('click', () => {
        newContact();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#group_button').on('click', () => {
        newGroup();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#show_message_button').on('click', () => {
        showMessages();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#show_contacts_button').on('click', () => {
        showContacts();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#show_groups_button').on('click', () => {
        showGroups();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#message_delete_button').on('click', () => {
        deleteMessage();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#contact_delete_button').on('click', () => {
        deleteContact();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#group_delete_button').on('click', () => {
        deleteGroup();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#group_add_member_button').on('click', () => {
        addGroupMember();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#group_delete_member_button').on('click', () => {
        deleteGroupMember();
    });
});

let storageManager = new StorageManager();

function putMessage(messages, place){
    document.getElementById(place).innerHTML = '';
    for(let prop in messages){
        document.getElementById(place).innerHTML += 'mid: ' + prop;
        document.getElementById(place).innerHTML += ', cyphertext: ' +
            messages[prop].ciphertext;
        document.getElementById(place).innerHTML += ', plaintext: ' +
            messages[prop].plaintext;
        document.getElementById(place).innerHTML += ', contact: ' +
            messages[prop].contact;
        document.getElementById(place).innerHTML += ', group: ' +
            messages[prop].group;
        document.getElementById(place).innerHTML += ', timestamp: ' +
            messages[prop].timestamp;
    }
}

function putContact(contacts, place){
    document.getElementById(place).innerHTML = '';
    for(let prop in contacts){
        document.getElementById(place).innerHTML += 'local name: ' +
            prop;
        document.getElementById(place).innerHTML += ', server name: ' +
            contacts[prop].name;
        document.getElementById(place).innerHTML += ', registered ' +
            'deviceIDs: ' + contacts[prop].devices;
    }
}

function putGroup(groups, place){
    document.getElementById(place).innerHTML = '';
    for(let prop in groups){
        document.getElementById(place).innerHTML += 'group name: ' +
            prop;
        document.getElementById(place).innerHTML += ', gid: ' +
            groups[prop].gid;
        document.getElementById(place).innerHTML += ', members: ' +
            groups[prop].members;
    }
}

function newMessage() {
    let mid = document.getElementById('mid').value;
    let cypher = document.getElementById('mcypher').value;
    let plain = document.getElementById('mplain').value;
    let contact = document.getElementById('mcontact').value;
    let group = document.getElementById('mgroup').value;
    let timestamp = document.getElementById('mtimestamp').value;
    let args = ['message'];
    storageManager.addMessage(mid, cypher, plain, contact, group, timestamp,
        putMessage, args);
}

function newContact() {
    let localName = document.getElementById('clocal').value;
    let serverName = document.getElementById('cserver').value;
    let device = document.getElementById('cdevice').value;
    let args = ['contact'];
    storageManager.addContact(localName, serverName, device, putContact, args);
}

function newGroup() {
    let gname = document.getElementById('gname').value;
    let gid = document.getElementById('gid').value;
    let gmembers = [document.getElementById('gmembers').value];
    let args = ['group'];
    storageManager.addGroup(gname, gid, gmembers, putGroup, args);
}

function showMessages(){
    let args = ['messages_here'];
    storageManager.getMessages(putMessage, args);
}

function showContacts(){
    let args = ['contacts_here'];
    storageManager.getContacts(putContact, args);
}

function showGroups(){
    let args = ['groups_here'];
    storageManager.getGroups(putGroup, args);
}

function deleteMessage(){
    let mid = document.getElementById('mid_delete').value;
    let args = ['messages_here'];
    storageManager.deleteMessage(mid, putMessage, args);
}

function deleteContact(){
    let name = document.getElementById('user_delete').value;
    let args = ['contacts_here'];
    storageManager.deleteContact(name, putContact, args);
}

function deleteGroup(){
    let group = document.getElementById('group_delete').value;
    let args = ['groups_here'];
    storageManager.deleteGroup(group, putGroup, args);
}

function addGroupMember(){
    let groupName = document.getElementById('add_member_group');
    let member = document.getElementById('add_member_name');
    let args = ['groups_here'];
    storageManager.addGroupMember(groupName, member, putGroup, args);
}

function deleteGroupMember(){
    let groupName = document.getElementById('delete_member_group');
    let member = document.getElementById('delete_member_name');
    let args = ['groups_here'];
    storageManager.deleteGroupMember(groupName, member, putGroup, args);
}
