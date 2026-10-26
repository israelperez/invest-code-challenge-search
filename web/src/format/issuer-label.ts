// Brand casing that title-casing the slug would get wrong.
const BRAND_LABELS: Record<string, string> = {
  activex: 'ActiveX',
  alliance_bernstein: 'AllianceBernstein',
  blackrock: 'BlackRock',
  digitalx: 'DigitalX',
  einvest: 'eInvest',
  etf_shares: 'ETF Shares',
  etfshares: 'ETFS',
  gci: 'GCI',
  gcq: 'GCQ',
  globalx: 'Global X',
  jpmorgan: 'JPMorgan',
  tencap: 'TenCap',
  vaneck: 'VanEck',
  wcm: 'WCM',
};

export function issuerLabel(slug: string | null): string {
  const clean = (slug ?? '').trim().toLowerCase();
  if (!clean) return '';
  const brand = BRAND_LABELS[clean];
  if (brand) return brand;
  return clean
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

// Two slugs can share a label ("investors mutual" and "investors_mutual"); those get the raw slug as a hint so they stay tellable apart.
export function issuerLabels(slugs: string[]): Map<string, { label: string; hint?: string }> {
  const seen = new Map<string, number>();
  for (const slug of slugs) seen.set(issuerLabel(slug), (seen.get(issuerLabel(slug)) ?? 0) + 1);
  return new Map(
    slugs.map((slug) => {
      const label = issuerLabel(slug);
      return [slug, seen.get(label)! > 1 ? { label, hint: slug } : { label }];
    }),
  );
}
