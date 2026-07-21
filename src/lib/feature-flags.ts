// Central feature flags. Toggle KEETA_ENABLED back to true once the Keeta
// API is available — the UI will re-enable everywhere automatically.
export const KEETA_ENABLED = false;

export function isPlatformEnabled(platform: string): boolean {
  if (platform === "keeta") return KEETA_ENABLED;
  return true;
}