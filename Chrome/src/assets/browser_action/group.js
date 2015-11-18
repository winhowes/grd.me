document.addEventListener('DOMContentLoaded', () => {
    $('#addgroup').on('click', () => {
        disp();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    $('#addcontact').on('click', () => {
        contact();
    });
});

let number = 0;
updateContacts();
updateGroups();

function disp() {
    let x = document.createElement('INPUT');
    x.setAttribute('id', 'newgroupname');
    x.id = 'newgroupname';
    x.setAttribute('type', 'text');
    document.getElementById('groupadd').innerHTML = '';
    document.getElementById('groupadd').appendChild(x);
    let btn = document.createElement('BUTTON');
    btn.className = 'blue btn';
    btn.onclick = addGroup;
    let txt = document.createTextNode('Add');
    btn.appendChild(txt);
    document.getElementById('groupadd').appendChild(btn);
}

function addGroup() {
    let x = document.getElementById('addgroup');
    let groupName = document.getElementById('newgroupname').value;
    document.getElementById('groupadd').innerHTML = '';
    let ul = document.createElement('ul');
    let li = document.createElement('li');
    li.innerHTML = groupName + ' [-]';
    li.id = number;
    ul.id = number;
    number++;
    let btn = document.createElement('BUTTON');
    let txt = document.createTextNode('del');
    btn.className = 'blue btn';
    btn.appendChild(txt);
    btn.onclick = () => {
        ul.innerHTML = '';
    }
    let innerUl = document.createElement('ul');
    innerUl.id = 'searchResults';
    let plus = document.createElement('li');
    plus.innerHTML = '[+]';
    plus.onclick = '';
    innerUl.appendChild(plus);
    li.appendChild(innerUl);
    ul.appendChild(li);
    ul.appendChild(btn);
    document.getElementById('groups').appendChild(ul);

    chrome.storage.local.get({groups: []}, (result) => {
        let groups = result.groups;
        let group = {name: groupName, members: []};
        groups.push(group);
        chrome.storage.local.set({groups: groups}, () => {
            updateGroups();
        });
    });
}

function updateGroups() {
    let groups;
    chrome.storage.local.get({groups: []}, (result) => {
        let list = document.getElementById('groups');
        list.innerHTML = '';
        for(let prop in result){
            for(let i = 0; i < result[prop].length; i++){
                let ul = document.createElement('ul');
                let li = document.createElement('li');
                let name = 'fail';
                try{
                    name = result[prop][i]['name'];
                } catch(err){
                    name = 'fail';
                }
                li.innerHTML = name;
                let innerUL = document.createElement('ul');
                li.appendChild(innerUL);
                for(let j = 0; j < result[prop][i]['members'].length; j++){
                    let li2 = document.createElement('li');
                    li2.innerHTML = result[prop][i]['members'][j];
                    innerUL.appendChild(li2);
                }
                ul.appendChild(li);
                list.appendChild(ul);
                let btn = document.createElement('BUTTON');
                btn.className = 'blue btn';
                let txt = document.createTextNode('delete group');
                btn.appendChild(txt);
                btn.onclick = function() {
                    result[prop].splice(i, 1);
                    ul.innerHTML = '';
                    groups = result.groups;
                    chrome.storage.local.set({groups: groups}, () => {
                        return true;
                    });
                }
                ul.appendChild(btn);
                let drop = document.createElement('SELECT');
                chrome.storage.local.get({contacts: []}, (res) => {
                    for(let pro in res){
                        for(let j = 0; j < res[pro].length; j++){
                            let opt = document.createElement('option');
                            opt.text = res[pro][j];
                            opt.value = j;
                            drop.add(opt);
                        }
                    }
                });
                ul.appendChild(drop);
                let btn2 = document.createElement('BUTTON');
                btn2.className = 'blue btn';
                let txt2 = document.createTextNode('add member');
                btn2.appendChild(txt2);
                btn2.onclick = () => {
                    result[prop][i]['members'].push(drop.options[drop.value].innerHTML);
                    groups = result.groups;
                    let li2 = document.createElement('li');
                    li2.innerHTML = drop.options[drop.value].innerHTML;
                    innerUL.appendChild(li2);
                    chrome.storage.local.set({groups: groups}, () => {
                        updateGroups();
                    });
                }
                ul.appendChild(btn2);
                let drop2 = document.createElement('SELECT');
                for(let j = 0; j < result[prop][i]['members'].length; j++){
                    let opt = document.createElement('option');
                    opt.text = result[prop][i]['members'][j];
                    opt.value = j;
                    drop2.add(opt);
                }
                ul.appendChild(drop2);
                let btn3 = document.createElement('BUTTON');
                btn3.className = 'blue btn';
                let txt3 = document.createTextNode('delete member');
                btn3.appendChild(txt3);
                btn3.onclick = () => {
                    try{
                        result[prop][i]['members'].splice(drop2.value, 1);
                        groups = result.groups;
                        chrome.storage.local.set({groups: groups}, () => {
                            updateGroups();
                        });
                    } catch(err) {
                        document.getElementById('debug2').innerHTML = result[prop][i]['members'] + ' ' + drop2.value;
                    }
                }
                ul.appendChild(btn3);
            }
        }
    });
}

function deleteGroup(id) {
    document.getElementById(id).innerHTML = '';
}

function contact() {
    let x = document.createElement('INPUT');
    x.setAttribute('id', 'newcontactname');
    x.id = 'newcontactname'
    x.setAttribute('type', 'text');
    document.getElementById('newcontact').innerHTML = '';
    document.getElementById('newcontact').appendChild(x);
    let btn = document.createElement('BUTTON');
    btn.className = 'blue btn';
    btn.onclick = addContact;
    let txt = document.createTextNode('Add');
    btn.appendChild(txt);
    document.getElementById('newcontact').appendChild(btn);
}

function addContact() {
    let x = document.getElementById('addgroup');
    let contact = document.getElementById('newcontactname').value;
    document.getElementById('newcontact').innerHTML = '';
    let contacts = [];

    chrome.storage.local.get({contacts: []}, (result) => {
        var contacts = result.contacts;
        contacts.push(contact);
        chrome.storage.local.set({contacts: contacts}, () => {
            updateContacts();
            updateGroups();
        });
    });
}

function updateContacts() {
    chrome.storage.local.get({contacts: []}, (result) => {
        let list = document.getElementById('contactlist');
        list.innerHTML = '';
        for(let i = 0; i < result.contacts.length; i++){
            let li = document.createElement('li');
            li.innerHTML = result.contacts[i];
            li.onclick = () => {
                list.removeChild(li);
                result.contacts.splice(i, 1);
                let contacts = result.contacts;
                chrome.storage.local.set({contacts: contacts}, () => {
                    updateGroups();
                    updateContacts();
                });
            }
            list.appendChild(li);
        }
    });
}

function addToStorageList(id, item, callback) {
    chrome.storage.local.get(id, (result) => {
        let ans = result[id] || [];
        ans.push(item);
        chrome.storage.local.set({id: ans}, callback());
    });
}

function update(){
    updateGroups();
    updateContacts();
}
