import { useEffect, useState } from "react";

export const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024; // 1MB

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "too-large" }
  | { status: "ready"; text: string };

export function useFileText(url: string | null): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!url) {
      setState({ status: "error", message: "No file URL" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentLength = response.headers.get("content-length");
        if (contentLength && Number(contentLength) > MAX_TEXT_PREVIEW_BYTES) {
          if (!cancelled) {
            setState({ status: "too-large" });
          }
          return;
        }

        const text = await response.text();
        if (cancelled) {
          return;
        }

        if (text.length > MAX_TEXT_PREVIEW_BYTES) {
          setState({ status: "too-large" });
          return;
        }

        setState({ status: "ready", text });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
