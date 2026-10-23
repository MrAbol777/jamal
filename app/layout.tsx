import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "حسابداری فروش نخ",
  description: "ثبت فروش و صدور فاکتور",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a5f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // افزونه‌های مرورگر گاهی روی body ویژگی اضافه می‌کنند؛ هشدار hydration بی‌اثر است
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
