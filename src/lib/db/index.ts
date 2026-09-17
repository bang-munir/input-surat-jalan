import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

type Database = NeonDatabase<typeof schema>;

let database: Database | undefined;

function loadLocalDotEnv(): void {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile();
    }
  } catch {
    return;
  }
}

function resolveConnectionString(): string | undefined {
  loadLocalDotEnv();

  const fromProcessEnv = process.env["DATABASE_URL"];
  if (typeof fromProcessEnv === "string" && fromProcessEnv.trim().length > 0) {
    return fromProcessEnv;
  }

  const requestEnv = (globalThis as { __env__?: Record<string, unknown> }).__env__;
  const fromRequestEnv = requestEnv?.["DATABASE_URL"];
  if (typeof fromRequestEnv === "string" && fromRequestEnv.trim().length > 0) {
    return fromRequestEnv;
  }

  return undefined;
}

function getDatabase(): Database {
  if (!database) {
    const connectionString = resolveConnectionString();
    if (!connectionString) {
      throw new Error("DATABASE_URL tidak tersedia di environment server.");
    }
    const pool = new Pool({ connectionString });
    database = drizzle({ client: pool, schema });
  }
  return database;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const current = getDatabase();
    const value = Reflect.get(current, prop, current);
    return typeof value === "function" ? value.bind(current) : value;
  },
});