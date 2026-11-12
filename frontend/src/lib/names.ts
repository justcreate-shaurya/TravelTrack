/** "Kavish Jain" -> "Kavish". Falls back to the whole (trimmed) name. */
export function firstName(name: string): string {
  const clean = name.trim();
  return clean.split(/\s+/)[0] || clean;
}
