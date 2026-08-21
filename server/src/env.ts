import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const stripTrailingSlash = (v: string) => v.replace(/\/+$/, '');

const envSchema = z.object({
  APP_NAME: z.string().default('Wedding Live Moments'),
  APP_URL: z.string().url().transform(stripTrailingSlash),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  SUPABASE_URL: z.string().url('SUPABASE_URL is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  DEVICE_HASH_SECRET: z.string().min(16).default('change-me-device-hash-secret-please'),

  S3_ENDPOINT: z.string().min(1, 'S3_ENDPOINT is required'),
  S3_PORT: z.coerce.number().optional(),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
  S3_REGION: z.string().default('us-east-1'),
  S3_USE_SSL: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  S3_PUBLIC_URL: z.string().optional(),

  MAX_IMAGE_SIZE_MB: z.coerce.number().default(15),
  MAX_VIDEO_SIZE_MB: z.coerce.number().default(100),

  CLIENT_URL: z.string().url().default('http://localhost:5173').transform(stripTrailingSlash),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables. Check .env against .env.example.');
}

export const env = parsed.data;
