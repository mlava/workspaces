export default {
    onload: ({ extensionAPI }) => {
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "JSON to Webhook",
            callback: () => jsonWH()
        });

        checkFirstRun();
        checkWorkspaces();
/*
        window.addEventListener('hashchange', async function (e) {
            var page = await window.roamAlphaAPI.q(`[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :node/title "Workspaces configuration"]  ]`);
            var hash = location.hash.split("/");
            if (page && hash[4] && hash[4] == page[0][0].uid) {
                ready(checkButton());
            }
        });

        function ready(fn) {
            if (document.readyState === "complete" || document.readyState === "interactive") {
                setTimeout(fn, 1);
            } else {
                document.addEventListener("DOMContentLoaded", fn);
            }
        }
        function checkButton() {
            const targetNode = document.getElementsByClassName("rm-xparser-default-Refresh Workspaces");
            if (targetNode) {
                targetNode[0].onclick = checkWorkspaces();
            }
        }
        */
    },
    onunload: () => {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'JSON to Webhook'
        });
        if (document.getElementById("workspaces")) {
            document.getElementById("workspaces").remove();
        }
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
        let string4 = "The first two options take either open or closed. The third (Main Content) requires the page uid (9 alphanumeric digit string at end of the url). The final takes a list of page or block uids, separated by a comma. These will each be opened in the right sidebar.";
        await createBlock(string4, newUid, 3);
        await createBlock("---", newUid, 4);
        let ws_1 = "Workspace Definitions:";
        let headerUID = await createBlock(ws_1, newUid, 5);
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
            } else { // TODO
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
        } else { // TODO
        }
    }


}

async function gotoWorkspace(workspace) {
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
    if (definitions?.children.length > 0) {
        for (var i = 0; i < definitions?.children.length; i++) {
            if (definitions?.children[i].string == workspace)
                var thisDefinition = definitions?.children[i];
        }
    }

    if (thisDefinition.children.length > 0) {
        for (var i = 0; i < thisDefinition.children.length; i++) {
            if (thisDefinition.children[i].string.startsWith("Left Sidebar:")) {
                var leftSidebar = thisDefinition.children[i].children[0].string;
            } else if (thisDefinition.children[i].string.startsWith("Right Sidebar:")) {
                var rightSidebar = thisDefinition.children[i].children[0].string;
            } else if (thisDefinition.children[i].string.startsWith("Main Content:")) {
                var mainString = thisDefinition.children[i].children[0].string;
            } else if (thisDefinition.children[i].string.startsWith("Right Sidebar Content:")) {
                var rightSidebarContent = thisDefinition.children[i].children[0]?.string;
            }
        }
    }

    if (leftSidebar == "closed") {
        await roamAlphaAPI.ui.leftSidebar.close();
    } else {
        await roamAlphaAPI.ui.leftSidebar.open();
    }
    if (rightSidebar == "closed") {
        await roamAlphaAPI.ui.rightSidebar.close();
    } else {
        await roamAlphaAPI.ui.rightSidebar.open();
    }
    if (mainString.startsWith("((")) {
        mainString = mainString.slice(2, mainString.length);
        mainString = mainString.slice(0, -2);
    }
    await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: mainString } });

    let rightSidebarWindows = await window.roamAlphaAPI.ui.rightSidebar.getWindows();
    if (rightSidebarWindows.length > 0) {
        for (var i = 0; i < rightSidebarWindows.length; i++) {
            window.roamAlphaAPI.ui.rightSidebar.removeWindow(
                {
                    "window":
                    {
                        "type": rightSidebarWindows[i]['type'],
                        "block-uid": rightSidebarWindows[i]['block-uid'] || rightSidebarWindows[i]['page-uid'] || rightSidebarWindows[i]['mentions-uid']
                    }
                }
            )
        }
    }

    rightSidebarContent = rightSidebarContent.split(",");
    for (var i = 0; i < rightSidebarContent.length; i++) {
        if (rightSidebarContent[i].startsWith("((")) {
            rightSidebarContent[i] = rightSidebarContent[i].slice(2, rightSidebarContent[i].length);
            rightSidebarContent[i] = rightSidebarContent[i].slice(0, -2);
        }
        await window.roamAlphaAPI.ui.rightSidebar.addWindow({ window: { type: 'outline', 'block-uid': rightSidebarContent[i], order: i } });
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