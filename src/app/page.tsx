import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Headphones,
  Library,
  Sparkles,
  Upload,
} from "lucide-react";
import StarBorder from "@/components/StarBorder";
import { HealthStatus } from "@/features/health/health-status";

export default function HomePage() {
  return (
    <main className="demon-home">
      <section className="demon-home-hero">
        <div className="demon-home-copy">
          <p className="demon-home-kicker">
            <Sparkles aria-hidden="true" />
            <span>LOCAL NOVEL SHRINE</span>
          </p>

          <h1 className="demon-home-title">匠魂书音</h1>

          <p className="demon-home-lead">
            把小说收进本地魂库。阅读书架保存文字与封面，听书书架生成章节音频，
            现在还多了一把文本清洗工具，给脏 TXT 先过一遍。
          </p>

          <div className="demon-home-gates">
            <HomeGate
              href="/books"
              label="听书书架"
              description="管理有声书任务、章节音频和播放队列。"
              icon={Headphones}
              image="/assets/images/%E6%81%B6%E9%AD%94%E5%8B%87%E5%A3%AB/tMPQqN.gif"
            />
            <HomeGate
              href="/reading"
              label="阅读书架"
              description="上传 TXT 与封面，按章节滚动阅读。"
              icon={BookOpen}
              image="/assets/images/%E6%81%B6%E9%AD%94%E5%A5%B3%E7%8E%8B/1P7MSU.gif"
            />
          </div>

          <div className="demon-home-actions">
            <StarBorder
              as="div"
              color="#ff79ca"
              speed="5s"
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
              只存阅读书架
            </Link>
            <Link className="demon-button-secondary" href="/tools/text-clean">
              <Sparkles aria-hidden="true" />
              清洗脏文本
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
            src="/assets/images/%E6%81%B6%E9%AD%94%E5%A5%B3%E7%8E%8B/zs5jpu.gif"
            alt=""
            width={416}
            height={416}
            unoptimized
            priority
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
  icon: LucideIcon;
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
        src="/assets/images/%E5%B0%8F%E6%81%B6%E9%AD%94/status.gif"
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
            src="/assets/images/%E5%B0%8F%E6%81%B6%E9%AD%94/hi.gif"
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
