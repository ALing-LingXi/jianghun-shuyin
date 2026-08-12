import Link from "next/link";
import { HealthStatus } from "@/features/health/health-status";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-2xl border border-stone-300 bg-white/80 p-8 shadow-sm sm:p-12">
        <div className="mb-10">
          <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
            工程骨架
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            匠魂书音
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
            本地中文文本有声化工具的第一阶段工程入口。
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          <Link
            className="border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white"
            href="/upload"
          >
            Upload text
          </Link>
          <Link
            className="border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800"
            href="/books"
          >
            Books
          </Link>
        </div>

        <HealthStatus />
      </section>
    </main>
  );
}
