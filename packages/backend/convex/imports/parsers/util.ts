export function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(31, hash) + s.charCodeAt(i)) % 0x1_00_00_00_00;
  }
  const positive = hash < 0 ? hash + 0x1_00_00_00_00 : hash;
  return positive.toString(36);
}
