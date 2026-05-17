/**
 * Curated catalog of MCP servers users can connect with one click.
 *
 * Each entry presets the URL, transport, auth method, and (for OAuth) the
 * scope to request. "Add custom MCP server" sits alongside this list as an
 * escape hatch for anything not catalogued.
 *
 * URLs are best-effort as of writing; servers occasionally relocate. When
 * adding new entries, prefer the official MCP endpoint published by the
 * vendor and verify by hitting `tools/list` once after connecting.
 */

export interface CatalogEntry {
  authType: "bearer" | "oauth2";
  catalogId: string;
  description: string;
  /** Documentation URL surfaced in the connect dialog. */
  helpUrl?: string;
  /** Logo identifier — UI maps this to a registry of imported SVGs. */
  logoKey: string;
  name: string;
  /** Optional OAuth scope to request during authorization. */
  oauthScope?: string;
  url: string;
}

export const MCP_CATALOG: readonly CatalogEntry[] = [
  {
    catalogId: "linear",
    name: "Linear",
    description: "Issues, projects, and cycles.",
    logoKey: "linear",
    // Streamable HTTP endpoint. Linear also exposes /sse for the legacy
    // SSE transport, which we don't support yet.
    url: "https://mcp.linear.app/mcp",
    authType: "oauth2",
    helpUrl: "https://linear.app/docs/mcp",
  },
  {
    catalogId: "notion",
    name: "Notion (MCP)",
    description: "Pages, databases, and search.",
    logoKey: "notion",
    url: "https://mcp.notion.com/mcp",
    authType: "oauth2",
  },
] as const;

export function findCatalogEntry(catalogId: string): CatalogEntry | undefined {
  return MCP_CATALOG.find((entry) => entry.catalogId === catalogId);
}
