"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BookOpen, ImagePlus, LoaderCircle, Upload } from "lucide-react";
import { DemonPageHeader } from "@/features/ui/demon-page-header";
import {
  MAX_READING_COVER_FILE_SIZE_BYTES,
  MAX_READING_TEXT_FILE_SIZE_BYTES,
  readingUploadSchema,
} from "@/shared/schemas/reading";
import { ReadingShell } from "./components/reading-shell";
import { useCreateReadingBook } from "./hooks/useReadingLibraryQuery";

export function ReadingUploadPage() {
  return (
    <ReadingShell>
      <ReadingUploadForm />
    </ReadingShell>
  );
}

function ReadingUploadForm() {
  const router = useRouter();
  const createBook = useCreateReadingBook();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSubmitting = createBook.isPending;

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setError(null);

    if (nextFile && !title.trim()) {
      setTitle(nextFile.name.replace(/\.txt$/i, "").trim());
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || !cover) {
      setError("请选择 TXT 文件和封面图。");
      return;
    }

    const parsed = readingUploadSchema.safeParse({
      title,
      author: author.trim() || undefined,
      fileName: file.name,
      fileSize: file.size,
      coverFileName: cover.name,
      coverFileSize: cover.size,
      coverMimeType: cover.type,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "上传信息无效。");
      return;
    }

    const formData = new FormData();
    formData.set("title", parsed.data.title);
    if (parsed.data.author) {
      formData.set("author", parsed.data.author);
    }
    formData.set("file", file);
    formData.set("cover", cover);

    try {
      const result = await createBook.mutateAsync(formData);
      router.push(`/reading/${result.bookId}/chapters/0`);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : "上传失败。",
      );
    }
  }

  return (
    <main className="demon-page">
      <div className="demon-page-inner">
        <DemonPageHeader
          eyebrow="Reading Archive"
          title="收藏一本小说"
          description="上传 TXT 与封面，只进入阅读书架，不触发 TTS、有声书任务或听书数据库。"
          icon={BookOpen}
          backHref="/reading"
          backLabel="返回阅读书架"
        />

        <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <section className="demon-panel grid content-between gap-6 p-5 sm:p-6">
            <div className="grid gap-5">
              <div className="grid size-20 place-items-center border border-amber-200/25 bg-amber-200/10 text-amber-100">
                <BookOpen className="size-9" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">独立阅读藏书</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-fuchsia-100/65">
                  系统会自动识别章节并建立目录。封面将成为书架主视觉，阅读进度仅保存在阅读模块。
                </p>
              </div>
            </div>

            <div className="hidden overflow-hidden border border-fuchsia-200/10 bg-[#19020c] p-3 sm:block">
              <Image
                className="h-48 w-full object-cover opacity-90"
                src="/assets/images/恶魔女王/JLZeTV.gif"
                alt=""
                width={640}
                height={192}
                unoptimized
                loading="lazy"
              />
            </div>
          </section>

          <form
            className="demon-panel grid gap-5 p-5 sm:p-6"
            aria-busy={isSubmitting}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <fieldset className="grid gap-5" disabled={isSubmitting}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm" htmlFor="reading-title">
                  <span className="font-bold text-fuchsia-50">书名</span>
                  <input
                    id="reading-title"
                    className="demon-input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm" htmlFor="reading-author">
                  <span className="font-bold text-fuchsia-50">作者</span>
                  <input
                    id="reading-author"
                    className="demon-input"
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                  />
                </label>
              </div>

              <label
                className="grid cursor-pointer gap-3 border border-dashed border-fuchsia-100/30 bg-black/20 p-5 text-sm transition hover:border-amber-200/60"
                htmlFor="reading-file"
              >
                <span className="inline-flex items-center gap-2 font-bold text-fuchsia-50">
                  <Upload className="size-4" aria-hidden="true" />
                  选择 TXT 小说
                </span>
                <span className="text-fuchsia-100/60">
                  仅支持 .txt，最大{" "}
                  {formatFileSize(MAX_READING_TEXT_FILE_SIZE_BYTES)}。
                </span>
                <input
                  id="reading-file"
                  type="file"
                  accept=".txt,text/plain"
                  className="block w-full text-sm text-fuchsia-100/70 file:mr-3 file:border-0 file:bg-fuchsia-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                  required
                  onChange={(event) =>
                    handleFileChange(event.currentTarget.files?.[0] ?? null)
                  }
                />
                {file ? (
                  <span className="text-amber-100">
                    {file.name} · {formatFileSize(file.size)}
                  </span>
                ) : null}
              </label>

              <label
                className="grid cursor-pointer gap-3 border border-dashed border-fuchsia-100/30 bg-black/20 p-5 text-sm transition hover:border-amber-200/60"
                htmlFor="reading-cover"
              >
                <span className="inline-flex items-center gap-2 font-bold text-fuchsia-50">
                  <ImagePlus className="size-4" aria-hidden="true" />
                  选择封面图
                </span>
                <span className="text-fuchsia-100/60">
                  JPG、PNG、WEBP、GIF，最大{" "}
                  {formatFileSize(MAX_READING_COVER_FILE_SIZE_BYTES)}。
                </span>
                <input
                  id="reading-cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block w-full text-sm text-fuchsia-100/70 file:mr-3 file:border-0 file:bg-fuchsia-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                  required
                  onChange={(event) => {
                    setCover(event.currentTarget.files?.[0] ?? null);
                    setError(null);
                  }}
                />
                {cover ? (
                  <span className="text-amber-100">
                    {cover.name} · {formatFileSize(cover.size)}
                  </span>
                ) : null}
              </label>
            </fieldset>

            {error ? (
              <p
                className="border border-red-300/30 bg-red-950/50 px-3 py-2 text-sm text-red-100"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="demon-button-primary w-fit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <BookOpen className="size-4" aria-hidden="true" />
              )}
              {isSubmitting ? "正在入库..." : "创建阅读书籍"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function formatFileSize(size: number): string {
  return `${(size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 1 : 0)} MB`;
}
