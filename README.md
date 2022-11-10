Create workspaces that you can automatically open with the click of a button.

**New:**
- David Vargas has merged his Sidebar roamjs.com extension into Workspaces. For details, see below. Thanks David!
- Update workspace definitions from a current state. Trigger via the Command Palette. This allows you to overwrite your workspace definition if you change how you want things laid out.

Define the open|close state of both sidebars, the main window content and the list of pages/blocks to open in the right sidebar if desired.

Create as many workspaces as you like. If you have only one, a button will appear on the Roam Research topbar that will open the workspace. If you have more than one, the button will turn into a dropdown select menu that opens the workspace when you change it.

This video walks through the basics:

https://www.loom.com/share/4ca0dd72a0fa4c46b012a59717e503d7

And this one walks through some new features:

https://www.loom.com/share/78bdf24f7478443b8431c52ec1f54472

Once installed, this extension creates a page in your graph called 'Workspaces configuration' and will automatically navigate there. A dummy workspace definition is supplied which demonstrates the required format.

Configuration is simple. Open the page you want in the main window, and whatever content you want in the right sidebar. Open or close the left and right sidebars as you prefer. Now, trigger the Command Palette command 'Create Workspace from current state' to create a new Workspace definition on your 'Workspaces configuration' page.

You can also configure things manually (although why would you?):
- In the block indented under Left Sidebar: type either open or closed. Same for Right Sidebar:.
- For the Main Window: option, place a page uid or [[page]] reference in the indented block.
- Place any [[pages]] or ((blocks)) you want in the right sidebar, with each one on a new row.
- Special cases: you could simply put DNP in the Main Window option and the workspace will automatically determine and open the correct daily note. You can use DNP+x or DNP-x in the Right Sidebar section, where x is an integer. This will open the page for tomorrow (DNP+1), yesterday (DNP-1) or even one year ago (DNP-365).

TODO:

1. ~~apply changes to workspace definitions without reloading the extension~~

2. ~~auto-save feature for current workspace~~

3. API to allow other extensions to interact with Workspaces

This extension has been merged with the previous RoamJS extension Sidebar! The following features have been brought over while the rest were made redundant due to Workspaces current featureset:
- `Autofocus` - Whenever you open the right sidebar, your cursor will autofocus on the first block. This behavior is toggleable from your Roam Depot Settings.
- `Auto Filter` - Roam natively supports includes/removes filters on pages. Those filters are not saved however when you add the page to the sidebar. Opening a page in the sidebar will persist the filters from the page. This behavior is toggleable from your Roam Depot Settings.
- `Go to Page` - Render a link button next to each page sidebar window to allow jumping directly to the page.
- `Expand/Collapse All` - Render a button on the top bar of the right sidebar that will expand/collapse all on click. This behavior is toggleable from your Roam Depot Settings (requires refresh).
- `Pinned open` - If your sidebar was open during your last Roam session, it will automatically open on load/reload.


