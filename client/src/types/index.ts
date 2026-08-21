export interface EventTable {
  number: string;
  name: string | null;
}

export interface WeddingEvent {
  id: string;
  name: string;
  slug: string;
  coupleName1: string;
  coupleName2: string;
  eventDate: string | null;
  hashtag: string | null;
  welcomeMessage: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  theme: string;
  isActive: boolean;
  tables: EventTable[];
}

export interface Moment {
  id: string;
  guestName: string | null;
  message: string | null;
  mediaType: string;
  status: 'pending' | 'approved' | 'rejected';
  origin: string;
  tableNumber: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  approvedAt: string | null;
}

export interface GuestMessage {
  id: string;
  eventId: string;
  tableId: string | null;
  guestName: string | null;
  message: string;
  createdAt: string;
}

export type WallMode = 'slideshow' | 'mosaic' | 'highlights' | 'latest';

export interface LiveState {
  mode: WallMode;
  playing: boolean;
  currentMomentId: string | null;
  highlightMomentId: string | null;
  updatedAt: string;
}

export interface Stats {
  received: number;
  pending: number;
  approved: number;
  rejected: number;
  messages: number;
  mostActiveTable: { number: string; name: string | null; count: number } | null;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'super_admin' | 'event_admin' | 'moderator';
}

export interface Table {
  id: string;
  eventId: string;
  number: string;
  name: string | null;
  qrToken: string;
  createdAt: string;
}
