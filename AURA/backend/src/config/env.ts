import { z } from "zod";
import { env as bunEnv } from "bun";

console.log("🔐 Loading environment variables...");

const serverSchema = z.object({
	// Node
	NODE_ENV: z.string(),
	// Server
	PORT: z.string().optional().default("8000"),

	// Supabase
	SUPABASE_URL: z.string().min(1),
	SUPABASE_ANON_KEY: z.string().min(1),

	// Sentry
	SENTRY_DSN: z.string().min(1),

});

const _serverEnv = serverSchema.safeParse(bunEnv);

if (!_serverEnv.success) {
	console.error("❌ Invalid environment variables:\n");
	_serverEnv.error.issues.forEach((issue: any) => {
		console.error(issue);
	});
	throw new Error("Invalid environment variables");
}

const { NODE_ENV, PORT, SUPABASE_ANON_KEY, SUPABASE_URL, SENTRY_DSN } = _serverEnv.data;

export const env = {
	NODE_ENV,
	PORT: parseInt(PORT),
	SUPABASE_ANON_KEY,
	SUPABASE_URL,
	SENTRY_DSN,
};

console.log("✅ Environment variables loaded");