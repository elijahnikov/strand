import React from "react";
import ReactDOM from "react-dom/client";
import { ScratchpadEditor } from "@/components/scratchpad-editor";
import "./styles.css";

document.documentElement.classList.add("dark");

const root = document.getElementById("root");
if (!root) {
  throw new Error("Note window root element missing");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <main className="flex h-screen flex-col bg-ui-bg-base p-4 text-ui-fg-base">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="font-semibold text-sm text-ui-fg-base">Write a note</h1>
        <button
          className="text-ui-fg-muted text-xs hover:text-ui-fg-base"
          onClick={() => window.close()}
          type="button"
        >
          Close
        </button>
      </header>
      <div className="flex-1">
        <ScratchpadEditor onSaved={() => window.close()} />
      </div>
    </main>
  </React.StrictMode>
);
