import { clearToken, setToken } from "@/lib/auth";
import {
  captureImage,
  captureScreenshot,
  captureSelection,
  captureWebsite,
} from "@/lib/capture";

const CONTEXT_MENU_SAVE_SELECTION = "strand-save-selection";
const CONTEXT_MENU_SAVE_IMAGE = "strand-save-image";

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: CONTEXT_MENU_SAVE_SELECTION,
        title: "Save selection to Strand",
        contexts: ["selection"],
      });
      chrome.contextMenus.create({
        id: CONTEXT_MENU_SAVE_IMAGE,
        title: "Save image to Strand",
        contexts: ["image"],
      });
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_SAVE_SELECTION) {
      const selection = info.selectionText ?? "";
      const sourceUrl = info.pageUrl ?? tab?.url ?? "";
      const sourceTitle = tab?.title ?? sourceUrl;
      void runCapture(
        "Save selection",
        captureSelection({ selection, sourceUrl, sourceTitle })
      );
    } else if (info.menuItemId === CONTEXT_MENU_SAVE_IMAGE) {
      const srcUrl = info.srcUrl;
      const sourceUrl = info.pageUrl ?? tab?.url ?? "";
      if (!srcUrl) {
        return;
      }
      void runCapture("Save image", captureImage({ srcUrl, sourceUrl }));
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === "save-current-page") {
      void runCapture("Save page", captureCurrentTabAsWebsite());
    } else if (command === "capture-screenshot") {
      void runCapture("Screenshot", captureCurrentTabScreenshot());
    }
  });

  chrome.runtime.onMessageExternal.addListener(
    (message, _sender, sendResponse) => {
      if (
        message?.type === "EXTENSION_TOKEN" &&
        typeof message.token === "string"
      ) {
        setToken({
          token: message.token,
          userId: message.userId,
          defaultWorkspaceId: message.defaultWorkspaceId,
        })
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
      }
      if (message?.type === "EXTENSION_DISCONNECT") {
        clearToken()
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
      }
      return false;
    }
  );
});

async function runCapture(
  label: string,
  promise: Promise<{ resourceId: string }>
): Promise<void> {
  try {
    await promise;
    notify(`${label} saved`, "Open Strand to view the resource.");
  } catch (err) {
    notify(`${label} failed`, err instanceof Error ? err.message : String(err));
  }
}

async function captureCurrentTabAsWebsite() {
  const tab = await getActiveTab();
  if (!tab.url) {
    throw new Error("Active tab has no URL");
  }
  return await captureWebsite({
    url: tab.url,
    title: tab.title ?? tab.url,
  });
}

async function captureCurrentTabScreenshot() {
  const tab = await getActiveTab();
  if (typeof tab.id !== "number") {
    throw new Error("Active tab has no id");
  }
  const domain = tab.url ? safeDomain(tab.url) : "screenshot";
  return await captureScreenshot({ tabId: tab.id, domain });
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    throw new Error("No active tab");
  }
  return tab;
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "");
  } catch {
    return "screenshot";
  }
}

function notify(title: string, message: string): void {
  if (!chrome.notifications?.create) {
    return;
  }
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon/128.png"),
    title,
    message,
  });
}
