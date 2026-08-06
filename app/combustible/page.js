"use client";
import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import DataTable from '@/components/DataTable';
import { supabase } from '@/lib/supabase';
import { Plus, X } from 'lucide-react';

export default function CombustiblePage() {
  const [cargas, setCargas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [user, setUser] = useState(null);
  
  const [formData, setFormData] = useState({
    vehiculo_id: '',
    chofer_id: '',
    fecha: '',
    litros: '',
    costo_total: '',
    precio_litro: '',
    km_al_cargar: '',
    estacion: ''
  });

  const fetchData = async () => {
    setLoading(true);
    
    const { data: cData } = await supabase.from('cargas_combustible').select('*, vehiculos(placa, marca), choferes(nombre)').order('fecha', { ascending: false });
    const { data: vData } = await supabase.from('vehiculos').select('*').eq('estado', 'activo');
    const { data: chData } = await supabase.from('choferes').select('*').eq('estado', 'activo');
    
    if (cData) setCargas(cData);
    if (vData) setVehiculos(vData);
    if (chData) setChoferes(chData);
    
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user);
    });

    fetchData();

    const channel = supabase
      .channel('cargas_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cargas_combustible' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dateString = now.toISOString().slice(0, 16);

    setFormData({
      vehiculo_id: '',
      chofer_id: '',
      fecha: dateString,
      litros: '',
      costo_total: '',
      precio_litro: '',
      km_al_cargar: '',
      estacion: ''
    });
    setShowModal(true);
  };

  const handleVehiculoChange = (vid) => {
    const v = vehiculos.find(x => x.id === vid);
    if (v) {
      setFormData({ ...formData, vehiculo_id: vid, km_al_cargar: v.kilometraje_actual });
    }
  };

  const handleCalculoPrecio = (e) => {
    const field = e.target.name;
    const value = e.target.value;
    const newForm = { ...formData, [field]: value };
    
    // Auto calcular precio_litro si hay litros y costo
    if ((field === 'litros' || field === 'costo_total') && newForm.litros && newForm.costo_total) {
      newForm.precio_litro = (parseFloat(newForm.costo_total) / parseFloat(newForm.litros)).toFixed(2);
    }
    setFormData(newForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const payload = {
      ...formData,
      litros: parseFloat(formData.litros),
      costo_total: parseFloat(formData.costo_total),
      precio_litro: parseFloat(formData.precio_litro),
      km_al_cargar: parseFloat(formData.km_al_cargar),
      fecha: new Date(formData.fecha).toISOString(),
      registrado_por: user.id
    };

    const { error } = await supabase.from('cargas_combustible').insert([payload]);
    if (error) {
      alert("Error: " + error.message);
    } else {
      setShowModal(false);
    }
  };

  const columns = [
    { key: 'fecha', label: 'Fecha', render: (val) => new Date(val).toLocaleString() },
    { key: 'vehiculo', label: 'Vehículo', render: (_, row) => row.vehiculos ? `${row.vehiculos.placa} - ${row.vehiculos.marca}` : '' },
    { key: 'chofer', label: 'Chofer', render: (_, row) => row.choferes ? row.choferes.nombre : '' },
    { key: 'litros', label: 'Litros', render: (val) => `${val} L` },
    { key: 'costo_total', label: 'Costo', render: (val) => `$${val}` },
    { key: 'rendimiento_calculado', label: 'Rendimiento', render: (val) => val ? <span className="badge badge-success">{Number(val).toFixed(2)} km/L</span> : <span className="badge badge-neutral">N/A</span> }
  ];

  return (
    <AuthGuard>
      <>
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Cargas de Combustible</h1>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Registrar Carga
          </button>
        </div>

        <DataTable columns={columns} data={cargas} loading={loading} />
      </div>

      {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '5vh 1rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '700px', padding: '2rem', margin: 'auto', marginBottom: '5vh' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Registrar Carga de Combustible</h2>
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
                      {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} ({v.marca})</option>)}
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
                    <label className="form-label">Fecha y Hora</label>
                    <input required type="datetime-local" className="form-input" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Estación de Servicio</label>
                    <input type="text" className="form-input" value={formData.estacion} onChange={e => setFormData({...formData, estacion: e.target.value})} />
                  </div>

                  <div className="form-group" style={{ flex: '1 1 30%' }}>
                    <label className="form-label">Litros</label>
                    <input required type="number" step="0.01" min="1" name="litros" className="form-input" value={formData.litros} onChange={handleCalculoPrecio} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 30%' }}>
                    <label className="form-label">Costo Total ($)</label>
                    <input required type="number" step="0.01" min="0" name="costo_total" className="form-input" value={formData.costo_total} onChange={handleCalculoPrecio} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 30%' }}>
                    <label className="form-label">Precio por Litro ($)</label>
                    <input required type="number" step="0.01" min="0" className="form-input" value={formData.precio_litro} onChange={e => setFormData({...formData, precio_litro: e.target.value})} />
                  </div>

                  <div className="form-group" style={{ flex: '1 1 100%' }}>
                    <label className="form-label">Kilometraje al Cargar</label>
                    <input required type="number" step="0.1" min="0" className="form-input" value={formData.km_al_cargar} onChange={e => setFormData({...formData, km_al_cargar: e.target.value})} />
                    <span className="form-error text-secondary mt-1">Debe ser el kilometraje mostrado en el odómetro en este momento.</span>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Registrar Carga</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    </AuthGuard>
  );
}
