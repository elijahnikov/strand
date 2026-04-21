import { preset } from "@omi/tailwind-config/preset";
import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/ui/*.{ts,tsx}"],
  presets: [preset],
  theme: {
    extend: {
      fontFamily: {
        sans: ["OpenRunde", ...defaultTheme.fontFamily.sans],
        mono: ["IoskeleyMono", ...defaultTheme.fontFamily.mono],
      },
    },
  },
} satisfies Config;
