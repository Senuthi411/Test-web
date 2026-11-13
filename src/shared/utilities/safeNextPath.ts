/**
 * Only accepts same-origin, absolute in-app paths for the post-login redirect, so a
 * crafted `?next=` cannot send users to another site.
 */
export function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  return next
}
