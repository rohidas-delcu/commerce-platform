import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: "apps/api/.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") }
});
