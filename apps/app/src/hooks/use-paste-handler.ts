import { useCallback, useEffect, useRef } from "react";

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

    // Skip if user is typing in an input
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

    // Priority 1: Files
    if (clipboardData.files.length > 0) {
      callbacksRef.current.onFiles(Array.from(clipboardData.files));
      return;
    }

    // Priority 2: Text (URL or note)
    const text = clipboardData.getData("text/plain").trim();
    if (!text) {
      return;
    }

    try {
      const url = new URL(text);
      if (url.protocol === "http:" || url.protocol === "https:") {
        callbacksRef.current.onUrl(text);
        return;
      }
    } catch {
      // Not a URL
    }

    // Priority 3: Plain text → note
    callbacksRef.current.onText(text);
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);
}
