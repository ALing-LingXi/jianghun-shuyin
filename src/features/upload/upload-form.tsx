"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, FileText, Search } from "lucide-react";
import {
  uploadFileSchema,
  uploadTextSchema,
  type UploadTextDto,
} from "@/shared/schemas/upload";
import {
  ttsVoiceListSchema,
  type TtsVoice,
} from "@/shared/schemas/tts";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/shared/tts";

type UploadMode = "text" | "file";

type UploadFormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

const defaultVoice: TtsVoice = {
  id: DEFAULT_TTS_VOICE,
  label: "云溪",
  locale: "zh-CN",
  gender: "Male",
};

export function UploadForm() {
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>("text");
  const [state, setState] = useState<UploadFormState>({ status: "idle" });
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState(DEFAULT_TTS_VOICE);
  const [voices, setVoices] = useState<TtsVoice[]>([defaultVoice]);
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [rate, setRate] = useState(DEFAULT_TTS_RATE);
  const [pitch, setPitch] = useState(DEFAULT_TTS_PITCH);
  const voiceMenuRef = useRef<HTMLDivElement>(null);

  const isSubmitting = state.status === "submitting";
  const hasContent = mode === "text" ? Boolean(text.trim()) : file !== null;
  const isSubmitDisabled = isSubmitting || !title.trim() || !hasContent;
  const selectedVoice =
    voices.find((option) => option.id === voice) ?? defaultVoice;
  const filteredVoices = useMemo(() => {
    const query = voiceQuery.trim().toLocaleLowerCase();

    if (!query) {
      return voices;
    }

    return voices.filter((option) =>
      [option.label, option.id, option.locale, option.gender].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [voiceQuery, voices]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadVoices() {
      try {
        const response = await fetch("/api/tts/voices", {
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const parsed = ttsVoiceListSchema.safeParse(await response.json());
        if (parsed.success && parsed.data.voices.length > 0) {
          setVoices(parsed.data.voices);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setVoices([defaultVoice]);
        }
      }
    }

    void loadVoices();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function closeVoiceMenu(event: MouseEvent) {
      if (
        voiceMenuRef.current &&
        !voiceMenuRef.current.contains(event.target as Node)
      ) {
        setIsVoiceMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeVoiceMenu);
    return () => document.removeEventListener("mousedown", closeVoiceMenu);
  }, []);

  function changeMode(nextMode: UploadMode) {
    if (isSubmitting) {
      return;
    }

    setMode(nextMode);
    setState({ status: "idle" });
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setState({ status: "idle" });

    if (nextFile && !title.trim()) {
      setTitle(titleFromFileName(nextFile.name));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "file") {
      await submitFile();
      return;
    }

    await submitText();
  }

  async function submitText() {
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
      setState({ status: "error", message: "请填写书名和正文。" });
      return;
    }

    setState({ status: "submitting" });

    try {
      const response = await fetch("/api/uploads/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      await redirectToJob(response);
    } catch (error) {
      setState({ status: "error", message: toUploadErrorMessage(error) });
    }
  }

  async function submitFile() {
    if (!file) {
      setState({ status: "error", message: "请选择一个 TXT 文件。" });
      return;
    }

    const parsed = uploadFileSchema.safeParse({
      title,
      author: author.trim() || undefined,
      fileName: file.name,
      fileSize: file.size,
      voice,
      rate,
      pitch,
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
      formData.set("title", parsed.data.title);
      if (parsed.data.author) {
        formData.set("author", parsed.data.author);
      }
      formData.set("voice", parsed.data.voice);
      formData.set("rate", parsed.data.rate);
      formData.set("pitch", parsed.data.pitch);

      const response = await fetch("/api/uploads/file", {
        method: "POST",
        body: formData,
      });
      await redirectToJob(response);
    } catch (error) {
      setState({ status: "error", message: toUploadErrorMessage(error) });
    }
  }

  async function redirectToJob(response: Response) {
    const body = (await response.json().catch(() => null)) as
      | { jobId?: string; error?: { message?: string } }
      | null;

    if (!response.ok || !body?.jobId) {
      throw new Error(body?.error?.message ?? "创建任务失败，请稍后重试。");
    }

    router.push(`/jobs/${body.jobId}`);
  }

  return (
    <form
      className="grid gap-6"
      aria-busy={isSubmitting}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <fieldset disabled={isSubmitting}>
        <legend className="sr-only">上传方式</legend>
        <div className="grid grid-cols-2 border border-stone-300 bg-stone-100 p-1 text-sm font-medium">
          <button
            type="button"
            className={`px-3 py-2 ${
              mode === "text"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600"
            }`}
            aria-pressed={mode === "text"}
            onClick={() => changeMode("text")}
          >
            粘贴文本
          </button>
          <button
            type="button"
            className={`px-3 py-2 ${
              mode === "file"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600"
            }`}
            aria-pressed={mode === "file"}
            onClick={() => changeMode("file")}
          >
            选择 TXT
          </button>
        </div>
      </fieldset>

      {mode === "file" ? (
        <div className="grid gap-3">
          <label
            className="grid cursor-pointer gap-2 border border-dashed border-stone-400 bg-stone-50 p-5 text-sm text-stone-700 transition-colors hover:border-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            htmlFor="upload-file"
          >
            <span className="flex items-center gap-2 font-medium text-stone-900">
              <FileText className="size-4" aria-hidden="true" />
              选择小说 TXT 文件
            </span>
            <span>仅支持 .txt，最大 20MB。原始文件会按字节保存。</span>
            <input
              id="upload-file"
              name="file"
              type="file"
              accept=".txt,text/plain"
              className="block w-full text-sm text-stone-700 file:mr-3 file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              disabled={isSubmitting}
              required={mode === "file"}
              onChange={(event) =>
                handleFileChange(event.currentTarget.files?.[0] ?? null)
              }
            />
          </label>
          {file ? (
            <p className="text-sm text-stone-600">
              已选择：{file.name} ({formatFileSize(file.size)})
            </p>
          ) : null}
        </div>
      ) : (
        <label className="grid gap-2" htmlFor="upload-text">
          <span className="text-sm font-medium text-stone-700">正文</span>
          <textarea
            id="upload-text"
            name="text"
            className="min-h-64 border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:bg-stone-100"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={isSubmitting}
            required={mode === "text"}
          />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2" htmlFor="upload-title">
          <span className="text-sm font-medium text-stone-700">书名</span>
          <input
            id="upload-title"
            name="title"
            className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:bg-stone-100"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </label>

        <label className="grid gap-2" htmlFor="upload-author">
          <span className="text-sm font-medium text-stone-700">作者</span>
          <input
            id="upload-author"
            name="author"
            className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:bg-stone-100"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid min-w-0 gap-2">
          <span
            id="upload-voice-label"
            className="text-sm font-medium text-stone-700"
          >
            音色
          </span>
          <div ref={voiceMenuRef} className="relative min-w-0">
            <button
              id="upload-voice"
              type="button"
              className="flex min-w-0 max-w-full items-center justify-between border border-stone-300 bg-white px-3 py-2 text-left text-sm text-stone-900 outline-none focus:border-stone-500 disabled:cursor-not-allowed disabled:bg-stone-100"
              aria-labelledby="upload-voice-label upload-voice"
              aria-expanded={isVoiceMenuOpen}
              aria-haspopup="listbox"
              disabled={isSubmitting}
              onClick={() => setIsVoiceMenuOpen((open) => !open)}
            >
              <span className="min-w-0 flex-1 truncate">
                {selectedVoice.label}
              </span>
              <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
            </button>

            {isVoiceMenuOpen ? (
              <div
                className="absolute z-20 mt-1 w-full min-w-0 overflow-hidden border border-stone-300 bg-white shadow-lg"
                role="listbox"
                aria-labelledby="upload-voice-label"
              >
                <label className="flex items-center gap-2 border-b border-stone-200 px-2 py-2">
                  <Search
                    className="size-4 shrink-0 text-stone-500"
                    aria-hidden="true"
                  />
                  <input
                    autoFocus
                    aria-label="搜索音色"
                    className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none"
                    value={voiceQuery}
                    onChange={(event) => setVoiceQuery(event.target.value)}
                    placeholder="搜索音色"
                    disabled={isSubmitting}
                  />
                </label>
                <div className="max-h-64 overflow-y-auto py-1">
                  {filteredVoices.map((option) => {
                    const isSelected = option.id === voice;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm text-stone-900 hover:bg-stone-100"
                        role="option"
                        aria-selected={isSelected}
                        disabled={isSubmitting}
                        onClick={() => {
                          setVoice(option.id);
                          setIsVoiceMenuOpen(false);
                          setVoiceQuery("");
                        }}
                      >
                        <Check
                          className={`size-4 shrink-0 ${
                            isSelected ? "opacity-100" : "opacity-0"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {option.label}
                        </span>
                        <span className="shrink-0 text-xs text-stone-500">
                          {voiceMetaLabel(option)}
                        </span>
                      </button>
                    );
                  })}
                  {filteredVoices.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-stone-500">
                      没有匹配的音色。
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <label className="grid min-w-0 gap-2" htmlFor="upload-rate">
          <span className="text-sm font-medium text-stone-700">语速</span>
          <input
            id="upload-rate"
            name="rate"
            className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:bg-stone-100"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="grid min-w-0 gap-2" htmlFor="upload-pitch">
          <span className="text-sm font-medium text-stone-700">音调</span>
          <input
            id="upload-pitch"
            name="pitch"
            className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:bg-stone-100"
            value={pitch}
            onChange={(event) => setPitch(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
      </div>

      {state.status === "error" ? (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        className="w-fit border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-500"
        disabled={isSubmitDisabled}
      >
        {isSubmitting
          ? "正在创建任务..."
          : mode === "file"
            ? "上传并开始生成"
            : "开始生成"}
      </button>
    </form>
  );
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.txt$/i, "").trim();
}

function formatFileSize(size: number): string {
  return `${(size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 1 : 2)} MB`;
}

function toUploadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "提交失败，请稍后重试。";
}

function voiceMetaLabel(voice: TtsVoice): string {
  return `${localeLabel(voice.locale)} · ${
    voice.gender === "Female" ? "女声" : "男声"
  }`;
}

function localeLabel(locale: string): string {
  if (locale === "zh-CN") {
    return "普通话";
  }

  if (locale.startsWith("zh-")) {
    return "中文";
  }

  return locale;
}
