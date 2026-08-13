import Link from "next/link";
import Image from "next/image";
import { BookOpen, Library, WandSparkles } from "lucide-react";
import { UploadForm } from "@/features/upload/upload-form";
import { DemonPageHeader } from "@/features/ui/demon-page-header";

export default function UploadPage() {
  return (
    <main className="demon-page">
      <div className="demon-page-inner">
        <DemonPageHeader
          eyebrow="Soul Forge"
          title="炼制有声书"
          description="投入文字或完整 TXT，选择声音参数。任务会在后台识别章节并逐章铸造成可播放音频。"
          icon={WandSparkles}
          actions={
            <>
              <Link className="demon-button-secondary" href="/books">
                <Library aria-hidden="true" />
                听书书架
              </Link>
              <Link className="demon-button-secondary" href="/reading/upload">
                <BookOpen aria-hidden="true" />
                只存阅读书
              </Link>
            </>
          }
        />

        <section className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="demon-panel grid content-between gap-6 overflow-hidden p-5 sm:p-6">
            <div className="grid gap-5">
              <div className="grid size-16 place-items-center border border-amber-200/25 bg-amber-200/10 text-amber-100">
                <WandSparkles className="size-7" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">章节炼音台</h2>
                <p className="mt-3 text-sm leading-7 text-fuchsia-100/65">
                  粘贴短文适合快速试听；上传 TXT 会保留原始字节，由后台识别章节并逐章生成。
                </p>
              </div>
            </div>

            <div className="relative min-h-48 overflow-hidden border border-fuchsia-200/10 bg-black/25">
              <Image
                className="absolute inset-x-0 bottom-0 mx-auto h-auto w-56 max-w-[80%] object-contain"
                src="/assets/images/小恶魔/status.gif"
                alt=""
                width={228}
                height={130}
                unoptimized
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10000b] via-transparent to-transparent" />
            </div>
          </aside>

          <section className="demon-panel p-4 sm:p-6 lg:p-8">
            <UploadForm />
          </section>
        </section>
      </div>
    </main>
  );
}
