"use client";
import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

export default function ReporteEntregasPage() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('semana'); // semana, mes, total
  
  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      
      const { data: choferes } = await supabase.from('choferes').select('id, nombre').eq('estado', 'activo');
      
      let query = supabase.from('pedidos').select('chofer_id, estado');
      
      const now = new Date();
      if (periodo === 'semana') {
        const start = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
        const end = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
        query = query.gte('fecha_entrega_programada', start).lte('fecha_entrega_programada', end);
      } else if (periodo === 'mes') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('fecha_entrega_programada', start);
      }
      
      const { data: pedidos } = await query;
      
      if (choferes && pedidos) {
        const stats = choferes.map(c => {
          const choferPedidos = pedidos.filter(p => p.chofer_id === c.id);
          const totales = choferPedidos.length;
          const entregados = choferPedidos.filter(p => p.estado === 'entregado').length;
          const noEntregados = choferPedidos.filter(p => p.estado === 'no_entregado').length;
          const cancelados = choferPedidos.filter(p => p.estado === 'cancelado').length;
          const pendientes = choferPedidos.filter(p => p.estado === 'pendiente' || p.estado === 'en_ruta').length;
          const efectividad = totales > 0 ? Math.round((entregados / totales) * 100) : 0;
          
          return {
            chofer: c.nombre,
            totales,
            entregados,
            noEntregados,
            cancelados,
            pendientes,
            efectividad
          };
        }).sort((a, b) => b.totales - a.totales); // Sort by most orders
        
        setReportData(stats);
      }
      setLoading(false);
    }
    
    loadReport();
  }, [periodo]);

  return (
    <AuthGuard requireAdmin={true}>
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Reporte de Entregas por Chofer</h1>
          
          <select className="form-select" style={{ width: '250px' }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="semana">Semana Actual</option>
            <option value="mes">Mes Actual</option>
            <option value="total">Histórico Total</option>
          </select>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          {loading ? (
            <p>Calculando estadísticas...</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Chofer</th>
                    <th className="text-center">Total Asignados</th>
                    <th className="text-center text-success">Entregados</th>
                    <th className="text-center text-danger">No Entregados</th>
                    <th className="text-center text-gray-400">Cancelados</th>
                    <th className="text-center text-warning">Pendientes / En Ruta</th>
                    <th className="text-center">Efectividad</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, i) => (
                    <tr key={i}>
                      <td className="font-medium">{row.chofer}</td>
                      <td className="text-center font-bold">{row.totales}</td>
                      <td className="text-center text-success font-semibold">{row.entregados}</td>
                      <td className="text-center text-danger font-semibold">{row.noEntregados}</td>
                      <td className="text-center text-gray-400 font-semibold">{row.cancelados}</td>
                      <td className="text-center text-warning font-semibold">{row.pendientes}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div style={{ width: '60px', height: '8px', backgroundColor: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${row.efectividad}%`, height: '100%', backgroundColor: row.efectividad > 80 ? 'var(--success)' : row.efectividad > 50 ? 'var(--warning)' : 'var(--danger)' }} />
                          </div>
                          <span className="text-sm font-semibold">{row.efectividad}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-4 text-secondary">No hay datos de pedidos en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
