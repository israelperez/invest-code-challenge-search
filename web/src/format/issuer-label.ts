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
