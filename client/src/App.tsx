import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { AdminProvider } from '@/context/AdminContext';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';

import { GuestEventPage } from '@/pages/guest/GuestEventPage';
import { GuestbookPage } from '@/pages/guest/GuestbookPage';
import { PublicGalleryPage } from '@/pages/gallery/PublicGalleryPage';
import { LiveWallPage } from '@/pages/live/LiveWallPage';

import { LoginPage } from '@/pages/admin/LoginPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { ModerationPage } from '@/pages/admin/ModerationPage';
import { GalleryManagePage } from '@/pages/admin/GalleryManagePage';
import { GuestbookAdminPage } from '@/pages/admin/GuestbookAdminPage';
import { ScreensPage } from '@/pages/admin/ScreensPage';
import { TablesPage } from '@/pages/admin/TablesPage';
import { StatsPage } from '@/pages/admin/StatsPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream text-center">
      <Heart className="h-8 w-8 fill-gold text-gold" />
      <h1 className="font-serif text-2xl">Wedding Live Moments</h1>
      <p className="max-w-xs text-sm text-ink/60">Aceda através do QR Code da sua mesa para partilhar um momento.</p>
      <Link to="/admin/login" className="text-sm text-gold-dark underline underline-offset-4">
        Acesso administrativo
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/e/:slug" element={<GuestEventPage />} />
          <Route path="/e/:slug/m/:tableNumber" element={<GuestEventPage />} />
          <Route path="/e/:slug/guestbook" element={<GuestbookPage />} />
          <Route path="/e/:slug/gallery" element={<PublicGalleryPage />} />
          <Route path="/e/:slug/live" element={<LiveWallPage />} />

          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="moderation" element={<ModerationPage />} />
            <Route path="gallery" element={<GalleryManagePage />} />
            <Route path="guestbook" element={<GuestbookAdminPage />} />
            <Route path="screens" element={<ScreensPage />} />
            <Route path="tables" element={<TablesPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminProvider>
    </BrowserRouter>
  );
}
