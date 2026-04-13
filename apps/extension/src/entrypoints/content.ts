export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "GET_SELECTION") {
        const selection = window.getSelection()?.toString() ?? "";
        sendResponse({
          selection,
          url: window.location.href,
          title: document.title,
        });
        return true;
      }
      if (message?.type === "GET_PAGE_META") {
        const description =
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") ?? null;
        const ogImage =
          document
            .querySelector('meta[property="og:image"]')
            ?.getAttribute("content") ?? null;
        sendResponse({
          url: window.location.href,
          title: document.title,
          description,
          ogImage,
        });
        return true;
      }
      return false;
    });
  },
});
