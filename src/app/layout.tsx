import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MoneyProvider } from "@/lib/store/MoneyContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: "Money Survival — Student Budgeting & Run-Out Forecast",
  description: "A calm, zero-guilt money survival calculator and AI expense tracker for college students living on a limited allowance.",
  keywords: ["student budgeting", "money tracker", "allowance calculator", "safe daily spend", "college finance"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
        <MoneyProvider>{children}</MoneyProvider>
      </body>
    </html>
  );
}
