import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Images,
  BookHeart,
  MonitorPlay,
  QrCode,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Heart,
} from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/moderation', label: 'Moderação', icon: ShieldCheck },
  { to: '/admin/gallery', label: 'Galeria', icon: Images },
  { to: '/admin/guestbook', label: 'Livro de Visitas', icon: BookHeart },
  { to: '/admin/screens', label: 'Telas', icon: MonitorPlay },
  { to: '/admin/tables', label: 'QR Code', icon: QrCode },
  { to: '/admin/stats', label: 'Estatísticas', icon: BarChart3 },
  { to: '/admin/settings', label: 'Configurações', icon: Settings },
];

export function AdminLayout() {
  const { user, events, currentEventId, setCurrentEventId, logout } = useAdmin();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gold/15 bg-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-6 py-6">
          <Heart className="h-5 w-5 fill-gold text-gold" />
          <span className="font-serif text-lg">Wedding Live Moments</span>
        </div>

        {events.length > 1 && (
          <div className="px-4 pb-4">
            <select
              value={currentEventId ?? ''}
              onChange={(e) => setCurrentEventId(e.target.value)}
              className="w-full rounded-lg border border-gold/30 bg-white px-3 py-2 text-sm"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-gold/15 text-gold-dark' : 'text-ink/70 hover:bg-blush'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full border-t border-gold/15 p-4">
          <p className="truncate text-xs text-ink/50">{user?.email}</p>
          <button onClick={handleLogout} className="mt-2 flex items-center gap-2 text-sm text-ink/60 hover:text-ink">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1">
        <div className="flex items-center justify-between border-b border-gold/15 bg-white px-4 py-3 lg:hidden">
          <span className="font-serif text-lg">Wedding Live Moments</span>
          <button onClick={() => setMobileOpen((v) => !v)}>{mobileOpen ? <X /> : <Menu />}</button>
        </div>
        <main className="p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
