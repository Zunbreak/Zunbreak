import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "Zunbreak";
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "zunbreak-profile-signal",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function getJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

const [repositories, ...eventPages] = await Promise.all([
  getJson(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=pushed`),
  ...[1, 2, 3].map((page) =>
    getJson(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`),
  ),
]);

const repos = repositories.filter(
  (repo) => !repo.fork && !repo.archived && repo.name.toLowerCase() !== username.toLowerCase(),
);
const events = eventPages.flat();
const pushes = events.filter((event) => event.type === "PushEvent");
const now = new Date();
const dayMs = 86_400_000;
const since30 = now.getTime() - 30 * dayMs;
const commitSize = (event) => Number(event.payload?.size ?? event.payload?.commits?.length ?? 0);
const recentPushes = pushes.filter((event) => new Date(event.created_at).getTime() >= since30);
const commits30 = recentPushes.reduce((total, event) => total + commitSize(event), 0);

const daily = Array.from({ length: 14 }, (_, index) => {
  const start = new Date(now.getTime() - (13 - index) * dayMs);
  const key = start.toISOString().slice(0, 10);
  return pushes
    .filter((event) => event.created_at.slice(0, 10) === key)
    .reduce((total, event) => total + commitSize(event), 0);
});

const languageMaps = await Promise.all(
  repos.slice(0, 16).map((repo) => getJson(repo.languages_url).catch(() => ({}))),
);
const languageTotals = new Map();
for (const languageMap of languageMaps) {
  for (const [language, bytes] of Object.entries(languageMap)) {
    languageTotals.set(language, (languageTotals.get(language) || 0) + Number(bytes));
  }
}
const allLanguageBytes = [...languageTotals.values()].reduce((sum, value) => sum + value, 0) || 1;
const languages = [...languageTotals.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 4)
  .map(([name, bytes]) => ({ name, percent: Math.round((bytes / allLanguageBytes) * 100) }));

while (languages.length < 4) languages.push({ name: "Awaiting signal", percent: 0 });

const latestPushAt = pushes[0]?.created_at || repos[0]?.pushed_at || null;
const latestPush = latestPushAt ? new Date(latestPushAt) : null;
const dateLabel = latestPush
  ? new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(latestPush).toUpperCase()
  : "AWAITING SIGNAL";
const timeLabel = latestPush
  ? `${latestPush.toISOString().slice(11, 16)} UTC`
  : "NO PUBLIC PUSH";
const signalState = commits30 >= 30 ? "HIGH ACTIVITY" : commits30 >= 10 ? "ACTIVE" : commits30 > 0 ? "LOW SIGNAL" : "QUIET";

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const maxDaily = Math.max(...daily, 1);
const activityBars = daily
  .map((value, index) => {
    const height = 8 + Math.round((value / maxDaily) * 66);
    const x = 62 + index * 12;
    const y = 206 - height;
    const opacity = value === 0 ? 0.18 : 0.48 + (value / maxDaily) * 0.52;
    return `<rect x="${x}" y="${y}" width="6" height="${height}" rx="3" fill="#f2b82b" opacity="${opacity.toFixed(2)}"/>`;
  })
  .join("");

const languageRows = languages
  .map((language, index) => {
    const y = 112 + index * 31;
    const width = Math.round(120 * Math.min(language.percent, 100) / 100);
    return `<text x="916" y="${y}" fill="#b8bec7" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11">${escapeXml(language.name.toUpperCase())}</text>
      <rect x="1030" y="${y - 9}" width="120" height="4" rx="2" fill="#252a31"/>
      <rect x="1030" y="${y - 9}" width="${width}" height="4" rx="2" fill="#e5aa1d"/>
      <text x="1163" y="${y}" text-anchor="end" fill="#6e7681" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="10">${language.percent}%</text>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="270" viewBox="0 0 1200 270" role="img" aria-labelledby="title description">
  <title id="title">Zunbreak activity signal</title>
  <description id="description">Public GitHub push activity, commit count and language distribution.</description>
  <defs>
    <linearGradient id="surface" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b0e13"/><stop offset="1" stop-color="#090b0f"/></linearGradient>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <rect x="1" y="1" width="1198" height="268" rx="16" fill="#07090d" stroke="#303640" stroke-width="2"/>

  <g>
    <rect x="22" y="22" width="266" height="226" rx="10" fill="url(#surface)" stroke="#252b33"/>
    <text x="48" y="57" fill="#e6ad24" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" letter-spacing="2">ACTIVITY / 14D</text>
    <line x1="48" y1="210" x2="260" y2="210" stroke="#252b33"/>
    ${activityBars}
    <circle cx="50" cy="230" r="4" fill="#f2b82b"/><text x="62" y="234" fill="#8b949e" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="10" letter-spacing="1">${signalState}</text>
  </g>

  <g>
    <rect x="310" y="22" width="266" height="226" rx="10" fill="url(#surface)" stroke="#252b33"/>
    <text x="336" y="57" fill="#e6ad24" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" letter-spacing="2">LAST PUBLIC PUSH</text>
    <circle cx="443" cy="127" r="45" fill="none" stroke="#5c4617"/>
    <circle cx="443" cy="127" r="28" fill="none" stroke="#9c7218"/>
    <circle cx="443" cy="127" r="7" fill="#f2b82b"/>
    <circle cx="443" cy="127" r="9" fill="#f2b82b" opacity="0.45" filter="url(#glow)"/>
    <text x="443" y="200" text-anchor="middle" fill="#f2f4f7" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13" letter-spacing="1">${dateLabel}</text>
    <text x="443" y="222" text-anchor="middle" fill="#6e7681" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="10" letter-spacing="2">${timeLabel}</text>
  </g>

  <g>
    <rect x="598" y="22" width="266" height="226" rx="10" fill="url(#surface)" stroke="#252b33"/>
    <text x="624" y="57" fill="#e6ad24" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" letter-spacing="2">PUBLIC COMMITS / 30D</text>
    <text x="624" y="143" fill="#f4f6f8" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="62" font-weight="700">${String(commits30).padStart(2, "0")}</text>
    <path d="M626 188 L646 188 655 180 666 197 677 170 688 203 699 181 710 191 721 174 732 198 743 183 754 189 774 189 786 178 798 195 810 184 834 184" fill="none" stroke="#e3a91d" stroke-width="2" opacity="0.7"/>
    <text x="624" y="225" fill="#6e7681" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="10" letter-spacing="2">PUBLIC API SIGNAL</text>
  </g>

  <g>
    <rect x="886" y="22" width="292" height="226" rx="10" fill="url(#surface)" stroke="#252b33"/>
    <text x="912" y="57" fill="#e6ad24" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" letter-spacing="2">LANGUAGE FIELD</text>
    ${languageRows}
    <text x="912" y="228" fill="#525a64" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9" letter-spacing="1">MEASURED ACROSS PUBLIC BUILDS</text>
  </g>
</svg>`;

await mkdir("assets", { recursive: true });
await writeFile("assets/zunbreak-activity.svg", svg, "utf8");
console.log(`Activity updated: ${commits30} public commits in 30 days`);

