import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/context/AdminContext';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAdmin();

  if (loading) return <LoadingSpinner label="A verificar sessão..." />;
  if (!user) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}
