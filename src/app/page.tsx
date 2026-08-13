"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Headphones,
  Library,
  Sparkles,
  Upload,
} from "lucide-react";
import BlurText from "@/components/BlurText";
import ShinyText from "@/components/ShinyText";
import StarBorder from "@/components/StarBorder";
import { HealthStatus } from "@/features/health/health-status";

const DesktopSplashCursor = dynamic(() => import("@/components/SplashCursor"), {
  ssr: false,
});

export default function HomePage() {
  const [showDesktopCursor, setShowDesktopCursor] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    );
    const update = () => setShowDesktopCursor(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <main className="demon-home">
      {showDesktopCursor && (
        <DesktopSplashCursor
          DYE_RESOLUTION={384}
          SIM_RESOLUTION={48}
          DENSITY_DISSIPATION={4}
          VELOCITY_DISSIPATION={2.4}
          SPLAT_RADIUS={0.1}
          SPLAT_FORCE={2200}
          CURL={2}
          RAINBOW_MODE={false}
          COLOR="#ff2aa3"
        />
      )}

      <section className="demon-home-hero">
        <div className="demon-home-copy">
          <p className="demon-home-kicker">
            <Sparkles aria-hidden="true" />
            <ShinyText
              text="LOCAL NOVEL SHRINE"
              color="#f8acd9"
              shineColor="#fff3a4"
              speed={3}
            />
          </p>

          <BlurText
            text="匠魂书音"
            animateBy="letters"
            delay={90}
            direction="bottom"
            className="demon-home-title"
          />

          <p className="demon-home-lead">
            把小说收进本地魔殿。阅读书架保存文字与封面，听书书架生成章节音频，
            两套数据独立维护。
          </p>

          <div className="demon-home-gates">
            <HomeGate
              href="/books"
              label="听书书架"
              description="管理有声书任务、章节音频和播放队列。"
              icon={Headphones}
              image="/assets/images/恶魔勇士/tMPQqN.gif"
            />
            <HomeGate
              href="/reading"
              label="阅读书架"
              description="上传 TXT 与封面，按章节滚动阅读。"
              icon={BookOpen}
              image="/assets/images/恶魔女王/1P7MSU.gif"
            />
          </div>

          <div className="demon-home-actions">
            <StarBorder
              as="div"
              color="#ff79ca"
              speed="4s"
              thickness={2}
              className="demon-star-cta"
            >
              <Link href="/upload">
                <Upload aria-hidden="true" />
                创建有声书
              </Link>
            </StarBorder>
            <Link className="demon-button-secondary" href="/reading/upload">
              <Library aria-hidden="true" />
              藏入阅读书架
            </Link>
          </div>
        </div>

        <aside className="demon-home-stage" aria-label="匠魂书音守护角色">
          <div className="demon-moon-seal" aria-hidden="true">
            <span>匠魂</span>
            <small>LOCAL AUDIO SHRINE</small>
          </div>
          <Image
            className="demon-home-character"
            src="/assets/images/恶魔女王/zs5jpu.gif"
            alt=""
            width={416}
            height={416}
            unoptimized
            loading="eager"
          />
          <StatusDock />
        </aside>
      </section>

      <section className="demon-home-bottom" aria-hidden="true">
        <Image
          src="/assets/backgrounds/bg_bottom.png"
          alt=""
          fill
          sizes="100vw"
          unoptimized
          loading="lazy"
        />
      </section>
    </main>
  );
}

function HomeGate({
  href,
  label,
  description,
  icon: Icon,
  image,
}: {
  href: string;
  label: string;
  description: string;
  icon: typeof Headphones;
  image: string;
}) {
  return (
    <Link className="demon-home-gate" href={href}>
      <span className="demon-home-gate-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <Image
        src={image}
        alt=""
        width={72}
        height={72}
        unoptimized
        loading="lazy"
      />
      <span className="demon-home-gate-warp" aria-hidden="true">
        ENTER
      </span>
    </Link>
  );
}

function StatusDock() {
  return (
    <div className="demon-home-status-dock">
      <Image
        className="demon-home-status-mascot"
        src="/assets/images/小恶魔/status.gif"
        alt=""
        width={228}
        height={130}
        unoptimized
        loading="lazy"
      />
      <div className="demon-home-health">
        <div className="demon-home-health-heading">
          <span>本地服务</span>
          <Image
            src="/assets/images/小恶魔/hi.gif"
            alt=""
            width={44}
            height={44}
            unoptimized
            loading="lazy"
          />
        </div>
        <HealthStatus />
      </div>
    </div>
  );
}
