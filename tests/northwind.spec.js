const { test, expect } = require("@playwright/test");

function collectErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push("console: " + message.text());
  });
  page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
  return errors;
}

async function open(page) {
  await page.goto("/");
  await expect(page.locator("#reconTitle")).toBeVisible();
}

test("renders the reconciliation workspace from the sample data", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);

  await expect(page.locator("#ledgerBody tr")).toHaveCount(9);
  await expect(page.locator("#reviewList li")).toHaveCount(3);
  await expect(page.locator("#reviewCount")).toHaveText("3");
  await expect(page.locator("#reconTitle")).toContainText("Three payments");
  await expect(page.locator("#chartTableBody tr")).toHaveCount(9);
  await expect(page.locator("#chartYAxis text")).toHaveCount(5);
  await expect(page.locator("#bulkBar")).toBeHidden();
  await expect(page.locator(".back-gallery")).toBeVisible();

  const progress = await page.locator("#reconProgress").evaluate((node) => Number(node.value));
  expect(progress).toBeGreaterThan(99.7);
  expect(await page.locator("#chartLine").getAttribute("d")).toMatch(/\S/);
  expect(errors).toEqual([]);
});

test("changes a status, undoes it, and persists the next change", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);

  await page.locator('.status[data-id="inv-2036"]').click();
  await expect(page.locator("#reviewCount")).toHaveText("2");
  await expect(page.locator("#reconTitle")).toContainText("Two payments");
  await expect(page.locator("#toast")).toBeVisible();
  await expect(page.locator("#toastText")).toContainText("Ridgeway Studio");

  await page.locator("#toastAction").click();
  await expect(page.locator("#reviewCount")).toHaveText("3");

  await page.locator('.status[data-id="inv-2036"]').click();
  await page.reload();
  await expect(page.locator("#reviewCount")).toHaveText("2");
  expect(errors).toEqual([]);
});

test("filters, selects visible rows, bulk-matches, and undoes", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);

  await page.locator("#q").fill("Ridgeway");
  await expect(page.locator("#ledgerBody tr")).toHaveCount(1);
  await expect(page.locator("#rowCount")).toHaveText("1 of 9 payment");

  await page.locator("#q").fill("zzzz");
  await expect(page.locator("#empty")).toBeVisible();
  await expect(page.locator("#rowCount")).toHaveText("0 of 9 payments");
  await page.locator("#clearSearch").click();

  await page.locator('.chip[data-filter="review"]').click();
  await expect(page.locator("#ledgerBody tr")).toHaveCount(3);
  await page.locator("#selectAll").check();
  await expect(page.locator("#bulkBar")).toBeVisible();
  await expect(page.locator("#selectedCount")).toHaveText("3");

  await page.locator("#markSelected").click();
  await expect(page.locator("#reviewCount")).toHaveText("0");
  await expect(page.locator("#queueClear")).toBeVisible();
  await expect(page.locator("#reconTitle")).toHaveText("The books are ready to close.");
  await page.locator("#toastAction").click();
  await expect(page.locator("#reviewCount")).toHaveText("3");
  expect(errors).toEqual([]);
});

test("opens the matching dialog and records the decision", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);

  await page.locator("#reviewList .review-open").first().click();
  await expect(page.locator("#matchDialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#matchTitle")).toHaveText("Ridgeway Studio");
  await expect(page.locator("#matchDialog")).toBeVisible();

  await page.locator('#matchDialog [value="match"]').click();
  await expect(page.locator("#matchDialog")).toHaveJSProperty("open", false);
  await expect(page.locator("#reviewCount")).toHaveText("2");
  await expect(page.locator("#toastText")).toContainText("Ridgeway Studio marked as matched");
  expect(errors).toEqual([]);
});

test("switches chart periods and supports keyboard inspection", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);

  await page.locator('.tab[data-range="6m"]').click();
  await expect(page.locator("#chartTableBody tr")).toHaveCount(6);
  await expect(page.locator("#chartTotal")).toHaveText("$1,420,880");
  await expect(page.locator("#chartReadout")).toContainText("$48,000");

  const before = await page.locator("#chartReadout").innerText();
  await page.locator("#chart").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#chartReadout")).not.toHaveText(before);
  await expect(page.locator("#chartCursor")).not.toHaveClass(/is-hidden/);
  expect(errors).toEqual([]);
});

test("persists the theme across a reload", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator("#themeToggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("downloads the current ledger as CSV", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportCsv").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("northwind-ledger-2026-11-03.csv");
  expect(errors).toEqual([]);
});

test("loads without console errors or external requests", async ({ page }) => {
  const errors = collectErrors(page);
  const external = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4173/")) external.push(request.url());
  });

  await open(page);
  await expect(page.locator("#ledgerBody tr")).toHaveCount(9);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("mobile drawer is inert when closed and interactive when open", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile viewport only");
  const errors = collectErrors(page);
  await open(page);

  await expect(page.locator("#sidebar")).toHaveJSProperty("inert", true);
  await expect(page.locator("#shell")).toHaveJSProperty("inert", false);
  await page.locator("#menuBtn").click();

  await expect(page.locator("body")).toHaveClass(/nav-open/);
  await expect(page.locator("#sidebar")).toHaveJSProperty("inert", false);
  await expect(page.locator("#shell")).toHaveJSProperty("inert", true);
  await expect(page.locator("#sidebar nav a").first()).toBeFocused();
  await expect(page.locator("#menuLabel")).toHaveText("Close navigation");

  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/nav-open/);
  await expect(page.locator("#sidebar")).toHaveJSProperty("inert", true);
  await expect(page.locator("#shell")).toHaveJSProperty("inert", false);
  await expect(page.locator("#menuBtn")).toBeFocused();
  expect(errors).toEqual([]);
});
