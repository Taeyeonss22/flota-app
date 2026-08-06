"use client";
import AuthGuard from '@/components/AuthGuard';
import { Truck, Map, Fuel, Users, AlertTriangle, CheckCircle, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { differenceInDays } from 'date-fns';

export default function Home() {
  const [role, setRole] = useState(null);
  const [stats, setStats] = useState({
    vehiculosActivos: 0,
    gastoMes: 0,
    mantenimientosPendientes: 0,
    kmMes: 0
  });
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single();
      if (perfil) setRole(perfil.rol);

      if (perfil?.rol === 'admin') {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Fetch data for KPIs
        const { count: vehiculosCount } = await supabase.from('vehiculos').select('*', { count: 'exact', head: true }).eq('estado', 'activo');
        
        const { data: cargas } = await supabase.from('cargas_combustible').select('costo_total, litros, rendimiento_calculado').gte('fecha', firstDayOfMonth);
        const gastoMes = cargas ? cargas.reduce((sum, c) => sum + parseFloat(c.costo_total), 0) : 0;
        
        const { data: recorridos } = await supabase.from('recorridos').select('km_recorridos').gte('fecha_salida', firstDayOfMonth);
        const kmMes = recorridos ? recorridos.reduce((sum, r) => sum + parseFloat(r.km_recorridos), 0) : 0;

        // Fetch for Alerts
        const { data: choferes } = await supabase.from('choferes').select('nombre, vigencia_licencia').eq('estado', 'activo');
        const { data: vehiculos } = await supabase.from('vehiculos').select('id, placa, kilometraje_actual');
        
        // Latest maintenance for each vehicle to check pending
        const { data: mantenimientos } = await supabase.from('mantenimientos').select('vehiculo_id, proximo_mantenimiento_km, proximo_mantenimiento_fecha').order('fecha', { ascending: false });
        
        const vehiculosMap = new window.Map();
        vehiculos?.forEach(v => vehiculosMap.set(v.id, v));

        const latestMantenimientos = new window.Map();
        mantenimientos?.forEach(m => {
          if (!latestMantenimientos.has(m.vehiculo_id)) {
            latestMantenimientos.set(m.vehiculo_id, m);
          }
        });

        const newAlertas = [];
        let mantPendientesCount = 0;

        // Check licenses
        choferes?.forEach(c => {
          const daysLeft = differenceInDays(new Date(c.vigencia_licencia), now);
          if (daysLeft < 0) {
            newAlertas.push({ type: 'danger', text: `Licencia de ${c.nombre} está vencida.` });
          } else if (daysLeft <= 30) {
            newAlertas.push({ type: 'warning', text: `Licencia de ${c.nombre} vence en ${daysLeft} días.` });
          }
        });

        // Check maintenance
        latestMantenimientos.forEach((m, vid) => {
          const v = vehiculosMap.get(vid);
          if (!v) return;

          let necesitaMant = false;
          
          if (m.proximo_mantenimiento_km) {
            const diffKm = m.proximo_mantenimiento_km - v.kilometraje_actual;
            if (diffKm <= 0) {
              newAlertas.push({ type: 'danger', text: `Vehículo ${v.placa} sobrepasó el kilometraje de mantenimiento.` });
              necesitaMant = true;
            } else if (diffKm <= 500) {
              newAlertas.push({ type: 'warning', text: `Vehículo ${v.placa} requiere mantenimiento en ${diffKm} km.` });
              necesitaMant = true;
            }
          }

          if (m.proximo_mantenimiento_fecha) {
            const daysLeft = differenceInDays(new Date(m.proximo_mantenimiento_fecha), now);
            if (daysLeft < 0) {
              newAlertas.push({ type: 'danger', text: `Mantenimiento de ${v.placa} está atrasado por fecha.` });
              necesitaMant = true;
            } else if (daysLeft <= 15) {
              newAlertas.push({ type: 'warning', text: `Mantenimiento de ${v.placa} programado en ${daysLeft} días.` });
              necesitaMant = true;
            }
          }

          if (necesitaMant) mantPendientesCount++;
        });

        // Add anomaly alert example if any vehicle has crazy low rendimiento this month
        if (cargas) {
          const anomalos = cargas.filter(c => parseFloat(c.rendimiento_calculado) < 2.0); // Arbitrary anomaly threshold
          if (anomalos.length > 0) {
            newAlertas.push({ type: 'warning', text: `Se detectaron ${anomalos.length} cargas con rendimiento anormalmente bajo (< 2 km/L) este mes.` });
          }
        }

        setStats({
          vehiculosActivos: vehiculosCount || 0,
          gastoMes,
          kmMes,
          mantenimientosPendientes: mantPendientesCount
        });
        setAlertas(newAlertas);
      }
      setLoading(false);
    }
    loadDashboard();
  }, []);

  if (loading) return null;

  return (
    <AuthGuard>
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">
            {role === 'admin' ? 'Dashboard Central' : 'Bienvenido a FlotaApp'}
          </h1>
        </div>
        
        {role === 'admin' && (
          <>
            {/* KPIs */}
            <div className="flex gap-4 mb-8" style={{ flexWrap: 'wrap' }}>
              <div className="glass-panel p-6 flex flex-col gap-2" style={{ flex: '1 1 200px', padding: '1.5rem' }}>
                <span className="text-secondary text-sm font-medium">Vehículos Activos</span>
                <span className="text-3xl font-bold">{stats.vehiculosActivos}</span>
              </div>
              <div className="glass-panel p-6 flex flex-col gap-2" style={{ flex: '1 1 200px', padding: '1.5rem' }}>
                <span className="text-secondary text-sm font-medium">Gasto Combustible (Mes)</span>
                <span className="text-3xl font-bold text-danger">${stats.gastoMes.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="glass-panel p-6 flex flex-col gap-2" style={{ flex: '1 1 200px', padding: '1.5rem' }}>
                <span className="text-secondary text-sm font-medium">Kilómetros (Mes)</span>
                <span className="text-3xl font-bold text-accent-primary">{stats.kmMes.toLocaleString()} km</span>
              </div>
              <div className="glass-panel p-6 flex flex-col gap-2" style={{ flex: '1 1 200px', padding: '1.5rem' }}>
                <span className="text-secondary text-sm font-medium">Mant. Pendientes</span>
                <span className={`text-3xl font-bold ${stats.mantenimientosPendientes > 0 ? 'text-warning' : 'text-success'}`}>{stats.mantenimientosPendientes}</span>
              </div>
            </div>

            {/* Alertas */}
            <h3 className="font-semibold text-lg mb-4">Alertas Activas</h3>
            <div className="mb-8 flex flex-col gap-3">
              {alertas.length === 0 ? (
                <div className="glass-panel p-4 flex items-center gap-3 text-success" style={{ padding: '1rem' }}>
                  <CheckCircle size={20} />
                  <span>Todo está en orden. No hay alertas activas.</span>
                </div>
              ) : (
                alertas.map((alerta, i) => (
                  <div key={i} className="glass-panel flex items-center gap-3" style={{ padding: '1rem', backgroundColor: alerta.type === 'danger' ? 'var(--danger-bg)' : 'var(--warning-bg)', borderColor: alerta.type === 'danger' ? 'var(--danger)' : 'var(--warning)' }}>
                    <AlertTriangle size={20} className={alerta.type === 'danger' ? 'text-danger' : 'text-warning'} />
                    <span className={alerta.type === 'danger' ? 'text-danger font-medium' : 'text-warning font-medium'}>{alerta.text}</span>
                  </div>
                ))
              )}
            </div>
            
            <h3 className="font-semibold text-lg mb-4">Accesos Rápidos</h3>
          </>
        )}

        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
          {role === 'admin' && (
            <>
              <Link href="/admin/vehiculos" className="glass-panel" style={{ flex: '1 1 150px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <Truck size={40} className="text-accent-primary" />
                <h3 className="font-semibold text-center">Vehículos</h3>
              </Link>
              <Link href="/admin/mantenimientos" className="glass-panel" style={{ flex: '1 1 150px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <Wrench size={40} className="text-accent-primary" />
                <h3 className="font-semibold text-center">Mantenimientos</h3>
              </Link>
              <Link href="/admin/choferes" className="glass-panel" style={{ flex: '1 1 150px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <Users size={40} className="text-accent-primary" />
                <h3 className="font-semibold text-center">Choferes</h3>
              </Link>
            </>
          )}

          <Link href="/recorridos" className="glass-panel" style={{ flex: '1 1 150px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <Map size={40} className="text-accent-primary" />
            <h3 className="font-semibold text-center">Recorridos</h3>
          </Link>

          <Link href="/combustible" className="glass-panel" style={{ flex: '1 1 150px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <Fuel size={40} className="text-accent-primary" />
            <h3 className="font-semibold text-center">Combustible</h3>
          </Link>
        </div>
      </div>
    </AuthGuard>
  );
}
