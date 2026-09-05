export function parseContributionLabel(label) {
  if (!label) return null;
  const text = String(label).trim();
  if (/^No contributions\b/i.test(text)) return 0;
  const match = text.match(/^(\d+)\s+contributions?\b/i);
  return match ? Number(match[1]) : null;
}

export function parseContributionCalendarHtml(html) {
  const tooltips = new Map();
  for (const match of String(html).matchAll(/<tool-tip\b([^>]*)>([^<]*)<\/tool-tip>/gi)) {
    const forId = match[1].match(/\bfor="([^"]+)"/i)?.[1];
    if (forId) tooltips.set(forId, match[2].trim());
  }

  const days = new Map();
  for (const match of String(html).matchAll(/<td\b([^>]*)>/gi)) {
    const attrs = match[1];
    if (!/\bContributionCalendar-day\b/.test(attrs)) continue;
    const date = attrs.match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    if (!date || !id) continue;
    const count = parseContributionLabel(tooltips.get(id));
    if (count == null) continue;
    days.set(date, count);
  }
  return days;
}

export function contributionCalendarUrl(username) {
  return `https://github.com/users/${encodeURIComponent(username)}/contributions`;
}
