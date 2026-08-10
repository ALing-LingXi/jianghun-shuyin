import { createLocalJobRunner } from "../server/infrastructure/localJobRunner";

const runner = createLocalJobRunner();

function shutdown() {
  runner.stop();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

runner.start();
