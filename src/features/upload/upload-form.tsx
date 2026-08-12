"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search } from "lucide-react";
import { uploadTextSchema, type UploadTextDto } from "@/shared/schemas/upload";
import {
  ttsVoiceListSchema,
  type TtsVoice,
} from "@/shared/schemas/tts";
import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOICE,
} from "@/shared/tts";

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
  const [state, setState] = useState<UploadFormState>({ status: "idle" });
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(DEFAULT_TTS_VOICE);
  const [voices, setVoices] = useState<TtsVoice[]>([defaultVoice]);
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [rate, setRate] = useState(DEFAULT_TTS_RATE);
  const [pitch, setPitch] = useState(DEFAULT_TTS_PITCH);
  const voiceMenuRef = useRef<HTMLDivElement>(null);

  const isSubmitting = state.status === "submitting";
  const isSubmitDisabled = isSubmitting || !title.trim() || !text.trim();
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
    <form
      className="grid gap-4"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit}
    >
      <label className="grid gap-2" htmlFor="upload-title">
        <span className="text-sm font-medium text-stone-700">书名</span>
        <input
          id="upload-title"
          name="title"
          className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
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
          className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          disabled={isSubmitting}
        />
      </label>

      <label className="grid gap-2" htmlFor="upload-text">
        <span className="text-sm font-medium text-stone-700">文本</span>
        <textarea
          id="upload-text"
          name="text"
          className="min-h-64 border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={isSubmitting}
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid min-w-0 gap-2" htmlFor="upload-voice">
          <span className="text-sm font-medium text-stone-700">音色</span>
          <div ref={voiceMenuRef} className="relative min-w-0">
            <button
              id="upload-voice"
              type="button"
              className="flex min-w-0 max-w-full items-center justify-between border border-stone-300 bg-white px-3 py-2 text-left text-sm text-stone-900 outline-none focus:border-stone-500 disabled:cursor-not-allowed disabled:bg-stone-100"
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

            {isVoiceMenuOpen && (
              <div
                className="absolute z-20 mt-1 w-full min-w-0 max-w-full overflow-hidden border border-stone-300 bg-white shadow-lg"
                role="listbox"
                aria-labelledby="upload-voice"
              >
                <label className="flex items-center gap-2 border-b border-stone-200 px-2 py-2">
                  <Search className="size-4 shrink-0 text-stone-500" aria-hidden="true" />
                  <input
                    autoFocus
                    aria-label="搜索音色"
                    className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none"
                    value={voiceQuery}
                    onChange={(event) => setVoiceQuery(event.target.value)}
                    placeholder="搜索音色"
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
                  {filteredVoices.length === 0 && (
                    <p className="px-3 py-2 text-sm text-stone-500">
                      没有匹配的音色
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </label>
        <label className="grid min-w-0 gap-2" htmlFor="upload-rate">
          <span className="text-sm font-medium text-stone-700">语速</span>
          <input
            id="upload-rate"
            name="rate"
            className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
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
            className="border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500"
            value={pitch}
            onChange={(event) => setPitch(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
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

function voiceMetaLabel(voice: TtsVoice): string {
  return `${localeLabel(voice.locale)} · ${voice.gender === "Female" ? "女声" : "男声"}`;
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
