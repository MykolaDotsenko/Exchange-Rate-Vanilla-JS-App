import { mkdir } from "node:fs/promises";

import { test } from "@playwright/test";

import { mockFrankfurter, waitForReferenceRate } from "./helpers/frankfurter.js";

test("capture deterministic portfolio screenshots", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "portfolio screenshots are generated once in Chromium"
  );

  await mkdir("artifacts/screenshots", { recursive: true });
  await mockFrankfurter(page);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await waitForReferenceRate(page);
  await page.screenshot({
    path: "artifacts/screenshots/nordrate-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/screenshots/nordrate-mobile.png",
    fullPage: true,
  });
});
