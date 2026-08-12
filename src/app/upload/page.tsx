import Link from "next/link";
import { UploadForm } from "@/features/upload/upload-form";

export default function UploadPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <section className="mx-auto w-full max-w-3xl border border-stone-300 bg-white/80 p-6 shadow-sm sm:p-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
              上传
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
              粘贴文本创建任务
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              填入书名、作者和正文后提交，系统会先保存原文，再创建 Book 和 Job。
            </p>
          </div>
          <Link
            className="border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800"
            href="/books"
          >
            Books
          </Link>
        </div>

        <UploadForm />
      </section>
    </main>
  );
}
