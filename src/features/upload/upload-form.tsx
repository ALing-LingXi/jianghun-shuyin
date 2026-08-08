"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadTextSchema, type UploadTextDto } from "@/shared/schemas/upload";

type UploadFormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

export function UploadForm() {
  const router = useRouter();
  const [state, setState] = useState<UploadFormState>({ status: "idle" });
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("zh-CN-XiaoxiaoNeural");
  const [rate, setRate] = useState("+0%");
  const [pitch, setPitch] = useState("+0Hz");

  const isSubmitting = state.status === "submitting";
  const isSubmitDisabled = isSubmitting || !title.trim() || !text.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: UploadTextDto = {
      title,
      author: author.trim() || undefined,
      text,
      voice,
      rate,
      pitch,
    };

    const parsed = uploadTextSchema.safeParse(payload);
    if (!parsed.success) {
      setState({ status: "error", message: "请填写完整的文本与基础信息。" });
      return;
    }

    setState({ status: "submitting" });

    try {
      const response = await fetch("/api/uploads/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = (await response.json()) as { jobId: string };
      router.push(`/jobs/${result.jobId}`);
    } catch {
      setState({ status: "error", message: "提交失败，请稍后重试。" });
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-stone-700">书名</span>
        <input
          className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={isSubmitting}
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-stone-700">作者</span>
        <input
          className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          disabled={isSubmitting}
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-stone-700">文本</span>
        <textarea
          className="min-h-64 border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={isSubmitting}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-stone-700">音色</span>
          <input
            className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
            value={voice}
            onChange={(event) => setVoice(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-stone-700">语速</span>
          <input
            className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-stone-700">音调</span>
          <input
            className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
            value={pitch}
            onChange={(event) => setPitch(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-700">{state.message}</p>
      )}

      <button
        type="submit"
        className="w-fit border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-500"
        disabled={isSubmitDisabled}
      >
        {isSubmitting ? "提交中..." : "开始生成"}
      </button>
    </form>
  );
}
