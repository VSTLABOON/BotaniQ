import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../store/toastStore';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { profile, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && profile && !allowedRoles.includes(profile.rol)) {
      toast.error('No tienes permisos para acceder a esta sección.');
      navigate('/admin', { replace: true });
    }
  }, [profile, allowedRoles, isLoading, navigate]);

  if (isLoading) return null;
  if (!profile || !allowedRoles.includes(profile.rol)) return null;

  return <>{children}</>;
}
