"use client";
import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import DataTable from '@/components/DataTable';
import MapPicker from '@/components/MapPicker';
import { supabase } from '@/lib/supabase';
import { Plus, X, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);

  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const [formData, setFormData] = useState({
    folio_venta_pos: '',
    cliente_nombre: '',
    cliente_direccion: '',
    cliente_latitud: null,
    cliente_longitud: null,
    vehiculo_id: '',
    chofer_id: '',
    fecha_entrega_programada: new Date().toISOString().split('T')[0],
    observaciones: ''
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: pData, error: pError } = await supabase
      .from('pedidos')
      .select('*, vehiculos(placa), choferes(nombre)')
      .order('created_at', { ascending: false });
      
    if (pError) console.error("Error fetching pedidos:", pError);
      
    const { data: vData } = await supabase.from('vehiculos').select('*').eq('estado', 'activo');
    const { data: cData } = await supabase.from('choferes').select('*').eq('estado', 'activo');
    
    // Filter locally to see if date matching was the issue, or just show all for now
    if (pData) {
      setPedidos(pData); // Just set all for debugging
    }
    if (vData) setVehiculos(vData);
    if (cData) setChoferes(cData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('pedidos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchData();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [filterDate]);

  const handleOpenModal = () => {
    setFormData({
      folio_venta_pos: '',
      cliente_nombre: '',
      cliente_direccion: '',
      cliente_latitud: null,
      cliente_longitud: null,
      vehiculo_id: '',
      chofer_id: '',
      fecha_entrega_programada: filterDate,
      observaciones: ''
    });
    setShowModal(true);
  };

  const handleLocationChange = (pos) => {
    setFormData({ ...formData, cliente_latitud: pos[0], cliente_longitud: pos[1] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check for duplicate folio today
    const { data: existing } = await supabase
      .from('pedidos')
      .select('id')
      .eq('folio_venta_pos', formData.folio_venta_pos)
      .eq('fecha_entrega_programada', formData.fecha_entrega_programada);

    if (existing && existing.length > 0) {
      const confirmSave = window.confirm(`El folio ${formData.folio_venta_pos} ya existe para esta fecha. ¿Deseas guardarlo de todos modos?`);
      if (!confirmSave) return;
    }

    const { data: insertedData, error } = await supabase.from('pedidos').insert([formData]).select();
    if (error) {
      alert("Error: " + error.message);
    } else {
      setShowModal(false);
      
      const newPedidoId = insertedData?.[0]?.id;

      // Llamar al backend de Next.js para enviar el push (CORS safe, Server-side)
      fetch('/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chofer_id: formData.chofer_id,
          folio_venta_pos: formData.folio_venta_pos,
          cliente_nombre: formData.cliente_nombre,
          pedido_id: newPedidoId
        })
      }).catch(err => console.error("Error llamando a la API de Push:", err));
    }
  };

  const statusColors = {
    'pendiente': 'badge-warning',
    'en_ruta': 'badge-primary',
    'entregado': 'badge-success',
    'no_entregado': 'badge-danger'
  };

  const columns = [
    { key: 'folio_venta_pos', label: 'Folio' },
    { key: 'cliente_nombre', label: 'Cliente' },
    { key: 'chofer', label: 'Chofer', render: (_, row) => row.choferes?.nombre },
    { key: 'vehiculo', label: 'Vehículo', render: (_, row) => row.vehiculos?.placa },
    { key: 'fecha_entrega_programada', label: 'Fecha (Debug)' },
    { key: 'estado', label: 'Estado', render: (val) => <span className={`badge ${statusColors[val]}`}>{val.replace('_', ' ')}</span> },
    { 
      key: 'actions', 
      label: 'Acciones', 
      render: (_, row) => (
        <button className="btn btn-secondary text-sm py-1 px-2" onClick={() => { setSelectedPedido(row); setShowDetailModal(true); }}>
          Detalles
        </button>
      ) 
    }
  ];

  return (
    <AuthGuard requireAdmin={true}>
      <>
        <div className="animate-fade-in">
          <div className="page-header">
            <h1 className="page-title">Pedidos del Día</h1>
            <div className="flex gap-4">
              <input type="date" className="form-input" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              <button className="btn btn-primary" onClick={handleOpenModal}>
                <Plus size={18} /> Nuevo Pedido
              </button>
            </div>
          </div>

          <DataTable columns={columns} data={pedidos} loading={loading} />
        </div>

        {/* CREATE MODAL */}
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '5vh 1rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '900px', padding: '2rem', margin: 'auto', marginBottom: '5vh' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Nuevo Pedido</h2>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex gap-6 flex-wrap md:flex-nowrap">
                <div className="flex-1 min-w-[300px] flex flex-col gap-4">
                  <div className="form-group">
                    <label className="form-label">Folio Venta (POS)</label>
                    <input required type="text" className="form-input" value={formData.folio_venta_pos} onChange={e => setFormData({...formData, folio_venta_pos: e.target.value})} />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Cliente</label>
                    <input required type="text" className="form-input" value={formData.cliente_nombre} onChange={e => setFormData({...formData, cliente_nombre: e.target.value})} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Dirección Completa</label>
                    <input required type="text" className="form-input" value={formData.cliente_direccion} onChange={e => setFormData({...formData, cliente_direccion: e.target.value})} />
                  </div>

                  <div className="flex gap-4">
                    <div className="form-group flex-1">
                      <label className="form-label">Vehículo</label>
                      <select required className="form-select" value={formData.vehiculo_id} onChange={e => setFormData({...formData, vehiculo_id: e.target.value})}>
                        <option value="" disabled>Seleccione...</option>
                        {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                      </select>
                    </div>
                    <div className="form-group flex-1">
                      <label className="form-label">Chofer</label>
                      <select required className="form-select" value={formData.chofer_id} onChange={e => setFormData({...formData, chofer_id: e.target.value})}>
                        <option value="" disabled>Seleccione...</option>
                        {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fecha Programada</label>
                    <input required type="date" className="form-input" value={formData.fecha_entrega_programada} onChange={e => setFormData({...formData, fecha_entrega_programada: e.target.value})} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Observaciones</label>
                    <textarea className="form-input" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} />
                  </div>
                </div>

                <div className="flex-1 min-w-[300px] flex flex-col">
                  <label className="form-label flex justify-between">
                    <span>Ubicación GPS (Opcional)</span>
                    {!formData.cliente_latitud && <span className="text-warning text-xs">Sin ubicación fijada</span>}
                  </label>
                  <div style={{ flex: 1, minHeight: '400px' }}>
                    <MapPicker location={formData.cliente_latitud ? [formData.cliente_latitud, formData.cliente_longitud] : null} onChange={handleLocationChange} />
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-6">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">Crear Pedido</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DETAIL MODAL */}
        {showDetailModal && selectedPedido && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '5vh 1rem' }}>
           <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '800px', padding: '2rem', margin: 'auto', marginBottom: '5vh' }}>
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold">Detalle de Pedido: {selectedPedido.folio_venta_pos}</h2>
               <button onClick={() => setShowDetailModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem' }}>
                 <X size={20} />
               </button>
             </div>

             <div className="flex gap-6 flex-wrap md:flex-nowrap">
               <div className="flex-1 flex flex-col gap-3">
                 <div><strong className="text-secondary text-sm">Cliente:</strong><p className="text-lg">{selectedPedido.cliente_nombre}</p></div>
                 <div><strong className="text-secondary text-sm">Dirección:</strong><p>{selectedPedido.cliente_direccion}</p></div>
                 <div><strong className="text-secondary text-sm">Estado:</strong><p><span className={`badge ${statusColors[selectedPedido.estado]}`}>{selectedPedido.estado.replace('_', ' ')}</span></p></div>
                 <div><strong className="text-secondary text-sm">Chofer:</strong><p>{selectedPedido.choferes?.nombre}</p></div>
                 <div><strong className="text-secondary text-sm">Vehículo:</strong><p>{selectedPedido.vehiculos?.placa}</p></div>
                 <div><strong className="text-secondary text-sm">Fecha:</strong><p>{selectedPedido.fecha_entrega_programada}</p></div>
                 
                 {selectedPedido.hora_llegada_real && (
                   <div><strong className="text-secondary text-sm">Llegada Real:</strong><p>{format(new Date(selectedPedido.hora_llegada_real), 'dd/MM/yyyy HH:mm')}</p></div>
                 )}
                 {selectedPedido.evidencia_foto_url && (
                   <div>
                     <strong className="text-secondary text-sm">Evidencia Fotográfica:</strong>
                     <div className="mt-2">
                       <a href={selectedPedido.evidencia_foto_url} target="_blank" rel="noopener noreferrer">
                         <img 
                           src={selectedPedido.evidencia_foto_url} 
                           alt="Evidencia" 
                           style={{ width: '100%', maxWidth: '250px', borderRadius: '8px', border: '1px solid var(--border)' }} 
                         />
                       </a>
                     </div>
                   </div>
                 )}
                 <div><strong className="text-secondary text-sm">Observaciones:</strong><p>{selectedPedido.observaciones || 'Ninguna'}</p></div>
               </div>

               <div className="flex-1 flex flex-col">
                 <strong className="text-secondary text-sm mb-2">Ubicación</strong>
                 <div style={{ flex: 1, minHeight: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                   {selectedPedido.cliente_latitud ? (
                     <MapPicker location={[selectedPedido.cliente_latitud, selectedPedido.cliente_longitud]} />
                   ) : (
                     <div className="flex items-center justify-center h-full bg-gray-100 text-secondary">Sin coordenadas GPS</div>
                   )}
                 </div>
               </div>
             </div>
           </div>
         </div>
        )}
      </>
    </AuthGuard>
  );
}
