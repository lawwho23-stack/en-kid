import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // biome-ignore lint: drizzle-kit reads this at push time only
    url: process.env.DATABASE_URL!,
  },
});
