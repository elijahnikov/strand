import type { api } from "@omi/backend/_generated/api.js";
import type { FunctionReturnType } from "convex/server";

export type ShareResourceData = NonNullable<
  FunctionReturnType<typeof api.resourceShare.queries.getPublicBySlug>
>;
