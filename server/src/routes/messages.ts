import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase/client.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { isRateLimited } from '../lib/security/rateLimit.js';
import { hashDevice, getClientIp } from '../lib/security/deviceHash.js';
import { ensureDeviceId } from '../lib/security/deviceCookie.js';
import { emitToEvent } from '../lib/websocket/socket.js';
import { logger } from '../lib/logger.js';

export const messagesRouter = Router();

interface GuestMessageRow {
  id: string;
  event_id: string;
  table_id: string | null;
  guest_name: string | null;
  message: string;
  created_at: string;
}

function toPublicGuestMessage(row: GuestMessageRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    tableId: row.table_id,
    guestName: row.guest_name,
    message: row.message,
    createdAt: row.created_at,
  };
}

const messageSchema = z.object({
  guestName: z.string().max(120).optional(),
  message: z.string().min(1).max(500),
  tableNumber: z.string().max(20).optional(),
});

messagesRouter.post('/events/:eventId/messages', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid message payload');

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, is_active')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) throw new HttpError(404, 'Event not found');
    if (!event.is_active) throw new HttpError(403, 'Event is not currently active');

    const deviceId = ensureDeviceId(req, res);
    const ip = getClientIp(req);
    if (isRateLimited(hashDevice(ip, deviceId), 20)) {
      throw new HttpError(429, 'Too many messages from this device. Please wait a few minutes.');
    }

    let tableId: string | null = null;
    if (parsed.data.tableNumber) {
      const { data: table } = await supabaseAdmin
        .from('tables')
        .select('id')
        .eq('event_id', eventId)
        .eq('number', parsed.data.tableNumber)
        .maybeSingle();
      tableId = table?.id ?? null;
    }

    const { data: guestMessage, error } = await supabaseAdmin
      .from('guest_messages')
      .insert({
        event_id: eventId,
        table_id: tableId,
        guest_name: parsed.data.guestName ?? null,
        message: parsed.data.message,
      })
      .select()
      .single();
    if (error) throw error;

    logger.info('guest message created', { eventId });
    const publicMessage = toPublicGuestMessage(guestMessage as GuestMessageRow);
    emitToEvent(eventId, 'message.created', publicMessage);
    res.status(201).json(publicMessage);
  } catch (err) {
    next(err);
  }
});

messagesRouter.get('/events/:eventId/messages', requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('guest_messages')
      .select()
      .eq('event_id', req.params.eventId)
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    res.json((data as GuestMessageRow[]).map(toPublicGuestMessage));
  } catch (err) {
    next(err);
  }
});
