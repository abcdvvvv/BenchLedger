import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const assets = join(dist, "assets");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const fail = (message) => { throw new Error(`Build verification failed: ${message}`); };
const files = readdirSync(assets);
const indexHtml = readFileSync(join(dist, "index.html"), "utf8");
const entryMatch = indexHtml.match(/<script[^>]+type="module"[^>]+src="\.\/assets\/([^"]+\.js)"/);
if (!entryMatch) fail("production entry script was not found in dist/index.html");
const entryFile = entryMatch[1];
const entrySource = readFileSync(join(assets, entryFile), "utf8");
const plotlyFile = files.find((file) => /^plotly-.*\.js$/.test(file));
if (!plotlyFile) fail("Plotly chunk is missing");
const escapedPlotlyFile = plotlyFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
if (!new RegExp(`(?:from|import)\\s*["']\\./${escapedPlotlyFile}["']`).test(entrySource)) fail("Plotly is no longer statically preloaded by the application entry");
if (new RegExp(`import\\(\\s*["']\\./${escapedPlotlyFile}["']`).test(entrySource)) fail("Plotly was converted to lazy loading");
if (!files.some((file) => /^sqlite3-worker1-.*\.js$/.test(file))) fail("SQLocal SQLite worker chunk is missing");
if (!files.some((file) => /^sqlite3-.*\.wasm$/.test(file))) fail("SQLocal SQLite WASM asset is missing");
if (files.some((file) => /^debug-menu\.sqlite$/.test(file)) || statExists(join(dist, "debug-menu.sqlite"))) fail("debug-menu.sqlite leaked into the production build");
const javascript = files.filter((file) => file.endsWith(".js")).map((file) => readFileSync(join(assets, file), "utf8")).join("\n");
if (javascript.includes('"allowScripts"') || javascript.includes('"test:watch"')) fail("package.json content leaked into the browser bundle");
if (!indexHtml.includes(`<meta name="benchledger-version" content="${packageJson.version}" />`)) fail(`application version ${packageJson.version} is missing from dist/index.html`);
const textArtifacts = [indexHtml, ...files.filter((file) => /\.(?:js|css)$/.test(file)).map((file) => readFileSync(join(assets, file), "utf8"))].join("\n");
if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(textArtifacts)) fail("production build still references Google Fonts");
if (!files.some((file) => /^InterVariable-(?!Italic-).+\.woff2$/.test(file))) fail("self-hosted Inter regular font asset is missing");

function statExists(path) {
  try { return statSync(path).isFile(); } catch { return false; }
}

process.stdout.write(`Verified production build entry ${basename(entryFile)}.\n`);
