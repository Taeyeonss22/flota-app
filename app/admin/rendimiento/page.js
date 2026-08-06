"use client";
import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { format, subMonths, isAfter, startOfMonth } from 'date-fns';

export default function RendimientoDashboard() {
  const [cargas, setCargas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes'); // 'mes', '3meses', 'todos'
  const [selectedVehiculo, setSelectedVehiculo] = useState('todos');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      
      const { data: vData } = await supabase.from('vehiculos').select('id, placa, marca');
      const { data: cData } = await supabase.from('cargas_combustible').select('*').order('fecha', { ascending: true });
      
      if (vData) setVehiculos(vData);
      if (cData) setCargas(cData);
      
      setLoading(false);
    }
    loadData();
  }, []);

  // Filter data based on selected period
  const filterDate = () => {
    const now = new Date();
    if (periodo === 'mes') return startOfMonth(now);
    if (periodo === '3meses') return subMonths(now, 3);
    return new Date(0); // all time
  };

  const cargasFiltradas = cargas.filter(c => {
    const dateMatch = isAfter(new Date(c.fecha), filterDate());
    const vehiculoMatch = selectedVehiculo === 'todos' || c.vehiculo_id === selectedVehiculo;
    return dateMatch && vehiculoMatch;
  });

  // Calculate stats
  const vehiculoStats = vehiculos.map(v => {
    const vCargas = cargasFiltradas.filter(c => c.vehiculo_id === v.id && c.rendimiento_calculado > 0);
    const totalRendimiento = vCargas.reduce((sum, c) => sum + parseFloat(c.rendimiento_calculado), 0);
    const avgRendimiento = vCargas.length > 0 ? (totalRendimiento / vCargas.length).toFixed(2) : 0;
    
    // Costo por km
    const totalCosto = vCargas.reduce((sum, c) => sum + parseFloat(c.costo_total), 0);
    const totalKm = vCargas.reduce((sum, c) => sum + (parseFloat(c.rendimiento_calculado) * parseFloat(c.litros)), 0);
    const costPerKm = totalKm > 0 ? (totalCosto / totalKm).toFixed(2) : 0;

    return {
      name: `${v.placa}`,
      avgRendimiento: parseFloat(avgRendimiento),
      costPerKm: parseFloat(costPerKm),
      cargas: vCargas
    };
  }).filter(v => v.avgRendimiento > 0).sort((a, b) => b.avgRendimiento - a.avgRendimiento);

  // Data for time series (only useful if 1 vehicle is selected)
  const timeSeriesData = cargasFiltradas
    .filter(c => selectedVehiculo !== 'todos' ? c.vehiculo_id === selectedVehiculo : true)
    .filter(c => c.rendimiento_calculado > 0)
    .map(c => ({
      fecha: format(new Date(c.fecha), 'dd MMM'),
      rendimiento: parseFloat(c.rendimiento_calculado).toFixed(2)
    }));

  return (
    <AuthGuard requireAdmin={true}>
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Dashboard de Rendimiento</h1>
        </div>

        <div className="flex gap-4 mb-8">
          <select className="form-select" style={{ width: '200px' }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="mes">Este Mes</option>
            <option value="3meses">Últimos 3 Meses</option>
            <option value="todos">Histórico Total</option>
          </select>

          <select className="form-select" style={{ width: '200px' }} value={selectedVehiculo} onChange={e => setSelectedVehiculo(e.target.value)}>
            <option value="todos">Todos los Vehículos</option>
            {vehiculos.map(v => (
              <option key={v.id} value={v.id}>{v.placa} ({v.marca})</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p>Cargando analíticas...</p>
        ) : (
          <div className="flex gap-6" style={{ flexWrap: 'wrap' }}>
            
            {/* Ranking Chart */}
            <div className="glass-panel" style={{ flex: '1 1 100%', padding: '2rem' }}>
              <h3 className="font-semibold text-lg mb-4">Ranking de Eficiencia (Promedio km/L)</h3>
              {vehiculoStats.length === 0 ? (
                <p className="text-secondary text-sm">No hay suficientes datos de cargas en este periodo.</p>
              ) : (
                <div style={{ height: '350px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vehiculoStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                      <Bar dataKey="avgRendimiento" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Rendimiento (km/L)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Time Series */}
            {selectedVehiculo !== 'todos' && (
              <div className="glass-panel" style={{ flex: '1 1 100%', padding: '2rem' }}>
                <h3 className="font-semibold text-lg mb-4">Tendencia de Rendimiento en el Tiempo</h3>
                {timeSeriesData.length === 0 ? (
                  <p className="text-secondary text-sm">No hay registros suficientes para graficar la tendencia.</p>
                ) : (
                  <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="fecha" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                        <Line type="monotone" dataKey="rendimiento" stroke="#10b981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="km/L" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Cost Table */}
            <div className="glass-panel" style={{ flex: '1 1 100%', padding: '2rem' }}>
              <h3 className="font-semibold text-lg mb-4">Métricas de Costo Operativo</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vehículo</th>
                      <th>Rendimiento Promedio</th>
                      <th>Costo por Kilómetro</th>
                      <th>Registros (Periodo)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehiculoStats.map(v => (
                      <tr key={v.name}>
                        <td className="font-medium">{v.name}</td>
                        <td><span className="badge badge-success">{v.avgRendimiento} km/L</span></td>
                        <td><span className="text-danger font-semibold">${v.costPerKm}</span></td>
                        <td>{v.cargas.length}</td>
                      </tr>
                    ))}
                    {vehiculoStats.length === 0 && (
                      <tr><td colSpan="4" className="text-center text-secondary py-4">Sin registros</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </AuthGuard>
  );
}
