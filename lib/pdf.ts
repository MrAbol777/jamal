import fs from "node:fs";
import puppeteer from "puppeteer-core";

const LOCAL_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
];

async function launch() {
  // روی Vercel/AWS Lambda مرورگر فشرده‌ی @sparticuz/chromium استفاده می‌شود
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { default: chromium } = await import("@sparticuz/chromium");
    chromium.setGraphicsMode = false;
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: await chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }
  const executablePath = LOCAL_CANDIDATES.find((c) => c && fs.existsSync(c));
  if (!executablePath) throw new Error("مرورگر Chrome/Edge برای ساخت PDF پیدا نشد. مسیر را در CHROME_PATH بگذارید.");
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
}

export async function htmlToPdf(html: string, size: "a4" | "a5" = "a4"): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: size === "a5" ? "A5" : "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
