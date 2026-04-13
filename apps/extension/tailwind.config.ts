import { preset } from "@strand/tailwind-config/preset";
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  presets: [preset],
} satisfies Config;
