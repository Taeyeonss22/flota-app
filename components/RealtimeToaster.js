"use client";
import { useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

export default function RealtimeToaster() {
  useEffect(() => {
    // Listen to changes in the "pedidos" table
    const channel = supabase
      .channel('pedidos_toast_notifications')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, (payload) => {
        const { new: newRecord, old: oldRecord } = payload;
        
        // Check if status changed
        if (newRecord.estado !== oldRecord.estado) {
          if (newRecord.estado === 'entregado') {
            toast.success(`🚚 Pedido entregado: ${newRecord.folio_venta_pos}`, { duration: 5000 });
          } else if (newRecord.estado === 'no_entregado') {
            toast.error(`⚠️ Pedido NO entregado: ${newRecord.folio_venta_pos}`, { duration: 5000 });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return <Toaster position="top-right" />;
}
