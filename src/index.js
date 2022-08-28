import iziToast from "izitoast";
let keyEventHandler = undefined;
var boundKEH = undefined;
var definitions = [];

export default {
    onload: ({ extensionAPI }) => {
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Create Workspace from current state",
            callback: () => createWorkspace()
        });

        checkFirstRun();
        checkWorkspaces();
        getKBShortcuts();
    },
    onunload: () => {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Create Workspace from current state'
        });
        if (document.getElementById("workspaces")) {
            document.getElementById("workspaces").remove();
        }
        window.removeEventListener('keydown', boundKEH);
    }
}

async function getKBShortcuts() {
    let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);
    let q = `[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${pageUID}"]  ]`;
    var results = await window.roamAlphaAPI.q(q);

    if (results[0][0]?.children.length > 0) {
        for (var i = 0; i < results[0][0].children.length; i++) {
            if (results[0][0].children[i].string.startsWith("Workspace Definitions:")) {
                for (var j = 0; j < results[0][0].children[i]?.children.length; j++) {
                    definitions.push({ "name": results[0][0]?.children[i]?.children[j]?.string, "kbshortcut": results[0][0]?.children[i]?.children[j]?.children[4]?.children[0]?.string });
                }
            }
        }
    }

    keyEventHandler = function (definitions, e) {
        let eventKey = e.key.toLowerCase();
        let eventShift = e.shiftKey;
        let eventAlt = e.altKey;
        for (var i = 0; i < definitions.length; i++) {
            if (eventKey == definitions[i].kbshortcut && eventShift && eventAlt) {
                gotoWorkspace(definitions[i].name);
            }
        }
    }

    boundKEH = keyEventHandler.bind(null, definitions);
    window.addEventListener('keydown', boundKEH);
}

async function createWorkspace() {
    // get required information to define a workspace
    var leftSidebarState, rightSidebarState;
    if (document.querySelector('.rm-open-left-sidebar-btn')) {
        leftSidebarState = "closed";
    } else {
        leftSidebarState = "open";
    }
    if (document.querySelector("#roam-right-sidebar-content")) {
        rightSidebarState = "open";
    } else {
        rightSidebarState = "closed";
    }

    var thisPage = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
    if (!thisPage) {
        var uri = window.location.href;
        const regex = /^https:\/\/roamresearch.com\/#\/(app|offline)\/\w+$/; //today's DNP
        if (uri.match(regex)) { // this is Daily Notes for today
            var today = new Date();
            var dd = String(today.getDate()).padStart(2, '0');
            var mm = String(today.getMonth() + 1).padStart(2, '0');
            var yyyy = today.getFullYear();
            thisPage = mm + '-' + dd + '-' + yyyy;
        }
    }

    var RSwindows = await window.roamAlphaAPI.ui.rightSidebar.getWindows();
    if (RSwindows) {
        var RSWList = [];
        for (var i = 0; i < RSwindows.length; i++) {
            if (RSwindows[i]['type'] == "block") {
                RSWList.push({ "order": RSwindows[i]['order'], "type": RSwindows[i]['type'], "uid": RSwindows[i]['block-uid'], "collapsed": RSwindows[i]['collapsed?'] });
            } else if (RSwindows[i].type == "mentions") {
                RSWList.push({ "order": RSwindows[i]['order'], "type": RSwindows[i]['type'], "uid": RSwindows[i]['mentions-uid'], "collapsed": RSwindows[i]['collapsed?'] });
            } else {
                RSWList.push({ "order": RSwindows[i]['order'], "type": RSwindows[i]['type'], "uid": RSwindows[i]['page-uid'], "collapsed": RSwindows[i]['collapsed?'] });
            }
        }
    }

    // get Workspaces configuration page and find the spot to write new config 
    let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);

    let q = `[:find (pull ?page
        [:node/title :block/string :block/uid {:block/children ...}
        ])
     :where [?page :block/uid "${pageUID}"]  ]`;
    var results = await window.roamAlphaAPI.q(q);
    if (results[0][0]?.children.length > 0) {
        for (var i = 0; i < results[0][0]?.children.length; i++) {
            if (results[0][0]?.children[i].string.startsWith("Workspace Definitions:")) {
                var definitions = results[0][0]?.children[i]
            }
        }
    }

    iziToast.question({
        color: "blue",
        layout: 2,
        drag: false,
        timeout: 100000,
        close: false,
        overlay: true,
        displayMode: 2,
        id: "question",
        title: "Workspaces",
        message:
            "What do you want to call this Workspace? What key (in addition to ALT-SHIFT) will trigger it?",
        position: "center",
        inputs: [
            [
                '<input type="text" placeholder="name">',
                "keyup",
                function (instance, toast, input, e) {
                },
                true,
            ],
            [
                '<input type="text" placeholder="keyboard shortcut key">',
                "keyup",
                function (instance, toast, input, e) {
                },
                true,
            ],
        ],
        buttons: [
            [
                "<button><b>Confirm</b></button>",
                function (instance, toast, button, e, inputs) {
                    writeNewWS(inputs[0].value, inputs[1].value);
                    instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                },
                false,
            ],
            [
                "<button>Cancel</button>",
                function (instance, toast, button, e) {
                    instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                },
            ],
        ],
        onClosing: function (instance, toast, closedBy) { },
        onClosed: function (instance, toast, closedBy) { },
    });

    async function writeNewWS(val, valKb) {
        // write new workspace definition to Workspaces configuration page
        let parentUID = definitions.uid;
        let order = 1 + (definitions.children.length);
        let secHeaderUID = await createBlock(val, parentUID, order);
        let ws_3 = "Left Sidebar:";
        let ws_3v = await createBlock(ws_3, secHeaderUID, 0);
        await createBlock(leftSidebarState, ws_3v, 1);
        let ws_4 = "Right Sidebar:";
        let ws_4v = await createBlock(ws_4, secHeaderUID, 1);
        await createBlock(rightSidebarState, ws_4v, 1);
        let ws_5 = "Main Content:";
        let ws_5v = await createBlock(ws_5, secHeaderUID, 2);
        await createBlock(thisPage, ws_5v, 1);
        let ws_6 = "Right Sidebar Content:";
        let ws_6v = await createBlock(ws_6, secHeaderUID, 3);
        if (RSWList.length > 0) {
            for (var i = 0; i < RSWList.length; i++) {
                await createBlock("" + RSWList[i].uid + "," + RSWList[i].type + "," + RSWList[i].collapsed + "", ws_6v, RSWList[i].order);
            }
        }
        let ws_7 = "Keyboard Shortcut:";
        let ws_7v = await createBlock(ws_7, secHeaderUID, 4);
        await createBlock(valKb, ws_7v, 1);

        checkWorkspaces();
    }
}

async function checkFirstRun() {
    var page = await window.roamAlphaAPI.q(`
    [:find ?e
        :where [?e :node/title "Workspaces configuration"]]`);
    if (page.length > 0) { // the page already exists
        return;
    } else { // no workspaces page created, so create one
        let newUid = roamAlphaAPI.util.generateUID();
        await window.roamAlphaAPI.createPage({ page: { title: "Workspaces configuration", uid: newUid } });
        let string1 = "Thank you for installing the Workspaces extension for Roam Research. This page has been automatically generated to allow configuration of your workspaces.";
        await createBlock(string1, newUid, 0);
        let string2 = "Below the  horizontal line is where you can define workspaces. You will see a variety of options that are required for each workspace definition. A dummy template is also provided for reference (which will not be used as a workspace).";
        await createBlock(string2, newUid, 1);
        let string3 = "This short video will walk you through configuration of your first workspace.";
        await createBlock(string3, newUid, 2);
        let string3a = "{{video:https://www.loom.com/share/4ca0dd72a0fa4c46b012a59717e503d7}}";
        await createBlock(string3a, newUid, 3);
        let string4 = "The first two options take either open or closed. The third (Main Content) requires the page uid (9 alphanumeric digit string at end of the url). The final takes a list of page or block uids, separated by a comma. These will each be opened in the right sidebar.";
        await createBlock(string4, newUid, 4);
        let string5 = "The final option allows you to define a keyboard shortcut to automatically navigate to your workspace. The shortcut will be SHIFT + ALT + a letter of your choice. Type a single lowercase letter in the space provided.";
        await createBlock(string5, newUid, 5);
        await createBlock("---", newUid, 6);
        let ws_1 = "Workspace Definitions:";
        let headerUID = await createBlock(ws_1, newUid, 7);
        let ws_2 = "Dummy";
        let secHeaderUID = await createBlock(ws_2, headerUID, 0);
        let ws_3 = "Left Sidebar:";
        let ws_3v = await createBlock(ws_3, secHeaderUID, 0);
        await createBlock("open", ws_3v, 1);
        let ws_4 = "Right Sidebar:";
        let ws_4v = await createBlock(ws_4, secHeaderUID, 1);
        await createBlock("open", ws_4v, 1);
        let ws_5 = "Main Content:";
        let ws_5v = await createBlock(ws_5, secHeaderUID, 2);
        await createBlock("", ws_5v, 1);
        let ws_6 = "Right Sidebar Content:";
        let ws_6v = await createBlock(ws_6, secHeaderUID, 3);
        await createBlock("", ws_6v, 1);
        let ws_7 = "Keyboard Shortcut:";
        let ws_7v = await createBlock(ws_7, secHeaderUID, 4);
        await createBlock("", ws_7v, 1);
        await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: newUid } });
    }
}

async function checkWorkspaces() {
    let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);
    let q = `[:find (pull ?page
        [:node/title :block/string :block/uid {:block/children ...}
        ])
     :where [?page :block/uid "${pageUID}"]  ]`;
    var results = await window.roamAlphaAPI.q(q);
    if (results[0][0]?.children.length > 0) {
        for (var i = 0; i < results[0][0].children.length; i++) {
            if (results[0][0].children[i].string.startsWith("Workspace Definitions:")) {
                var definitions = results[0][0]?.children[i];
            }
        }
    }

    //destroy the rm.topbar div
    if (document.getElementById("workspaces")) {
        document.getElementById("workspaces").remove();
    }

    //create the rm.topbar div
    if (definitions?.children.length > 1) {
        for (var i = 0; i < definitions?.children.length; i++) {
            if (!document.getElementById('workspaces')) {
                var divParent = document.createElement('div');
                divParent.classList.add('.flex-container');
                divParent.innerHTML = "";
                divParent.id = 'workspaces';

                var div = document.createElement('div');
                div.classList.add('flex-items');
                div.innerHTML = "";
                div.id = "workspacesSelect";
                var span = document.createElement('span');
                span.classList.add('bp3-button', 'bp3-minimal', 'bp3-small', 'bp3-icon-folder-shared-open');
                var selectString = "<select name=\"workspacesSelect\" id=\"workspacesSelectMenu\">"
                for (i = 0; i < definitions.children.length; i++) {
                    selectString += "<option value=\"" + definitions.children[i].string + "\">" + definitions.children[i].string + "</option>";
                }
                selectString += "</select>";
                span.innerHTML = selectString;
                span.onchange =
                    div.append(span);
                divParent.append(div);

                var topBarContent = document.querySelector("#app > div > div > div.flex-h-box > div.roam-main > div.rm-files-dropzone > div");
                var topBarRow = topBarContent.childNodes[1];

                if (topBarContent && topBarRow) {
                    topBarRow.parentNode.insertBefore(divParent, topBarRow);
                }
                document.getElementById("workspacesSelectMenu").addEventListener("change", () => {
                    gotoWorkspace(document.getElementById("workspacesSelectMenu").value);
                });
            }
        }
    } else {
        if (!document.getElementById('workspaces')) {
            var divParent = document.createElement('div');
            divParent.classList.add('.flex-container');
            divParent.innerHTML = "";
            divParent.id = 'workspaces';

            var div = document.createElement('div');
            div.classList.add('flex-items');
            div.innerHTML = "";
            div.id = definitions?.children[0].string;
            var span = document.createElement('span');
            span.classList.add('bp3-button', 'bp3-minimal', 'bp3-small', 'bp3-icon-folder-shared-open');
            span.innerHTML = definitions.children[0].string;
            div.append(span);
            divParent.append(div);

            var topBarContent = document.querySelector("#app > div > div > div.flex-h-box > div.roam-main > div.rm-files-dropzone > div");
            var topBarRow = topBarContent.childNodes[1];

            if (topBarContent && topBarRow) {
                topBarRow.parentNode.insertBefore(divParent, topBarRow);
            }
            div.addEventListener('click', function () {
                gotoWorkspace(span.innerHTML);
            });
        }
    }
}

async function gotoWorkspace(workspace) {
    let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);
    let q = `[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${pageUID}"]  ]`;
    var results = await window.roamAlphaAPI.q(q);
    if (results[0][0]?.children.length > 0) {
        for (var i = 0; i < results[0][0]?.children.length; i++) {
            if (results[0][0]?.children[i].string.startsWith("Workspace Definitions:")) {
                var definitions = results[0][0]?.children[i];
            }
        }
    }
    if (definitions?.children.length > 0) {
        for (var i = 0; i < definitions?.children.length; i++) {
            if (definitions?.children[i]?.string == workspace)
                var thisDefinition = definitions?.children[i];
        }
    }

    var leftSidebar = undefined;
    var rightSidebar = undefined;
    var mainString = undefined;
    var rightSidebarContent = undefined;
    if (thisDefinition.children.length > 0) {
        for (var i = 0; i < thisDefinition.children.length; i++) {
            if (thisDefinition.children[i].string.startsWith("Left Sidebar:")) {
                if (thisDefinition.children[i].hasOwnProperty("children")) {
                    leftSidebar = thisDefinition.children[i]?.children[0]?.string;
                }
            } else if (thisDefinition.children[i].string.startsWith("Right Sidebar:")) {
                if (thisDefinition.children[i].hasOwnProperty('children')) {
                    rightSidebar = thisDefinition.children[i]?.children[0]?.string;
                }
            } else if (thisDefinition.children[i].string.startsWith("Main Content:")) {
                if (thisDefinition.children[i].hasOwnProperty('children')) {
                    mainString = thisDefinition.children[i]?.children[0]?.string;
                }
            } else if (thisDefinition.children[i].string.startsWith("Right Sidebar Content:")) {
                if (thisDefinition.children[i].hasOwnProperty('children')) {
                    rightSidebarContent = thisDefinition.children[i]?.children;
                }
            }
        }
        console.info(leftSidebar, rightSidebar, mainString, rightSidebarContent);
    }

    var leftSidebarState;
    if (document.querySelector('.rm-open-left-sidebar-btn')) {
        leftSidebarState = "closed";
    } else {
        leftSidebarState = "open";
    }

    // set left sidebar open state, but only if it isn't already in that state
    if (leftSidebar != undefined) {
        if (leftSidebar == "closed" && leftSidebarState == "open") {
            await roamAlphaAPI.ui.leftSidebar.close();
        } else if (leftSidebar == "open" && leftSidebarState == "closed") {
            await roamAlphaAPI.ui.leftSidebar.open();
        }
    }

    // set main window content
    if (mainString != undefined) {
        if (mainString.startsWith("((")) {
            mainString = mainString.slice(2, mainString.length);
            mainString = mainString.slice(0, -2);
        }
        await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: mainString } });
    }

    // get any pre-existing right sidebar content to keep for later, before we add new blocks
    let rightSidebarWindows = await window.roamAlphaAPI.ui.rightSidebar.getWindows();
    // get and create new right sidebar content
    var descriptors = [];
    if (rightSidebarContent != undefined) {
        for (var j = 0; j < rightSidebarContent.length; j++) {
            if (rightSidebarContent[j]?.string.length > 0) {
                descriptors[j] = rightSidebarContent[j]?.string.split(",");
                var thisNewUid = descriptors[j][0]?.trim();
                // handle missing definitions for mode and collapsed state
                var thisNewState = descriptors[j][1]?.trim();
                if (thisNewState == null) {
                    thisNewState = "outline"
                }
                var thisNewCollapsed = descriptors[j][2]?.trim();
                if (thisNewCollapsed == null) {
                    thisNewCollapsed = "false"
                }
                // trim and (( )) from blockrefs
                if (thisNewUid.startsWith("((")) {
                    thisNewUid = thisNewUid.slice(2, thisNewUid.length);
                    thisNewUid = thisNewUid.slice(0, -2);
                }
                // set right sidebar content
                await window.roamAlphaAPI.ui.rightSidebar.addWindow({ window: { type: thisNewState, 'block-uid': thisNewUid, order: j } });
                if (thisNewCollapsed == "true") {
                    await window.roamAlphaAPI.ui.rightSidebar.collapseWindow({ window: { type: thisNewState, 'block-uid': thisNewUid } });
                }

            }
        }
    }
    // remove the pre-existing content
    if (rightSidebarWindows.length > 0) {
        for (var i = 0; i < rightSidebarWindows.length; i++) {
            await window.roamAlphaAPI.ui.rightSidebar.removeWindow({ "window": { "type": rightSidebarWindows[i]['type'], "block-uid": rightSidebarWindows[i]['block-uid'] || rightSidebarWindows[i]['page-uid'] || rightSidebarWindows[i]['mentions-uid'] } })
        }
    }

    // set right sidebar open state
    console.info(rightSidebar);
    if (rightSidebar != undefined) {
        if (rightSidebar == "closed") {
            console.info("closing RSB");
            await roamAlphaAPI.ui.rightSidebar.close();
        } else if (rightSidebar == "open") {
            console.info("opening RSB");
            await roamAlphaAPI.ui.rightSidebar.open();
        }
    }
}

async function createBlock(string, uid, order) {
    let newUid = roamAlphaAPI.util.generateUID();
    await window.roamAlphaAPI.createBlock(
        {
            location: { "parent-uid": uid, order: order },
            block: { string: string.toString(), uid: newUid }
        });
    return newUid;
}