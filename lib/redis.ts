import { Redis } from "@upstash/redis";

// Eén gedeelde client. Leest UPSTASH_REDIS_REST_URL en UPSTASH_REDIS_REST_TOKEN
// automatisch uit de omgeving (zie .env.local / Vercel env vars).
export const redis = Redis.fromEnv();
