"use client";

import { useEffect, useState } from "react";
import type { HealthResponse } from "@/shared/health";

type HealthState =
  | { status: "loading" }
  | { status: "success"; data: HealthResponse }
  | { status: "error" };

export function HealthStatus() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Health request failed");
        }

        const data = (await response.json()) as HealthResponse;
        setHealth({ status: "success", data });
      } catch {
        if (!controller.signal.aborted) {
          setHealth({ status: "error" });
        }
      }
    }

    void loadHealth();

    return () => controller.abort();
  }, []);

  return (
    <div className="border-t border-stone-200 pt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-stone-500">API 健康状态</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">
            {health.status === "loading" && "检查中..."}
            {health.status === "success" && "运行正常"}
            {health.status === "error" && "暂时不可用"}
          </p>
        </div>
        <span
          aria-label={`API 状态：${health.status}`}
          className={`h-3 w-3 shrink-0 rounded-full ${
            health.status === "success"
              ? "bg-emerald-500"
              : health.status === "error"
                ? "bg-red-500"
                : "bg-amber-400"
          }`}
        />
      </div>

      {health.status === "success" && (
        <p className="mt-4 text-sm text-stone-500">
          服务：{health.data.service} · 响应时间：
          {new Date(health.data.timestamp).toLocaleTimeString("zh-CN")}
        </p>
      )}

      {health.status === "error" && (
        <p className="mt-4 text-sm text-red-700">
          无法连接健康检查接口，请确认开发服务器仍在运行。
        </p>
      )}
    </div>
  );
}
