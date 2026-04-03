const JS_SUFFIX = /\.js$/i;
const TS_SUFFIX = /\.ts$/i;
const TRAILING_DOT = /\.$/;

export function normalizeConceptName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(JS_SUFFIX, "")
    .replace(TS_SUFFIX, "")
    .replace(TRAILING_DOT, "");
}
