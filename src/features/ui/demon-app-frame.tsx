import Image from "next/image";
import { DemonNavigation } from "@/features/ui/demon-navigation";

export function DemonAppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="demon-app-frame">
      <div className="demon-backdrop" aria-hidden="true">
        <Image
          className="demon-sky-image"
          src="/assets/backgrounds/bg_top.png"
          alt=""
          fill
          sizes="100vw"
          unoptimized
          priority
        />
        <div className="demon-scanlines" />
      </div>

      <DemonNavigation />

      <div className="demon-content">{children}</div>
    </div>
  );
}
