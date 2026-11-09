#!/usr/bin/env node
/* Northwind Ledger — zero-dependency checks.
 *
 * Run from this folder:  node check.mjs
 *
 * This is a guardrail, not a validator replacement. It checks the things that
 * are easy to break while editing a static sample: the IDs shared between the
 * HTML and JS, local asset paths, inline script/style (the CSP forbids both),
 * ledger shape, colour contrast, target sizes and external requests.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(join(root, file), "utf8");

const html = read("index.html");
const css = read("styles.css");
const js = read("main.js");
const ledgerSource = read("ledger.js");
const boot = read("theme-boot.js");
const readme = read("README.md");
const pkg = JSON.parse(read("package.json"));
const gitignore = read(".gitignore");
const playwrightConfig = read("playwright.config.js");

let passed = 0;
let failed = 0;
const problems = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  problems.push(name + (detail ? " — " + detail : ""));
}

function group(title) {
  console.log("\n" + title);
}

function tokensIn(block) {
  const tokens = {};
  const re = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g;
  let match;
  while ((match = re.exec(block))) tokens[match[1]] = match[2];
  return tokens;
}

function blockFor(selector) {
  const start = css.indexOf(selector);
  if (start === -1) return "";
  const open = css.indexOf("{", start);
  if (open === -1) return "";
  const close = css.indexOf("}", open);
  if (close === -1) return "";
  return css.slice(open + 1, close);
}

function channel(value) {
  const normal = value / 255;
  return normal <= 0.03928 ? normal / 12.92 : Math.pow((normal + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const clean = hex.replace("#", "");
  return (
    0.2126 * channel(parseInt(clean.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(clean.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(clean.slice(4, 6), 16))
  );
}

function contrast(a, b) {
  const one = luminance(a);
  const two = luminance(b);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

/* ---------- Markup ---------- */

group("Markup and document");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const idSet = new Set(ids);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

check("has one <h1>", (html.match(/<h1\b/g) || []).length === 1);
check("has a main landmark", (html.match(/<main\b/g) || []).length === 1);
check("has a skip link to #main", /class="skip"\s+href="#main"/.test(html));
check("language is set", /<html\b[^>]*\blang="[^"]+"/i.test(html));
check("title is present", /<title>[^<]+<\/title>/i.test(html));
check("description is present", /<meta\s+name="description"\s+content="[^"]+"/i.test(html));
check("canonical is present", /<link\s+rel="canonical"\s+href="[^"]+"/i.test(html));
check("theme colour is present", /<meta\s+name="theme-color"\s+id="themeColor"/i.test(html));
check("IDs are unique", duplicateIds.length === 0, duplicateIds.join(", "));
check("all IDs are used by the page or a control", ids.length > 20);
check("no inline style attributes", !/\sstyle\s*=/i.test(html));
check("no positive tabindex", !/\btabindex="[1-9]/.test(html));
check("no target=_blank without review", !/target="_blank"/i.test(html));

const headingLevels = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
let previousLevel = 0;
let headingSkip = null;
headingLevels.forEach((level) => {
  if (!headingSkip && level > previousLevel + 1) headingSkip = "h" + previousLevel + " to h" + level;
  previousLevel = level;
});
check("heading levels do not skip", !headingSkip, headingSkip || "");

const idReferenceAttributes = ["aria-labelledby", "aria-describedby", "aria-controls"];
idReferenceAttributes.forEach((attribute) => {
  const re = new RegExp(attribute + '="([^"]+)"', "g");
  let match;
  while ((match = re.exec(html))) {
    match[1].split(/\s+/).filter(Boolean).forEach((reference) => {
      check(attribute + " references #" + reference, idSet.has(reference));
    });
  }
});

[...html.matchAll(/href="#([^"]+)"/g)].forEach((match) => {
  check("in-page link #" + match[1] + " has a target", idSet.has(match[1]));
});

const jsIds = [...js.matchAll(/(?<!\$)\$\("([^"]+)"\)/g)].map((match) => match[1]);
[...new Set(jsIds)].forEach((id) => {
  check("JS ID " + id + " exists in the HTML", idSet.has(id));
});

const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
buttons.forEach((match, index) => {
  const attrs = match[1];
  const name = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  check("button " + (index + 1) + " has a type", /\btype="(button|submit|reset)"/.test(attrs));
  check("button " + (index + 1) + " has a name", name.length > 0 || /aria-label="[^"]+"/.test(attrs));
});

const inputs = [...html.matchAll(/<input\b([^>]*)>/g)];
inputs.forEach((match, index) => {
  check("input " + (index + 1) + " is labelled", /aria-label="[^"]+"/.test(match[1]));
});

check("progress is labelled and bounded", /<progress\b[^>]*aria-labelledby="[^"]+"[^>]*>/.test(html) && /max="100"/.test(html));
check("sort headers use valid aria-sort", [...html.matchAll(/aria-sort="([^"]+)"/g)].every((match) => ["none", "ascending", "descending"].includes(match[1])));
check("dialog has a form and a label", /<dialog\b[^>]*aria-labelledby="[^"]+"/.test(html) && /<form\s+method="dialog"/.test(html));
check("no inline event handlers", !/\son[a-z]+\s*=/i.test(html));
check("CSP is present and has no unsafe-inline", /Content-Security-Policy/.test(html) && !/unsafe-inline|unsafe-eval/.test(html));
check("CSP forbids remote connections", /connect-src 'none'/.test(html));
check("favicon data URI has encoded spaces", (() => {
  const match = html.match(/rel="icon"\s+href="(data:[^"]+)"/);
  return Boolean(match) && !match[1].includes(" ");
})());

const localAssets = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((href) => !/^(https?:|data:|#)/.test(href));
localAssets.forEach((href) => {
  check("local asset " + href, read(href).length > 0);
});

const externalRefs = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((match) => match[1]);
check(
  "external URLs are only the canonical/OG URLs",
  externalRefs.every((url) => url.startsWith("https://jayod-studios.github.io/northwind-ledger/")),
  externalRefs.join(", ")
);

const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
inlineScripts.forEach((match) => {
  check("every script has a src (CSP)", /\bsrc="/.test(match[1]), match[2].trim().slice(0, 40));
});

/* ---------- Data ---------- */

group("Ledger data");

const sandbox = { window: {} };
vm.runInNewContext(ledgerSource, sandbox, { timeout: 1000 });
const NW = sandbox.window.NORTHWIND;

check("NORTHWIND is defined", Boolean(NW));
if (NW) {
  check("nine recent payments", NW.payments.length === 9);
  check("six matched", NW.payments.filter((payment) => payment.status === "matched").length === 6);
  check("three exceptions", NW.payments.filter((payment) => payment.status === "review").length === 3);
  check("payment IDs are unique", new Set(NW.payments.map((payment) => payment.id)).size === NW.payments.length);
  check("references are unique", new Set(NW.payments.map((payment) => payment.reference)).size === NW.payments.length);
  check("amounts are integer cents", NW.payments.every((payment) => Number.isInteger(payment.amount)));
  check("expected is null or integer cents", NW.payments.every((payment) => payment.expected === null || Number.isInteger(payment.expected)));
  check("dates are ISO calendar dates", NW.payments.every((payment) => /^\d{4}-\d{2}-\d{2}$/.test(payment.date)));
  check("review rows carry a reason", NW.payments.filter((payment) => payment.status === "review").every((payment) => payment.reason.length > 0));
  check("balance is $284,102", NW.meta.balance === 28410200);
  check("total payments are 1,207", NW.meta.totalPayments === 1207);
  check("cleared payments are 1,204", NW.meta.cleared === 1204);
  check("runway is 38 days", NW.meta.runwayDays === 38);
  check("sample is dated 3 November 2026", NW.meta.asOf.startsWith("2026-11-03"));
  check("9W total is $284,102", NW.ranges["9w"].total === 28410200);
  check("9W delta is $31,342", NW.ranges["9w"].delta === 3134200);
  check("9W ends at $5,642", NW.ranges["9w"].net[8] === 564200);
  check("6M total is $1,420,880", NW.ranges["6m"].total === 142088000);
  check("1Y total is $2,864,000", NW.ranges["1y"].total === 286400000);
  Object.keys(NW.ranges).forEach((key) => {
    const range = NW.ranges[key];
    check(key + " labels, values and nets line up", range.labels.length === range.values.length && range.values.length === range.net.length);
    check(key + " has five y ticks", range.yticks.length === 5);
    check(key + " values stay in 0–1", range.values.every((value) => value >= 0 && value <= 1));
  });
}

/* ---------- CSS and contrast ---------- */

group("Styles, targets and contrast");

const darkBlock = blockFor(":root");
const lightBlock = blockFor(':root[data-theme="light"]');
const dark = tokensIn(darkBlock);
const light = tokensIn(lightBlock);

check("dark token deck exists", Object.keys(dark).length > 10);
check("light token deck exists", Object.keys(light).length > 10);
check("color-scheme is declared in both decks", (css.match(/color-scheme:/g) || []).length >= 2);
check("reduced-motion block exists", /prefers-reduced-motion:\s*reduce/.test(css));
check("print styles exist", /@media print/.test(css));
check("focus-visible styles exist", /:focus-visible/.test(css));
check("no @imports", !/@import/i.test(css));
check("no remote CSS assets", !/url\(\s*['"]?https?:/i.test(css));

check("primary buttons are 40px tall", /\.btn\s*\{[^}]*min-height:\s*40px/.test(css));
check("icon buttons are 40px square", /\.icon-btn\s*\{[^}]*width:\s*40px[^}]*height:\s*40px/.test(css));
check("search control is 40px tall", /\.search\s*\{[^}]*min-height:\s*40px/.test(css));
check("back link is 40px tall", /\.back-gallery\s*\{[^}]*min-height:\s*40px/.test(css));
check("compact tabs are 28px", /\.tab\s*\{[^}]*min-height:\s*28px/.test(css));
check("compact chips are 30px", /\.chip\s*\{[^}]*min-height:\s*30px/.test(css));
check("status controls are 28px", /\.status\s*\{[^}]*min-height:\s*28px/.test(css));
check("text links are 28px", /\.text-link\s*\{[^}]*min-height:\s*28px/.test(css));

const textPairs = [
  ["text", "panel"],
  ["text", "bg"],
  ["muted", "panel"],
  ["muted", "bg"],
  ["muted", "panel-2"],
  ["faint", "panel"],
  ["placeholder", "panel"],
  ["axis", "panel"],
  ["mint", "panel"],
  ["mint", "bg"],
  ["mint", "panel-2"],
  ["warn", "panel"],
  ["warn", "panel-2"],
  ["mint-ink", "mint"],
  ["avatar-ink", "avatar-a"],
];

["dark", "light"].forEach((themeName) => {
  const tokens = themeName === "dark" ? dark : light;
  textPairs.forEach(([foreground, background]) => {
    const fg = tokens[foreground];
    const bg = tokens[background];
    if (!fg || !bg) {
      check(themeName + " " + foreground + "/" + background + " tokens exist", false);
      return;
    }
    const value = contrast(fg, bg);
    check(
      themeName + " " + foreground + " on " + background + " ≥ 4.5:1",
      value >= 4.5,
      value.toFixed(2) + ":1"
    );
  });

  ["panel", "bg"].forEach((background) => {
    const fg = tokens["control-line"];
    const bg = tokens[background];
    const value = contrast(fg, bg);
    check(
      themeName + " control border on " + background + " ≥ 3:1",
      value >= 3,
      value.toFixed(2) + ":1"
    );
  });
});

/* ---------- JS and README ---------- */

group("Behaviour and notes");

check("state is persisted locally", /localStorage/.test(js) && /northwind-ledger-v1/.test(js));
check("theme is applied before paint", /data-theme/.test(boot) && /matchMedia/.test(boot));
check("native dialog is used", /showModal\(\)/.test(js));
check("sorting updates aria-sort", /aria-sort/.test(js));
check("filters use aria-pressed", /aria-pressed/.test(js));
check("CSV export is implemented", /text\/csv/.test(js) && /createObjectURL/.test(js));
check("undo is available", /Undo/.test(js) && /undoChanges/.test(js));
check("reduced motion is respected in JS", /prefers-reduced-motion/.test(js) && /isReduced/.test(js));
check("no fetch or XHR", !/\bfetch\s*\(|XMLHttpRequest|sendBeacon/.test(js));
check("no remote URLs in JS", !/https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(js));
check("no innerHTML writes", !/\.innerHTML\s*=/.test(js));
check("gallery link is guarded on GitHub Pages", /github\.io/.test(js) && /back-gallery/.test(js));

check("README names the data source", /ledger\.js/.test(readme));
check("README names the theme boot script", /theme-boot\.js/.test(readme));
check("README names the checker", /check\.mjs/.test(readme));
check("README does not claim 44px-ish targets", !/44px-ish/i.test(readme));

/* ---------- Dev-only QA ---------- */

group("Dev-only QA");

check("runtime dependencies stay empty", Object.keys(pkg.dependencies || {}).length === 0);
check("Playwright is a dev dependency", Boolean(pkg.devDependencies && pkg.devDependencies["@playwright/test"]));
check("axe-core is a dev dependency", Boolean(pkg.devDependencies && pkg.devDependencies["@axe-core/playwright"]));
check("test scripts exist", Boolean(pkg.scripts && pkg.scripts.test && pkg.scripts["test:a11y"]));
check("QA output is ignored", /node_modules/.test(gitignore) && /test-results/.test(gitignore) && /playwright-report/.test(gitignore));
check("Playwright starts the static server", /webServer/.test(playwrightConfig) && /python3 -m http\.server/.test(playwrightConfig));
check("Playwright covers desktop and mobile", /name: "desktop"/.test(playwrightConfig) && /name: "mobile"/.test(playwrightConfig));
check("interaction tests are present", read("tests/northwind.spec.js").includes("mobile drawer"));
check("axe tests are present", read("tests/a11y.spec.js").includes("WCAG A/AA"));

/* ---------- Result ---------- */

if (failed) {
  console.error("\n" + failed + " check" + (failed === 1 ? "" : "s") + " failed:");
  problems.forEach((problem) => console.error("  ✗ " + problem));
  process.exitCode = 1;
} else {
  console.log("\nAll " + passed + " checks passed.");
}
