import iziToast from "izitoast";
import initializeRoamJSSidebarFeatures from "./sidebar";
let keyEventHandler = undefined;
var boundKEH = undefined;
var kbDefinitions = [];
var pullBlock = undefined;
var auto = false;
let observer = undefined;
var checkInterval = 0;
var checkEveryMinutes, autoLabel, autoMenu;
var leftSidebarStateCSS;

export default {
    onload: ({ extensionAPI }) => {
        const config = {
            tabTitle: "Workspaces",
            settings: [
                {
                    id: "ws-auto",
                    name: "Autosave",
                    description: "Automatically save your Roam Research layout at intervals",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setAuto(evt); }
                    },
                },
                {
                    id: "ws-auto-label",
                    name: "Autosave workspace label",
                    description: "Name for your autosaved workspace",
                    action: { type: "input", placeholder: "Autosave" },
                },
                {
                    id: "ws-auto-time",
                    name: "Autosave interval",
                    description: "Frequency in minutes to save your workspace",
                    action: { type: "input", placeholder: "5" },
                },/*
                {
                    id: "ws-auto-include",
                    name: "Autosave in Topbar Menu",
                    description: "Include autosave workspace in Workspaces dropdown",
                    action: { type: "switch" },
                },*/
                {
                    id: "ws-auto-focus",
                    name: "Autofocus Sidebar",
                    description: "Whether or not the sidebar should be automatically focused upon opening.",
                    action: { type: "switch" },
                },
                {
                    id: "ws-auto-filter",
                    name: "Autofilter Sidebar",
                    description: "Whether or not the sidebar filters should match the corresponding page's filter.",
                    action: { type: "switch" },
                },
                {
                    id: "ws-auto-pin",
                    name: "Autopin Sidebar",
                    description: "Whether or not new sidebar windows should be automatically pinned.",
                    action: { type: "switch" },
                },
                {
                    id: "ws-go-to-page",
                    name: "Go to Page Links",
                    description: "Whether or not to show go to page links from Page sidebar windows",
                    action: { type: "switch" },
                },
                {
                    id: "ws-exp-col",
                    name: "Expand/Collapse All Button",
                    description: "Whether or not to display the expand/collapse all windows button on the top of the sidebar",
                    action: { type: "switch" },
                },
            ]
        };
        extensionAPI.settings.panel.create(config);

        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Create Workspace from current state",
            callback: () => createWorkspace(false, false, false)
        });
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Update Workspace from current state",
            callback: () => createWorkspace(false, false, true)
        });

        async function initiateObserver() {
            const targetNode1 = document.getElementsByClassName("rm-topbar")[0];
            const config = { attributes: false, childList: true, subtree: true };
            const callback = function (mutationsList, observer) {
                for (const mutation of mutationsList) {
                    if (mutation.addedNodes[0]) {
                        for (var i = 0; i < mutation.addedNodes[0]?.classList.length; i++) {
                            if (mutation.addedNodes[0]?.classList[i] == "rm-open-left-sidebar-btn") { // left sidebar has been closed
                                checkWorkspaces();
                            }
                        }
                    } else if (mutation.removedNodes[0]) {
                        for (var i = 0; i < mutation.removedNodes[0]?.classList.length; i++) {
                            if (mutation.removedNodes[0]?.classList[i] == "rm-open-left-sidebar-btn") { // left sidebar has been opened
                                checkWorkspaces();
                            }
                        }
                    }
                }
            };
            observer = new MutationObserver(callback);
            observer.observe(targetNode1, config);
        }
        initiateObserver();

        checkFirstRun();
        checkWorkspaces();
        getKBShortcuts();

        async function setAuto(evt) { // onchange
            if (evt.target.checked) {
                auto = true;
                autoSave();
            } else {
                auto = false;
                if (checkInterval > 0) clearInterval(checkInterval);
            }
        }

        if (extensionAPI.settings.get("ws-auto") == true) { // onload
            auto = true;
            autoSave();
        }

        async function autoSave() {
            if (extensionAPI.settings.get("ws-auto-time")) {
                checkEveryMinutes = extensionAPI.settings.get("ws-auto-time");
            } else {
                checkEveryMinutes = 5;
            }
            if (extensionAPI.settings.get("ws-auto-label")) {
                autoLabel = extensionAPI.settings.get("ws-auto-label");
            } else {
                autoLabel = "Autosave";
            }
            /*         
            if (extensionAPI.settings.get("ws-auto-include") == true) {
                autoMenu = true;
            } else {
                autoMenu = false;
            }
            */

            setTimeout(async () => {
                await createWorkspace(auto, autoLabel, autoMenu);
                try { if (checkInterval > 0) clearInterval(checkInterval) } catch (e) { }
                checkInterval = setInterval(async () => {
                    await createWorkspace(auto, autoLabel/*, autoMenu*/)
                }, checkEveryMinutes * 60000);
            }, 10000)
        }

        /*
        window.roamWorkspacesAPI = {
            openWorkspace: gotoWorkspace,
            clearWorkspaceCSS: clearWorkspaceCSS,
            createWorkspace: createWorkspace,
            listWorkspaces: listWorkspaces,
            deleteWorkspace: deleteWorkspace,
            addWorkspaceOpenedWatch: addWorkspaceOpenedWatch,
            removeWorkspaceOpenedWatch: removeWorkspaceOpenedWatch,
        }*/
        const unloadRoamJSSidebarFeatures = initializeRoamJSSidebarFeatures(extensionAPI);
        return () => {
            unloadRoamJSSidebarFeatures();
            window.roamAlphaAPI.ui.commandPalette.removeCommand({
                label: 'Create Workspace from current state'
            });
            window.roamAlphaAPI.ui.commandPalette.removeCommand({
                label: 'Update Workspace from current state'
            });
            if (document.getElementById("workspaces")) {
                document.getElementById("workspaces").remove();
            }
            window.removeEventListener('keydown', boundKEH);
            if (checkInterval > 0) clearInterval(checkInterval);

            window.roamAlphaAPI.data.removePullWatch(
                "[:block/children :block/uid :block/string {:block/children ...}]",
                `[:block/uid "${pullBlock}"]`,
                pullFunction);
            observer.disconnect();
            clearWorkspaceCSS();
        }
    }
}

async function checkFirstRun() {
    var page = await window.roamAlphaAPI.q(`[:find (pull ?page [:block/string :block/uid {:block/children ...}]) :where [?page :node/title "Workspaces configuration"]  ]`);
    if (page.length > 0) { // the page already exists
        if (page[0][0].hasOwnProperty("children")) {
            for (var i = 0; i < page[0][0].children.length; i++) {
                if (page[0][0].children[i].string == "Workspace Definitions:") {
                    var pullBlock = page[0][0].children[i].uid;
                }
            }
        }
        var pageUID = page[0][0].uid;
    } else { // no workspaces page created, so create one
        let newUid = roamAlphaAPI.util.generateUID();
        await window.roamAlphaAPI.createPage({ page: { title: "Workspaces configuration", uid: newUid } });
        let string1 = "Thank you for installing the Workspaces extension for Roam Research. This page has been automatically generated to allow configuration of your workspaces.";
        await createBlock(string1, newUid, 0);
        let string2 = "Below the horizontal line is where you can define workspaces. You will see a variety of options that are required for each workspace definition. A dummy template is provided for reference.";
        await createBlock(string2, newUid, 1);
        let string3 = "This short video will walk you through configuration of your first workspace. You could do this manually, but it is easier to just set up your workspace as you like it and then use the Command Palette 'Create Workspace from current state' command.";
        await createBlock(string3, newUid, 2);
        let string3a = "{{video:https://www.loom.com/share/4ca0dd72a0fa4c46b012a59717e503d7}}";
        await createBlock(string3a, newUid, 3);
        let string4 = "The first two options take either open or closed. The third (Main Content) requires the page uid (9 alphanumeric digit string at end of the url) or a Roam link to the [[page]]. You could also simply put DNP if you want the Workspace to open to whichever daily note page is appropriate for that day. The fourth option takes a list of page or block uids, each on their own row, or a list of [[page]] references on their own row. These will each be opened in the right sidebar.";
        await createBlock(string4, newUid, 4);
        let string5 = "A special use case would be to have multiple daily note pages as part of a workspace: you could have the DNP for today in the main content area and both yesterday and tomorrow's DNP in the right sidebar. For today use the code DNP, yesterday use DNP-1 and tomorrow use DNP+1. The dates will be calculated upon loading the workspace, meaning that they will always be right for the day you're using the workspace.";
        await createBlock(string5, newUid, 5);
        let string6 = "The final option allows you to define a keyboard shortcut to automatically navigate to your workspace. The shortcut will be SHIFT + ALT + a letter of your choice. Type a single lowercase letter in the space provided. Please note that not all letters will work as some are reserved for use by the browser or other functions. It might require some experimentation to find the right key to use! Setting a new keyboard shortcut requires you to either reload the page or the extension.";
        await createBlock(string6, newUid, 6);
        await createBlock("---", newUid, 7);
        let ws_1 = "Workspace Definitions:";
        let headerUID = await createBlock(ws_1, newUid, 8);
        let ws_2 = "Dummy";
        let secHeaderUID = await createBlock(ws_2, headerUID, 0);
        let ws_3 = "Left Sidebar:";
        let ws_3v = await createBlock(ws_3, secHeaderUID, 0);
        await createBlock("__open or closed__", ws_3v, 1);
        let ws_4 = "Right Sidebar:";
        let ws_4v = await createBlock(ws_4, secHeaderUID, 1);
        await createBlock("__open or closed__", ws_4v, 1);
        let ws_5 = "Main Content:";
        let ws_5v = await createBlock(ws_5, secHeaderUID, 2);
        await createBlock("__add a [[ page link here, or DNP to open that day's daily note page__", ws_5v, 1);
        let ws_6 = "Right Sidebar Content:";
        let ws_6v = await createBlock(ws_6, secHeaderUID, 3);
        await createBlock("__add a [[ page link here__", ws_6v, 1);
        await createBlock("__or a (( blockref here__", ws_6v, 2);
        await createBlock("__or maybe DNP-1 for yesterday or DNP+1 for tomorrow__", ws_6v, 3);
        await createBlock("__or go crazy and use DNP-365 to see what you were doing last year!__", ws_6v, 4);
        let ws_7 = "Keyboard Shortcut:";
        let ws_7v = await createBlock(ws_7, secHeaderUID, 4);
        await createBlock("__type one letter here__", ws_7v, 1);
        let ws_8 = "Custom CSS:";
        let ws_8v = await createBlock(ws_8, secHeaderUID, 5);
        await createBlock("```css\nplace any custom css in this code block```", ws_8v, 1);
        await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: newUid } });

        pullBlock = headerUID;
    }
    await window.roamAlphaAPI.data.removePullWatch(
        "[:block/children :block/uid :block/string {:block/children ...}]",
        `[:block/uid "${pullBlock}"]`,
        pullFunction);
    await window.roamAlphaAPI.data.addPullWatch(
        "[:block/children :block/uid :block/string {:block/children ...}]",
        `[:block/uid "${pullBlock}"]`,
        pullFunction);
}

async function checkWorkspaces(before, after) {
    /* // experimenting only at the minute
    if (before != undefined && before != null) {
        if (before[":block/children"].length > 0) {
            for (var i = 0; i < before[":block/children"].length; i++) {
                var wsName = before[":block/children"][i][":block/string"];
                window.roamAlphaAPI.ui.commandPalette.removeCommand({
                    label: 'Open Workspace: '+wsName+''
                });
            }
        }
    } */
    let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);
    var results = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid :block/order {:block/children ...} ]) :where [?page :block/uid "${pageUID}"] ]`);
    if (results[0][0].hasOwnProperty("children") && results[0][0]?.children.length > 0) {
        for (var i = 0; i < results[0][0].children.length; i++) {
            if (results[0][0].children[i].string.startsWith("Workspace Definitions:")) {
                var definitions = results[0][0]?.children[i];
            }
        }
    }
    definitions.children = await sortObjectsByOrder(definitions.children); // sort by order

    // destroy the rm.topbar div
    if (document.getElementById("workspaces")) {
        document.getElementById("workspaces").remove();
    }

    // create the rm.topbar div
    if (definitions?.children.length > 1) {
        for (var i = 0; i < definitions.children.length; i++) {
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
                /*
                var selectString = "<select name=\"workspacesSelectMenu\" id=\"workspacesSelectMenu\"><option value=\"null\">Select...</option>";
                for (var j = 0; j < definitions.children.length; j++) {
                    selectString += "<option value=\"" + definitions.children[j].string + "\">" + definitions.children[j].string + "</option>";
                }
                selectString += "<option value=\"clearWorkspacesCSS\">Clear CSS</option></select>";
                span.innerHTML = selectString;
                */
                div.append(span);
                divParent.append(div);

                div.addEventListener('click', function () {
                    workspaceSelect();
                });

                if (document.querySelector(".rm-open-left-sidebar-btn")) { // the sidebar is closed
                    await sleep(20);
                    if (document.querySelector("#todayTomorrow")) { // Yesterday Tomorrow extension also installed, so place this to right
                        let todayTomorrow = document.querySelector("#todayTomorrow");
                        todayTomorrow.after(divParent);
                    } else if (document.querySelector("span.bp3-button.bp3-minimal.bp3-icon-arrow-right.pointer.bp3-small.rm-electron-nav-forward-btn")) { // electron client needs separate css
                        let electronArrows = document.getElementsByClassName("rm-electron-nav-forward-btn")[0];
                        electronArrows.after(divParent);
                    } else {
                        let sidebarButton = document.querySelector(".rm-open-left-sidebar-btn");
                        sidebarButton.after(divParent);
                    }
                } else {
                    await sleep(20);
                    if (document.querySelector("#todayTomorrow")) { // Yesterday Tomorrow extension also installed, so place this to right
                        let todayTomorrow = document.querySelector("#todayTomorrow");
                        todayTomorrow.after(divParent);
                    } else if (document.querySelector("span.bp3-button.bp3-minimal.bp3-icon-arrow-right.pointer.bp3-small.rm-electron-nav-forward-btn")) { // electron client needs separate css
                        let electronArrows = document.getElementsByClassName("rm-electron-nav-forward-btn")[0];
                        electronArrows.after(divParent);
                    } else {
                        var topBarContent = document.querySelector("#app > div > div > div.flex-h-box > div.roam-main > div.rm-files-dropzone > div");
                        var topBarRow = topBarContent.childNodes[1];
                        topBarRow.parentNode.insertBefore(divParent, topBarRow);
                    }
                }
                /*
                document.getElementById("workspacesSelectMenu").addEventListener("change", () => {
                    if (document.getElementById("workspacesSelectMenu").value != "null") {
                        gotoWorkspace(document.getElementById("workspacesSelectMenu").value);
                    }
                });
                */
            }
            /* // experimenting only at the minute
            var wsName = definitions.children[i].string;
            console.info(wsName);
            await window.roamAlphaAPI.ui.commandPalette.addCommand({
                label: "Open Workspace: "+wsName+"",
                callback: () => gotoWorkspace(wsName)
            }); */
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
            //span.innerHTML = definitions.children[0].string;
            div.append(span);
            divParent.append(div);

            var topBarContent = document.querySelector("#app > div > div > div.flex-h-box > div.roam-main > div.rm-files-dropzone > div");
            var topBarRow = topBarContent.childNodes[1];

            if (topBarContent && topBarRow) {
                topBarRow.parentNode.insertBefore(divParent, topBarRow);
            }
            div.addEventListener('click', function () {
                gotoWorkspace(definitions.children[0].string);
            });
            if (document.querySelector(".rm-open-left-sidebar-btn")) { // the sidebar is closed
                await sleep(20);
                if (document.querySelector("#todayTomorrow")) { // Yesterday Tomorrow extension also installed, so place this to right
                    let todayTomorrow = document.querySelector("#todayTomorrow");
                    todayTomorrow.after(divParent);
                } else if (document.querySelector("span.bp3-button.bp3-minimal.bp3-icon-arrow-right.pointer.bp3-small.rm-electron-nav-forward-btn")) { // electron client needs separate css
                    let electronArrows = document.getElementsByClassName("rm-electron-nav-forward-btn")[0];
                    electronArrows.after(divParent);
                } else {
                    let sidebarButton = document.querySelector(".rm-open-left-sidebar-btn");
                    sidebarButton.after(divParent);
                }
            } else {
                await sleep(20);
                if (document.querySelector("#todayTomorrow")) { // Yesterday Tomorrow extension also installed, so place this to right
                    let todayTomorrow = document.querySelector("#todayTomorrow");
                    todayTomorrow.after(divParent);
                } else if (document.querySelector("span.bp3-button.bp3-minimal.bp3-icon-arrow-right.pointer.bp3-small.rm-electron-nav-forward-btn")) { // electron client needs separate css
                    let electronArrows = document.getElementsByClassName("rm-electron-nav-forward-btn")[0];
                    electronArrows.after(divParent);
                } else {
                    var topBarContent = document.querySelector("#app > div > div > div.flex-h-box > div.roam-main > div.rm-files-dropzone > div");
                    var topBarRow = topBarContent.childNodes[1];
                    topBarRow.parentNode.insertBefore(divParent, topBarRow);
                }
            }
        }
    }
    console.info("Workspace definitions updated");
}

async function workspaceSelect() {
    let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);
    var results = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid :block/order {:block/children ...} ]) :where [?page :block/uid "${pageUID}"] ]`);
    if (results[0][0].hasOwnProperty("children") && results[0][0]?.children.length > 0) {
        for (var i = 0; i < results[0][0].children.length; i++) {
            if (results[0][0].children[i].string.startsWith("Workspace Definitions:")) {
                var definitions = results[0][0]?.children[i];
            }
        }
    }
    definitions.children = await sortObjectsByOrder(definitions.children); // sort by order
    console.info(definitions.children);
    var selectString = "<select><option value=\"\">Select</option>";
    for (var j = 0; j < definitions.children.length; j++) {
        selectString += "<option value=\"" + definitions.children[j].string + "\">" + definitions.children[j].string + "</option>";
    }
    selectString += "</select>";
    iziToast.question({
        theme: 'light',
        color: 'black',
        layout: 2,
        drag: false,
        timeout: false,
        close: false,
        overlay: true,
        title: 'Workspaces',
        message: 'Which workspace do you want to open?',
        position: 'center',
        inputs: [
            [selectString, 'change', function (instance, toast, select, e) { }]
        ],
        buttons: [
            ['<button><b>Confirm</b></button>', function (instance, toast, button, e, inputs) {
                gotoWorkspace(inputs[0].options[inputs[0].selectedIndex].value);
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
            }, false], // true to focus
            [
                "<button>Cancel</button>",
                function (instance, toast, button, e) {
                    instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                },
            ],
        ]
    });
}

async function getKBShortcuts() {
    window.removeEventListener('keydown', boundKEH);
    while (kbDefinitions.length) {
        kbDefinitions.pop();
    }
    let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);
    let results = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${pageUID}"]  ]`);

    if (results[0][0]?.children.length > 0) {
        for (var i = 0; i < results[0][0].children.length; i++) {
            if (results[0][0].children[i].string.startsWith("Workspace Definitions:")) {
                for (var j = 0; j < results[0][0].children[i]?.children.length; j++) {
                    for (var k = 0; k < results[0][0].children[i].children[j].children.length; k++) {
                        if (results[0][0]?.children[i].children[j].children[k].string == "Keyboard Shortcut:") {
                            kbDefinitions.push({ "name": results[0][0].children[i].children[j].string, "kbshortcut": results[0][0].children[i].children[j].children[k].children[0].string });
                        }
                    }
                }
            }
        }
    }

    keyEventHandler = function (kbDefinitions, e) {
        let eventKey = e.code;
        let eventShift = e.shiftKey;
        let eventAlt = e.altKey;
        for (var i = 0; i < kbDefinitions.length; i++) {
            let kbshortcutKey = "Key" + kbDefinitions[i].kbshortcut.toUpperCase();
            if (eventKey == kbshortcutKey && eventShift && eventAlt) {
                gotoWorkspace(kbDefinitions[i].name);
            }
        }
    }
    boundKEH = keyEventHandler.bind(null, kbDefinitions);
    window.addEventListener('keydown', boundKEH);
    console.info("Workspace keyboard Shortcuts updated");
}

async function createWorkspace(autosaved, autoLabel, update) {
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
            thisPage = "DNP";
        }
    }
    var pageName = undefined;
    var pageFilters = undefined;
    if (thisPage != "DNP") {
        pageName = await window.roamAlphaAPI.q(`[:find ?title :where [?b :block/uid "${thisPage}"] [?b :node/title ?title]]`);
        var pageFiltersTemp = await window.roamAlphaAPI.ui.filters.getPageFilters({ "page": { "uid": thisPage } });
        if (pageFiltersTemp.includes.length > 0 || pageFiltersTemp.removes.length > 0) {
            pageFilters = pageFiltersTemp;
        }
    }

    var RSwindows = await window.roamAlphaAPI.ui.rightSidebar.getWindows();
    if (RSwindows) {
        var RSWList = [];
        for (var i = 0; i < RSwindows.length; i++) {
            if (RSwindows[i]['type'] == "block") {
                let RSWFilters = await window.roamAlphaAPI.ui.filters.getSidebarWindowFilters({ "window": { "block-uid": RSwindows[i]['block-uid'], "type": RSwindows[i]['type'] } });
                RSWList.push({ "order": RSwindows[i]['order'], "type": RSwindows[i]['type'], "uid": RSwindows[i]['block-uid'], "collapsed": RSwindows[i]['collapsed?'], "filters": JSON.stringify(RSWFilters) });
            } else if (RSwindows[i].type == "mentions") {
                let RSWFilters = await window.roamAlphaAPI.ui.filters.getSidebarWindowFilters({ "window": { "block-uid": RSwindows[i]['page-uid'], "type": RSwindows[i]['type'] } });
                RSWList.push({ "order": RSwindows[i]['order'], "type": RSwindows[i]['type'], "uid": RSwindows[i]['page-uid'], "collapsed": RSwindows[i]['collapsed?'], "filters": JSON.stringify(RSWFilters) });
            } else { // outline or graph
                let RSWFilters = await window.roamAlphaAPI.ui.filters.getSidebarWindowFilters({ "window": { "block-uid": RSwindows[i]['page-uid'], "type": RSwindows[i]['type'] } });
                RSWList.push({ "order": RSwindows[i]['order'], "type": RSwindows[i]['type'], "uid": RSwindows[i]['page-uid'], "collapsed": RSwindows[i]['collapsed?'], "filters": JSON.stringify(RSWFilters) });
            }
        }
    }

    // get Workspaces configuration page and find the spot to write new config 
    let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);
    let results = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${pageUID}"] ]`);
    if (results[0][0]?.children.length > 0) {
        for (var i = 0; i < results[0][0]?.children.length; i++) {
            if (results[0][0]?.children[i].string.startsWith("Workspace Definitions:")) {
                var definitions = results[0][0]?.children[i];
            }
        }
    }

    if (update) {
        var selectString = "<select><option value=\"\">Select</option>";
        for (var j = 0; j < definitions.children.length; j++) {
            if (!definitions.children[j].string.startsWith("* ")) {
                selectString += "<option value=\"" + definitions.children[j].uid + "\">" + definitions.children[j].string + "</option>";
            }
        }
        selectString += "</select>";
        iziToast.question({
            theme: 'light',
            color: 'black',
            layout: 2,
            drag: false,
            timeout: false,
            close: false,
            overlay: true,
            title: 'Workspaces',
            message: 'Which workspace do you want to update?',
            position: 'center',
            inputs: [
                [selectString, 'change', function (instance, toast, select, e) { }]
            ],
            buttons: [
                ['<button><b>Confirm</b></button>', function (instance, toast, button, e, inputs) {
                    updateWS(inputs[0].options[inputs[0].selectedIndex].value);
                    instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                }, false], // true to focus
                [
                    "<button>Cancel</button>",
                    function (instance, toast, button, e) {
                        instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                    },
                ],
            ]
        });
    } else if (autosaved) {
        updateAutoWS(autoLabel);
    } else {
        iziToast.question({
            theme: 'light',
            color: 'black',
            layout: 2,
            drag: false,
            timeout: false,
            close: false,
            overlay: true,
            displayMode: 2,
            id: "question",
            title: "Workspaces",
            message: "What do you want to call this Workspace? What key (in addition to ALT-SHIFT) will trigger it?",
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
                    false,
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
    }

    async function writeNewWS(val, valKb) {
        // write new workspace definition to Workspaces configuration page
        let parentUID = definitions.uid;
        var order;
        if (definitions.hasOwnProperty("children")) {
            order = 1 + (definitions.children.length);
        } else {
            order = 1;
        }
        let secHeaderUID = await createBlock(val, parentUID, order);
        let ws_3 = "Left Sidebar:";
        let ws_3v = await createBlock(ws_3, secHeaderUID, 0);
        await createBlock(leftSidebarState, ws_3v, 1);
        let ws_4 = "Right Sidebar:";
        let ws_4v = await createBlock(ws_4, secHeaderUID, 1);
        await createBlock(rightSidebarState, ws_4v, 1);
        let ws_5 = "Main Content:";
        let ws_5v = await createBlock(ws_5, secHeaderUID, 2);
        if (pageName != undefined && pageName.length > 0) {
            await createBlock("[[" + pageName + "]]", ws_5v, 1);
            if (pageFilters != undefined) {
                await createBlock(JSON.stringify(pageFilters), ws_5v, 2);
            }
        } else {
            await createBlock(thisPage, ws_5v, 1);
        }
        let ws_6 = "Right Sidebar Content:";
        let ws_6v = await createBlock(ws_6, secHeaderUID, 3);
        if (RSWList.length > 0) {
            for (var i = 0; i < RSWList.length; i++) {
                if (RSWList[i].type == "outline") {
                    var pageName1 = await window.roamAlphaAPI.q(`[:find ?title :where [?b :block/uid "${RSWList[i].uid}"] [?b :node/title ?title]]`);
                    let RSWFdef = await createBlock("[[" + pageName1 + "]]," + RSWList[i].type + "," + RSWList[i].collapsed + "", ws_6v, RSWList[i].order);
                    await createBlock(RSWList[i].filters, RSWFdef, 1);
                } else {
                    let RSWFdef = await createBlock("((" + RSWList[i].uid + "))," + RSWList[i].type + "," + RSWList[i].collapsed + "", ws_6v, RSWList[i].order);
                    await createBlock(RSWList[i].filters, RSWFdef, 1);
                }
            }
        }
        let ws_7 = "Keyboard Shortcut:";
        let ws_7v = await createBlock(ws_7, secHeaderUID, 4);
        await createBlock(valKb, ws_7v, 1);
        let ws_8 = "Custom CSS:";
        let ws_8v = await createBlock(ws_8, secHeaderUID, 5);
        await createBlock("```css\nplace any custom css in this code block```", ws_8v, 1);
    }

    async function updateWS(secHeaderUID) {
        console.info("Updating workspace");
        // update workspace definition to Workspaces configuration page
        var order;

        if (definitions.hasOwnProperty("children")) {
            order = 1 + (definitions.children.length);
            for (var i = 0; i < definitions.children.length; i++) {
                if (definitions.children[i].uid == secHeaderUID) {
                    if (definitions.children[i].hasOwnProperty("children")) {
                        for (var j = 0; j < definitions.children[i].children.length; j++) {
                            window.roamAlphaAPI.deleteBlock({ "block": { "uid": definitions.children[i].children[j].uid } })
                        }
                    }
                }
            }
        } else {
            order = 1;
        }

        let ws_3 = "Left Sidebar:";
        let ws_3v = await createBlock(ws_3, secHeaderUID, 0);
        await createBlock(leftSidebarState, ws_3v, 1);
        let ws_4 = "Right Sidebar:";
        let ws_4v = await createBlock(ws_4, secHeaderUID, 1);
        await createBlock(rightSidebarState, ws_4v, 1);
        let ws_5 = "Main Content:";
        let ws_5v = await createBlock(ws_5, secHeaderUID, 2);
        if (pageName != undefined && pageName.length > 0) {
            await createBlock("[[" + pageName + "]]", ws_5v, 1);
            if (pageFilters != undefined) {
                await createBlock(JSON.stringify(pageFilters), ws_5v, 2);
            }
        } else {
            await createBlock(thisPage, ws_5v, 1);
        }
        let ws_6 = "Right Sidebar Content:";
        let ws_6v = await createBlock(ws_6, secHeaderUID, 3);
        if (RSWList.length > 0) {
            for (var i = 0; i < RSWList.length; i++) {
                if (RSWList[i].type == "outline") {
                    var pageName1 = await window.roamAlphaAPI.q(`[:find ?title :where [?b :block/uid "${RSWList[i].uid}"] [?b :node/title ?title]]`);
                    let RSWFdef = await createBlock("[[" + pageName1 + "]]," + RSWList[i].type + "," + RSWList[i].collapsed + "", ws_6v, RSWList[i].order);
                    await createBlock(RSWList[i].filters, RSWFdef, 1);
                } else {
                    let RSWFdef = await createBlock("((" + RSWList[i].uid + "))," + RSWList[i].type + "," + RSWList[i].collapsed + "", ws_6v, RSWList[i].order);
                    await createBlock(RSWList[i].filters, RSWFdef, 1);
                }
            }
        }
        let ws_7 = "Keyboard Shortcut:";
        let ws_7v = await createBlock(ws_7, secHeaderUID, 4);
        await createBlock("", ws_7v, 1);
    }

    async function updateAutoWS(autoLabel) {
        var secHeaderUID = undefined;
        console.info("Autosaving workspace");
        // write or update autosave workspace definition to Workspaces configuration page
        let parentUID = definitions.uid;
        var order;
        var autosaveLabel = "* " + autoLabel.toString();

        if (definitions.hasOwnProperty("children")) {
            order = 1 + (definitions.children.length);
            for (var i = 0; i < definitions.children.length; i++) {
                if (definitions.children[i].string == autosaveLabel) {
                    secHeaderUID = definitions.children[i].uid;
                    if (definitions.children[i].hasOwnProperty("children")) {
                        for (var j = 0; j < definitions.children[i].children.length; j++) {
                            window.roamAlphaAPI.deleteBlock({ "block": { "uid": definitions.children[i].children[j].uid } })
                        }
                    }
                }
            }
        } else {
            order = 1;
        }

        if (secHeaderUID == undefined) {
            secHeaderUID = await createBlock(autosaveLabel, parentUID, order);
        }
        let ws_3 = "Left Sidebar:";
        let ws_3v = await createBlock(ws_3, secHeaderUID, 0);
        await createBlock(leftSidebarState, ws_3v, 1);
        let ws_4 = "Right Sidebar:";
        let ws_4v = await createBlock(ws_4, secHeaderUID, 1);
        await createBlock(rightSidebarState, ws_4v, 1);
        let ws_5 = "Main Content:";
        let ws_5v = await createBlock(ws_5, secHeaderUID, 2);
        if (pageName != undefined && pageName.length > 0) {
            await createBlock("[[" + pageName + "]]", ws_5v, 1);
            if (pageFilters != undefined) {
                await createBlock(JSON.stringify(pageFilters), ws_5v, 2);
            }
        } else {
            await createBlock(thisPage, ws_5v, 1);
        }
        let ws_6 = "Right Sidebar Content:";
        let ws_6v = await createBlock(ws_6, secHeaderUID, 3);
        if (RSWList.length > 0) {
            for (var i = 0; i < RSWList.length; i++) {
                if (RSWList[i].type == "outline") {
                    var pageName1 = await window.roamAlphaAPI.q(`[:find ?title :where [?b :block/uid "${RSWList[i].uid}"] [?b :node/title ?title]]`);
                    let RSWFdef = await createBlock("[[" + pageName1 + "]]," + RSWList[i].type + "," + RSWList[i].collapsed + "", ws_6v, RSWList[i].order);
                    await createBlock(RSWList[i].filters, RSWFdef, 1);
                } else {
                    let RSWFdef = await createBlock("((" + RSWList[i].uid + "))," + RSWList[i].type + "," + RSWList[i].collapsed + "", ws_6v, RSWList[i].order);
                    await createBlock(RSWList[i].filters, RSWFdef, 1);
                }
            }
        }
        let ws_7 = "Keyboard Shortcut:";
        let ws_7v = await createBlock(ws_7, secHeaderUID, 4);
        await createBlock("", ws_7v, 1);
    }
}

async function gotoWorkspace(workspace) {
    if (workspace == "clearWorkspacesCSS") { // remove custom css
        clearWorkspaceCSS();
    } else {
        let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);
        let q = `[:find (pull ?page [:node/title :block/string :block/uid :block/order {:block/children ...} ]) :where [?page :block/uid "${pageUID}"]  ]`;
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
        var mainFilters = undefined;
        var rightSidebarContent = undefined;
        var workspaceCSS = undefined;

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
                        if (thisDefinition.children[i].children.length > 1) {
                            mainFilters = thisDefinition.children[i]?.children[1]?.string;
                        }
                    }
                } else if (thisDefinition.children[i].string.startsWith("Right Sidebar Content:")) {
                    if (thisDefinition.children[i].hasOwnProperty('children')) {
                        rightSidebarContent = thisDefinition.children[i]?.children;
                    }
                } else if (thisDefinition.children[i].string.startsWith("Custom CSS:")) {
                    if (thisDefinition.children[i].hasOwnProperty('children')) {
                        if (thisDefinition.children[i].children[0].string.length > 0) {
                            if (thisDefinition.children[i].children[0].string.startsWith("```css")) { // this is a CSS code block
                                workspaceCSS = thisDefinition.children[i].children[0].string.substring(6).slice(0, -3);
                            } else if (thisDefinition.children[i].children[0].string.startsWith("((")) { // this is a block references
                                var blockRef = thisDefinition.children[i].children[0].string.substring(2).slice(0, -2);;
                                var cssBlock = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${blockRef}"] ]`);
                                cssBlock = cssBlock[0][0].string;
                                workspaceCSS = cssBlock.substring(6).slice(0, -3);
                            }
                        }
                    }
                }
            }
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
            if (mainString.trim() == "DNP") {
                var today = new Date();
                var dd = String(today.getDate()).padStart(2, '0');
                var mm = String(today.getMonth() + 1).padStart(2, '0');
                var yyyy = today.getFullYear();
                var dateUID = mm + '-' + dd + '-' + yyyy;
                await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: dateUID } });
                if (mainFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageFilters({ "page": { "uid": dateUID }, "filters": JSON.parse(mainFilters) })
                }
            } else if (mainString.startsWith("((")) {
                mainString = mainString.slice(2, mainString.length);
                mainString = mainString.slice(0, -2);
                await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: mainString } });
                if (mainFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageFilters({ "page": { "uid": mainString }, "filters": JSON.parse(mainFilters) })
                }
            } else if (mainString.startsWith("[[")) { // this is a page name not a uid
                mainString = mainString.slice(2, mainString.length);
                mainString = mainString.slice(0, -2);
                let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "${mainString}"][?e :block/uid ?uid ] ]`);
                await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: pageUID[0][0].toString() } });
                if (mainFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageFilters({ "page": { "title": mainString }, "filters": JSON.parse(mainFilters) })
                }
            } else {
                await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: mainString } });
                if (mainFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageFilters({ "page": { "uid": mainString }, "filters": JSON.parse(mainFilters) })
                }
            }
        }

        // remove any pre-existing right sidebar content
        let rightSidebarWindows = await window.roamAlphaAPI.ui.rightSidebar.getWindows();
        if (rightSidebarWindows.length > 0) {
            for (var i = 0; i < rightSidebarWindows.length; i++) {
                window.roamAlphaAPI.ui.rightSidebar.removeWindow({ "window": { "type": rightSidebarWindows[i]['type'], "block-uid": rightSidebarWindows[i]['block-uid'] || rightSidebarWindows[i]['page-uid'] || rightSidebarWindows[i]['mentions-uid'] } }) // thanks to Matt Vogel and his Clear Right Sidebar extension as I couldn't quite get this to work as intended until looking at his code - used with permission
            }
        }

        // get and create new right sidebar content
        var descriptors = [];
        if (rightSidebarContent != undefined) {
            rightSidebarContent = await sortObjectsByOrder(rightSidebarContent);
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
                    if (rightSidebarContent[j].hasOwnProperty("children")) {
                        var thisNewFilters = rightSidebarContent[j].children[0].string.trim();
                    } else {
                        thisNewFilters = "false";
                    }

                    // trim and (( )) from blockrefs
                    if (thisNewUid.trim() == "DNP") { // today's DNP
                        var today = new Date();
                        var dd = String(today.getDate()).padStart(2, '0');
                        var mm = String(today.getMonth() + 1).padStart(2, '0');
                        var yyyy = today.getFullYear();
                        thisNewUid = mm + '-' + dd + '-' + yyyy;
                    } else if (thisNewUid.startsWith("DNP")) { // another DNP
                        var DNPString = thisNewUid.trim();
                        DNPString = DNPString.slice(3, DNPString.length);
                        if (DNPString.startsWith("+")) {
                            DNPString = DNPString.slice(1, DNPString.length);
                            var date = new Date(new Date().setDate(new Date().getDate() + parseInt(DNPString)));
                        } else {
                            DNPString = DNPString.slice(1, DNPString.length);
                            var date = new Date(new Date().setDate(new Date().getDate() - parseInt(DNPString)));
                        }
                        var dd = String(date.getDate()).padStart(2, '0');
                        var mm = String(date.getMonth() + 1).padStart(2, '0');
                        var yyyy = date.getFullYear();
                        thisNewUid = mm + '-' + dd + '-' + yyyy;
                        var titleDate = convertToRoamDate(thisNewUid);
                        var page = await window.roamAlphaAPI.q(`
                    [:find ?e
                        :where [?e :node/title "${titleDate}"]]`);
                        if (page.length < 1) { // create new page
                            await window.roamAlphaAPI.createPage({ page: { title: titleDate, uid: thisNewUid } });
                        }
                        var results = window.roamAlphaAPI.data.pull("[:block/children]", [":block/uid", thisNewUid]);
                        if (results == null) {
                            let newBlockUid = roamAlphaAPI.util.generateUID();
                            await window.roamAlphaAPI.createBlock({ location: { "parent-uid": thisNewUid, order: 0 }, block: { string: "", uid: newBlockUid } });
                        }
                    } else if (thisNewUid.startsWith("((")) {
                        thisNewUid = thisNewUid.slice(2, thisNewUid.length);
                        thisNewUid = thisNewUid.slice(0, -2);
                    } else if (thisNewUid.startsWith("[[")) { // this is a page name not a uid
                        thisNewUid = thisNewUid.slice(2, thisNewUid.length);
                        thisNewUid = thisNewUid.slice(0, -2);
                        var newPage = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "${thisNewUid}"][?e :block/uid ?uid ] ]`);
                        thisNewUid = newPage[0][0].toString();
                    }
                    // set right sidebar content
                    await window.roamAlphaAPI.ui.rightSidebar.addWindow({ window: { type: thisNewState, 'block-uid': thisNewUid, order: j } });
                    if (thisNewCollapsed == "true") {
                        await window.roamAlphaAPI.ui.rightSidebar.collapseWindow({ window: { type: thisNewState, 'block-uid': thisNewUid } });
                    }
                    if (thisNewFilters != "false") {
                        await window.roamAlphaAPI.ui.filters.setSidebarWindowFilters({ "window": { "block-uid": thisNewUid, "type": thisNewState }, "filters": JSON.parse(thisNewFilters) });
                    }
                }
            }
        }

        // set right sidebar open state
        if (rightSidebar != undefined) {
            if (rightSidebar == "closed") {
                await roamAlphaAPI.ui.rightSidebar.close();
            } else if (rightSidebar == "open") {
                await roamAlphaAPI.ui.rightSidebar.open();
            }
        }

        // remove and set any custom css
        var head = document.getElementsByTagName("head")[0];
        if (!document.getElementById("workspaces-css") && workspaceCSS != undefined && workspaceCSS != "place any custom css in this code block") { // no existing workspaces css is set and we need to set some
            var style = document.createElement("style");
            style.id = "workspaces-css";
            style.textContent = workspaceCSS;
            head.appendChild(style);
        } else { // found existing workspaces css so remove before setting new if relevant
            clearWorkspaceCSS();
            if (workspaceCSS != undefined && workspaceCSS != "place any custom css in this code block") {
                var newStyles = document.createElement("style");
                newStyles.id = "workspaces-css";
                newStyles.textContent = workspaceCSS;
                head.appendChild(newStyles);
            }
        }
    }
}

async function clearWorkspaceCSS() {
    var head = document.getElementsByTagName("head")[0];
    if (document.getElementById("workspaces-css")) {
        var oldStyles = document.getElementById("workspaces-css");
        head.removeChild(oldStyles);
    }
}

// helper functions
function pullFunction(before, after) {
    checkWorkspaces(before, after);
    getKBShortcuts();
}

function convertToRoamDate(dateString) {
    var parsedDate = dateString.split('-');
    var year = parsedDate[2];
    var month = Number(parsedDate[0]);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var monthName = months[month - 1];
    var day = Number(parsedDate[1]);
    let suffix = (day >= 4 && day <= 20) || (day >= 24 && day <= 30)
        ? "th"
        : ["st", "nd", "rd"][day % 10 - 1];
    return "" + monthName + " " + day + suffix + ", " + year + "";
}

async function sortObjectsByOrder(o) {
    return o.sort(function (a, b) {
        return a.order - b.order;
    });
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

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}