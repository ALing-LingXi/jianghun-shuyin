import type { JobDto } from "@/shared/schemas/job";

export function JobStatusPanel({ job }: { job: JobDto }) {
  return (
    <dl className="grid gap-4 rounded border border-stone-200 bg-white p-6">
      <div>
        <dt className="text-sm text-stone-500">状态</dt>
        <dd className="mt-1 text-lg font-semibold text-stone-900">
          {job.status}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-stone-500">阶段</dt>
        <dd className="mt-1 text-lg font-semibold text-stone-900">
          {job.stage}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-stone-500">进度</dt>
        <dd className="mt-1 text-lg font-semibold text-stone-900">
          {job.progress}%
        </dd>
        <div className="mt-3 h-2 overflow-hidden rounded bg-stone-100">
          <div
            className="h-full bg-amber-600 transition-all"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>
    </dl>
  );
}
