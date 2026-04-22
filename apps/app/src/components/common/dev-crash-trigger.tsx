import { useLocation } from "@tanstack/react-router";

/**
 * Dev-only: add `?boom=<scope>` to the URL to throw a render error at that
 * scope, exercising the matching CatchBoundary. Scopes:
 *   - `root`  → outer boundary in __root.tsx (also kills workspace shell)
 *   - `page`  → inner boundary in global-workspace-layout (shell survives)
 */
export function DevCrashTrigger({ scope }: { scope: "root" | "page" }) {
  const search = useLocation({ select: (l) => l.search }) as Record<
    string,
    unknown
  >;
  const boom = search.boom;

  if (!import.meta.env.DEV) {
    return null;
  }
  if (boom !== scope) {
    return null;
  }

  throw new Error(`DevCrashTrigger: simulated ${scope} crash`);
}
