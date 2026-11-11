/**
 * Vercel Web Analytics beforeSend (QA Q1): drop the URL fragment from every event, so a #token= (ACCM confirm link)
 * or any other fragment never reaches analytics, even if an event fires before the page strips it.
 */
export function stripUrlFragment<T extends { url: string }>(event: T): T {
  const i = event.url.indexOf("#");
  return i === -1 ? event : { ...event, url: event.url.slice(0, i) };
}
