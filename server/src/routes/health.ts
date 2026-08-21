import { Router } from 'express';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { supabaseAdmin } from '../lib/supabase/client.js';
import { s3 } from '../lib/minio/client.js';
import { env } from '../env.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const result = { status: 'ok', database: 'unknown', storage: 'unknown' };

  try {
    const { error } = await supabaseAdmin.from('events').select('id', { count: 'exact', head: true }).limit(1);
    result.database = error ? 'error' : 'connected';
    if (error) result.status = 'degraded';
  } catch {
    result.database = 'error';
    result.status = 'degraded';
  }

  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    result.storage = 'connected';
  } catch {
    result.storage = 'error';
    result.status = 'degraded';
  }

  res.status(result.status === 'ok' ? 200 : 503).json(result);
});
