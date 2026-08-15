"use client";

import { useState, type FormEvent } from "react";
import { FileText, LoaderCircle, Sparkles } from "lucide-react";
import {
  MAX_TEXT_CLEAN_FILE_SIZE_BYTES,
  textCleanUploadSchema,
} from "@/shared/schemas/text-clean";

type CleanToolState =
  | { status: "idle" }
  | { status: "submitting" }
  | {
      status: "success";
      fileName: string;
      encoding: string;
      originalCharacters: number;
      cleanedCharacters: number;
      notices: string[];
    }
  | { status: "error"; message: string };

export function TextCleanTool() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<CleanToolState>({ status: "idle" });
  const isSubmitting = state.status === "submitting";

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setState({ status: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setState({ status: "error", message: "请先选择一个 TXT 文件。" });
      return;
    }

    const parsed = textCleanUploadSchema.safeParse({
      fileName: file.name,
      fileSize: file.size,
    });

    if (!parsed.success) {
      setState({
        status: "error",
        message: parsed.error.issues[0]?.message ?? "TXT 文件不可用。",
      });
      return;
    }

    setState({ status: "submitting" });

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/tools/text-clean", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw await readErrorMessage(response);
      }

      const blob = await response.blob();
      const downloadFileName =
        decodeHeaderFileName(response.headers.get("x-download-file-name")) ??
        `${file.name.replace(/\.txt$/i, "").trim()}.cleaned.txt`;
      triggerDownload(blob, downloadFileName);

      setState({
        status: "success",
        fileName: downloadFileName,
        encoding: response.headers.get("x-detected-encoding") ?? "utf-8",
        originalCharacters: Number(
          response.headers.get("x-original-characters") ?? "0",
        ),
        cleanedCharacters: Number(
          response.headers.get("x-cleaned-characters") ?? "0",
        ),
        notices: buildNotices(response.headers),
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "文本清洗失败，请稍后重试。",
      });
    }
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
      <fieldset className="grid gap-5" disabled={isSubmitting}>
        <label
          className="grid cursor-pointer gap-3 border border-dashed border-fuchsia-100/30 bg-black/20 p-5 text-sm transition hover:border-amber-200/60"
          htmlFor="text-clean-file"
        >
          <span className="inline-flex items-center gap-2 font-bold text-fuchsia-50">
            <FileText className="size-4" aria-hidden="true" />
            选择脏 TXT
          </span>
          <span className="text-fuchsia-100/60">
            只支持 .txt，最大 {formatFileSize(MAX_TEXT_CLEAN_FILE_SIZE_BYTES)}。
            会自动清掉 BOM、空白噪声和装饰行，然后直接下载。
          </span>
          <input
            id="text-clean-file"
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

        {state.status === "error" ? (
          <p
            className="border border-red-300/30 bg-red-950/50 px-3 py-2 text-sm text-red-100"
            role="alert"
          >
            {state.message}
          </p>
        ) : null}

        {state.status === "success" ? (
          <div className="grid gap-2 border border-emerald-300/25 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-50">
            <p className="font-bold">已下载 {state.fileName}</p>
            <p className="text-emerald-100/80">
              编码 {state.encoding}，字符 {state.originalCharacters} →{" "}
              {state.cleanedCharacters}
            </p>
            {state.notices.length > 0 ? (
              <p className="text-emerald-100/70">
                提示：{state.notices.join("，")}
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <button
        type="submit"
        className="demon-button-primary w-fit"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        {isSubmitting ? "正在清洗..." : "清洗并下载"}
      </button>
    </form>
  );
}

async function readErrorMessage(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; detail?: string };
    };
    return new Error(
      payload.error?.detail ??
        payload.error?.message ??
        "文本清洗失败，请稍后重试。",
    );
  } catch {
    return new Error("文本清洗失败，请稍后重试。");
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

function buildNotices(headers: Headers): string[] {
  return [
    headers.get("x-removed-bom") === "true" ? "已移除 BOM" : undefined,
    Number(headers.get("x-normalized-newlines") ?? "0") > 0
      ? "已归一化换行"
      : undefined,
    Number(headers.get("x-collapsed-blank-lines") ?? "0") > 0
      ? "已折叠空白行"
      : undefined,
    Number(headers.get("x-trimmed-blank-lines") ?? "0") > 0
      ? "已裁掉首尾空白"
      : undefined,
  ].filter((notice): notice is string => notice !== undefined);
}

function formatFileSize(size: number): string {
  return `${(size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 1 : 0)} MB`;
}

function decodeHeaderFileName(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
