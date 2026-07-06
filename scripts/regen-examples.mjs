#!/usr/bin/env node
// Regenerate every shipped sample/example HTML onto the CURRENT template
// runtime. Each shipped file is a self-contained snapshot; per the skill's
// authoring model the only per-file authored content is the config object
// (`const app = {...};` for the interactive skeleton, `const config = {...};`
// for the platform poster) and the <title>. Everything else is the template —
// so after editing assets/skeleton.html or assets/platform-skeleton.html,
// run `node scripts/regen-examples.mjs` and re-verify every file's audit in
// a browser before shipping.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { configSpan, titleOf, spliceTitle, SpliceError } from "./splice.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  { file: "examples/pulsepay-architecture.html", template: "assets/skeleton.html", marker: "const app = {",
    title: "PulsePay Architecture — Interactive Diagram" }, // upgrade its generic title
  { file: "samples/ai-agent-platform.html", template: "assets/skeleton.html", marker: "const app = {" },
  { file: "examples/ai-agent-platform-poster.html", template: "assets/platform-skeleton.html", marker: "const config = {" },
  { file: "examples/pulsepay-platform-poster.html", template: "assets/platform-skeleton.html", marker: "const config = {" },
  { file: "samples/platform-architecture.html", template: "assets/platform-skeleton.html", marker: "const config = {" },
];

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

try {
  for (const t of TARGETS) {
    const target = readFileSync(join(ROOT, t.file), "utf8");
    const template = readFileSync(join(ROOT, t.template), "utf8");
    const [ta, tb] = configSpan(target, t.marker, t.file);
    const [pa, pb] = configSpan(template, t.marker, t.template);
    const title = t.title || titleOf(target, t.file);
    const out = spliceTitle(template.slice(0, pa) + target.slice(ta, tb) + template.slice(pb), title);
    writeFileSync(join(ROOT, t.file), out);
    console.log(`✓ regenerated ${t.file}  (template: ${t.template}, title: "${title}")`);
  }
  console.log("done — open each file and confirm its layout audit passes before shipping.");
} catch (e) {
  if (e instanceof SpliceError) fail(e.message);
  throw e;
}
