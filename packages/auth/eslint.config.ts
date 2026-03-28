import { baseConfig, restrictEnvAccess } from "@strand/eslint-config/base";
import { defineConfig } from "eslint/config";

export default defineConfig(
	{
		ignores: ["script/**"],
	},
	baseConfig,
	restrictEnvAccess,
);
