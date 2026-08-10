export interface JobRunner {
  start(): void;
  stop(): void;
  runOnce(): Promise<number>;
}
