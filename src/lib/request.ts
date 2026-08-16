// Best-effort client address, used only to key rate limiters. Vercel and
// Netlify both set x-forwarded-for; the left-most entry is the original client.
// A spoofed header can only ever cost the spoofer their own bucket, and the
// per-account limiter still applies, so this does not need to be trustworthy.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
