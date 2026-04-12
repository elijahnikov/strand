import { init } from "@instantdb/react";
import schema from "./instant.schema";

const env = (
  import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }
).env;

const appId = env?.VITE_INSTANT_APP_ID ?? "";

export const instantDb = init({
  appId,
  schema,
  useDateObjects: true,
});

export type { AppSchema } from "./instant.schema";
