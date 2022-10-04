Create workspaces that you can automatically open with the click of a button.

**New:**
- From version 6, changes to workspace definitions are dynamically updated and you no longer need to reload the extension to make them work. This also applies to keyboard shortcut definitions which have previously been tricky to get working.
- First release featuring autosave functionality. Set an interval and this extension will automatically save your workspace at that interval, within your Workspace definitions. This makes it easy to go back if you suffered a crash or some other disaster.
- Custom CSS. Apply CSS styling when you open a workspace. You can either place the CSS in a CSS code block or use a block ref to any css block on your graph.

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
