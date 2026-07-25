const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "fbclid",
  "gclid",
];

export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }
  url.hash = "";
  url.searchParams.sort();
  const search = url.searchParams.toString();
  return `${url.origin}${url.pathname}${search ? `?${search}` : ""}`;
}
