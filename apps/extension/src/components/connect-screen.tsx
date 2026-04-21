const DEFAULT_WEB_APP_URL = "https://app.omi.com";

function getWebAppUrl(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined;
  return fromEnv ?? DEFAULT_WEB_APP_URL;
}

const baseUrlRegex = /\/$/;

export function ConnectScreen() {
  const handleConnect = () => {
    const baseUrl = getWebAppUrl().replace(baseUrlRegex, "");
    const extId = chrome.runtime.id;
    chrome.tabs.create({
      url: `${baseUrl}/connect-extension?extId=${encodeURIComponent(extId)}`,
    });
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 bg-ui-bg-component p-5 text-center">
      <div className="space-y-1">
        <h1 className="font-semibold text-base text-ui-fg-base">
          Connect to omi
        </h1>
        <p className="text-ui-fg-muted text-xs">
          Sign in once in the web app to let this extension save to your
          workspace.
        </p>
      </div>
      <button
        className="w-full rounded-xl bg-ui-fg-base px-4 py-2 font-medium text-sm text-ui-fg-on-inverted transition-opacity hover:opacity-90"
        onClick={handleConnect}
        type="button"
      >
        Connect
      </button>
    </div>
  );
}
