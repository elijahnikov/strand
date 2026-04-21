import { preset } from "@omi/tailwind-config/preset";
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  presets: [preset],
} satisfies Config;
