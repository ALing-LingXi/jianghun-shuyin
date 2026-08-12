import Link from "next/link";
import { UploadForm } from "@/features/upload/upload-form";

export default function UploadPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-3xl border border-stone-300 bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
              上传
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-stone-900">
              创建有声书任务
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              粘贴正文，或上传完整 TXT 小说。系统会保存原文、识别章节并自动规划可播放段落。
            </p>
          </div>
          <Link
            className="border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800"
            href="/books"
          >
            书架
          </Link>
        </div>

        <UploadForm />
      </section>
    </main>
  );
}
