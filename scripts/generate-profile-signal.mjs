import { mkdir, readFile, writeFile } from "node:fs/promises";

const CONFIG = {
  username: "Zunbreak",
  days: 14,
  width: 1200,
  height: 190,
  panel: {
    radius: 8,
    strokeWidth: 2,
    goldHairline: 2,
  },
  colors: {
    background: "#07090d",
    frame: "#343a43",
    gold: "#e8ad21",
    text: "#f4f1e9",
    muted: "#8b949e",
    divider: "#252b33",
    graph: "#e8ad21",
  },
  labels: {
    contributions: "CONTRIBUTIONS · LAST 14 DAYS",
    latestActivity: "LATEST ACTIVITY",
    latestPublicPush: "LATEST PUBLIC PUSH",
    empty: "—",
  },
  months: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  graph: {
    x0: 40,
    x1: 1160,
    yBase: 158,
    amplitude: 28,
    lineWidth: 1.25,
    areaOpacity: 0.12,
    barWidth: 5,
    glowWidth: 6,
    glowBlur: 2.5,
  },
  terminal: {
    x: 36,
    y: 182,
    size: 13,
    tracking: 0.35,
    prompt: "C:\\Zunbreak>",
    message: "Knock, knock.",
    cursorDx: 3,
    duration: "1.05s",
    calcMode: "discrete",
  },
  type: {
    labelSize: 14,
    labelTracking: 1.6,
    valueSize: 42,
    dateSize: 22,
    publicSize: 18,
    family: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  maxPublicChars: 36,
};

const username = process.env.GITHUB_USERNAME || CONFIG.username;
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "zunbreak-profile-signal",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function utcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(value) {
  return utcDay(new Date(value)).toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return CONFIG.labels.empty;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return CONFIG.labels.empty;
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${day} ${CONFIG.months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function clip(value, max) {
  const text = String(value);
  return text.length <= max ? text : `${text.slice(0, Math.max(max - 1, 1))}…`;
}

function catmullRomPath(points, yMax) {
  if (points.length === 0) return "";
  const at = (index) => points[Math.max(0, Math.min(points.length - 1, index))];
  const clampY = (y) => (yMax == null ? y : Math.min(y, yMax));
  const parts = [`M ${points[0].x.toFixed(1)} ${clampY(points[0].y).toFixed(1)}`];
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = at(index - 1);
    const p1 = at(index);
    const p2 = at(index + 1);
    const p3 = at(index + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    parts.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${clampY(p2.y).toFixed(1)}`,
    );
  }
  return parts.join(" ");
}

async function getJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

async function graphql(query, variables) {
  if (!token) return null;
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(`GitHub GraphQL ${response.status}: ${JSON.stringify(payload.errors || payload)}`);
  }
  return payload.data;
}

const now = utcDay(new Date());
const from = new Date(now.getTime() - (CONFIG.days - 1) * 86_400_000);
const to = new Date(now.getTime() + 86_400_000 - 1);

const query = `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        restrictedContributionsCount
        latestRestrictedContributionDate
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const [graph, eventPages, publicRepos] = await Promise.all([
  graphql(query, { login: username, from: from.toISOString(), to: to.toISOString() }),
  Promise.all(
    [1, 2, 3].map((page) =>
      getJson(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`),
    ),
  ),
  getJson(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=public&sort=pushed&per_page=20`,
  ),
]);

const collection = graph?.user?.contributionsCollection ?? null;
const calendarDays = (collection?.contributionCalendar?.weeks ?? [])
  .flatMap((week) => week.contributionDays)
  .sort((a, b) => a.date.localeCompare(b.date));

const lastFourteen = Array.from({ length: CONFIG.days }, (_, index) => {
  const date = dayKey(now.getTime() - (CONFIG.days - 1 - index) * 86_400_000);
  const match = calendarDays.find((day) => day.date === date);
  return { date, contributionCount: Number(match?.contributionCount ?? 0) };
});

const calendarTotal = Number(collection?.contributionCalendar?.totalContributions);
const contributionTotal = Number.isFinite(calendarTotal)
  ? calendarTotal
  : lastFourteen.reduce((sum, day) => sum + day.contributionCount, 0);
const restrictedCount = Number(collection?.restrictedContributionsCount ?? 0);
const latestRestricted = collection?.latestRestrictedContributionDate
  ? dayKey(collection.latestRestrictedContributionDate)
  : null;

const publicPush = eventPages
  .flat()
  .find((event) => event?.type === "PushEvent" && event?.repo?.name);
const latestPublicRepo = Array.isArray(publicRepos)
  ? publicRepos.find((repo) => repo?.name && repo.private !== true && !repo.fork)
  : null;

const publicRepo = publicPush?.repo?.name || (latestPublicRepo ? `${latestPublicRepo.owner?.login || username}/${latestPublicRepo.name}` : "");
const publicPushAt = publicPush?.created_at || latestPublicRepo?.pushed_at || null;

const latestCalendarDay = [...lastFourteen].reverse().find((day) => day.contributionCount > 0)?.date || null;
const latestActivityDate =
  [latestCalendarDay, latestRestricted, publicPushAt ? dayKey(publicPushAt) : null]
    .filter(Boolean)
    .sort()
    .at(-1) || null;

const maxDaily = Math.max(...lastFourteen.map((day) => day.contributionCount), 1);
const { x0, x1, yBase, amplitude, lineWidth, areaOpacity, barWidth, glowWidth, glowBlur } = CONFIG.graph;
const span = Math.max(CONFIG.days - 1, 1);
const peakY = yBase - amplitude;

const points = lastFourteen.map((day, index) => {
  const x = x0 + (index / span) * (x1 - x0);
  const y = yBase - (day.contributionCount / maxDaily) * amplitude;
  return { x, y, count: day.contributionCount };
});

const curve = catmullRomPath(points, yBase);
const areaPath = `${curve} L ${x1.toFixed(1)} ${yBase} L ${x0.toFixed(1)} ${yBase} Z`;
const graphBars = points
  .map((point) => {
    const height = Math.max(2, yBase - point.y);
    const opacity = point.count === 0 ? 0.12 : 0.22 + (point.count / maxDaily) * 0.45;
    return `<rect x="${(point.x - barWidth / 2).toFixed(1)}" y="${point.y.toFixed(1)}" width="${barWidth}" height="${height.toFixed(1)}" fill="${CONFIG.colors.graph}" opacity="${opacity.toFixed(2)}"/>`;
  })
  .join("");

const lastPublicValue = publicRepo
  ? `${clip(publicRepo.toUpperCase(), CONFIG.maxPublicChars)} · ${formatDate(publicPushAt)}`
  : CONFIG.labels.empty;

const terminalLine = `${CONFIG.terminal.prompt} ${CONFIG.terminal.message}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CONFIG.width}" height="${CONFIG.height}" viewBox="0 0 ${CONFIG.width} ${CONFIG.height}" role="img" aria-labelledby="title description">
  <title id="title">Zunbreak GitHub activity</title>
  <desc id="description">Fourteen-day contributions, latest activity date and latest public push.</desc>
  <defs>
    <linearGradient id="signalPeak" gradientUnits="userSpaceOnUse" x1="0" y1="${peakY}" x2="0" y2="${yBase}">
      <stop offset="0" stop-color="${CONFIG.colors.graph}" stop-opacity="0.92"/>
      <stop offset="1" stop-color="${CONFIG.colors.graph}" stop-opacity="0.18"/>
    </linearGradient>
    <linearGradient id="signalGlow" gradientUnits="userSpaceOnUse" x1="0" y1="${peakY}" x2="0" y2="${yBase}">
      <stop offset="0" stop-color="${CONFIG.colors.graph}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${CONFIG.colors.graph}" stop-opacity="0.04"/>
    </linearGradient>
    <filter id="signalBlur" x="-8%" y="-80%" width="116%" height="260%">
      <feGaussianBlur stdDeviation="${glowBlur}"/>
    </filter>
  </defs>
  <rect x="1" y="1" width="${CONFIG.width - 2}" height="${CONFIG.height - 2}" rx="${CONFIG.panel.radius}" fill="${CONFIG.colors.background}" stroke="${CONFIG.colors.frame}" stroke-width="${CONFIG.panel.strokeWidth}"/>
  <path d="M18 2 H1182" fill="none" stroke="${CONFIG.colors.gold}" stroke-width="${CONFIG.panel.goldHairline}" opacity="0.78"/>
  <line x1="400" y1="28" x2="400" y2="128" stroke="${CONFIG.colors.divider}" stroke-width="1"/>
  <line x1="800" y1="28" x2="800" y2="128" stroke="${CONFIG.colors.divider}" stroke-width="1"/>
  <g font-family="${CONFIG.type.family}">
    <text x="36" y="52" fill="${CONFIG.colors.gold}" font-size="${CONFIG.type.labelSize}" letter-spacing="${CONFIG.type.labelTracking}">${escapeXml(CONFIG.labels.contributions)}</text>
    <text x="36" y="108" fill="${CONFIG.colors.text}" font-size="${CONFIG.type.valueSize}" font-weight="700">${escapeXml(String(contributionTotal))}</text>
    <text x="428" y="52" fill="${CONFIG.colors.gold}" font-size="${CONFIG.type.labelSize}" letter-spacing="${CONFIG.type.labelTracking}">${escapeXml(CONFIG.labels.latestActivity)}</text>
    <text x="428" y="108" fill="${CONFIG.colors.text}" font-size="${CONFIG.type.dateSize}">${escapeXml(formatDate(latestActivityDate))}</text>
    <text x="828" y="52" fill="${CONFIG.colors.gold}" font-size="${CONFIG.type.labelSize}" letter-spacing="${CONFIG.type.labelTracking}">${escapeXml(CONFIG.labels.latestPublicPush)}</text>
    <text x="828" y="108" fill="${CONFIG.colors.text}" font-size="${CONFIG.type.publicSize}">${escapeXml(lastPublicValue)}</text>
    <text x="${CONFIG.terminal.x}" y="${CONFIG.terminal.y}" fill="${CONFIG.colors.gold}" font-size="${CONFIG.terminal.size}" letter-spacing="${CONFIG.terminal.tracking}" font-weight="600">${escapeXml(terminalLine)}<tspan dx="${CONFIG.terminal.cursorDx}"><animate attributeName="opacity" values="1;0" dur="${CONFIG.terminal.duration}" calcMode="${CONFIG.terminal.calcMode}" repeatCount="indefinite"/>█</tspan></text>
  </g>
  <path d="${areaPath}" fill="${CONFIG.colors.graph}" opacity="${areaOpacity}"/>
  ${graphBars}
  <path d="${curve}" fill="none" stroke="url(#signalGlow)" stroke-width="${glowWidth}" stroke-linecap="round" filter="url(#signalBlur)"/>
  <path d="${curve}" fill="none" stroke="url(#signalPeak)" stroke-width="${lineWidth}" stroke-linecap="round"/>
</svg>
`;

const out = new URL("../assets/profile-signal.svg", import.meta.url);
await mkdir(new URL(".", out), { recursive: true });
const next = svg.trim() + "\n";
let previous = "";
try {
  previous = await readFile(out, "utf8");
} catch {
  previous = "";
}
if (previous !== next) await writeFile(out, next, "utf8");
console.log(
  `Profile signal ${previous === next ? "unchanged" : "updated"}: ${contributionTotal} contributions, restricted=${restrictedCount}`,
);
