"use client";
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthGuard({ children, requireAdmin = false }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        if (mounted) {
          setLoading(false);
          if (pathname !== '/login') router.push('/login');
        }
        return;
      }

      // Check role
      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', session.user.id)
        .single();

      if (mounted) {
        if (error || !perfil) {
          console.error("Error al obtener perfil:", JSON.stringify(error, null, 2));
          console.error("Código:", error?.code, "Mensaje:", error?.message, "Detalles:", error?.details);
          setLoading(false);
          setAuthorized(false);
          // If logged in but no profile, probably sync issue, but let's go to login
          router.push('/login');
          return;
        }

        if (requireAdmin && perfil.rol !== 'admin') {
          router.push('/recorridos');
          return;
        }

        setAuthorized(true);
        setLoading(false);
      }
    }

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (mounted) {
            setAuthorized(false);
            if (pathname !== '/login') router.push('/login');
          }
        } else if (event === 'SIGNED_IN') {
          checkAuth();
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [requireAdmin, router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <p className="text-lg text-secondary">Cargando aplicación...</p>
      </div>
    );
  }

  if (!authorized && pathname !== '/login') {
    return null; // Will redirect
  }

  return children;
}
