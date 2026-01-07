const createHTMLObserver = ({ callback, tag, className }) => {
  const getChildren = (d) =>
    Array.from(d.getElementsByClassName(className)).filter(
      (d) => d.nodeName === tag
    );
  getChildren(document).forEach(callback);

  const isNode = (d) =>
    d.nodeName === tag && Array.from(d.classList).includes(className);
  const getNodes = (nodes) =>
    Array.from(nodes)
      .filter((d) => isNode(d) || d.hasChildNodes())
      .flatMap((d) => (isNode(d) ? [d] : getChildren(d)));

  const htmlObserver = new MutationObserver((ms) => {
    ms.flatMap((m) => getNodes(m.addedNodes)).forEach(callback);
  });
  htmlObserver.observe(document.body, { childList: true, subtree: true });
  return htmlObserver;
};

const getWindowUid = (w) =>
  w.type === "outline"
    ? w["page-uid"]
    : w.type === "mentions"
      ? w["mentions-uid"]
      : w["block-uid"];

const MinimalIcon = ({
  toggleIcon,
  icon,
  onClick,
  onToggleClick,
  tooltipContent,
}) => {
  const [toggled, setToggled] = window.React.useState(false);
  return window.React.createElement(
    window.Blueprint.Core.Tooltip,
    { content: tooltipContent },
    window.React.createElement(window.Blueprint.Core.Button, {
      icon: toggled ? toggleIcon : icon,
      minimal: true,
      onClick: (e) => {
        if (toggleIcon) {
          setToggled(!toggled);
        }
        if (toggled) {
          onToggleClick(e);
        } else {
          onClick(e);
        }
      },
    })
  );
};

const initializeRoamJSSidebarFeatures = (extensionAPI) => {
  const unloads = new Set();
  const expColContainerSelector =
    "[data-roamjs-sidebar-expcolall-container]";
  const goToPageContainerSelector =
    "[data-roamjs-sidebar-link-container]";
  let goToPageRefreshAttempts = 0;
  let goToPageRefreshInFlight = false;

  const renderIcon = ({ p, ...props }) => {
    window.ReactDOM.render(window.React.createElement(MinimalIcon, props), p);
    unloads.add(() => {
      window.ReactDOM.unmountComponentAtNode(p);
      p.remove();
    });
  };
  const getRightSidebarTopbar = (rightSidebar) =>
    rightSidebar
      ?.querySelector(".bp3-icon-menu-open")
      ?.closest(".flex-h-box") ||
    document
      .querySelector("#right-sidebar .bp3-icon-menu-open")
      ?.closest(".flex-h-box") ||
    document.querySelector(".bp3-icon-menu-open")?.closest(".flex-h-box");

  const removeExpandCollapseIcon = (rightSidebar) => {
    const rightSidebarTopbar = getRightSidebarTopbar(rightSidebar);
    if (!rightSidebarTopbar) {
      return;
    }
    rightSidebarTopbar
      .querySelectorAll(expColContainerSelector)
      .forEach((el) => el.remove());
    rightSidebarTopbar.removeAttribute("data-roamjs-sidebar-expcolall");
  };

  const renderExpandCollapseIcon = (rightSidebar) => {
    if (!rightSidebar) {
      return;
    }
    const rightSidebarTopbar = getRightSidebarTopbar(rightSidebar);
    const isEnabled = extensionAPI.settings.get("ws-exp-col");
    if (!rightSidebarTopbar || !isEnabled) {
      if (rightSidebarTopbar && !isEnabled) {
        removeExpandCollapseIcon(rightSidebar);
      }
      return;
    }
    if (
      rightSidebarTopbar &&
      isEnabled &&
      !rightSidebarTopbar.hasAttribute("data-roamjs-sidebar-expcolall")
    ) {
      rightSidebarTopbar.setAttribute(
        "data-roamjs-sidebar-expcolall",
        "true"
      );
      const expandCollapseContainer = document.createElement("span");
      expandCollapseContainer.setAttribute(
        "data-roamjs-sidebar-expcolall-container",
        "true"
      );
      renderIcon({
        p: expandCollapseContainer,
        icon: "collapse-all",
        tooltipContent: "Expand/Collapse all windows in sidebar",
        toggleIcon: "expand-all",
        onClick: () => {
          rightSidebar
            .querySelectorAll(
              ".rm-sidebar-window .window-headers .rm-caret-open"
            )
            .forEach((e) => e.click());
          /* Roam has a bug for non block windows
        window.roamAlphaAPI.ui.rightSidebar.getWindows().forEach((w) => {
          window.roamAlphaAPI.ui.rightSidebar.collapseWindow({
            window: {
              type: w.type,
              "block-uid": getWindowUid(w),
            },
          });
        });
        */
        },
        onToggleClick: () => {
          rightSidebar.querySelectorAll(".rm-sidebar-window .window-headers .rm-caret-closed").forEach(
            (e) => e.click()
          );
          /* Roam has a bug for non block windows
        window.roamAlphaAPI.ui.rightSidebar.getWindows().forEach((w) => {
          window.roamAlphaAPI.ui.rightSidebar.expandWindow({
            window: {
              type: w.type,
              "block-uid": getWindowUid(w),
            },
          });
        });
        */
        },
      });
      const toggleButton = rightSidebarTopbar
        .querySelector(".bp3-icon-menu-open")
        ?.closest("button");
      if (toggleButton) {
        rightSidebarTopbar.insertBefore(expandCollapseContainer, toggleButton);
      } else {
        rightSidebarTopbar.appendChild(expandCollapseContainer);
      }
    }
  };

  const refreshExpandCollapseIcon = () => {
    renderExpandCollapseIcon(document.getElementById("right-sidebar"));
  };

  const scheduleGoToPageRefresh = (rightSidebar) => {
    if (goToPageRefreshInFlight) {
      return;
    }
    goToPageRefreshInFlight = true;
    goToPageRefreshAttempts = 0;
    const target = rightSidebar || document.getElementById("right-sidebar");
    if (!target) {
      goToPageRefreshInFlight = false;
      return;
    }
    const tryRefresh = () => {
      const setting = extensionAPI.settings.get("ws-go-to-page");
      if (setting === false || setting === "false") {
        goToPageRefreshInFlight = false;
        return true;
      }
      goToPageRefreshAttempts += 1;
      refreshGoToPageLinks();
      const hasIcons = !!document.querySelector(goToPageContainerSelector);
      if (hasIcons || goToPageRefreshAttempts >= 60) {
        goToPageRefreshInFlight = false;
        return true;
      }
      return false;
    };
    const scheduleLoop = () => {
      if (!tryRefresh()) {
        setTimeout(scheduleLoop, 200);
      }
    };
    scheduleLoop();
    const outlineObserver = new MutationObserver(() => {
      if (tryRefresh()) {
        outlineObserver.disconnect();
      }
    });
    outlineObserver.observe(target, { childList: true, subtree: true });
    unloads.add(() => outlineObserver.disconnect());
  };

  const rightSidebarCallback = (rightSidebar) => {
    if (!rightSidebar) {
      return;
    }
    renderExpandCollapseIcon(rightSidebar);
    setTimeout(() => {
      scheduleGoToPageRefresh(rightSidebar);
    }, 300);
    if (!rightSidebar.hasAttribute("data-roamjs-sidebar")) {
      rightSidebar.setAttribute("data-roamjs-sidebar", "true");

  const sidebarStyleObserver = new MutationObserver(() => {
    setTimeout(() => {
      const isOpen = localStorage.getItem("roamjs:sidebar:open");
      const isCloseIconPresent = !!document.querySelector(
        ".rm-topbar .bp3-icon-menu-closed"
      );
      const isOpenIconPresent = !!document.querySelector(
        ".bp3-icon-menu-open"
      );

      if (isOpen && isCloseIconPresent) {
        localStorage.removeItem("roamjs:sidebar:open");
      } else if (!isOpen && !isCloseIconPresent) {
        localStorage.setItem("roamjs:sidebar:open", "true");
        if (extensionAPI.settings.get("ws-auto-focus")) {
          const firstBlock =
            rightSidebar.getElementsByClassName("roam-block")[0];
          if (firstBlock) {
            const id = firstBlock.id;
            const blockUid = id.substring(id.length - 9, id.length);
            const restOfHTMLId = id.substring(0, id.length - 10);
            const windowId =
              restOfHTMLId.match(/^block-input-([a-zA-Z0-9_-]+)$/)?.[1] ||
              "";
            window.roamAlphaAPI.ui.setBlockFocusAndSelection({
              location: { "block-uid": blockUid, "window-id": windowId },
            });
          }
        }
      }

      if (isOpenIconPresent) {
        renderExpandCollapseIcon(rightSidebar);
        scheduleGoToPageRefresh(rightSidebar);
      }
    }, 50);
  });
      observer.disconnect();

      sidebarStyleObserver.observe(rightSidebar, { attributes: true });
      unloads.add(() => sidebarStyleObserver.disconnect());

      if (!!localStorage.getItem("roamjs:sidebar:open") && extensionAPI.settings.get("ws-save-sidebar")) {
        window.roamAlphaAPI.ui.rightSidebar.open();
      }
    }
  };
  const observer = new MutationObserver((mutatedRecords, obs) => {
    const [rightSidebar] = mutatedRecords.flatMap((r) =>
      (Array.from(r.addedNodes) || []).flatMap((n) =>
        n.id === "right-sidebar"
          ? [n]
          : n.querySelectorAll
            ? Array.from(n.querySelectorAll("#right-sidebar"))
            : []
      )
    );
    if (!!rightSidebar) {
      console.log(rightSidebar);
    }
    rightSidebarCallback(rightSidebar);
  });
  observer.observe(document.querySelector(".roam-body"), {
    childList: true,
    subtree: true,
  });
  rightSidebarCallback(document.getElementById("right-sidebar"));
  unloads.add(() => observer.disconnect());

  const sidebarWindowObserver = createHTMLObserver({
    tag: "DIV",
    className: "rm-sidebar-window",
    callback: (d) => {
      if (
        (extensionAPI.settings.get("ws-auto-filter") &&
          /^Outline of:/.test(d.firstElementChild.innerText)) || (extensionAPI.settings.get("ws-auto-pin"))
      ) {
        const order = Array.from(
          d.parentElement.parentElement.children
        ).findIndex((c) => c === d.parentElement);
        const sidebarWindow = window.roamAlphaAPI.ui.rightSidebar
          .getWindows()
          .find((w) => w.order === order);
        if (extensionAPI.settings.get("ws-auto-pin")) {
          if (sidebarWindow.type == "block") {
            window.roamAlphaAPI.ui.rightSidebar.pinWindow({
              window: {
                type: sidebarWindow.type,
                "block-uid": sidebarWindow["block-uid"],
              }
            });
          } else {
            window.roamAlphaAPI.ui.rightSidebar.pinWindow({
              window: {
                type: sidebarWindow.type,
                "block-uid": sidebarWindow["page-uid"],
              }
            });
          }
        }
        const filters = window.roamAlphaAPI.ui.filters.getPageFilters({
          page: { uid: getWindowUid(sidebarWindow) },
        });
        if (filters.includes.length || filters.removes.length) {
          window.roamAlphaAPI.ui.filters.setSidebarWindowFilters({
            window: {
              type: sidebarWindow.type,
              "block-uid": sidebarWindow["page-uid"],
            },
            filters,
          });
        }
      }
    },
  });
  unloads.add(() => sidebarWindowObserver.disconnect());

  const getSidebarWindowForOutline = (d) => {
    const allWindows = window.roamAlphaAPI.ui.rightSidebar.getWindows() || [];
    const domWindow = d.closest(".rm-sidebar-window");
    const domWindowId =
      domWindow?.getAttribute("data-sidebar-window-id") ||
      domWindow?.getAttribute("data-window-id") ||
      domWindow?.id;
    if (domWindowId) {
      const idNormalized = domWindowId.replace(/^sidebar-window-/, "");
      const byId = allWindows.find((w) => w["window-id"] === domWindowId);
      if (byId) {
        return byId;
      }
      const byNormalizedId = allWindows.find(
        (w) => w["window-id"] === idNormalized
      );
      if (byNormalizedId) {
        return byNormalizedId;
      }
    }
    const allDomWindows = Array.from(
      document.querySelectorAll(".rm-sidebar-window")
    );
    const order = allDomWindows.indexOf(domWindow);
    return allWindows.find((w) => w.order === order);
  };

  function updateGoToPageLink(d) {
    const settingValue = extensionAPI.settings.get("ws-go-to-page");
    const isEnabled = settingValue === true || settingValue === "true";
    const sidebarWindow = getSidebarWindowForOutline(d);
    const pageUid = sidebarWindow?.["page-uid"];
    const h = d.querySelector("h1.rm-title-display");
    if (!h) {
      return;
    }
    if (!isEnabled || !pageUid) {
      h.removeAttribute("data-roamjs-sidebar-link");
      h.querySelectorAll(goToPageContainerSelector).forEach((el) =>
        el.remove()
      );
      return;
    }

    const hasContainer = !!h.querySelector(goToPageContainerSelector);
    if (!h.hasAttribute("data-roamjs-sidebar-link") || !hasContainer) {
      const linkIconContainer = document.createElement("span");
      linkIconContainer.setAttribute(
        "data-roamjs-sidebar-link-container",
        "true"
      );
      h.setAttribute("data-roamjs-sidebar-link", "true");
      h.addEventListener("mousedown", (e) => {
        if (linkIconContainer.contains(e.target)) {
          e.stopPropagation();
        }
      });
      renderIcon({
        p: linkIconContainer,
        tooltipContent: "Go to page",
        onClick: () =>
          window.roamAlphaAPI.ui.mainWindow.openPage({
            page: { uid: pageUid },
          }),
        icon: "link",
      });
      h.appendChild(linkIconContainer);
    }
  }

  const sidebarOutlineObserver = createHTMLObserver({
    tag: "DIV",
    className: "rm-sidebar-outline",
    callback: updateGoToPageLink,
  });
  unloads.add(() => sidebarOutlineObserver.disconnect());

  const legacyConfigUid = window.roamAlphaAPI.pull("[:block/uid]", [
    ":node/title",
    "roam/js/sidebar",
  ])?.[":block/uid"];
  if (legacyConfigUid) {
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Migrate Legacy Sidebar Configs",
      callback: () => {
        const tree = window.roamAlphaAPI.pull(
          "[:block/uid :block/string {:block/children ...}]",
          [":node/title", "roam/js/sidebar"]
        );
        const savedNode = (tree?.[":block/children"] || []).find((t) =>
          /saved/i.test(t[":block/string"])
        );
        if (savedNode) {
          const oldSidebars = savedNode?.[":block/children"] || [];
          const newConfig = window.roamAlphaAPI.pull(
            "[:block/uid :block/string {:block/children ...}]",
            [":node/title", "Workspaces configuration"]
          );
          const definitions = (newConfig?.[":block/children"] || []).find((n) =>
            /Workspace Definitions:/i.test(n[":block/string"])
          );
          const base = (definitions?.[":block/children"] || []).length;
          oldSidebars.forEach(async (sidebar, order) => {
            await window.roamAlphaAPI.moveBlock({
              location: {
                "parent-uid": definitions[":block/uid"],
                order: base + order,
              },
              block: { uid: sidebar[":block/uid"] },
            });
            const rightSidebarContent = window.roamAlphaAPI.util.generateUID();
            await window.roamAlphaAPI.createBlock({
              location: {
                "parent-uid": sidebar[":block/uid"],
                order: 0,
              },
              block: {
                string: `Right Sidebar Content:`,
                uid: rightSidebarContent,
              },
            });
            (sidebar[":block/children"] || []).forEach(async (wndow, order) => {
              const ref = wndow[":block/children"]?.[0]?.[":block/string"];
              const type = wndow[":block/string"];
              await window.roamAlphaAPI.moveBlock({
                location: {
                  "parent-uid": rightSidebarContent,
                  order,
                },
                block: { uid: wndow[":block/uid"] },
              });
              await window.roamAlphaAPI.updateBlock({
                block: {
                  uid: wndow[":block/uid"],
                  string: `((${ref})),${type}`,
                },
              });
              await window.roamAlphaAPI.updateBlock({
                block: {
                  uid: wndow[":block/children"]?.[0]?.[":block/uid"],
                  string: `{"includes":[],"removes":[]}`,
                },
              });
            });
          });
        }
        window.roamAlphaAPI.updatePage({
          page: { uid: legacyConfigUid, title: "legacy/roam/js/sidebar" },
        });
      },
    });
  }

  const unload = () => {
    unloads.forEach((u) => u());
    const rightSidebar = document.getElementById("right-sidebar");
    if (rightSidebar) {
      rightSidebar.removeAttribute("data-roamjs-sidebar");
      removeExpandCollapseIcon(rightSidebar);
    }
  };

  function refreshGoToPageLinks() {
    document
      .querySelectorAll(".rm-sidebar-outline")
      .forEach(updateGoToPageLink);
  }

  unload.refreshExpandCollapseIcon = refreshExpandCollapseIcon;
  unload.refreshGoToPageLinks = refreshGoToPageLinks;
  return unload;
};

export default initializeRoamJSSidebarFeatures;
