import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import {
  captureFileHandler,
  captureNoteHandler,
  captureWebsiteHandler,
  meHandler,
  uploadUrlHandler,
} from "./extensionAuth/http";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/api/ext/me",
  method: "GET",
  handler: meHandler,
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
