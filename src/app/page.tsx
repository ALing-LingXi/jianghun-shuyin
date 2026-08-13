"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Headphones,
  Library,
  Sparkles,
  Upload,
} from "lucide-react";
import BlurText from "@/components/BlurText";
import ShinyText from "@/components/ShinyText";
import SplashCursor from "@/components/SplashCursor";
import StarBorder from "@/components/StarBorder";
import { HealthStatus } from "@/features/health/health-status";

export default function HomePage() {
  return (
    <main className="demon-home">
      <div className="hidden lg:block">
        <SplashCursor
          DYE_RESOLUTION={512}
          SIM_RESOLUTION={64}
          DENSITY_DISSIPATION={4}
          VELOCITY_DISSIPATION={2.4}
          SPLAT_RADIUS={0.12}
          SPLAT_FORCE={2500}
          CURL={2}
          RAINBOW_MODE={false}
          COLOR="#ff2aa3"
        />
      </div>

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
              image="/assets/images/恶魔勇士/Fm5chK.gif"
            />
            <HomeGate
              href="/reading"
              label="阅读书架"
              description="上传 TXT 与封面，按章节滚动阅读。"
              icon={BookOpen}
              image="/assets/images/恶魔女王/JLZeTV.gif"
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
          />
          <div className="demon-home-health">
            <span>本地服务</span>
            <HealthStatus />
          </div>
        </aside>
      </section>

      <section className="demon-home-bottom" aria-hidden="true">
        <Image
          src="/assets/backgrounds/bg_bottom.png"
          alt=""
          fill
          sizes="100vw"
          unoptimized
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
      <Image src={image} alt="" width={72} height={72} unoptimized />
      <span className="demon-home-gate-warp" aria-hidden="true">
        ENTER
      </span>
    </Link>
  );
}
