import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "匠魂书音",
  description: "本地中文文本有声化工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
