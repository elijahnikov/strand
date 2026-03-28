import { baseConfig, restrictEnvAccess } from "@strand/eslint-config/base";
import { nextjsConfig } from "@strand/eslint-config/nextjs";
import { reactConfig } from "@strand/eslint-config/react";
import { defineConfig } from "eslint/config";

export default defineConfig(
	{
		ignores: [".next/**"],
	},
	baseConfig,
	reactConfig,
	nextjsConfig,
	restrictEnvAccess,
);
