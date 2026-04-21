import { useEffect, useState } from "react";
import { captureScratchpad } from "@/lib/capture";

const DRAFT_KEY = "omi.scratchpad.draft.v1";
const TITLE_MAX_LEN = 60;

export function ScratchpadEditor({ onSaved }: { onSaved?: () => void } = {}) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get(DRAFT_KEY).then((result) => {
      const draft = result[DRAFT_KEY];
      if (typeof draft === "string") {
        setValue(draft);
      }
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void chrome.storage.local.set({ [DRAFT_KEY]: value });
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    setStatus("saving");
    setMessage(null);
    try {
      const title = deriveTitle(trimmed);
      const jsonContent = JSON.stringify(buildPlainTextDoc(trimmed));
      await captureScratchpad({
        title,
        plainTextContent: trimmed,
        jsonContent,
      });
      setStatus("success");
      setMessage("Saved to omi");
      setValue("");
      await chrome.storage.local.remove(DRAFT_KEY);
      onSaved?.();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <textarea
        className="min-h-[220px] flex-1 resize-none rounded-xl border-[0.5px] bg-ui-bg-component px-3 py-2 text-sm text-ui-fg-base outline-none placeholder:text-ui-fg-muted focus:border-ui-fg-base/30"
        onChange={(e) => setValue(e.target.value)}
        placeholder="Quick note… (autosaves locally as you type)"
        value={value}
      />
      <div className="flex items-center justify-between">
        <span
          className={
            status === "error"
              ? "text-ui-fg-error text-xs"
              : status === "success"
                ? "text-ui-fg-base text-xs"
                : "text-ui-fg-muted text-xs"
          }
        >
          {message ?? "Drafts stored in this browser"}
        </span>
        <button
          className="rounded-xl bg-ui-fg-base px-3 py-1.5 font-medium text-sm text-ui-fg-on-inverted disabled:opacity-50"
          disabled={status === "saving" || value.trim().length === 0}
          onClick={() => void save()}
          type="button"
        >
          {status === "saving" ? "Saving…" : "Save to omi"}
        </button>
      </div>
    </div>
  );
}

function deriveTitle(text: string): string {
  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? text;
  if (firstLine.length <= TITLE_MAX_LEN) {
    return firstLine;
  }
  return `${firstLine.slice(0, TITLE_MAX_LEN)}…`;
}

function buildPlainTextDoc(text: string) {
  return {
    type: "doc",
    content: text.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}
