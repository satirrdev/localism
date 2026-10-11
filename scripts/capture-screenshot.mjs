import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

async function main() {
  const outputPath = path.resolve(process.cwd(), "public/screenshot-app.png");
  const executablePath = path.join(
    process.env.HOME || "/home/satir",
    ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"
  );

  console.log("Launching headless browser...");
  const launchOptions = {
    headless: true,
  };
  if (fs.existsSync(executablePath)) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    });

    const page = await context.newPage();
    console.log("Navigating to https://satirrdev.github.io/localism...");
    await page.goto("https://satirrdev.github.io/localism", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    console.log("Waiting for tool cards and tabs...");
    await page.waitForSelector('[role="tablist"]', { state: "visible", timeout: 15000 });
    await page.waitForSelector('[role="tabpanel"]', { state: "visible", timeout: 15000 });

    // Wait for fonts to load and animations to settle
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);

    console.log(`Saving screenshot to ${outputPath}...`);
    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: false,
    });

    console.log("Screenshot successfully saved!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
