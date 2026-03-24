import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Job-Fit Insight",
  description: "기업/직무 기반 AI 맞춤형 분석 리포트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="font-sans">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
