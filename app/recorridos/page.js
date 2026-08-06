"use client";
import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import DataTable from '@/components/DataTable';
import { supabase } from '@/lib/supabase';
import { Plus, X } from 'lucide-react';

export default function RecorridosPage() {
  const [recorridos, setRecorridos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [user, setUser] = useState(null);
  
  const [formData, setFormData] = useState({
    vehiculo_id: '',
    chofer_id: '',
    fecha_salida: '',
    fecha_llegada: '',
    origen: '',
    destino: '',
    km_inicial: '',
    km_final: '',
    proposito: '',
    observaciones: ''
  });

  const fetchData = async () => {
    setLoading(true);
    
    // As RLS limits recorridos per user if operador, we can just query all.
    const { data: rData } = await supabase.from('recorridos').select('*, vehiculos(placa, marca), choferes(nombre)').order('created_at', { ascending: false });
    const { data: vData } = await supabase.from('vehiculos').select('*').eq('estado', 'activo');
    const { data: cData } = await supabase.from('choferes').select('*').eq('estado', 'activo');
    
    if (rData) setRecorridos(rData);
    if (vData) setVehiculos(vData);
    if (cData) setChoferes(cData);
    
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user);
    });

    fetchData();

    const channel = supabase
      .channel('recorridos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recorridos' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = () => {
    // Current time formatted for datetime-local input
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dateString = now.toISOString().slice(0, 16);

    setFormData({
      vehiculo_id: '',
      chofer_id: '',
      fecha_salida: dateString,
      fecha_llegada: dateString,
      origen: '',
      destino: '',
      km_inicial: '',
      km_final: '',
      proposito: '',
      observaciones: ''
    });
    setShowModal(true);
  };

  const handleVehiculoChange = (vid) => {
    const v = vehiculos.find(x => x.id === vid);
    if (v) {
      setFormData({ ...formData, vehiculo_id: vid, km_inicial: v.kilometraje_actual, km_final: v.kilometraje_actual });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const payload = {
      ...formData,
      km_inicial: parseFloat(formData.km_inicial),
      km_final: parseFloat(formData.km_final),
      fecha_salida: new Date(formData.fecha_salida).toISOString(),
      fecha_llegada: new Date(formData.fecha_llegada).toISOString(),
      registrado_por: user.id
    };

    const { error } = await supabase.from('recorridos').insert([payload]);
    if (error) {
      alert("Error: " + error.message);
    } else {
      setShowModal(false);
    }
  };

  const columns = [
    { key: 'fecha_salida', label: 'Salida', render: (val) => new Date(val).toLocaleString() },
    { key: 'vehiculo', label: 'Vehículo', render: (_, row) => row.vehiculos ? `${row.vehiculos.placa} - ${row.vehiculos.marca}` : '' },
    { key: 'chofer', label: 'Chofer', render: (_, row) => row.choferes ? row.choferes.nombre : '' },
    { key: 'ruta', label: 'Ruta', render: (_, row) => `${row.origen} ➔ ${row.destino}` },
    { key: 'km_recorridos', label: 'Kms Recorridos', render: (val) => <span className="font-semibold text-accent-primary">{val} km</span> },
    { key: 'proposito', label: 'Propósito' }
  ];

  return (
    <AuthGuard>
      <>
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Bitácora de Recorridos</h1>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Registrar Recorrido
          </button>
        </div>

        <DataTable columns={columns} data={recorridos} loading={loading} />
      </div>

      {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '5vh 1rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '700px', padding: '2rem', margin: 'auto', marginBottom: '5vh' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Registrar Recorrido</h2>
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
                    <label className="form-label">Chofer</label>
                    <select required className="form-select" value={formData.chofer_id} onChange={e => setFormData({...formData, chofer_id: e.target.value})}>
                      <option value="" disabled>Seleccione chofer...</option>
                      {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Fecha y Hora Salida</label>
                    <input required type="datetime-local" className="form-input" value={formData.fecha_salida} onChange={e => setFormData({...formData, fecha_salida: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Fecha y Hora Llegada</label>
                    <input required type="datetime-local" className="form-input" value={formData.fecha_llegada} onChange={e => setFormData({...formData, fecha_llegada: e.target.value})} />
                  </div>

                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Origen</label>
                    <input required type="text" className="form-input" value={formData.origen} onChange={e => setFormData({...formData, origen: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Destino</label>
                    <input required type="text" className="form-input" value={formData.destino} onChange={e => setFormData({...formData, destino: e.target.value})} />
                  </div>

                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Km Inicial</label>
                    <input required type="number" step="0.1" min="0" className="form-input" value={formData.km_inicial} onChange={e => setFormData({...formData, km_inicial: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Km Final</label>
                    <input required type="number" step="0.1" min={formData.km_inicial || 0} className="form-input" value={formData.km_final} onChange={e => setFormData({...formData, km_final: e.target.value})} />
                  </div>
                  
                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label className="form-label">Propósito del viaje</label>
                    <input required type="text" className="form-input" value={formData.proposito} onChange={e => setFormData({...formData, proposito: e.target.value})} />
                  </div>
                  
                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label className="form-label">Observaciones (Opcional)</label>
                    <textarea className="form-input" rows="2" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})}></textarea>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Registrar Recorrido</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    </AuthGuard>
  );
}
