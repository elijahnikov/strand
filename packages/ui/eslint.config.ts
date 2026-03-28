import { baseConfig } from "@strand/eslint-config/base";
import { reactConfig } from "@strand/eslint-config/react";
import { defineConfig } from "eslint/config";

export default defineConfig(
	{
		ignores: ["dist/**"],
	},
	baseConfig,
	reactConfig,
);
