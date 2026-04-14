import {
  RiCameraLine,
  RiExternalLinkLine,
  RiFileTextLine,
  RiGlobalLine,
  RiLogoutBoxLine,
} from "@remixicon/react";
import { cn } from "@strand/ui";
import { useState } from "react";
import { captureScreenshot, captureWebsite } from "@/lib/capture";

const NOTE_WINDOW_WIDTH = 480;
const NOTE_WINDOW_HEIGHT = 600;

interface Status {
  message?: string;
  state: "idle" | "pending" | "error";
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

function getWebAppUrl(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined;
  return (fromEnv ?? "https://app.strand.com").replace(/\/$/, "");
}

export function MenuScreen({ onDisconnect }: { onDisconnect: () => void }) {
  const [status, setStatus] = useState<Status>({ state: "idle" });

  const runAndClose = async (
    fn: () => Promise<unknown>,
    errorLabel: string
  ) => {
    setStatus({ state: "pending" });
    try {
      await fn();
      window.close();
    } catch (err) {
      setStatus({
        state: "error",
        message: `${errorLabel}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleSavePage = () =>
    runAndClose(async () => {
      const tab = await getActiveTab();
      if (!tab.url) {
        throw new Error("Active tab has no URL");
      }
      await captureWebsite({ url: tab.url, title: tab.title ?? tab.url });
    }, "Save page failed");

  const handleScreenshot = () =>
    runAndClose(async () => {
      const tab = await getActiveTab();
      if (typeof tab.id !== "number") {
        throw new Error("Active tab has no id");
      }
      const domain = tab.url ? safeDomain(tab.url) : "screenshot";
      await captureScreenshot({ tabId: tab.id, domain });
    }, "Screenshot failed");

  const handleWriteNote = () => {
    chrome.windows.create({
      url: chrome.runtime.getURL("/note.html"),
      type: "popup",
      width: NOTE_WINDOW_WIDTH,
      height: NOTE_WINDOW_HEIGHT,
    });
    window.close();
  };

  const handleOpenStrand = () => {
    chrome.tabs.create({ url: getWebAppUrl() });
    window.close();
  };

  const pending = status.state === "pending";

  return (
    <div className="relative flex flex-col bg-ui-bg-component p-1 outline-none">
      <div className="px-2 pt-1 pb-1">
        <span className="font-medium text-ui-fg-muted text-xs uppercase tracking-wider">
          Strand
        </span>
      </div>

      <ul className="flex flex-col gap-px">
        <MenuItem
          disabled={pending}
          icon={<RiGlobalLine />}
          label="Save this page"
          onClick={() => void handleSavePage()}
          shortcut="⌘⇧S"
        />
        <MenuItem
          disabled={pending}
          icon={<RiCameraLine />}
          label="Screenshot page"
          onClick={() => void handleScreenshot()}
          shortcut="⌘⇧Y"
        />
        <MenuItem
          disabled={pending}
          icon={<RiFileTextLine />}
          label="Write a note"
          onClick={handleWriteNote}
        />
        <Separator />
        <MenuItem
          icon={<RiExternalLinkLine />}
          label="Open Strand"
          onClick={handleOpenStrand}
        />
        <MenuItem
          icon={<RiLogoutBoxLine />}
          label="Disconnect"
          onClick={onDisconnect}
          variant="destructive"
        />
      </ul>

      {status.state === "error" ? (
        <div className="mt-1 rounded-xl border-[0.5px] border-ui-fg-error/30 bg-ui-bg-component px-2 py-1.5 text-ui-fg-error text-xs">
          {status.message}
        </div>
      ) : null}
      {pending ? (
        <div className="mt-1 px-2 py-1.5 text-ui-fg-muted text-xs">Saving…</div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <li>
      <button
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-xl bg-ui-bg-component px-2 py-1.5 text-left font-medium text-sm text-ui-fg-subtle outline-none transition-colors",
          "hover:bg-ui-bg-component-hover hover:text-ui-fg-base",
          "disabled:pointer-events-none disabled:text-ui-fg-disabled",
          "[&_svg]:mr-2 [&_svg]:size-4 [&_svg]:text-ui-fg-subtle hover:[&_svg]:text-ui-fg-base disabled:[&_svg]:text-ui-fg-disabled",
          variant === "destructive" && "text-ui-fg-error hover:text-ui-fg-error"
        )}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {icon}
        <span className="flex-1">{label}</span>
        {shortcut ? (
          <kbd className="ms-auto font-medium font-sans text-ui-fg-muted text-xs tracking-widest">
            {shortcut}
          </kbd>
        ) : null}
      </button>
    </li>
  );
}

function Separator() {
  return <li aria-hidden className="-mx-1 my-1 h-px bg-ui-fg-muted/10" />;
}
