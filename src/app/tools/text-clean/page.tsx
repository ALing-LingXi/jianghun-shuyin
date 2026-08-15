import Link from "next/link";
import { BookOpen, Sparkles, Upload } from "lucide-react";
import { TextCleanTool } from "@/features/tools/text-clean-tool";
import { DemonPageHeader } from "@/features/ui/demon-page-header";

export default function TextCleanPage() {
  return (
    <main className="demon-page">
      <div className="demon-page-inner">
        <DemonPageHeader
          eyebrow="Text Tool"
          title="脏文本清洗"
          description="上传乱掉的 TXT，自动清理 BOM、空白、装饰线和换行噪声，然后下载一份更适合流水线处理的纯文本。"
          icon={Sparkles}
          backHref="/"
          backLabel="返回首页"
          actions={
            <>
              <Link className="demon-button-secondary" href="/upload">
                <Upload aria-hidden="true" />
                生成有声书
              </Link>
              <Link className="demon-button-secondary" href="/reading/upload">
                <BookOpen aria-hidden="true" />
                阅读书架
              </Link>
            </>
          }
        />

        <section className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="demon-panel grid content-between gap-6 p-5 sm:p-6">
            <div className="grid gap-5">
              <div className="grid size-16 place-items-center border border-fuchsia-200/25 bg-fuchsia-200/10 text-fuchsia-100">
                <Sparkles className="size-7" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">清洗脏文本</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-fuchsia-100/65">
                  适合把网页机翻、复制残片、含 BOM 的 TXT 先过一遍。
                  这一步只做文本整理，不碰数据库、TTS 或音频。
                </p>
              </div>
            </div>

            <div className="grid gap-3 border border-fuchsia-200/10 bg-black/20 p-4 text-sm text-fuchsia-100/70">
              <p className="font-bold text-fuchsia-50">会做的事</p>
              <p>去掉 BOM，统一换行，压缩连续空白，删掉装饰分隔线。</p>
              <p>下载结果直接是 UTF-8 TXT，可以继续进后续流水线。</p>
            </div>
          </aside>

          <section className="demon-panel p-5 sm:p-6">
            <TextCleanTool />
          </section>
        </section>
      </div>
    </main>
  );
}
