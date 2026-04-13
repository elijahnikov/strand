const FALLBACK = "/";

export function safeRedirect(target: string | undefined): string {
  if (!target) {
    return FALLBACK;
  }
  if (!target.startsWith("/") || target.startsWith("//")) {
    return FALLBACK;
  }
  return target;
}
