"use client";
import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import DataTable from '@/components/DataTable';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Trash2, X, ShieldAlert, CheckCircle, Ban } from 'lucide-react';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    id: null,
    nombre: '',
    email: '',
    password: '',
    rol: 'operador',
    estado: 'activo',
    // Si es operador, requerimos datos de chofer:
    licencia: '',
    tipo_licencia: 'A',
    vigencia_licencia: new Date().toISOString().split('T')[0],
    telefono: ''
  });

  const fetchUsuarios = async () => {
    setLoading(true);
    // Traemos de perfiles, pero necesitamos el email que está en auth.users...
    // Como estamos en el cliente, no podemos acceder directo a auth.users fácilmente por RLS.
    // Usaremos un endpoint API para obtener la lista completa con correos, o simplemente mostramos perfiles.
    // Para simplificar, mostraremos los perfiles y no el correo si no está disponible, o usamos nuestra API.
    
    // Por ahora traemos perfiles
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setUsuarios(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsuarios();
    const channel = supabase
      .channel('perfiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => {
        fetchUsuarios();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleOpenModal = (usuario = null) => {
    if (usuario) {
      setFormData({
        id: usuario.id,
        nombre: usuario.nombre,
        email: 'Oculto por seguridad',
        password: '',
        rol: usuario.rol,
        estado: usuario.estado || 'activo',
        licencia: '', tipo_licencia: 'A', vigencia_licencia: '', telefono: ''
      });
      setIsEditing(true);
    } else {
      setFormData({
        id: null,
        nombre: '',
        email: '',
        password: '',
        rol: 'operador',
        estado: 'activo',
        licencia: '', tipo_licencia: 'A', vigencia_licencia: new Date().toISOString().split('T')[0], telefono: ''
      });
      setIsEditing(false);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (isEditing) {
      // Editar solo nombre, rol y estado en tabla perfiles
      await supabase.from('perfiles').update({
        nombre: formData.nombre,
        rol: formData.rol,
        estado: formData.estado
      }).eq('id', formData.id);
      
      // Si también es chofer, actualizamos la tabla choferes
      if (formData.rol === 'operador') {
         await supabase.from('choferes').update({
            estado: formData.estado
         }).eq('id', formData.id);
      }
      setShowModal(false);
      setLoading(false);
      return;
    }

    // CREACIÓN NUEVA (llama a la API Route para usar Service Role)
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert('Usuario creado con éxito');
      setShowModal(false);
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setLoading(false);
  };

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'rol', label: 'Rol', render: (val) => (
      <span className={`badge ${val === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>{val.toUpperCase()}</span>
    )},
    { key: 'estado', label: 'Estado', render: (val) => (
      <span className={`badge ${val === 'activo' ? 'badge-success' : 'badge-danger'}`}>
        {val ? val.toUpperCase() : 'ACTIVO'}
      </span>
    )},
    {
      key: 'actions',
      label: 'Acciones',
      sortable: false,
      render: (_, row) => (
        <div className="flex gap-2">
          <button className="btn btn-secondary text-sm py-1 px-2" onClick={(e) => { e.stopPropagation(); handleOpenModal(row); }}>
            <Edit size={14} /> Editar
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
          <div>
            <h1 className="page-title">Usuarios del Sistema</h1>
            <p className="text-secondary text-sm">Gestiona accesos, administradores y choferes.</p>
          </div>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} /> Nuevo Usuario
          </button>
        </div>

        <DataTable columns={columns} data={usuarios} loading={loading} />
      </div>

      {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '5vh 1rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '600px', padding: '2rem', margin: 'auto', marginBottom: '5vh' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{isEditing ? 'Editar Usuario' : 'Crear Acceso de Usuario'}</h2>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="form-group flex-1">
                    <label className="form-label">Nombre Completo</label>
                    <input required type="text" className="form-input" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                  </div>
                  <div className="form-group flex-1">
                    <label className="form-label">Rol en el Sistema</label>
                    <select required className="form-select" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})} disabled={isEditing}>
                      <option value="operador">Chofer / Operador</option>
                      <option value="admin">Administrador Web</option>
                    </select>
                  </div>
                </div>

                {!isEditing && (
                  <>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mt-2 mb-2">
                      <h3 className="font-semibold text-sm mb-3">Credenciales de Acceso</h3>
                      <div className="flex gap-4">
                        <div className="form-group flex-1">
                          <label className="form-label">Correo Electrónico</label>
                          <input required type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div className="form-group flex-1">
                          <label className="form-label">Contraseña (Mínimo 6)</label>
                          <input required type="password" minLength={6} className="form-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                        </div>
                      </div>
                    </div>
                    
                    {formData.rol === 'operador' && (
                       <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mb-2">
                         <h3 className="font-semibold text-sm text-blue-800 mb-3 flex items-center gap-2">
                            <ShieldAlert size={16}/> Datos adicionales para Chofer
                         </h3>
                         <div className="flex gap-4 mb-3">
                           <div className="form-group flex-1">
                             <label className="form-label">Licencia</label>
                             <input required type="text" className="form-input" value={formData.licencia} onChange={e => setFormData({...formData, licencia: e.target.value})} />
                           </div>
                           <div className="form-group flex-1">
                             <label className="form-label">Tipo Licencia</label>
                             <input required type="text" className="form-input" value={formData.tipo_licencia} onChange={e => setFormData({...formData, tipo_licencia: e.target.value})} />
                           </div>
                         </div>
                         <div className="flex gap-4">
                           <div className="form-group flex-1">
                             <label className="form-label">Vigencia</label>
                             <input required type="date" className="form-input" value={formData.vigencia_licencia} onChange={e => setFormData({...formData, vigencia_licencia: e.target.value})} />
                           </div>
                           <div className="form-group flex-1">
                             <label className="form-label">Teléfono</label>
                             <input type="tel" className="form-input" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                           </div>
                         </div>
                       </div>
                    )}
                  </>
                )}

                {isEditing && (
                  <div className="form-group">
                    <label className="form-label">Estado del Acceso</label>
                    <select required className="form-select" value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})}>
                      <option value="activo">Activo (Puede iniciar sesión)</option>
                      <option value="inactivo">Inactivo / Bloqueado</option>
                    </select>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Usuario')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    </AuthGuard>
  );
}
