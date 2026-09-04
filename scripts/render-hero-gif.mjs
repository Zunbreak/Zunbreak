import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const settingsPath = join(root, "assets", "zunbreak-profile-settings.json");
const gifPath = join(root, "assets", "zunbreak-hero.gif");
const framesDir = join(root, "scripts", ".gif-frames");
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const types = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === "/" ? "scripts/hero-lab-render.html" : pathname.replace(/^\//, "");
  const filePath = join(root, ...relative.split("/").filter(Boolean));
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on("open", () => {
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    stream.pipe(response);
  });
  stream.on("error", () => response.writeHead(404).end("not found"));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const payload = JSON.parse(await readFile(settingsPath, "utf8"));
const settings = payload.settings;
const fps = 12;
const naturalPeriod = 4.8 / Math.max(Number(settings.tempo) || 0.2, 0.2);
const frameCount = Math.round(naturalPeriod * fps);
const loopPeriod = frameCount / fps;
settings.loopPeriod = loopPeriod;

const browser = await puppeteer.launch({
  executablePath: edgePath,
  headless: true,
  args: ["--hide-scrollbars", "--mute-audio"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 400, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/scripts/hero-lab-render.html`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => window.HERO_READY === true);
  await page.evaluate((next) => window.setHeroSettings(next), settings);
  const startFrame = await page.evaluate((time) => window.renderHeroFrame(time), 0);
  const wrapFrame = await page.evaluate((time) => window.renderHeroFrame(time), loopPeriod);
  if (startFrame !== wrapFrame) {
    throw new Error("hero animation is not seamless: t=0 and t=loopPeriod differ");
  }
  console.log(`Seamless loop ${loopPeriod.toFixed(3)}s at ${fps} fps (${frameCount} frames)`);

  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  for (let index = 0; index < frameCount; index++) {
    const dataUrl = await page.evaluate(
      (time) => window.renderHeroFrame(time),
      (index * loopPeriod) / frameCount,
    );
    const buffer = Buffer.from(dataUrl.split(",", 2)[1], "base64");
    await writeFile(join(framesDir, `frame_${String(index).padStart(3, "0")}.png`), buffer);
    if ((index + 1) % 12 === 0) console.log(`Rendered ${index + 1}/${frameCount}`);
  }
} finally {
  await browser.close();
  server.close();
}

const palette = join(framesDir, "palette.png");
await run("ffmpeg", [
  "-y",
  "-framerate",
  String(fps),
  "-i",
  join(framesDir, "frame_%03d.png"),
  "-vf",
  "palettegen=max_colors=96:reserve_transparent=0",
  palette,
]);
await run("ffmpeg", [
  "-y",
  "-framerate",
  String(fps),
  "-i",
  join(framesDir, "frame_%03d.png"),
  "-i",
  palette,
  "-lavfi",
  "paletteuse=dither=sierra2_4a",
  "-loop",
  "0",
  gifPath,
]);
await rm(framesDir, { recursive: true, force: true });
console.log(`Wrote ${gifPath}`);
