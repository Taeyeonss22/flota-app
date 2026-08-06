"use client";
import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import DataTable from '@/components/DataTable';
import { supabase } from '@/lib/supabase';
import { Plus, X } from 'lucide-react';

export default function MantenimientosPage() {
  const [mantenimientos, setMantenimientos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    vehiculo_id: '',
    tipo: 'preventivo',
    descripcion: '',
    fecha: '',
    km_al_mantenimiento: '',
    costo: '',
    taller: '',
    proximo_mantenimiento_km: '',
    proximo_mantenimiento_fecha: ''
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: mData } = await supabase.from('mantenimientos').select('*, vehiculos(placa, marca)').order('fecha', { ascending: false });
    const { data: vData } = await supabase.from('vehiculos').select('*').order('placa', { ascending: true });
    
    if (mData) setMantenimientos(mData);
    if (vData) setVehiculos(vData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('mantenimientos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mantenimientos' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = () => {
    const today = new Date().toISOString().split('T')[0];
    
    setFormData({
      vehiculo_id: '',
      tipo: 'preventivo',
      descripcion: '',
      fecha: today,
      km_al_mantenimiento: '',
      costo: '',
      taller: '',
      proximo_mantenimiento_km: '',
      proximo_mantenimiento_fecha: ''
    });
    setShowModal(true);
  };

  const handleVehiculoChange = (vid) => {
    const v = vehiculos.find(x => x.id === vid);
    if (v) {
      setFormData({ ...formData, vehiculo_id: vid, km_al_mantenimiento: v.kilometraje_actual });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      km_al_mantenimiento: parseFloat(formData.km_al_mantenimiento),
      costo: parseFloat(formData.costo),
      proximo_mantenimiento_km: formData.proximo_mantenimiento_km ? parseFloat(formData.proximo_mantenimiento_km) : null,
      proximo_mantenimiento_fecha: formData.proximo_mantenimiento_fecha || null,
    };

    const { error } = await supabase.from('mantenimientos').insert([payload]);
    if (error) {
      alert("Error: " + error.message);
    } else {
      setShowModal(false);
    }
  };

  const columns = [
    { key: 'fecha', label: 'Fecha' },
    { key: 'vehiculo', label: 'Vehículo', render: (_, row) => row.vehiculos ? `${row.vehiculos.placa} - ${row.vehiculos.marca}` : '' },
    { key: 'tipo', label: 'Tipo', render: (val) => <span className={`badge ${val === 'preventivo' ? 'badge-success' : 'badge-warning'}`}>{val}</span> },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'costo', label: 'Costo', render: (val) => `$${val}` },
    { key: 'taller', label: 'Taller' }
  ];

  return (
    <AuthGuard requireAdmin={true}>
      <>
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Mantenimientos</h1>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Registrar Mantenimiento
          </button>
        </div>

        <DataTable columns={columns} data={mantenimientos} loading={loading} />
      </div>

      {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '5vh 1rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '700px', padding: '2rem', margin: 'auto', marginBottom: '5vh' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Registrar Mantenimiento</h2>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="flex gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Vehículo</label>
                    <select required className="form-select" value={formData.vehiculo_id} onChange={e => handleVehiculoChange(e.target.value)}>
                      <option value="" disabled>Seleccione vehículo...</option>
                      {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} ({v.marca}) - Km: {v.kilometraje_actual}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Tipo de Mantenimiento</label>
                    <select required className="form-select" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                      <option value="preventivo">Preventivo</option>
                      <option value="correctivo">Correctivo</option>
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Fecha del Servicio</label>
                    <input required type="date" className="form-input" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Kilometraje del Servicio</label>
                    <input required type="number" step="0.1" min="0" className="form-input" value={formData.km_al_mantenimiento} onChange={e => setFormData({...formData, km_al_mantenimiento: e.target.value})} />
                  </div>

                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label className="form-label">Descripción de las tareas realizadas</label>
                    <input required type="text" className="form-input" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} />
                  </div>
                  
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Taller / Proveedor (Opcional)</label>
                    <input type="text" className="form-input" value={formData.taller} onChange={e => setFormData({...formData, taller: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Costo Total ($)</label>
                    <input required type="number" step="0.01" min="0" className="form-input" value={formData.costo} onChange={e => setFormData({...formData, costo: e.target.value})} />
                  </div>

                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <h3 className="font-semibold text-lg mt-4 mb-2">Programación del Siguiente Mantenimiento (Opcional)</h3>
                  </div>

                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Próximo Mantenimiento (Kilometraje)</label>
                    <input type="number" step="0.1" min={formData.km_al_mantenimiento || 0} className="form-input" value={formData.proximo_mantenimiento_km} onChange={e => setFormData({...formData, proximo_mantenimiento_km: e.target.value})} placeholder="Ej: 50000" />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Próximo Mantenimiento (Fecha)</label>
                    <input type="date" className="form-input" value={formData.proximo_mantenimiento_fecha} onChange={e => setFormData({...formData, proximo_mantenimiento_fecha: e.target.value})} min={formData.fecha} />
                  </div>
                  
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Registrar Mantenimiento</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    </AuthGuard>
  );
}
