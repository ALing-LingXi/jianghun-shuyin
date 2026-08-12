import type { Metadata } from "next";
import { MiniPlayer } from "@/features/player/components/mini-player";
import { PlayerAudioEngine } from "@/features/player/components/player-audio-engine";
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
      <body>
        <div className="pb-24 sm:pb-0">{children}</div>
        <PlayerAudioEngine />
        <MiniPlayer />
      </body>
    </html>
  );
}
