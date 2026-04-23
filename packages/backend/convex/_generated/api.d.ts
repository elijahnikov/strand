/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as billing_backfill from "../billing/backfill.js";
import type * as billing_credits from "../billing/credits.js";
import type * as billing_hooks from "../billing/hooks.js";
import type * as billing_pricing from "../billing/pricing.js";
import type * as billing_queries from "../billing/queries.js";
import type * as billing_repair from "../billing/repair.js";
import type * as billing_resolver from "../billing/resolver.js";
import type * as billing_sync from "../billing/sync.js";
import type * as chat_actions from "../chat/actions.js";
import type * as chat_internals from "../chat/internals.js";
import type * as chat_mutations from "../chat/mutations.js";
import type * as chat_queries from "../chat/queries.js";
import type * as collection_mutations from "../collection/mutations.js";
import type * as collection_queries from "../collection/queries.js";
import type * as connections_actions from "../connections/actions.js";
import type * as connections_internals from "../connections/internals.js";
import type * as connections_mutations from "../connections/mutations.js";
import type * as connections_oauth_authorize from "../connections/oauth/authorize.js";
import type * as connections_oauth_httpRoutes from "../connections/oauth/httpRoutes.js";
import type * as connections_oauth_stateSigner from "../connections/oauth/stateSigner.js";
import type * as connections_oauth_tokenExchange from "../connections/oauth/tokenExchange.js";
import type * as connections_providers_google_drive from "../connections/providers/google_drive.js";
import type * as connections_providers_notion from "../connections/providers/notion.js";
import type * as connections_providers_raindrop from "../connections/providers/raindrop.js";
import type * as connections_providers_readwise from "../connections/providers/readwise.js";
import type * as connections_providers_registry from "../connections/providers/registry.js";
import type * as connections_providers_types from "../connections/providers/types.js";
import type * as connections_queries from "../connections/queries.js";
import type * as crons from "../crons.js";
import type * as email_resend from "../email/resend.js";
import type * as email_sendVerificationEmail from "../email/sendVerificationEmail.js";
import type * as extensionAuth_http from "../extensionAuth/http.js";
import type * as extensionAuth_internals from "../extensionAuth/internals.js";
import type * as extensionAuth_mutations from "../extensionAuth/mutations.js";
import type * as extensionAuth_queries from "../extensionAuth/queries.js";
import type * as extensionAuth_shared from "../extensionAuth/shared.js";
import type * as http from "../http.js";
import type * as imports_actions from "../imports/actions.js";
import type * as imports_internals from "../imports/internals.js";
import type * as imports_mutations from "../imports/mutations.js";
import type * as imports_parsers_bookmarkHtml from "../imports/parsers/bookmarkHtml.js";
import type * as imports_parsers_csv from "../imports/parsers/csv.js";
import type * as imports_parsers_evernoteEnex from "../imports/parsers/evernoteEnex.js";
import type * as imports_parsers_fabric from "../imports/parsers/fabric.js";
import type * as imports_parsers_markdown from "../imports/parsers/markdown.js";
import type * as imports_parsers_notionApi from "../imports/parsers/notionApi.js";
import type * as imports_parsers_notionZip from "../imports/parsers/notionZip.js";
import type * as imports_parsers_raindropApi from "../imports/parsers/raindropApi.js";
import type * as imports_parsers_readwise from "../imports/parsers/readwise.js";
import type * as imports_parsers_types from "../imports/parsers/types.js";
import type * as imports_parsers_util from "../imports/parsers/util.js";
import type * as imports_parsers_util_markdownToHtml from "../imports/parsers/util/markdownToHtml.js";
import type * as imports_pipeline from "../imports/pipeline.js";
import type * as imports_queries from "../imports/queries.js";
import type * as imports_rehydrate from "../imports/rehydrate.js";
import type * as rateLimiter from "../rateLimiter.js";
import type * as resource_actions from "../resource/actions.js";
import type * as resource_aiActions from "../resource/aiActions.js";
import type * as resource_aiInternals from "../resource/aiInternals.js";
import type * as resource_aiQueries from "../resource/aiQueries.js";
import type * as resource_internals from "../resource/internals.js";
import type * as resource_linkInternals from "../resource/linkInternals.js";
import type * as resource_mutations from "../resource/mutations.js";
import type * as resource_queries from "../resource/queries.js";
import type * as resource_tagActions from "../resource/tagActions.js";
import type * as search_actions from "../search/actions.js";
import type * as search_highlight from "../search/highlight.js";
import type * as search_internals from "../search/internals.js";
import type * as search_memoryBoost from "../search/memoryBoost.js";
import type * as search_queries from "../search/queries.js";
import type * as shared from "../shared.js";
import type * as user_queries from "../user/queries.js";
import type * as userMemory_aiActions from "../userMemory/aiActions.js";
import type * as userMemory_internals from "../userMemory/internals.js";
import type * as userMemory_mutations from "../userMemory/mutations.js";
import type * as userMemory_queries from "../userMemory/queries.js";
import type * as utils from "../utils.js";
import type * as workspace_mutations from "../workspace/mutations.js";
import type * as workspace_queries from "../workspace/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "billing/backfill": typeof billing_backfill;
  "billing/credits": typeof billing_credits;
  "billing/hooks": typeof billing_hooks;
  "billing/pricing": typeof billing_pricing;
  "billing/queries": typeof billing_queries;
  "billing/repair": typeof billing_repair;
  "billing/resolver": typeof billing_resolver;
  "billing/sync": typeof billing_sync;
  "chat/actions": typeof chat_actions;
  "chat/internals": typeof chat_internals;
  "chat/mutations": typeof chat_mutations;
  "chat/queries": typeof chat_queries;
  "collection/mutations": typeof collection_mutations;
  "collection/queries": typeof collection_queries;
  "connections/actions": typeof connections_actions;
  "connections/internals": typeof connections_internals;
  "connections/mutations": typeof connections_mutations;
  "connections/oauth/authorize": typeof connections_oauth_authorize;
  "connections/oauth/httpRoutes": typeof connections_oauth_httpRoutes;
  "connections/oauth/stateSigner": typeof connections_oauth_stateSigner;
  "connections/oauth/tokenExchange": typeof connections_oauth_tokenExchange;
  "connections/providers/google_drive": typeof connections_providers_google_drive;
  "connections/providers/notion": typeof connections_providers_notion;
  "connections/providers/raindrop": typeof connections_providers_raindrop;
  "connections/providers/readwise": typeof connections_providers_readwise;
  "connections/providers/registry": typeof connections_providers_registry;
  "connections/providers/types": typeof connections_providers_types;
  "connections/queries": typeof connections_queries;
  crons: typeof crons;
  "email/resend": typeof email_resend;
  "email/sendVerificationEmail": typeof email_sendVerificationEmail;
  "extensionAuth/http": typeof extensionAuth_http;
  "extensionAuth/internals": typeof extensionAuth_internals;
  "extensionAuth/mutations": typeof extensionAuth_mutations;
  "extensionAuth/queries": typeof extensionAuth_queries;
  "extensionAuth/shared": typeof extensionAuth_shared;
  http: typeof http;
  "imports/actions": typeof imports_actions;
  "imports/internals": typeof imports_internals;
  "imports/mutations": typeof imports_mutations;
  "imports/parsers/bookmarkHtml": typeof imports_parsers_bookmarkHtml;
  "imports/parsers/csv": typeof imports_parsers_csv;
  "imports/parsers/evernoteEnex": typeof imports_parsers_evernoteEnex;
  "imports/parsers/fabric": typeof imports_parsers_fabric;
  "imports/parsers/markdown": typeof imports_parsers_markdown;
  "imports/parsers/notionApi": typeof imports_parsers_notionApi;
  "imports/parsers/notionZip": typeof imports_parsers_notionZip;
  "imports/parsers/raindropApi": typeof imports_parsers_raindropApi;
  "imports/parsers/readwise": typeof imports_parsers_readwise;
  "imports/parsers/types": typeof imports_parsers_types;
  "imports/parsers/util": typeof imports_parsers_util;
  "imports/parsers/util/markdownToHtml": typeof imports_parsers_util_markdownToHtml;
  "imports/pipeline": typeof imports_pipeline;
  "imports/queries": typeof imports_queries;
  "imports/rehydrate": typeof imports_rehydrate;
  rateLimiter: typeof rateLimiter;
  "resource/actions": typeof resource_actions;
  "resource/aiActions": typeof resource_aiActions;
  "resource/aiInternals": typeof resource_aiInternals;
  "resource/aiQueries": typeof resource_aiQueries;
  "resource/internals": typeof resource_internals;
  "resource/linkInternals": typeof resource_linkInternals;
  "resource/mutations": typeof resource_mutations;
  "resource/queries": typeof resource_queries;
  "resource/tagActions": typeof resource_tagActions;
  "search/actions": typeof search_actions;
  "search/highlight": typeof search_highlight;
  "search/internals": typeof search_internals;
  "search/memoryBoost": typeof search_memoryBoost;
  "search/queries": typeof search_queries;
  shared: typeof shared;
  "user/queries": typeof user_queries;
  "userMemory/aiActions": typeof userMemory_aiActions;
  "userMemory/internals": typeof userMemory_internals;
  "userMemory/mutations": typeof userMemory_mutations;
  "userMemory/queries": typeof userMemory_queries;
  utils: typeof utils;
  "workspace/mutations": typeof workspace_mutations;
  "workspace/queries": typeof workspace_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
