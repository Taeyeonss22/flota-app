"use client";
import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import DataTable from '@/components/DataTable';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Trash2, X, Link as LinkIcon } from 'lucide-react';

export default function ChoferesPage() {
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    licencia: '',
    tipo_licencia: '',
    vigencia_licencia: '',
    telefono: '',
    estado: 'activo'
  });

  const fetchChoferes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('choferes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setChoferes(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChoferes();

    const channel = supabase
      .channel('choferes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'choferes' }, () => {
        fetchChoferes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = (chofer = null) => {
    if (chofer) {
      setFormData({
        nombre: chofer.nombre,
        licencia: chofer.licencia,
        tipo_licencia: chofer.tipo_licencia,
        vigencia_licencia: chofer.vigencia_licencia,
        telefono: chofer.telefono || '',
        estado: chofer.estado
      });
      setEditingId(chofer.id);
    } else {
      setFormData({
        nombre: '',
        licencia: '',
        tipo_licencia: '',
        vigencia_licencia: '',
        telefono: '',
        estado: 'activo'
      });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingId) {
      await supabase.from('choferes').update(formData).eq('id', editingId);
    } else {
      await supabase.from('choferes').insert([formData]);
    }
    
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este chofer?')) {
      await supabase.from('choferes').delete().eq('id', id);
    }
  };

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'licencia', label: 'Licencia' },
    { key: 'tipo_licencia', label: 'Tipo' },
    { key: 'vigencia_licencia', label: 'Vigencia' },
    { key: 'telefono', label: 'Teléfono' },
    { 
      key: 'estado', 
      label: 'Estado',
      render: (val) => (
        <span className={`badge ${val === 'activo' ? 'badge-success' : 'badge-danger'}`}>
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
          <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
            <Edit size={14} />
          </button>
          <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
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
          <h1 className="page-title">Choferes</h1>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} /> Nuevo Chofer
          </button>
        </div>

        <DataTable columns={columns} data={choferes} loading={loading} />
      </div>

      {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '5vh 1rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', margin: 'auto', marginBottom: '5vh' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{editingId ? 'Editar Chofer' : 'Nuevo Chofer'}</h2>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Nombre Completo</label>
                  <input required type="text" className="form-input" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                </div>
                <div className="flex gap-4 mb-4">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Licencia</label>
                    <input required type="text" className="form-input" value={formData.licencia} onChange={e => setFormData({...formData, licencia: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Tipo Licencia</label>
                    <input required type="text" className="form-input" value={formData.tipo_licencia} onChange={e => setFormData({...formData, tipo_licencia: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-4 mb-4">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Vigencia Licencia</label>
                    <input required type="date" className="form-input" value={formData.vigencia_licencia} onChange={e => setFormData({...formData, vigencia_licencia: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Teléfono</label>
                    <input type="tel" className="form-input" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-select" value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    </AuthGuard>
  );
}
