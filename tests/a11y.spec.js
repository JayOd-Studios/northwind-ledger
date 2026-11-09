const { test, expect } = require("@playwright/test");
const axeModule = require("@axe-core/playwright");
const AxeBuilder = axeModule.default || axeModule;

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

function formatViolations(result) {
  return result.violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join("; ");
      return violation.id + ": " + violation.help + " — " + targets;
    })
    .join("\n");
}

async function scan(page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}

test("has no WCAG A/AA violations in either theme", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#reconTitle")).toBeVisible();

  const dark = await scan(page);
  expect(dark.violations, formatViolations(dark)).toEqual([]);

  await page.locator("#themeToggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const light = await scan(page);
  expect(light.violations, formatViolations(light)).toEqual([]);
});

test("has no WCAG A/AA violations with the matching dialog open", async ({ page }) => {
  await page.goto("/");
  await page.locator("#reviewList .review-open").first().click();
  await expect(page.locator("#matchDialog")).toHaveJSProperty("open", true);

  const result = await scan(page);
  expect(result.violations, formatViolations(result)).toEqual([]);
});
