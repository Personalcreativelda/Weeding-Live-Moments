import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import archiver from 'archiver';
import sharp from 'sharp';
import { supabaseAdmin } from '../lib/supabase/client.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { getLiveState, updateLiveState, emitToEvent, type WallMode } from '../lib/websocket/socket.js';
import { toPublicMoment, type MomentRow } from '../services/moments/present.js';
import { getObjectStream, getObjectBuffer } from '../lib/minio/client.js';
import { toCsv } from '../services/export/csv.js';
import { env } from '../env.js';
import { logger } from '../lib/logger.js';

export const eventsRouter = Router();

interface EventRow {
  id: string;
  name: string;
  slug: string;
  couple_name_1: string;
  couple_name_2: string;
  event_date: string | null;
  hashtag: string | null;
  welcome_message: string | null;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  secondary_color: string;
  theme: string;
  is_active: boolean;
  created_at: string;
}

function toPublicEvent(event: EventRow, tables: { number: string; name: string | null }[] = []) {
  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    coupleName1: event.couple_name_1,
    coupleName2: event.couple_name_2,
    eventDate: event.event_date,
    hashtag: event.hashtag,
    welcomeMessage: event.welcome_message,
    logoUrl: event.logo_url,
    coverUrl: event.cover_url,
    primaryColor: event.primary_color,
    secondaryColor: event.secondary_color,
    theme: event.theme,
    isActive: event.is_active,
    tables,
  };
}

// GET /api/events/by-slug/:slug — public event lookup
eventsRouter.get('/events/by-slug/:slug', async (req, res, next) => {
  try {
    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('slug', req.params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!event) throw new HttpError(404, 'Event not found');

    const { data: tables } = await supabaseAdmin.from('tables').select('number, name').eq('event_id', event.id);

    res.json(toPublicEvent(event as EventRow, tables ?? []));
  } catch (err) {
    next(err);
  }
});

// Admin: list events accessible to the logged-in admin (super_admin sees all)
eventsRouter.get('/events', requireAdmin, async (req, res, next) => {
  try {
    const isSuperAdmin = req.admin!.role === 'super_admin';

    if (isSuperAdmin) {
      const { data, error } = await supabaseAdmin.from('events').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.json((data as EventRow[]).map((e) => toPublicEvent(e)));
      return;
    }

    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('event_admins')
      .select('event_id')
      .eq('user_id', req.admin!.userId);
    if (membershipError) throw membershipError;

    const eventIds = (memberships ?? []).map((m) => m.event_id);
    if (eventIds.length === 0) {
      res.json([]);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .in('id', eventIds)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data as EventRow[]).map((e) => toPublicEvent(e)));
  } catch (err) {
    next(err);
  }
});

const createEventSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers and hyphens'),
  coupleName1: z.string().min(1),
  coupleName2: z.string().min(1),
  eventDate: z.string().datetime().optional(),
  hashtag: z.string().optional(),
});

eventsRouter.post('/events', requireAdmin, async (req, res, next) => {
  try {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid event payload');

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug,
        couple_name_1: parsed.data.coupleName1,
        couple_name_2: parsed.data.coupleName2,
        event_date: parsed.data.eventDate ?? null,
        hashtag: parsed.data.hashtag ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;

    await supabaseAdmin.from('event_admins').insert({ event_id: event.id, user_id: req.admin!.userId });

    logger.info('event created', { eventId: event.id, slug: event.slug });
    res.status(201).json(toPublicEvent(event as EventRow));
  } catch (err) {
    next(err);
  }
});

const updateEventSchema = z.object({
  name: z.string().min(1).optional(),
  coupleName1: z.string().min(1).optional(),
  coupleName2: z.string().min(1).optional(),
  eventDate: z.string().datetime().nullable().optional(),
  hashtag: z.string().nullable().optional(),
  welcomeMessage: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  theme: z.string().optional(),
  isActive: z.boolean().optional(),
});

eventsRouter.patch('/events/:id', requireAdmin, async (req, res, next) => {
  try {
    const parsed = updateEventSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid event payload');
    const p = parsed.data;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (p.name !== undefined) patch.name = p.name;
    if (p.coupleName1 !== undefined) patch.couple_name_1 = p.coupleName1;
    if (p.coupleName2 !== undefined) patch.couple_name_2 = p.coupleName2;
    if (p.eventDate !== undefined) patch.event_date = p.eventDate;
    if (p.hashtag !== undefined) patch.hashtag = p.hashtag;
    if (p.welcomeMessage !== undefined) patch.welcome_message = p.welcomeMessage;
    if (p.logoUrl !== undefined) patch.logo_url = p.logoUrl;
    if (p.coverUrl !== undefined) patch.cover_url = p.coverUrl;
    if (p.primaryColor !== undefined) patch.primary_color = p.primaryColor;
    if (p.secondaryColor !== undefined) patch.secondary_color = p.secondaryColor;
    if (p.theme !== undefined) patch.theme = p.theme;
    if (p.isActive !== undefined) patch.is_active = p.isActive;

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;

    res.json(toPublicEvent(event as EventRow));
  } catch (err) {
    next(err);
  }
});

// ---- Tables & QR codes ----

eventsRouter.get('/events/:eventId/tables', requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tables')
      .select('*')
      .eq('event_id', req.params.eventId)
      .order('number', { ascending: true });
    if (error) throw error;
    res.json(
      (data ?? []).map((t) => ({
        id: t.id,
        eventId: t.event_id,
        number: t.number,
        name: t.name,
        qrToken: t.qr_token,
        createdAt: t.created_at,
      }))
    );
  } catch (err) {
    next(err);
  }
});

const createTableSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
});

eventsRouter.post('/events/:eventId/tables', requireAdmin, async (req, res, next) => {
  try {
    const parsed = createTableSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid table payload');

    const { data: table, error } = await supabaseAdmin
      .from('tables')
      .insert({
        event_id: req.params.eventId,
        number: parsed.data.number,
        name: parsed.data.name ?? null,
        qr_token: `${req.params.eventId}-${parsed.data.number}-${Date.now().toString(36)}`,
      })
      .select('*')
      .single();
    if (error) throw error;

    res.status(201).json({
      id: table.id,
      eventId: table.event_id,
      number: table.number,
      name: table.name,
      qrToken: table.qr_token,
      createdAt: table.created_at,
    });
  } catch (err) {
    next(err);
  }
});

eventsRouter.delete('/tables/:id', requireAdmin, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('tables').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

function eventQrUrl(slug: string, tableNumber?: string) {
  // A single QR is meant to be shared with every guest; the per-table QR
  // (tableNumber set) exists only as an optional extra for table-level stats.
  return tableNumber ? `${env.APP_URL}/e/${slug}/m/${tableNumber}` : `${env.APP_URL}/e/${slug}`;
}

eventsRouter.get('/events/:eventId/qr', requireAdmin, async (req, res, next) => {
  try {
    const format = req.query.format === 'svg' ? 'svg' : 'png';
    const tableNumber = typeof req.query.table === 'string' ? req.query.table : undefined;

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('slug')
      .eq('id', req.params.eventId)
      .maybeSingle();
    if (error) throw error;
    if (!event) throw new HttpError(404, 'Event not found');

    const url = eventQrUrl(event.slug, tableNumber);

    if (format === 'svg') {
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1 });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    } else {
      const png = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 512 });
      res.setHeader('Content-Type', 'image/png');
      res.send(png);
    }
  } catch (err) {
    next(err);
  }
});

// ---- Stats ----

eventsRouter.get('/events/:eventId/stats', requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const [receivedRes, pendingRes, approvedRes, rejectedRes, messagesRes, tableMomentsRes] = await Promise.all([
      supabaseAdmin.from('moments').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabaseAdmin.from('moments').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'pending'),
      supabaseAdmin.from('moments').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'approved'),
      supabaseAdmin.from('moments').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'rejected'),
      supabaseAdmin.from('guest_messages').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabaseAdmin.from('moments').select('table_id').eq('event_id', eventId).not('table_id', 'is', null),
    ]);

    for (const r of [receivedRes, pendingRes, approvedRes, rejectedRes, messagesRes, tableMomentsRes]) {
      if (r.error) throw r.error;
    }

    const counts = new Map<string, number>();
    for (const row of tableMomentsRes.data ?? []) {
      const key = row.table_id as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let mostActiveTable: { number: string; name: string | null; count: number } | null = null;
    let topTableId: string | null = null;
    let topCount = 0;
    for (const [tableId, count] of counts) {
      if (count > topCount) {
        topCount = count;
        topTableId = tableId;
      }
    }
    if (topTableId) {
      const { data: table } = await supabaseAdmin.from('tables').select('number, name').eq('id', topTableId).maybeSingle();
      if (table) mostActiveTable = { number: table.number, name: table.name, count: topCount };
    }

    res.json({
      received: receivedRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      approved: approvedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
      messages: messagesRes.count ?? 0,
      mostActiveTable,
    });
  } catch (err) {
    next(err);
  }
});

// ---- Live wall state & remote control ----

eventsRouter.get('/events/:eventId/live-state', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const state = getLiveState(eventId);

    const { data, error } = await supabaseAdmin
      .from('moments')
      .select('*, tables(number, name)')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(40);
    if (error) throw error;

    res.json({
      state,
      moments: await Promise.all((data as MomentRow[]).map(toPublicMoment)),
    });
  } catch (err) {
    next(err);
  }
});

const wallControlSchema = z.object({
  action: z.enum(['play', 'pause', 'next', 'previous', 'mode', 'highlight', 'clear-highlight']),
  mode: z.enum(['slideshow', 'mosaic', 'highlights', 'latest']).optional(),
  momentId: z.string().optional(),
});

eventsRouter.post('/events/:eventId/wall/control', requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const parsed = wallControlSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid wall control payload');

    const { action, mode, momentId } = parsed.data;

    switch (action) {
      case 'play':
        emitToEvent(eventId, 'wall.play', updateLiveState(eventId, { playing: true }));
        break;
      case 'pause':
        emitToEvent(eventId, 'wall.pause', updateLiveState(eventId, { playing: false }));
        break;
      case 'next':
        emitToEvent(eventId, 'wall.next', { at: new Date().toISOString() });
        break;
      case 'previous':
        emitToEvent(eventId, 'wall.previous', { at: new Date().toISOString() });
        break;
      case 'mode':
        if (!mode) throw new HttpError(400, 'mode is required for the mode action');
        emitToEvent(eventId, 'wall.mode.changed', updateLiveState(eventId, { mode: mode as WallMode }));
        break;
      case 'highlight':
        if (!momentId) throw new HttpError(400, 'momentId is required to highlight');
        emitToEvent(eventId, 'wall.highlight', updateLiveState(eventId, { highlightMomentId: momentId }));
        break;
      case 'clear-highlight':
        emitToEvent(eventId, 'wall.highlight', updateLiveState(eventId, { highlightMomentId: null }));
        break;
    }

    res.json(getLiveState(eventId));
  } catch (err) {
    next(err);
  }
});

// ---- Export (photos + CSVs as a single ZIP) ----

eventsRouter.get('/events/:eventId/export', requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('slug')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) throw new HttpError(404, 'Event not found');

    const [momentsRes, messagesRes] = await Promise.all([
      supabaseAdmin
        .from('moments')
        .select('*, tables(number, name)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('guest_messages').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
    ]);
    if (momentsRes.error) throw momentsRes.error;
    if (messagesRes.error) throw messagesRes.error;

    const moments = (momentsRes.data ?? []) as MomentRow[];
    const messages = messagesRes.data ?? [];

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${event.slug}-export.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      logger.error('export failed', { message: err.message });
      res.destroy(err);
    });
    archive.pipe(res);

    const momentsCsv = toCsv(
      moments.map((m) => ({
        id: m.id,
        guestName: m.guest_name ?? '',
        message: (m.message ?? '').replace(/\n/g, ' '),
        table: m.tables?.number ?? '',
        status: m.status,
        createdAt: m.created_at,
        approvedAt: m.approved_at ?? '',
      })),
      ['id', 'guestName', 'message', 'table', 'status', 'createdAt', 'approvedAt']
    );
    archive.append(momentsCsv, { name: 'moments.csv' });

    const messagesCsv = toCsv(
      messages.map((m) => ({
        id: m.id,
        guestName: m.guest_name ?? '',
        message: (m.message as string).replace(/\n/g, ' '),
        createdAt: m.created_at,
      })),
      ['id', 'guestName', 'message', 'createdAt']
    );
    archive.append(messagesCsv, { name: 'messages.csv' });

    for (const moment of moments.filter((m) => m.status === 'approved')) {
      try {
        if (moment.media_type === 'video') {
          const ext = moment.storage_key.split('.').pop() ?? 'mp4';
          const stream = await getObjectStream(moment.storage_key);
          archive.append(stream, { name: `photos/${moment.id}.${ext}` });
        } else {
          // Re-encode stored webp to JPEG so the ZIP contains .jpg files.
          const webpBuffer = await getObjectBuffer(moment.storage_key);
          const jpeg = await sharp(webpBuffer).jpeg({ quality: 90 }).toBuffer();
          archive.append(jpeg, { name: `photos/${moment.id}.jpg` });
        }
      } catch {
        logger.warn('export: failed to fetch photo', { momentId: moment.id });
      }
    }

    logger.info('event export generated', { eventId, moments: moments.length, messages: messages.length });
    await archive.finalize();
  } catch (err) {
    next(err);
  }
});
