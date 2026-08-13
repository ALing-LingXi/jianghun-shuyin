import Link from "next/link";
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

        <section className="demon-panel mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
          <UploadForm />
        </section>
      </div>
    </main>
  );
}
