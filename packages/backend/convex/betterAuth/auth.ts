import { createAuth } from "../auth";

// biome-ignore lint/suspicious/noExplicitAny: <>
export const auth = createAuth({} as any);
