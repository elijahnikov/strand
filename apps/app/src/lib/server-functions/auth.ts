import { api } from "@strand/backend/_generated/api.js";
import { createServerFn } from "@tanstack/react-start";
import { fetchAuthQuery } from "../auth-server";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async () => await fetchAuthQuery(api.user.queries.currentUser, {})
);
