import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import { supabaseAdmin } from '../lib/supabase/client.js';
import { uploadObject, getObjectStream, getObjectBuffer } from '../lib/minio/client.js';
import sharp from 'sharp';
import { processImage } from '../services/uploads/imageProcess.js';
import { processVideo } from '../services/uploads/videoProcess.js';
import { toPublicMoment, type MomentRow } from '../services/moments/present.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { isRateLimited } from '../lib/security/rateLimit.js';
import { hashDevice, getClientIp } from '../lib/security/deviceHash.js';
import { ensureDeviceId } from '../lib/security/deviceCookie.js';
import { emitToEvent, updateLiveState } from '../lib/websocket/socket.js';
import { logger } from '../lib/logger.js';
import { env } from '../env.js';

export const momentsRouter = Router();

const MOMENT_SELECT = '*, tables(number, name)';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const ALLOWED_MIME = new Set([...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME]);

const upload = multer({
  storage: multer.memoryStorage(),
  // multer only knows the total byte ceiling up front; images are checked
  // again against MAX_IMAGE_SIZE_MB once we know which type was actually sent.
  limits: { fileSize: Math.max(env.MAX_IMAGE_SIZE_MB, env.MAX_VIDEO_SIZE_MB) * 1024 * 1024 },
});

function storagePrefix(eventId: string, date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `events/${eventId}/moments/${yyyy}/${mm}`;
}

// POST /api/events/:eventId/moments — guest upload, no auth
momentsRouter.post('/events/:eventId/moments', upload.single('photo'), async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const file = req.file;

    if (!file) {
      throw new HttpError(400, 'photo file is required');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new HttpError(400, 'Unsupported file type');
    }

    const sniffed = await fileTypeFromBuffer(file.buffer);
    if (!sniffed || !ALLOWED_MIME.has(sniffed.mime)) {
      throw new HttpError(400, 'File content does not match an accepted image or video type');
    }
    const isVideo = ALLOWED_VIDEO_MIME.has(sniffed.mime);
    if (!isVideo && file.buffer.byteLength > env.MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      throw new HttpError(400, `Image must be ${env.MAX_IMAGE_SIZE_MB}MB or smaller`);
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, is_active')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) throw new HttpError(404, 'Event not found');
    if (!event.is_active) throw new HttpError(403, 'Event is not currently accepting moments');

    const deviceId = ensureDeviceId(req, res);
    const ip = getClientIp(req);
    const limiterKey = hashDevice(ip, deviceId);

    if (isRateLimited(limiterKey)) {
      logger.warn('upload rate limited', { eventId });
      throw new HttpError(429, 'Too many uploads from this device. Please wait a few minutes.');
    }

    const tableNumber = typeof req.body.tableNumber === 'string' ? req.body.tableNumber : undefined;
    const guestName = typeof req.body.guestName === 'string' ? req.body.guestName.slice(0, 120) : null;
    const message = typeof req.body.message === 'string' ? req.body.message.slice(0, 500) : null;
    const origin = tableNumber ? 'table' : 'general';

    let tableId: string | null = null;
    if (tableNumber) {
      const { data: table } = await supabaseAdmin
        .from('tables')
        .select('id')
        .eq('event_id', eventId)
        .eq('number', tableNumber)
        .maybeSingle();
      tableId = table?.id ?? null;
    }

    logger.info('upload started', { eventId, origin, mediaType: isVideo ? 'video' : 'image' });

    const id = uuidv4();
    const prefix = storagePrefix(eventId, new Date());
    const thumbnailKey = `events/${eventId}/thumbnails/${id}.webp`;
    let storageKey: string;

    if (isVideo) {
      const { video, thumbnail, extension, contentType } = await processVideo(file.buffer, sniffed.mime);
      storageKey = `${prefix}/${id}.${extension}`;
      await uploadObject(storageKey, video, contentType);
      await uploadObject(thumbnailKey, thumbnail, 'image/webp');
    } else {
      const { original, thumbnail, contentType } = await processImage(file.buffer);
      storageKey = `${prefix}/${id}.webp`;
      await uploadObject(storageKey, original, contentType);
      await uploadObject(thumbnailKey, thumbnail, contentType);
    }

    const deviceHash = hashDevice(ip, deviceId);

    const { data: moment, error: insertError } = await supabaseAdmin
      .from('moments')
      .insert({
        event_id: eventId,
        table_id: tableId,
        guest_name: guestName,
        message,
        media_type: isVideo ? 'video' : 'image',
        storage_key: storageKey,
        thumbnail_key: thumbnailKey,
        origin,
        device_hash: deviceHash,
      })
      .select(MOMENT_SELECT)
      .single();
    if (insertError) throw insertError;

    logger.info('upload completed', { eventId, momentId: moment.id });

    const publicMoment = await toPublicMoment(moment as MomentRow);
    emitToEvent(eventId, 'moment.created', publicMoment);

    res.status(201).json(publicMoment);
  } catch (err) {
    if (!(err instanceof HttpError)) {
      logger.error('upload failed', { message: err instanceof Error ? err.message : String(err) });
    }
    next(err);
  }
});

// GET /api/events/:eventId/moments?status=pending — admin
momentsRouter.get('/events/:eventId/moments', requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    let query = supabaseAdmin
      .from('moments')
      .select(MOMENT_SELECT)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json(await Promise.all((data as MomentRow[]).map(toPublicMoment)));
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:eventId/gallery — public, approved only
momentsRouter.get('/events/:eventId/gallery', async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('moments')
      .select(MOMENT_SELECT)
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(30);
    if (error) throw error;

    res.json(await Promise.all((data as MomentRow[]).map(toPublicMoment)));
  } catch (err) {
    next(err);
  }
});

const DOWNLOAD_CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

// GET /api/events/:eventId/moments/:momentId/download — public, approved only
// Streams the original file with Content-Disposition: attachment so the browser
// saves it instead of navigating to the signed object URL.
momentsRouter.get('/events/:eventId/moments/:momentId/download', async (req, res, next) => {
  try {
    const { eventId, momentId } = req.params;

    const { data: moment, error } = await supabaseAdmin
      .from('moments')
      .select('id, event_id, media_type, storage_key, created_at')
      .eq('id', momentId)
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .maybeSingle();
    if (error) throw error;
    if (!moment) throw new HttpError(404, 'Moment not found');

    const extension =
      moment.storage_key.split('.').pop() ?? (moment.media_type === 'video' ? 'mp4' : 'webp');
    const base = `momento-${moment.created_at.slice(0, 10)}`;

    if (moment.media_type === 'video') {
      const contentType = DOWNLOAD_CONTENT_TYPES[extension] ?? 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${base}.${extension}"`);

      const stream = await getObjectStream(moment.storage_key);
      stream.on('error', next);
      stream.pipe(res);
      return;
    }

    // Images are stored as webp; re-encode to JPEG so downloads land as .jpg
    const webpBuffer = await getObjectBuffer(moment.storage_key);
    const jpeg = await sharp(webpBuffer).jpeg({ quality: 90 }).toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.jpg"`);
    res.end(jpeg);
  } catch (err) {
    next(err);
  }
});

async function setStatus(momentId: string, status: 'approved' | 'rejected', adminUserId: string): Promise<MomentRow> {
  const { data, error } = await supabaseAdmin
    .from('moments')
    .update({
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      approved_by: adminUserId,
    })
    .eq('id', momentId)
    .select(MOMENT_SELECT)
    .single();
  if (error) throw error;
  return data as MomentRow;
}

momentsRouter.patch('/moments/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const moment = await setStatus(req.params.id, 'approved', req.admin!.userId);
    const publicMoment = await toPublicMoment(moment);
    emitToEvent(moment.event_id, 'moment.approved', publicMoment);
    logger.info('moment approved', { momentId: moment.id, eventId: moment.event_id });
    res.json(publicMoment);
  } catch (err) {
    next(err);
  }
});

momentsRouter.patch('/moments/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const moment = await setStatus(req.params.id, 'rejected', req.admin!.userId);
    const publicMoment = await toPublicMoment(moment);
    emitToEvent(moment.event_id, 'moment.rejected', publicMoment);
    logger.info('moment rejected', { momentId: moment.id, eventId: moment.event_id });
    res.json(publicMoment);
  } catch (err) {
    next(err);
  }
});

momentsRouter.post('/moments/bulk/approve', requireAdmin, async (req, res, next) => {
  try {
    const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids : [];
    const results = await Promise.all(
      ids.map(async (id) => {
        const moment = await setStatus(id, 'approved', req.admin!.userId);
        const publicMoment = await toPublicMoment(moment);
        emitToEvent(moment.event_id, 'moment.approved', publicMoment);
        return publicMoment;
      })
    );
    res.json(results);
  } catch (err) {
    next(err);
  }
});

momentsRouter.post('/moments/bulk/reject', requireAdmin, async (req, res, next) => {
  try {
    const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids : [];
    const results = await Promise.all(
      ids.map(async (id) => {
        const moment = await setStatus(id, 'rejected', req.admin!.userId);
        const publicMoment = await toPublicMoment(moment);
        emitToEvent(moment.event_id, 'moment.rejected', publicMoment);
        return publicMoment;
      })
    );
    res.json(results);
  } catch (err) {
    next(err);
  }
});

momentsRouter.patch('/moments/:id/highlight', requireAdmin, async (req, res, next) => {
  try {
    const { data: moment, error } = await supabaseAdmin
      .from('moments')
      .select(MOMENT_SELECT)
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!moment || moment.status !== 'approved') throw new HttpError(400, 'Only approved moments can be highlighted');

    const publicMoment = await toPublicMoment(moment as MomentRow);
    updateLiveState(moment.event_id, { highlightMomentId: moment.id });
    emitToEvent(moment.event_id, 'wall.highlight', publicMoment);
    res.json(publicMoment);
  } catch (err) {
    next(err);
  }
});
