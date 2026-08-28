const SLUG = 'context-recall-cards';
const BASE_URL = import.meta.env.VITE_BILLING_BASE_URL || 'https://api.sociobot.in/api/v1';
const REAL_LICENSE_KEY = `sb_license:${SLUG}`;
const REAL_VERDICT_KEY = `sb_license_verdict:${SLUG}`;
const DAY = 86_400_000;
let demoMode = false;

function licenseKey(): string { return demoMode ? `demo:${REAL_LICENSE_KEY}` : REAL_LICENSE_KEY; }
function verdictKey(): string { return demoMode ? `demo:${REAL_VERDICT_KEY}` : REAL_VERDICT_KEY; }

export function useDemoBilling(enabled: boolean): void {
  demoMode = enabled;
}

interface Verdict {
  valid: boolean;
  checkedAt: number;
  reason?: string;
}

export const checkoutUrl = `${BASE_URL}/products/${SLUG}/checkout`;

export function captureLicenseFromUrl(): void {
  const url = new URL(window.location.href);
  const license = url.searchParams.get('license');
  if (!license) return;
  localStorage.setItem(licenseKey(), license.trim());
  localStorage.setItem(verdictKey(), JSON.stringify({ valid: true, checkedAt: 0 } satisfies Verdict));
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function getLicense(): string {
  return localStorage.getItem(licenseKey()) ?? '';
}

export function saveLicense(token: string): void {
  localStorage.setItem(licenseKey(), token.trim());
  localStorage.setItem(verdictKey(), JSON.stringify({ valid: true, checkedAt: 0 } satisfies Verdict));
}

export function clearLicense(): void {
  localStorage.removeItem(licenseKey());
  localStorage.removeItem(verdictKey());
}

function cachedVerdict(): Verdict | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(verdictKey()) ?? 'null') as Verdict | null;
    return value && typeof value.valid === 'boolean' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function isUnlocked(): boolean {
  return Boolean(getLicense()) && cachedVerdict()?.valid !== false;
}

export async function verifyLicense(force = false): Promise<Verdict | undefined> {
  const token = getLicense();
  if (!token) return undefined;
  const cached = cachedVerdict();
  if (!force && cached?.checkedAt && Date.now() - cached.checkedAt < DAY) return cached;
  try {
    const response = await fetch(`${BASE_URL}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('Verification service unavailable');
    const body = await response.json() as { valid: boolean; reason?: string };
    const verdict = { valid: Boolean(body.valid), reason: body.reason, checkedAt: Date.now() };
    localStorage.setItem(verdictKey(), JSON.stringify(verdict));
    return verdict;
  } catch {
    return force ? undefined : cached;
  }
}
