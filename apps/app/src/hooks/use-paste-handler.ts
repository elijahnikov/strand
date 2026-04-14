import { useCallback, useEffect, useRef } from "react";
import { isHttpUrl } from "~/lib/is-http-url";

interface PasteHandlerCallbacks {
  onFiles: (files: File[]) => void;
  onText: (text: string) => void;
  onUrl: (url: string) => void;
}

export function usePasteHandler(callbacks: PasteHandlerCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const cooldownRef = useRef(false);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const target = event.target as HTMLElement;

    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    if (cooldownRef.current) {
      return;
    }

    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, 500);

    const clipboardData = event.clipboardData;
    if (!clipboardData) {
      return;
    }

    if (clipboardData.files.length > 0) {
      callbacksRef.current.onFiles(Array.from(clipboardData.files));
      return;
    }

    const text = clipboardData.getData("text/plain").trim();
    if (!text) {
      return;
    }

    if (isHttpUrl(text)) {
      callbacksRef.current.onUrl(text);
      return;
    }

    callbacksRef.current.onText(text);
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);
}
