import type { Metadata } from "next";
import { MiniPlayer } from "@/features/player/components/mini-player";
import { PlayerAudioEngine } from "@/features/player/components/player-audio-engine";
import { DemonAppFrame } from "@/features/ui/demon-app-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: "匠魂书音",
  description: "本地小说阅读与有声书生成工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <DemonAppFrame>
          <div className="pb-24 sm:pb-0">{children}</div>
        </DemonAppFrame>
        <PlayerAudioEngine />
        <MiniPlayer />
      </body>
    </html>
  );
}
