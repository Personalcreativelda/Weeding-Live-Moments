import { getSignedObjectUrl } from '../../lib/minio/client.js';

export interface MomentRow {
  id: string;
  event_id: string;
  table_id: string | null;
  guest_name: string | null;
  message: string | null;
  media_type: string;
  storage_key: string;
  thumbnail_key: string | null;
  status: 'pending' | 'approved' | 'rejected';
  origin: string;
  device_hash: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  tables?: { number: string; name: string | null } | null;
}

export interface PublicMoment {
  id: string;
  guestName: string | null;
  message: string | null;
  mediaType: string;
  status: string;
  origin: string;
  tableNumber: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  approvedAt: string | null;
}

export async function toPublicMoment(moment: MomentRow): Promise<PublicMoment> {
  const [imageUrl, thumbnailUrl] = await Promise.all([
    getSignedObjectUrl(moment.storage_key),
    getSignedObjectUrl(moment.thumbnail_key ?? moment.storage_key),
  ]);

  return {
    id: moment.id,
    guestName: moment.guest_name,
    message: moment.message,
    mediaType: moment.media_type,
    status: moment.status,
    origin: moment.origin,
    tableNumber: moment.tables?.number ?? null,
    imageUrl,
    thumbnailUrl,
    createdAt: moment.created_at,
    approvedAt: moment.approved_at,
  };
}
