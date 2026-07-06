// Shared config-splice primitives used by both scripts/regen-examples.mjs and
// scripts/upgrade-diagram.mjs. Single source of truth for how the authored
// config object and <title> are located inside a skeleton-derived HTML file.
//
// Authoring model: the only per-file authored content is the config object
// (`const app = {...};` for the interactive skeleton, `const config = {...};`
// for the platform poster) and the <title>. Everything else belongs to the
// template, so both regen (template -> shipped file) and upgrade (arbitrary
// file -> current template) perform the same span-extraction + splice.

export const END = "\n      };"; // config end marker (both templates share the indentation convention)

// Thrown when the config span or title cannot be located unambiguously.
// Callers decide how to report/exit (regen exits 1 immediately; upgrade
// aborts before any write and prints a manual-splice fallback message).
export class SpliceError extends Error {}

// span = [start, end) of the config object inside `html`
export function configSpan(html, marker, file) {
  const a = html.indexOf(marker);
  if (a < 0) throw new SpliceError(`${file}: config marker "${marker}" not found`);
  if (html.indexOf(marker, a + 1) >= 0) throw new SpliceError(`${file}: config marker "${marker}" is ambiguous (found twice)`);
  const b = html.indexOf(END, a);
  if (b < 0) throw new SpliceError(`${file}: config end marker not found after ${marker}`);
  const end = b + END.length;

  // Heuristic guard: the END marker is just the first "\n      };" found after
  // the marker, with no real brace-counting. If an authored value inside the
  // config happens to contain that exact literal (e.g. embedded in a string),
  // the span above truncates early and produces a corrupted extraction. A
  // simple brace-balance count catches the common premature-END case (it is
  // NOT a full parser and won't catch every pathological input — e.g. braces
  // hidden inside strings that still balance numerically).
  const configText = html.slice(a, end);
  const opens = (configText.match(/\{/g) || []).length;
  const closes = (configText.match(/\}/g) || []).length;
  if (opens !== closes) {
    throw new SpliceError(
      `${file}: config span looks truncated (unbalanced braces: ${opens} "{" vs ${closes} "}") — ` +
        `likely a premature end-marker match; aborting before any write`,
    );
  }

  return [a, end];
}

export function titleOf(html, file) {
  const m = html.match(/<title>([^<]*)<\/title>/);
  if (!m) throw new SpliceError(`${file}: <title> not found`);
  return m[1];
}

// Replace the <title> content, immune to $-token interpretation in `title`
// (String.replace treats $$, $&, $`, $', $<name> specially in a *string*
// replacement — a function replacer sidesteps that entirely).
export function spliceTitle(html, title) {
  return html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
}
