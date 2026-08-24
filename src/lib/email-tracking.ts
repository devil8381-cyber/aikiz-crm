/**
 * Wraps an HTML email body with:
 *  - a 1x1 tracking pixel (open tracking)
 *  - click-through redirect links (click tracking)
 * Both hit /api/email/track, keyed by the EmailLog.trackToken.
 */
export function withTracking(html: string, trackToken: string, baseUrl: string): string {
  if (!baseUrl || !trackToken) return html // tracking is best-effort; never block sending on it

  let out = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_match, url: string) =>
      `href="${baseUrl}/api/email/track?t=${encodeURIComponent(trackToken)}&r=${encodeURIComponent(url)}"`
  )

  const pixel = `<img src="${baseUrl}/api/email/track?t=${encodeURIComponent(trackToken)}&px=1" width="1" height="1" alt="" style="display:none;border:0;" />`
  out = out.replace("</body>", `${pixel}</body>`)
  return out
}
