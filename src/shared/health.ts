export const HEALTH_STATUS = "ok" as const;

export type HealthResponse = {
  status: typeof HEALTH_STATUS;
  service: "jianghun-shuyin";
  timestamp: string;
};

export function createHealthResponse(now: Date = new Date()): HealthResponse {
  return {
    status: HEALTH_STATUS,
    service: "jianghun-shuyin",
    timestamp: now.toISOString(),
  };
}
