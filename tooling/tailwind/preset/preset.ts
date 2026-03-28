import type { Config } from "tailwindcss";
import plugin from "./plugin";
import { theme } from "./theme/extension/theme";

const preset = {
  content: [],
  plugins: [plugin] as Config["plugins"],
  theme: {
    extend: {
      ...theme.extend,
      transitionProperty: {
        fg: "color, background-color, border-color, box-shadow, opacity",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0px" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0px" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        shimmer: "shimmer 3s infinite linear",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
} satisfies Config;

export { preset };
