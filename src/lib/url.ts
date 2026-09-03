const Explicit_Scheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

export function resolveSafeUserUrl(value: string, baseUrl: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const scheme = trimmed.match(Explicit_Scheme)?.[0].slice(0, -1).toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}
