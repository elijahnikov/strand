import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { oauthCallbackHandler } from "./connections/oauth/httpRoutes";
import {
  webhookHandler as integrationsWebhookHandler,
  webhookHandlerByConnection as integrationsWebhookHandlerByConnection,
} from "./connections/sync/httpRoutes";
import {
  captureFileHandler,
  captureNoteHandler,
  captureWebsiteHandler,
  listResourcesHandler,
  meHandler,
  uploadUrlHandler,
} from "./extensionAuth/http";
import { mcpHandler } from "./mcp/server";
import { oauthCallbackHandler as mcpClientOauthCallbackHandler } from "./mcpClient/oauthHttp";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

for (const provider of [
  "notion",
  "raindrop",
  "google_drive",
  "github",
] as const) {
  http.route({
    path: `/api/oauth/${provider}/callback`,
    method: "GET",
    handler: oauthCallbackHandler,
  });
}

// Provider webhooks for continuous sync.
//   - Notion / Drive use ONE URL per provider; payload carries a key
//     (e.g. workspace_id) that routes the event to the right connection.
//   - GitHub / Linear use ONE URL per CONNECTION; the connectionId is encoded
//     directly in the path. They register a unique URL per webhook anyway, so
//     this is the simpler shape.
for (const provider of ["notion", "google_drive"] as const) {
  http.route({
    path: `/api/integrations/${provider}/webhook`,
    method: "POST",
    handler: integrationsWebhookHandler,
  });
}
for (const provider of ["github", "linear"] as const) {
  http.route({
    pathPrefix: `/api/integrations/${provider}/webhook/`,
    method: "POST",
    handler: integrationsWebhookHandlerByConnection,
  });
}

http.route({
  path: "/api/ext/me",
  method: "GET",
  handler: meHandler,
});
http.route({
  path: "/api/ext/resources",
  method: "GET",
  handler: listResourcesHandler,
});
http.route({
  path: "/api/ext/upload-url",
  method: "POST",
  handler: uploadUrlHandler,
});
http.route({
  path: "/api/ext/capture/website",
  method: "POST",
  handler: captureWebsiteHandler,
});
http.route({
  path: "/api/ext/capture/note",
  method: "POST",
  handler: captureNoteHandler,
});
http.route({
  path: "/api/ext/capture/file",
  method: "POST",
  handler: captureFileHandler,
});

// MCP server (Streamable HTTP transport). External MCP clients (Claude
// Desktop, Cursor, custom agents) hit /api/mcp with a Bearer PAT scoped to a
// single workspace.
for (const method of ["POST", "GET", "DELETE"] as const) {
  http.route({
    path: "/api/mcp",
    method,
    handler: mcpHandler,
  });
}

// OAuth callback for outbound MCP client connections (Omi-as-client connecting
// to external MCP servers like Google Calendar, Notion's MCP, etc.).
http.route({
  path: "/api/mcp-client/oauth/callback",
  method: "GET",
  handler: mcpClientOauthCallbackHandler,
});

export default http;
