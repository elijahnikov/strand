import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  dev: {
    server: {
      port: 3100,
    },
  },
  manifest: {
    name: "omi",
    description:
      "Save pages, highlights, screenshots, images, and quick notes to your omi workspace.",
    permissions: [
      "activeTab",
      "contextMenus",
      "notifications",
      "scripting",
      "storage",
    ],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "omi",
    },
    commands: {
      "save-current-page": {
        suggested_key: {
          default: "Ctrl+Shift+S",
          mac: "Command+Shift+S",
        },
        description: "Save current page to omi",
      },
      "capture-screenshot": {
        suggested_key: {
          default: "Ctrl+Shift+Y",
          mac: "Command+Shift+Y",
        },
        description: "Screenshot current page to omi",
      },
    },
    externally_connectable: {
      matches: ["https://app.omi.com/*", "http://localhost:*/*"],
    },
  },
  vite: () => ({
    // tailwindcss plugin types drift between the top-level vite and wxt's
    // pinned vite copy; types are structurally compatible at runtime.
    plugins: [tailwindcss() as unknown as never],
  }),
});
