import type { api } from "@strand/backend/_generated/api.js";
import type { FunctionReturnType } from "convex/server";

export type GetResourceData = NonNullable<
  FunctionReturnType<typeof api.resource.queries.get>
>;
