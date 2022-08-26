Create workspaces that you can automatically open with the click of a button.

Define the open|close state of both sidebars, the main window content and the list of pages/blocks to open in the right sidebar if desired.

Create as many workspaces as you like. If you have only one, a button will appear on the Roam Research topbar that will open the workspace. If you have more than one, the button will turn into a dropdown select menu that opens the workspace when you change it.

This video walks through the basics:

https://www.loom.com/share/4ca0dd72a0fa4c46b012a59717e503d7

Once installed, this extension creates a page in your graph called 'Workspaces configuration' and will automatically navigate there. A dummy workspace definition is supplied which demonstrates the required format.

Configuration is simple. Open the page you want in the main window, and whatever content you want in the right sidebar. Open or close the left and right sidebars as you prefer. Now, trigger the Command Palette command 'Create Workspace from current state' to create a new Workspace definition on your 'Workspaces configuration' page.

You can also configure things manually (although why would you?):
- In the block indented under Left Sidebar: type either open or closed. Same for Right Sidebar:.
- For the Main Window: option, place a page uid in the indented block.
- For any pages or blocks you want in the right sidebar, create a list of uids, with each one on a new row.

You will need to reload the extension to apply these changes, however a way to do this automatically is on the TODO list.

TODO:
1. apply changes to workspace definitions without reloading the extension
