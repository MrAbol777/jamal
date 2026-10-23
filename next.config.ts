import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // مرورگر فشرده‌ی PDF نباید باندل شود
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // فونت‌ها با fs خوانده می‌شوند؛ باید در خروجی سرورلس همراه تابع بروند
  outputFileTracingIncludes: {
    "/invoices/[id]/html": ["./public/fonts/**/*"],
    "/invoices/[id]/pdf": ["./public/fonts/**/*", "./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
