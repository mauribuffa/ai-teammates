import "server-only";

import { parseEnv } from "@neon/env";
import { drizzle } from "drizzle-orm/node-postgres";

import config from "@/neon";
import * as schema from "./schema";

// Pooled connection (-pooler host) for app traffic. Schema pushes use the unpooled URL (see drizzle.config.ts).
const { postgres } = parseEnv(config, ["DATABASE_URL"]);

export const db = drizzle(postgres.databaseUrl, { schema });
