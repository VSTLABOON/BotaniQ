import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { UserProfile } from '../types';
import { logger } from '../lib/logger';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
  });

  useEffect(() => {
    // 1. Obtener la sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionUpdate(session);
    });

    // 2. Escuchar cambios de sesión (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSessionUpdate(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSessionUpdate = async (session: Session | null) => {
    if (!session?.user) {
      setState({ session: null, user: null, profile: null, isLoading: false });
      return;
    }

    try {
      // 3. Consultar la tabla de perfiles usando el user.id
      const { data: profile, error } = await supabase
        .from('perfiles')
        .select('id, tienda_id, rol, nombre_completo, telefono, direccion')
        .eq('id', session.user.id)
        .single();

      if (error) {
        logger.error('Error al cargar el perfil:', error.message);
      }

      const mappedProfile: UserProfile | null = profile ? {
        id: profile.id,
        tienda_id: profile.tienda_id,
        rol: profile.rol,
        nombre: profile.nombre_completo || null,
        email: session.user.email || null,
        telefono: profile.telefono || null,
        direccion: profile.direccion || null,
      } : null;

      setState({
        session,
        user: session.user,
        profile: mappedProfile,
        isLoading: false,
      });
    } catch (err) {
      logger.error('Error inesperado al cargar perfil:', err as Error);
      setState({ session, user: session.user, profile: null, isLoading: false });
    }
  };

  const contextValue = useMemo(() => state, [state]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
