"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Truck, Users, Map, Fuel, LogOut, LayoutDashboard, Wrench, BarChart3, Menu, X } from 'lucide-react';

export default function Navigation({ children }) {
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && mounted) {
        setUser(session.user);
        const { data } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();
        if (data && mounted) {
          setRole(data.rol);
        }
      }
    }

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (mounted) {
            setRole(null);
            setUser(null);
          }
        } else if (event === 'SIGNED_IN' && session) {
          loadUser();
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };
  
  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  if (!user || pathname === '/login') {
    return <main className="app-main container">{children}</main>;
  }

  const NavLinks = () => (
    <>
      <Link href="/" className={`btn-nav ${pathname === '/' ? 'btn-nav-active' : ''}`}>
        <LayoutDashboard size={18} /> Dashboard
      </Link>
      
      {role === 'admin' && (
        <>
          <Link href="/admin/vehiculos" className={`btn-nav ${pathname.includes('/vehiculos') ? 'btn-nav-active' : ''}`}>
            <Truck size={18} /> Vehículos
          </Link>
          <Link href="/admin/choferes" className={`btn-nav ${pathname.includes('/choferes') ? 'btn-nav-active' : ''}`}>
            <Users size={18} /> Choferes
          </Link>
          <Link href="/admin/recorridos" className={`btn-nav ${pathname.includes('/recorridos') ? 'btn-nav-active' : ''}`}>
             <Map size={18} /> Recorridos
          </Link>
          <Link href="/admin/mantenimientos" className={`btn-nav ${pathname.includes('/mantenimientos') ? 'btn-nav-active' : ''}`}>
            <Wrench size={18} /> Mantenimientos
          </Link>
          <Link href="/admin/rendimiento" className={`btn-nav ${pathname.includes('/rendimiento') ? 'btn-nav-active' : ''}`}>
            <BarChart3 size={18} /> Rendimiento
          </Link>
          <Link href="/admin/pedidos" className={`btn-nav ${pathname.includes('/pedidos') ? 'btn-nav-active' : ''}`}>
            <Map size={18} /> Pedidos/Entregas
          </Link>
          <Link href="/admin/usuarios" className={`btn-nav ${pathname.includes('/usuarios') ? 'btn-nav-active' : ''}`}>
            <Users size={18} /> Usuarios
          </Link>
        </>
      )}
      
      {role === 'operador' && (
        <>
          <Link href="/recorridos" className={`btn-nav ${pathname.includes('/recorridos') ? 'btn-nav-active' : ''}`}>
            <Map size={18} /> Mis Recorridos
          </Link>
          <Link href="/combustible" className={`btn-nav ${pathname.includes('/combustible') ? 'btn-nav-active' : ''}`}>
            <Fuel size={18} /> Combustible
          </Link>
        </>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="sidebar-overlay md:hidden" onClick={() => setIsMobileOpen(false)}></div>
      )}
      
      {/* Sidebar (Left) */}
      <aside className={`sidebar ${isMobileOpen ? 'open' : ''} md:translate-x-0`}>
        <div className="sidebar-logo-container">
          <img src="/logo-ferremix.jpg" alt="FerreMix Logo" style={{ height: '50px', objectFit: 'contain', backgroundColor: 'white', padding: '6px', borderRadius: '4px', width: '100%' }} />
        </div>
        <nav className="sidebar-nav">
          <NavLinks />
        </nav>
      </aside>

      {/* Main Content Area (Right) */}
      <div className="app-content-wrapper">
        {/* Top Header */}
        <header className="topbar">
          <div className="flex items-center">
            {/* Hamburger for mobile */}
            <button className="md:hidden mr-4" onClick={() => setIsMobileOpen(true)} style={{ color: 'var(--text-primary)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <Menu size={24} />
            </button>
            <h2 className="font-semibold text-lg hidden sm:block" style={{ color: 'var(--text-primary)' }}>
              Panel de Control
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end text-sm">
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.email}</span>
              <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{role}</span>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary py-1 px-3" style={{ fontSize: '0.8rem' }}>
              <LogOut size={16} /> Salir
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="app-main">
          {children}
        </main>
      </div>
    </>
  );
}
