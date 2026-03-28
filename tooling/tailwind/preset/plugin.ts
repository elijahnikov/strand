import plugin from "tailwindcss/plugin";

import { colors } from "./theme/tokens/colors";
import { components } from "./theme/tokens/components";
import { effects } from "./theme/tokens/effects";
import { typography } from "./theme/tokens/typography";

export default plugin(function medusaUi({ addBase, addComponents, config }) {
  const [darkMode, className = ".dark"] = ([] as string[]).concat(
    config("darkMode", "media")
  );

  addBase({
    "*": {
      borderColor: "var(--border-base)",
    },
  });

  addComponents(typography);

  addBase({
    ":root": { ...colors.light, ...effects.light },
    ...components.light,
  });

  if (darkMode === "class") {
    addBase({
      [className]: { ...colors.dark, ...effects.dark },
    });
  } else {
    addBase({
      "@media (prefers-color-scheme: dark)": {
        ":root": { ...colors.dark, ...effects.dark },
        ...components.dark,
      },
    });
  }
});
