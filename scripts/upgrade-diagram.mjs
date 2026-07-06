#!/usr/bin/env node
// Upgrade an existing diagram file (interactive skeleton or platform poster)
// onto the CURRENT template runtime, in place. This generalizes the same
// splice regen-examples.mjs performs (see scripts/splice.mjs) to an arbitrary
// user file: extract the authored config object + <title>, re-host them onto
// whichever template matches the file's marker, and write the result back —
// backing up the original first.
//
// Usage: node scripts/upgrade-diagram.mjs <file> [--check] [--force]
//   --check   print "fileVer -> targetVer" and exit; makes no changes.
//   --force   re-host even if the file is already on the current version.
//
// Authoring contract (see SKILL.md): only the config object and <title> are
// the user's — everything else belongs to the template. Manual edits made
// outside the config block are replaced by the current runtime on upgrade;
// the pre-upgrade file is preserved at <file>.bak.

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { configSpan, titleOf, spliceTitle, SpliceError } from "./splice.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const TEMPLATES = [
  { marker: "const app = {", file: "assets/skeleton.html" },
  { marker: "const config = {", file: "assets/platform-skeleton.html" },
];

function argFail(msg) {
  console.error(`✗ ${msg}`);
  console.error("usage: node scripts/upgrade-diagram.mjs <file> [--check] [--force]");
  process.exit(1);
}

function abort(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function readGenerator(html) {
  const m = html.match(/<meta\s+name="generator"\s+content="interactive-diagram\s+(v[\d.]+)"\s*\/?>/);
  return m ? m[1] : null;
}

function parseVer(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v || "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// semver compare; returns null when either side isn't parseable (not comparable)
function cmpVer(a, b) {
  const pa = parseVer(a);
  const pb = parseVer(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function detectTemplate(html, file) {
  const hits = TEMPLATES.filter((t) => html.includes(t.marker));
  if (hits.length !== 1) {
    const which =
      hits.length === 0
        ? 'neither `const app = {` nor `const config = {`'
        : 'both `const app = {` and `const config = {`';
    abort(`${file}: cannot detect template — found ${which}; unable to route this file`);
  }
  return hits[0];
}

// ---- argv ----
const KNOWN_FLAGS = new Set(["--check", "--force"]);
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const positionals = argv.filter((a) => !a.startsWith("--"));

for (const f of flags) if (!KNOWN_FLAGS.has(f)) argFail(`unknown flag "${f}"`);
if (positionals.length > 1) argFail(`unexpected extra argument(s): ${positionals.slice(1).join(", ")}`);

const check = flags.has("--check");
const force = flags.has("--force");
const file = positionals[0];

if (!file) argFail("missing <file> argument");
if (!existsSync(file)) argFail(`${file}: not found`);

const fileHtml = readFileSync(file, "utf8");
const template = detectTemplate(fileHtml, file);
const templateHtml = readFileSync(join(ROOT, template.file), "utf8");

const fileVerRaw = readGenerator(fileHtml);
const fileVerLabel = fileVerRaw || "unknown (pre-stamp)";
const targetVer = readGenerator(templateHtml);
if (!targetVer) abort(`${template.file}: current template has no generator meta — cannot determine target version`);

if (check) {
  console.log(`${fileVerLabel} -> ${targetVer}`);
  process.exit(0);
}

if (fileVerRaw && cmpVer(fileVerRaw, targetVer) === 0 && !force) {
  console.log(`${file} is already up to date (${targetVer}); no changes made. Pass --force to re-host anyway.`);
  process.exit(0);
}

// Extract BEFORE writing anything — any ambiguity aborts with zero writes.
let configText, title, pa, pb;
try {
  const [fa, fb] = configSpan(fileHtml, template.marker, file);
  configText = fileHtml.slice(fa, fb);
  title = titleOf(fileHtml, file);
  [pa, pb] = configSpan(templateHtml, template.marker, template.file);
} catch (e) {
  if (e instanceof SpliceError) {
    console.error(`✗ ${e.message}`);
    console.error(
      `could not extract this file's config unambiguously — no changes made, no backup written. ` +
        `Fall back to a manual splice: copy the config object and <title> from ${file} into a fresh copy of ${template.file} by hand.`,
    );
    process.exit(1);
  }
  throw e;
}

const backupPath = `${file}.bak`;
writeFileSync(backupPath, fileHtml);

const out = spliceTitle(templateHtml.slice(0, pa) + configText + templateHtml.slice(pb), title);

// Atomic write: write to a sibling temp file, then rename over the target so
// a mid-write failure can never leave `file` truncated/corrupted.
const tmpPath = `${file}.tmp`;
writeFileSync(tmpPath, out);
renameSync(tmpPath, file);

console.log(`upgraded ${file}: ${fileVerLabel} -> ${targetVer}`);
console.log(
  `WARN: any manual runtime edits outside the config block were replaced by the current template. Recover them from ${backupPath} if needed.`,
);
console.log("Reopen the file and confirm the layout audit passes before shipping.");
