"use client";
import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import DataTable from '@/components/DataTable';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Trash2, X, UserPlus, History } from 'lucide-react';

export default function VehiculosPage() {
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [choferSeleccionado, setChoferSeleccionado] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    placa: '',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    tipo: '',
    capacidad_tanque_litros: '',
    kilometraje_actual: 0,
    estado: 'activo'
  });

  const fetchVehiculos = async () => {
    setLoading(true);
    const { data: vData } = await supabase.from('vehiculos').select('*').order('created_at', { ascending: false });
    const { data: cData } = await supabase.from('choferes').select('*').eq('estado', 'activo');
    
    if (vData) setVehiculos(vData);
    if (cData) setChoferes(cData);
    setLoading(false);
  };

  useEffect(() => {
    fetchVehiculos();

    const channel = supabase
      .channel('vehiculos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehiculos' }, (payload) => {
        fetchVehiculos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = (vehiculo = null) => {
    if (vehiculo) {
      setFormData({
        placa: vehiculo.placa,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        anio: vehiculo.anio,
        tipo: vehiculo.tipo,
        capacidad_tanque_litros: vehiculo.capacidad_tanque_litros,
        kilometraje_actual: vehiculo.kilometraje_actual,
        estado: vehiculo.estado
      });
      setEditingId(vehiculo.id);
    } else {
      setFormData({
        placa: '',
        marca: '',
        modelo: '',
        anio: new Date().getFullYear(),
        tipo: '',
        capacidad_tanque_litros: '',
        kilometraje_actual: 0,
        estado: 'activo'
      });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      anio: parseInt(formData.anio),
      capacidad_tanque_litros: parseFloat(formData.capacidad_tanque_litros),
      kilometraje_actual: parseFloat(formData.kilometraje_actual),
    };

    if (editingId) {
      await supabase.from('vehiculos').update(payload).eq('id', editingId);
    } else {
      await supabase.from('vehiculos').insert([payload]);
    }
    
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este vehículo?')) {
      await supabase.from('vehiculos').delete().eq('id', id);
    }
  };

  const handleOpenAsignar = (vehiculo) => {
    setVehiculoSeleccionado(vehiculo);
    setChoferSeleccionado('');
    setShowAsignarModal(true);
  };

  const handleAsignar = async (e) => {
    e.preventDefault();
    if (!choferSeleccionado) return;

    // Terminar asignaciones previas del vehículo
    await supabase.from('asignaciones')
      .update({ fecha_fin: new Date().toISOString().split('T')[0], activa: false })
      .eq('vehiculo_id', vehiculoSeleccionado.id)
      .eq('activa', true);

    // Crear nueva asignación
    await supabase.from('asignaciones').insert([{
      vehiculo_id: vehiculoSeleccionado.id,
      chofer_id: choferSeleccionado,
      activa: true
    }]);

    setShowAsignarModal(false);
    alert('Chofer asignado correctamente');
  };

  const columns = [
    { key: 'placa', label: 'Placa' },
    { key: 'marca', label: 'Marca' },
    { key: 'modelo', label: 'Modelo' },
    { key: 'anio', label: 'Año' },
    { 
      key: 'estado', 
      label: 'Estado',
      render: (val) => (
        <span className={`badge ${val === 'activo' ? 'badge-success' : val === 'mantenimiento' ? 'badge-warning' : 'badge-danger'}`}>
          {val.toUpperCase()}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Acciones',
      sortable: false,
      render: (_, row) => (
        <div className="flex gap-2">
          <button className="btn btn-secondary" title="Asignar Chofer" style={{ padding: '0.25rem 0.5rem' }} onClick={(e) => { e.stopPropagation(); handleOpenAsignar(row); }}>
            <UserPlus size={14} />
          </button>
          <button className="btn btn-secondary" title="Editar" style={{ padding: '0.25rem 0.5rem' }} onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
            <Edit size={14} />
          </button>
          <button className="btn btn-danger" title="Eliminar" style={{ padding: '0.25rem 0.5rem' }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <AuthGuard requireAdmin={true}>
      <>
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Vehículos</h1>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} /> Nuevo Vehículo
          </button>
        </div>

        <DataTable columns={columns} data={vehiculos} loading={loading} />
      </div>

      {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '5vh 1rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '600px', padding: '2rem', margin: 'auto', marginBottom: '5vh' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{editingId ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="flex gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Placa</label>
                    <input required type="text" className="form-input" value={formData.placa} onChange={e => setFormData({...formData, placa: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Marca</label>
                    <input required type="text" className="form-input" value={formData.marca} onChange={e => setFormData({...formData, marca: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Modelo</label>
                    <input required type="text" className="form-input" value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Año</label>
                    <input required type="number" min="1900" max={new Date().getFullYear() + 1} className="form-input" value={formData.anio} onChange={e => setFormData({...formData, anio: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Tipo (Auto, Camión, etc.)</label>
                    <input required type="text" className="form-input" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Capacidad Tanque (Litros)</label>
                    <input required type="number" step="0.1" min="1" className="form-input" value={formData.capacidad_tanque_litros} onChange={e => setFormData({...formData, capacidad_tanque_litros: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Kilometraje Actual</label>
                    <input required type="number" step="0.1" min="0" className="form-input" value={formData.kilometraje_actual} onChange={e => setFormData({...formData, kilometraje_actual: e.target.value})} disabled={editingId !== null} />
                  </div>
                  <div className="form-group" style={{ flex: '1 1 45%' }}>
                    <label className="form-label">Estado</label>
                    <select className="form-select" value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})}>
                      <option value="activo">Activo</option>
                      <option value="mantenimiento">Mantenimiento</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAsignarModal && vehiculoSeleccionado && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '5vh 1rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem', margin: 'auto', marginBottom: '5vh' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Asignar Chofer</h2>
                <button onClick={() => setShowAsignarModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem' }}>
                  <X size={20} />
                </button>
              </div>
              <p className="mb-4 text-sm text-secondary">
                Asignando chofer al vehículo: <strong>{vehiculoSeleccionado.placa}</strong> ({vehiculoSeleccionado.marca} {vehiculoSeleccionado.modelo})
              </p>
              <form onSubmit={handleAsignar}>
                <div className="form-group mb-6">
                  <label className="form-label">Seleccionar Chofer</label>
                  <select required className="form-select" value={choferSeleccionado} onChange={e => setChoferSeleccionado(e.target.value)}>
                    <option value="" disabled>-- Seleccione un chofer --</option>
                    {choferes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} (Lic. {c.licencia})</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAsignarModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Asignar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    </AuthGuard>
  );
}
