import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/infrastructure/db/schema.ts",
  out: "./src/server/infrastructure/db/migrations",
  dbCredentials: {
    url: "./storage/jianghun-shuyin.db",
  },
});
