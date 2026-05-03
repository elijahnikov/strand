import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { oauthCallbackHandler } from "./connections/oauth/httpRoutes";
import { webhookHandler as integrationsWebhookHandler } from "./connections/sync/httpRoutes";
import {
  captureFileHandler,
  captureNoteHandler,
  captureWebsiteHandler,
  listResourcesHandler,
  meHandler,
  uploadUrlHandler,
} from "./extensionAuth/http";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

for (const provider of ["notion", "raindrop", "google_drive"] as const) {
  http.route({
    path: `/api/oauth/${provider}/callback`,
    method: "GET",
    handler: oauthCallbackHandler,
  });
}

// Provider webhooks for continuous sync. One URL per provider — the payload
// itself carries a key (e.g. Notion's workspace_id) that the handler uses to
// route the event to the correct connection.
// Path shape: /api/integrations/:provider/webhook
for (const provider of [
  "notion",
  "github",
  "linear",
  "google_drive",
] as const) {
  http.route({
    path: `/api/integrations/${provider}/webhook`,
    method: "POST",
    handler: integrationsWebhookHandler,
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

export default http;
