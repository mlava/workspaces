import iziToast from "izitoast";
import initializeRoamJSSidebarFeatures from "./sidebar";
var pullBlock = undefined;
var auto = false;
var key;
let observer = undefined;
var checkInterval = 0;
var checkEveryMinutes, autoLabel, autoMenu;
let topbarMenuLayout;
var cpOnly = false;
var checkWSbefore = false;
var wsName = [];

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
                    description: "Frequency in minutes to save your workspace (1-30)",
                    action: { type: "input", placeholder: "5" },
                },
                {
                    id: "ws-layout",
                    name: "Topbar Menu Layout",
                    description: "Turn on to keep topbar dropdown, off to use modal",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setLayout(evt); }
                    },
                },
                {
                    id: "ws-cpOnly",
                    name: "Command Palette only",
                    description: "Turn on to remove icon from topbar and trigger only via Command Palette",
                    action: {
                        type: "switch",
                        onChange: (evt) => { setCpOnly(evt); }
                    },
                },
                {
                    id: "ws-save-sidebar",
                    name: "Save Right Sidebar state",
                    description: "Turn on to save and restore right sidebar open/close state on load",
                    action: { type: "switch" },
                },
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
                    action: {
                        type: "switch",
                        onChange: (evt) => { enableECACP(evt); }
                    },
                },
            ]
        };
        extensionAPI.settings.panel.create(config);

        extensionAPI.ui.commandPalette.addCommand({
            label: "Create Workspace from current state",
            callback: () => createWorkspace(false, false, false)
        });
        extensionAPI.ui.commandPalette.addCommand({
            label: "Update Workspace from current state",
            callback: () => createWorkspace(false, false, true)
        });
        extensionAPI.ui.commandPalette.addCommand({
            label: "Open Workspace select modal",
            callback: () => workspaceSelect()
        });

        if (extensionAPI.settings.get("ws-exp-col") == true) { // onload
            enableECACP(false, true);
        } else {
            extensionAPI.ui.commandPalette.addCommand({
                label: "Toggle expand/collapse all right sidebar content",
                callback: () => {
                    let RSContent = document.querySelectorAll(".rm-sidebar-window .window-headers");
                    if (RSContent[0].innerHTML.includes("rm-caret-open")) { // collapse all windows 
                        document.querySelectorAll(
                            ".rm-sidebar-window .window-headers .rm-caret-open"
                        )
                            .forEach((e) => e.click());
                    } else { // expand all windows
                        document.querySelectorAll(".rm-sidebar-window .window-headers .rm-caret-closed").forEach(
                            (e) => e.click()
                        );
                    }
                }
            });
        }

        function enableECACP(evt, state) {
            if ((evt != undefined && evt?.target?.checked == true) || state == true) {
                extensionAPI.ui.commandPalette.removeCommand({
                    label: "Toggle expand/collapse all right sidebar content",
                });
                // CP option for expand/collapse all from sidebar.js
                extensionAPI.ui.commandPalette.addCommand({
                    label: "Toggle expand/collapse all right sidebar content",
                    callback: () => {
                        let button = document.getElementsByClassName("bp3-button bp3-minimal");
                        for (var i = 0; i < button.length; i++) {
                            if (button[i]?.childNodes[0]?.className == "bp3-icon bp3-icon-collapse-all" || button[i]?.childNodes[0]?.className == "bp3-icon bp3-icon-expand-all") {
                                button[i].click();
                            }
                        }
                    }
                });
            } else {
                extensionAPI.ui.commandPalette.removeCommand({
                    label: "Toggle expand/collapse all right sidebar content",
                });
                extensionAPI.ui.commandPalette.addCommand({
                    label: "Toggle expand/collapse all right sidebar content",
                    callback: () => {
                        let RSContent = document.querySelectorAll(".rm-sidebar-window .window-headers");
                        if (RSContent[0].innerHTML.includes("rm-caret-open")) { // collapse all windows 
                            document.querySelectorAll(
                                ".rm-sidebar-window .window-headers .rm-caret-open"
                            )
                                .forEach((e) => e.click());
                        } else { // expand all windows
                            document.querySelectorAll(".rm-sidebar-window .window-headers .rm-caret-closed").forEach(
                                (e) => e.click()
                            );
                        }
                    }
                });
            }
        }

        // fix right sidebar top align with Roam Studio
        if (document.getElementById("roamstudio-css-system")) {
            if (!document.getElementById("workspaces-css-fix-roam-studio")) {
                var head = document.getElementsByTagName("head")[0];
                var style = document.createElement("style");
                style.id = "workspaces-css-fix-roam-studio";
                style.textContent = "#right-sidebar > .flex-h-box { padding-top: 7px !important; padding-bottom: 7px !important; }";
                head.appendChild(style);
            }
        } else {
            if (document.getElementById("workspaces-css-fix-roam-studio")) {
                var head = document.getElementsByTagName("head")[0];
                var cssStyles = document.getElementById("workspaces-css-fix-roam-studio");
                head.removeChild(cssStyles);
            }
        }

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

        if (extensionAPI.settings.get("ws-layout") == true) { // onload
            topbarMenuLayout = "dropdown";
        } else {
            topbarMenuLayout = "modal";
        }
        if (extensionAPI.settings.get("ws-cpOnly") == true) { // onload
            cpOnly = true;
        } else {
            cpOnly = false;
        }
        if (extensionAPI.settings.get("ws-auto") == true) { // onload
            auto = true;
            autoSave();
        }

        async function setAuto(evt) { // onchange
            if (evt.target.checked) {
                auto = true;
                autoSave();
            } else {
                auto = false;
                if (checkInterval > 0) clearInterval(checkInterval);
            }
        }
        async function setLayout(evt) { // onChange
            if (evt.target.checked) {
                topbarMenuLayout = "dropdown";
                checkWorkspaces();
            } else {
                topbarMenuLayout = "modal";
                checkWorkspaces();
            }
        }
        async function setCpOnly(evt) { // onChange
            if (evt.target.checked) {
                cpOnly = true;
                checkWorkspaces();
            } else {
                cpOnly = false;
                checkWorkspaces();
            }
        }

        async function autoSave() {
            if (extensionAPI.settings.get("ws-auto-time")) {
                const regex = /^[0-9]{1,2}$/m;
                if (regex.test(extensionAPI.settings.get("ws-auto-time"))) {
                    if (extensionAPI.settings.get("ws-auto-time") < 1 || extensionAPI.settings.get("ws-auto-time") > 30) {
                        key = "num";
                        sendConfigAlert(key);
                        checkEveryMinutes = 5;
                    } else {
                        checkEveryMinutes = parseInt(extensionAPI.settings.get("ws-auto-time"));
                    }
                } else {
                    key = "num";
                    sendConfigAlert(key);
                    checkEveryMinutes = 5;
                }
            } else {
                checkEveryMinutes = 5;
            }
            if (extensionAPI.settings.get("ws-auto-label")) {
                autoLabel = extensionAPI.settings.get("ws-auto-label");
            } else {
                autoLabel = "Autosave";
            }

            await createWorkspace(auto, autoLabel, autoMenu);
            try { if (checkInterval > 0) clearInterval(checkInterval) } catch (e) { }
            checkInterval = setInterval(async () => {
                await createWorkspace(auto, autoLabel/*, autoMenu*/)
            }, checkEveryMinutes * 60000);
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
                let string6 = "The final option allows you to define custom css to use for your workspace. Simply place custom css in the code block below the Custom CSS heading.";
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
                let ws_8 = "Custom CSS:";
                let ws_8v = await createBlock(ws_8, secHeaderUID, 4);
                await createBlock("```css\nplace any custom css in this code block```", ws_8v, 1);
                let ws_9 = "Zen Mode:";
                let ws_9v = await createBlock(ws_9, secHeaderUID, 5);
                await createBlock("off", ws_9v, 1);
                let ws_10 = "Extended Focus Mode:";
                let ws_10v = await createBlock(ws_10, secHeaderUID, 6);
                await createBlock("off", ws_10v, 1);
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
            if (before != undefined && before != null) {
                if (before[":block/children"].length > 0) {
                    if (before[":block/children"].length > after[":block/children"].length) { // a workspace has been removed
                        for (var i = 0; i < before[":block/children"].length; i++) {
                            var matched = false;
                            for (var j = 0; j < after[":block/children"].length; j++) {
                                if (before[":block/children"][i][":block/string"] == after[":block/children"][j][":block/string"]) {
                                    matched = true;
                                }
                            }
                            if (matched == false) {
                                var wsName1 = before[":block/children"][i][":block/string"];
                                extensionAPI.ui.commandPalette.removeCommand({
                                    label: 'Open Workspace: ' + wsName1 + ''
                                });
                            }
                        }
                    } else if (before[":block/children"].length < after[":block/children"].length) { //  a workspace has been added
                        for (var i = 0; i < after[":block/children"].length; i++) {
                            var matched = false;
                            for (var j = 0; j < before[":block/children"].length; j++) {
                                if (after[":block/children"][i][":block/string"] == before[":block/children"][j][":block/string"]) {
                                    matched = true;
                                }
                            }
                            if (matched == false) {
                                var wsName1 = after[":block/children"][i][":block/string"];
                                await extensionAPI.ui.commandPalette.addCommand({
                                    label: "Open Workspace: " + wsName1 + "",
                                    callback: () => gotoWorkspace(wsName1)
                                });
                            }
                        }
                    }
                }
            }

            let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "Workspaces configuration"][?e :block/uid ?uid ] ]`);
            var results = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid :block/order {:block/children ...} ]) :where [?page :block/uid "${pageUID}"] ]`);
            if (results[0][0].hasOwnProperty("children") && results[0][0]?.children.length > 0) {
                for (var i = 0; i < results[0][0].children.length; i++) {
                    if (results[0][0].children[i].string.startsWith("Workspace Definitions:")) {
                        var definitions = results[0][0]?.children[i];
                    }
                }
            }
            if (definitions.hasOwnProperty("children") && definitions.children.length > 1) {
                definitions.children = await sortObjectsByOrder(definitions.children); // sort by order
            }

            if (definitions.hasOwnProperty("children") && definitions?.children.length > 1 && checkWSbefore == false) { //onload
                definitions.children.forEach(child => {
                    const workspaceName = child.string.toString();
                    extensionAPI.ui.commandPalette.addCommand({
                        label: `Open Workspace: ${workspaceName}`,
                        callback: () => gotoWorkspace(workspaceName)
                    })
                });
            }
            checkWSbefore = true;

            // destroy the rm.topbar div
            if (document.getElementById("workspaces")) {
                document.getElementById("workspaces").remove();
            }

            // create the rm.topbar div & command palette commands
            if (definitions.hasOwnProperty("children") && definitions?.children.length > 1) {
                for (var i = 0; i < definitions.children.length; i++) {
                    if (!document.getElementById('workspaces') && !cpOnly) {
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

                        if (topbarMenuLayout == "dropdown") {
                            var selectString = "<select name=\"workspacesSelectMenu\" id=\"workspacesSelectMenu\"><option value=\"null\">Select...</option>";
                            for (var j = 0; j < definitions.children.length; j++) {
                                selectString += "<option value=\"" + definitions.children[j].string + "\">" + definitions.children[j].string + "</option>";
                            }
                            selectString += "<option value=\"clearWorkspacesCSS\">Clear CSS</option></select>";
                            span.innerHTML = selectString;
                        }

                        div.append(span);
                        divParent.append(div);

                        if (topbarMenuLayout == "modal") {
                            div.addEventListener('click', function () {
                                workspaceSelect();
                            });
                        }

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

                        if (topbarMenuLayout == "dropdown") {
                            document.getElementById("workspacesSelectMenu").addEventListener("change", () => {
                                if (document.getElementById("workspacesSelectMenu").value != "null") {
                                    gotoWorkspace(document.getElementById("workspacesSelectMenu").value);
                                }
                            });
                        }
                    }
                }
            } else if (definitions.hasOwnProperty("children") && definitions?.children.length == 1) {
                if (!document.getElementById('workspaces') && !cpOnly) {
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

        function pullFunction(before, after) {
            checkWorkspaces(before, after);
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
            if (document.getElementById("workspaces")) {
                document.getElementById("workspaces").remove();
            }
            if (checkInterval > 0) clearInterval(checkInterval);

            window.roamAlphaAPI.data.removePullWatch(
                "[:block/children :block/uid :block/string {:block/children ...}]",
                `[:block/uid "${pullBlock}"]`,
                pullFunction);
            observer.disconnect();
            clearWorkspaceCSS();
            if (document.getElementById("workspaces-css-fix-roam-studio")) {
                var head = document.getElementsByTagName("head")[0];
                var cssStyles = document.getElementById("workspaces-css-fix-roam-studio");
                head.removeChild(cssStyles);
            }
        }
    }
}

// Workspaces functions
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
    var selectString = "<select><option value=\"\">Select</option>";
    for (var j = 0; j < definitions.children.length; j++) {
        selectString += "<option value=\"" + definitions.children[j].string + "\">" + definitions.children[j].string + "</option>";
    }
    selectString += "<option value=\"clearWorkspacesCSS\">Clear CSS</option></select>";
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
    if (thisPage == undefined || thisPage == null) {
        var uri = window.location.href;
        const regex = /^https:\/\/roamresearch\.com\/.+\/(app|offline)\/\w+$/; //today's DNP
        if (uri.match(regex)) { // this is Daily Notes for today
            thisPage = "DNP";
        }
    }

    var pageName = undefined;
    var pageFilters = undefined;
    var pageRefFilters = undefined;
    if (thisPage != "DNP") {
        pageName = await window.roamAlphaAPI.q(`[:find ?title :where [?b :block/uid "${thisPage}"] [?b :node/title ?title]]`);
        var pageFiltersTemp = await window.roamAlphaAPI.ui.filters.getPageFilters({ "page": { "uid": thisPage } });
        if (pageFiltersTemp.includes.length > 0 || pageFiltersTemp.removes.length > 0) {
            pageFilters = pageFiltersTemp;
        }
        var pageRefFiltersTemp = await window.roamAlphaAPI.ui.filters.getPageLinkedRefsFilters({ "page": { "uid": thisPage } });
        if (pageRefFiltersTemp.includes.length > 0 || pageRefFiltersTemp.removes.length > 0) {
            pageRefFilters = pageRefFiltersTemp;
        }
    }

    var RSWList = [];
    var RSwindows = await window.roamAlphaAPI.ui.rightSidebar.getWindows();
    if (RSwindows) {
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
    const zenModeState = isZenMode() ? "on" : "off";
    const efmModeState = isExtendedFocusMode() ? "on" : "off";

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
            message: "What do you want to call this Workspace?",
            position: "center",
            inputs: [
                [
                    '<input type="text" placeholder="name">',
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
                        writeNewWS(inputs[0].value);
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

    async function writeNewWS(val) {
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
        if (thisPage == "DNP") {
            await createBlock("DNP", ws_5v, 1);
            if (pageFilters != undefined) {
                await createBlock(JSON.stringify(pageFilters), ws_5v, 2);
            }
            if (pageRefFilters != undefined) {
                await createBlock("Ref filters: " + JSON.stringify(pageRefFilters), ws_5v, 3);
            }
        } else if (pageName != undefined && pageName.length > 0) {
            await createBlock("[[" + pageName + "]]", ws_5v, 1);
            if (pageFilters != undefined) {
                await createBlock(JSON.stringify(pageFilters), ws_5v, 2);
            }
            if (pageRefFilters != undefined) {
                await createBlock("Ref filters: " + JSON.stringify(pageRefFilters), ws_5v, 3);
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
        let ws_8 = "Custom CSS:";
        let ws_8v = await createBlock(ws_8, secHeaderUID, 5);
        await createBlock("```css\nplace any custom css in this code block```", ws_8v, 1);
        let ws_9 = "Zen Mode:";
        let ws_9v = await createBlock(ws_9, secHeaderUID, 6);
        await createBlock(zenModeState, ws_9v, 1);
        let ws_10 = "Extended Focus Mode:";
        let ws_10v = await createBlock(ws_10, secHeaderUID, 7);
        await createBlock(efmModeState, ws_10v, 1);
    }

    async function updateWS(secHeaderUID) {
        console.info("Updating workspace");
        // update workspace definition to Workspaces configuration page
        var order;
        var RSUpdated = false;

        if (definitions.hasOwnProperty("children")) {
            order = 1 + (definitions.children.length);
            for (var i = 0; i < definitions.children.length; i++) {
                if (definitions.children[i].uid == secHeaderUID) {
                    if (definitions.children[i].hasOwnProperty("children")) {
                        for (var j = 0; j < definitions.children[i].children.length; j++) {
                            if (definitions.children[i].children[j].string == "Main Content:" && definitions.children[i].children[j].hasOwnProperty("children")) {
                                for (var k = 0; k < definitions.children[i].children[j].children.length; k++) {
                                    if (definitions.children[i].children[j].children[k].string.includes("DNP")) {
                                        thisPage = definitions.children[i].children[j].children[k].string;
                                    }
                                }
                            } else if (definitions.children[i].children[j].string == "Right Sidebar Content:" && definitions.children[i].children[j].hasOwnProperty("children")) {
                                RSUpdated = true;
                                // need to iterate through the RSWList and overwrite if not a DNP block, ensuring to add extras even if they didn't exist before
                                for (var k = 0; k < definitions.children[i].children[j].children.length; k++) {
                                    if (!definitions.children[i].children[j].children[k].string.includes("DNP")) {
                                        console.info(definitions.children[i].children[j].children[k].uid);
                                        if (RSWList.length > 0 && RSWList[k].type == "outline") {
                                            //var pageName1 = await window.roamAlphaAPI.q(`[:find ?title :where [?b :block/uid "${RSWList[i].uid}"] [?b :node/title ?title]]`);
                                            //let RSWFdef = await createBlock("[[" + pageName1 + "]]," + RSWList[i].type + "," + RSWList[i].collapsed + "", ws_6v, RSWList[i].order);
                                            //await createBlock(RSWList[i].filters, RSWFdef, 1);
                                        } else {
                                            //let RSWFdef = await createBlock("((" + RSWList[i].uid + "))," + RSWList[i].type + "," + RSWList[i].collapsed + "", ws_6v, RSWList[i].order);
                                            //await createBlock(RSWList[i].filters, RSWFdef, 1);
                                        }
                                    }
                                }
                            }
                            // need to figure out if I'm overwriting the whole definition in the above or deleting blocks using below and then writing a replacement
                            //window.roamAlphaAPI.deleteBlock({ "block": { "uid": definitions.children[i].children[j].uid } })
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
        if (thisPage.includes("DNP")) {
            await createBlock(thisPage, ws_5v, 1);
            if (pageFilters != undefined) {
                await createBlock(JSON.stringify(pageFilters), ws_5v, 2);
            }
            if (pageRefFilters != undefined) {
                await createBlock("Ref filters: " + JSON.stringify(pageRefFilters), ws_5v, 3);
            }
        } else if (pageName != undefined && pageName.length > 0) {
            await createBlock("[[" + pageName + "]]", ws_5v, 1);
            if (pageFilters != undefined) {
                await createBlock(JSON.stringify(pageFilters), ws_5v, 2);
            }
            if (pageRefFilters != undefined) {
                await createBlock("Ref filters: " + JSON.stringify(pageRefFilters), ws_5v, 3);
            }
        } else {
            await createBlock(thisPage, ws_5v, 1);
        }
        if (RSUpdated == false) {
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
        }
        let ws_8 = "Zen Mode:";
        let ws_8v = await createBlock(ws_8, secHeaderUID, 6);
        await createBlock(zenModeState, ws_8v, 1);
        let ws_9 = "Extended Focus Mode:";
        let ws_9v = await createBlock(ws_9, secHeaderUID, 7);
        await createBlock(efmModeState, ws_9v, 1);
    }

    async function updateAutoWS(autoLabel) {
        var secHeaderUID = undefined;
        var zenFound = false;
        var efmFound = false;

        console.info("Autosaving workspace");
        // write or update autosave workspace definition to Workspaces configuration page
        let parentUID = definitions.uid;
        var order;
        var autosaveLabel = "* " + autoLabel.toString();
        async function writeAutosaveDefinition(secHeaderUID) {
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
                if (pageRefFilters != undefined) {
                    await createBlock("Ref filters: " + JSON.stringify(pageRefFilters), ws_5v, 3);
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
            let ws_9 = "Zen Mode:";
            let ws_9v = await createBlock(ws_9, secHeaderUID, 6);
            await createBlock(zenModeState, ws_9v, 1);
            let ws_10 = "Extended Focus Mode:";
            let ws_10v = await createBlock(ws_10, secHeaderUID, 7);
            await createBlock(efmModeState, ws_10v, 1);
        }

        if (definitions.hasOwnProperty("children")) {
            order = 1 + (definitions.children.length);
            for (var i = 0; i < definitions.children.length; i++) {
                if (definitions.children[i].string == autosaveLabel) {
                    secHeaderUID = definitions.children[i].uid;
                    if (definitions.children[i].hasOwnProperty("children")) { // there is already an autosaved definition
                        for (var j = 0; j < definitions.children[i].children.length; j++) {
                            // check and update if needed - left sidebar
                            if (definitions.children[i].children[j].string.startsWith("Left Sidebar:")) {
                                if (definitions.children[i].children[j].hasOwnProperty("children")) {
                                    if (definitions.children[i].children[j].children[0].string != leftSidebarState) { // only update if different
                                        window.roamAlphaAPI.updateBlock({
                                            "block": {
                                                "uid": definitions.children[i].children[j].children[0].uid,
                                                "string": leftSidebarState
                                            }
                                        });
                                        console.info("Workspaces - autoupdated left sidebar state");
                                    }
                                }
                            }
                            // check and update if needed - right sidebar
                            if (definitions.children[i].children[j].string.startsWith("Right Sidebar:")) {
                                if (definitions.children[i].children[j].hasOwnProperty("children")) {
                                    if (definitions.children[i].children[j].children[0].string != rightSidebarState) { // only update if different
                                        window.roamAlphaAPI.updateBlock({
                                            "block": {
                                                "uid": definitions.children[i].children[j].children[0].uid,
                                                "string": rightSidebarState
                                            }
                                        });
                                        console.info("Workspaces - autoupdated right sidebar state");
                                    }
                                }
                            }
                            // check and update if needed - main content
                            if (definitions.children[i].children[j].string.startsWith("Main Content:")) {
                                var jsonPageFilters;
                                if (pageFilters == undefined) {
                                    jsonPageFilters = JSON.stringify({ "includes": [], "removes": [] });
                                } else {
                                    jsonPageFilters = JSON.stringify(pageFilters);
                                }
                                var jsonPageRefFilters;
                                if (pageRefFilters == undefined) {
                                    jsonPageRefFilters = JSON.stringify({ "includes": [], "removes": [] });
                                } else {
                                    jsonPageRefFilters = JSON.stringify(pageRefFilters);
                                }
                                if (definitions.children[i].children[j].hasOwnProperty("children")) {
                                    if (pageName != undefined && pageName.length > 0 && definitions.children[i].children[j].children[0].string != "[[" + pageName + "]]") { // only update if different
                                        window.roamAlphaAPI.updateBlock({
                                            "block": {
                                                "uid": definitions.children[i].children[j].children[0].uid,
                                                "string": "[[" + pageName + "]]"
                                            }
                                        });
                                        console.info("Workspaces - autoupdated main content state");
                                    } else if (definitions.children[i].children[j].children[0].string != "[[" + pageName + "]]") {
                                        window.roamAlphaAPI.updateBlock({
                                            "block": {
                                                "uid": definitions.children[i].children[j].children[0].uid,
                                                "string": pageName
                                            }
                                        });
                                    }
                                    if (definitions.children[i].children[j].children[0].hasOwnProperty("children")) {
                                        if (definitions.children[i].children[j].children[0].children.length < 2) {
                                            if (!definitions.children[i].children[j].children[0].children[0].string.startsWith('Ref filters:')) {
                                                window.roamAlphaAPI.updateBlock({
                                                    "block": {
                                                        "uid": definitions.children[i].children[j].children[0].children[0].uid,
                                                        "string": jsonPageFilters
                                                    }
                                                });
                                                await createBlock("Ref filters: " + jsonPageRefFilters, definitions.children[i].children[j].children[0].uid, 1);
                                            } else {
                                                window.roamAlphaAPI.updateBlock({
                                                    "block": {
                                                        "uid": definitions.children[i].children[j].children[0].children[0].uid,
                                                        "string": "Ref filters: " + jsonPageRefFilters
                                                    }
                                                });
                                                await createBlock(jsonPageFilters, definitions.children[i].children[j].children[0].uid, 0);
                                            }
                                        } else {
                                            for (var l = 0; l < definitions.children[i].children[j].children[0].children.length; l++) {
                                                if (!definitions.children[i].children[j].children[0].children[l].string.startsWith('Ref filters:')) {
                                                    window.roamAlphaAPI.updateBlock({
                                                        "block": {
                                                            "uid": definitions.children[i].children[j].children[0].children[l].uid,
                                                            "string": jsonPageFilters
                                                        }
                                                    });
                                                } else {
                                                    window.roamAlphaAPI.updateBlock({
                                                        "block": {
                                                            "uid": definitions.children[i].children[j].children[0].children[l].uid,
                                                            "string": "Ref filters: " + jsonPageRefFilters
                                                        }
                                                    });
                                                }
                                            }
                                        }
                                    } else {
                                        await createBlock(jsonPageFilters, definitions.children[i].children[j].children[0].uid, 0);
                                        await createBlock("Ref filters: " + jsonPageRefFilters, definitions.children[i].children[j].children[0].uid, 1);
                                    }
                                } else {
                                    if (pageName != undefined && pageName.length > 0) {
                                        let newPage = await createBlock("[[" + pageName + "]]", definitions.children[i].children[j].uid, 0);

                                        await createBlock(jsonPageFilters, newPage, 0);
                                        await createBlock("Ref filters: " + jsonPageRefFilters, newPage, 1);
                                    }
                                }
                            }
                            // check and update if needed - right sidebar content
                            if (definitions.children[i].children[j].string.startsWith("Right Sidebar Content:")) {
                                if (RSWList.length > 0) { 
                                    var diff, leng;
                                    // first handle mismatched list lengths (new or removed RSB items)
                                    if (definitions.children[i].children[j].hasOwnProperty("children") && definitions.children[i].children[j].children.length > RSWList.length) {
                                        for (var n = RSWList.length; n < definitions.children[i].children[j].children.length; n++) {
                                            await window.roamAlphaAPI.deleteBlock({ "block": { "uid": definitions.children[i].children[j].children[n].uid } })
                                        }
                                    }
                                    if (definitions.children[i].children[j].hasOwnProperty("children")) {
                                        diff = RSWList.length - definitions.children[i].children[j].children.length;
                                    } else {
                                        diff = RSWList.length;
                                    }
                                    console.info("diff: " + diff);
                                    if (diff != undefined) {
                                        leng = RSWList.length - diff;
                                    } else {
                                        leng = RSWList.length;
                                    }
                                    console.info("leng: " + leng);
                                    for (var k = 0; k < RSWList.length; k++) {
                                        var RSWFdef;
                                        if (RSWList[k].type == "outline") {
                                            var pageName1 = await window.roamAlphaAPI.q(`[:find ?title :where [?b :block/uid "${RSWList[k].uid}"] [?b :node/title ?title]]`);
                                            RSWFdef = "[[" + pageName1 + "]]," + RSWList[k].type + "," + RSWList[k].collapsed + "";
                                        } else {
                                            RSWFdef = "((" + RSWList[k].uid + "))," + RSWList[k].type + "," + RSWList[k].collapsed + "";
                                        }
                                        if (k < leng) {
                                            if (RSWFdef != definitions.children[i].children[j].children[k].string) {
                                                await window.roamAlphaAPI.updateBlock({
                                                    "block": {
                                                        "uid": definitions.children[i].children[j].children[k].uid,
                                                        "string": RSWFdef
                                                    }
                                                })
                                            }
                                            if (definitions.children[i].children[j].children[k].hasOwnProperty("children")) {
                                                if (definitions.children[i].children[j].children[k].children[0].string != RSWList[k].filters) {
                                                    await window.roamAlphaAPI.updateBlock({
                                                        "block": {
                                                            "uid": definitions.children[i].children[j].children[k].children[0].uid,
                                                            "string": RSWList[k].filters
                                                        }
                                                    })
                                                }
                                            } else {
                                                await createBlock(RSWList[k].filters, definitions.children[i].children[j].children[k].uid, 0);
                                            }
                                        } else {
                                            let newblock = await createBlock(RSWFdef, definitions.children[i].children[j].uid, k);
                                            await createBlock(RSWList[k].filters, newblock, 0);
                                        }
                                    }
                                } else {
                                    // delete any RSB items in definition as they've all been removed
                                    if (definitions.children[i].children[j].hasOwnProperty("children")) {
                                        for (var m = 0; m < definitions.children[i].children[j].children.length; m++) {
                                            await window.roamAlphaAPI.deleteBlock({ "block": { "uid": definitions.children[i].children[j].children[m].uid } })
                                        }
                                    }
                                }
                            }
                            if (definitions.children[i].children[j].string.startsWith("Zen Mode:")) {
                                zenFound = true;
                                if (definitions.children[i].children[j].hasOwnProperty("children")) {
                                    if (definitions.children[i].children[j].children[0].string != zenModeState) { // only update if different
                                        await window.roamAlphaAPI.updateBlock({
                                            "block": {
                                                "uid": definitions.children[i].children[j].children[0].uid,
                                                "string": zenModeState
                                            }
                                        });
                                    }
                                } else {
                                    await createBlock(zenModeState, definitions.children[i].children[j].uid, 0);
                                }
                            }
                            if (definitions.children[i].children[j].string.startsWith("Extended Focus Mode:")) {
                                efmFound = true;
                                if (definitions.children[i].children[j].hasOwnProperty("children")) {
                                    if (definitions.children[i].children[j].children[0].string != efmModeState) { // only update if different
                                        await window.roamAlphaAPI.updateBlock({
                                            "block": {
                                                "uid": definitions.children[i].children[j].children[0].uid,
                                                "string": efmModeState
                                            }
                                        });
                                    }
                                } else {
                                    await createBlock(efmModeState, definitions.children[i].children[j].uid, 0);
                                }
                            }
                        }
                        if (zenFound == false) {
                            let wsZen = await createBlock("Zen Mode:", secHeaderUID, 6);
                            await createBlock(zenModeState, wsZen, 1);
                        }
                        if (efmFound == false) {
                            let wsEFM = await createBlock("Extended Focus Mode:", secHeaderUID, 7);
                            await createBlock(efmModeState, wsEFM, 1);
                        }
                    }
                    // if autosave definition exists, no need to create a new one
                }
            }
            if (secHeaderUID == undefined) { // no existing autosave definition, so create one
                secHeaderUID = await createBlock(autosaveLabel, parentUID, order);
                await writeAutosaveDefinition(secHeaderUID);
            }
        } else {
            order = 1;
            if (secHeaderUID == undefined) {
                secHeaderUID = await createBlock(autosaveLabel, parentUID, order);
            }
            await writeAutosaveDefinition(secHeaderUID);
        }
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
        if (definitions.hasOwnProperty("children") && definitions?.children.length > 0) {
            for (var i = 0; i < definitions?.children.length; i++) {
                if (definitions?.children[i]?.string == workspace)
                    var thisDefinition = definitions?.children[i];
            }
        }

        var leftSidebar = undefined;
        var rightSidebar = undefined;
        var mainString = undefined;
        var mainFilters = undefined;
        var mainRefFilters = undefined;
        var rightSidebarContent = undefined;
        var workspaceCSS = undefined;
        var zenMode = undefined;
        var efmMode = undefined;

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
                            for (j = 1; j < thisDefinition.children[i].children.length; j++) {
                                if (thisDefinition.children[i]?.children[j]?.string.startsWith("Ref filters:")) {
                                    mainRefFilters = thisDefinition.children[i]?.children[j]?.string.replace("Ref filters: ", "");
                                } else {
                                    mainFilters = thisDefinition.children[i]?.children[j]?.string;
                                }
                            }
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
                } else if (thisDefinition.children[i].string.startsWith("Zen Mode:")) {
                    if (thisDefinition.children[i].hasOwnProperty("children") && thisDefinition.children[i].children[0]?.string) {
                        zenMode = thisDefinition.children[i].children[0].string.toLowerCase();
                    }
                } else if (thisDefinition.children[i].string.startsWith("Extended Focus Mode:")) {
                    if (thisDefinition.children[i].hasOwnProperty("children") && thisDefinition.children[i].children[0]?.string) {
                        efmMode = thisDefinition.children[i].children[0].string.toLowerCase();
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
                if (mainRefFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageLinkedRefsFilters({ "page": { "uid": dateUID }, "filters": JSON.parse(mainRefFilters) })
                }
            } else if (mainString.startsWith("((")) {
                mainString = mainString.slice(2, mainString.length);
                mainString = mainString.slice(0, -2);
                await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: mainString } });
                if (mainFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageFilters({ "page": { "uid": mainString }, "filters": JSON.parse(mainFilters) })
                }
                if (mainRefFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageLinkedRefsFilters({ "page": { "uid": mainString }, "filters": JSON.parse(mainRefFilters) })
                }
            } else if (mainString.startsWith("[[")) { // this is a page name not a uid
                mainString = mainString.slice(2, mainString.length);
                mainString = mainString.slice(0, -2);
                let pageUID = await window.roamAlphaAPI.q(`[:find ?uid :where [?e :node/title "${mainString}"][?e :block/uid ?uid ] ]`);
                await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: pageUID[0][0].toString() } });
                if (mainFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageFilters({ "page": { "title": mainString }, "filters": JSON.parse(mainFilters) })
                }
                if (mainRefFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageLinkedRefsFilters({ "page": { "title": mainString }, "filters": JSON.parse(mainRefFilters) })
                }
            } else {
                await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: mainString } });
                if (mainFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageFilters({ "page": { "uid": mainString }, "filters": JSON.parse(mainFilters) })
                }
                if (mainRefFilters != undefined) {
                    await window.roamAlphaAPI.ui.filters.setPageLinkedRefsFilters({ "page": { "uid": mainString }, "filters": JSON.parse(mainRefFilters) })
                }
            }
        }

        if (rightSidebarContent != undefined) {
            // remove any pre-existing right sidebar content
            let rightSidebarWindows = await window.roamAlphaAPI.ui.rightSidebar.getWindows().filter(w => !(w["pinned?"] || w["pinned-to-top?"]));
            if (rightSidebarWindows.length > 0) {
                for (var i = 0; i < rightSidebarWindows.length; i++) {
                    window.roamAlphaAPI.ui.rightSidebar.removeWindow({ "window": { "type": rightSidebarWindows[i]['type'], "block-uid": rightSidebarWindows[i]['block-uid'] || rightSidebarWindows[i]['page-uid'] || rightSidebarWindows[i]['mentions-uid'] } }) // thanks to Matt Vogel and his Clear Right Sidebar extension as I couldn't quite get this to work as intended until looking at his code - used with permission
                }
            }

            // get and create new right sidebar content
            var descriptors = [];
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
        const desiredZen = zenMode ? zenMode == "on" : false;
        await setZenMode(desiredZen);
        const desiredEFM = efmMode ? efmMode == "on" : false;
        await setExtendedFocusMode(desiredEFM);
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
function isZenMode() {
    const zenEl = document.querySelector(".rm-topbar-zen");
    const topbar = document.querySelector(".rm-topbar");
    const zenVisible = zenEl && getComputedStyle(zenEl).display !== "none";
    const topbarHidden = topbar && getComputedStyle(topbar).display === "none";
    return !!(zenVisible || topbarHidden);
}

function isExtendedFocusMode() {
    try {
        return !!window.extendedFocusMode?.isOn?.();
    } catch (e) {
        return false;
    }
}

async function setZenMode(targetOn) {
    const desired = !!targetOn;
    if (!document.querySelector(".rm-topbar") && !document.querySelector(".rm-topbar-zen")) {
        return;
    }
    if (isZenMode() === desired) return;

    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const sendToggle = async () => {
        const targets = [document, document.body, window].filter(Boolean);
        (document.body || document.documentElement)?.focus?.();
        const modInit = { key: "k", code: "KeyK", metaKey: isMac, ctrlKey: !isMac, bubbles: true, cancelable: true, composed: true, keyCode: 75, which: 75, repeat: false };
        targets.forEach(t => t.dispatchEvent(new KeyboardEvent("keydown", modInit)));
        targets.forEach(t => t.dispatchEvent(new KeyboardEvent("keyup", modInit)));
        await sleep(250);
        const zInit = { key: "z", code: "KeyZ", bubbles: true, cancelable: true, composed: true, keyCode: 90, which: 90, repeat: false };
        targets.forEach(t => t.dispatchEvent(new KeyboardEvent("keydown", zInit)));
        targets.forEach(t => t.dispatchEvent(new KeyboardEvent("keypress", zInit)));
        targets.forEach(t => t.dispatchEvent(new KeyboardEvent("keyup", zInit)));
    };

    await sendToggle();
    await sleep(350);
    if (isZenMode() !== desired) {
        await sendToggle();
        await sleep(350);
    }
}

async function setExtendedFocusMode(targetOn) {
    if (!window.extendedFocusMode || !window.extendedFocusMode.toggle) return;
    const desired = !!targetOn;
    try {
        if (isExtendedFocusMode() === desired) return;
        await window.extendedFocusMode.toggle(desired);
        await sleep(200);
    } catch (e) { }
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

function sendConfigAlert(key) {
    if (key == "num") {
        alert("Please enter a number in minutes between 1 and 30. Defaulting to 5.");
    }
}
