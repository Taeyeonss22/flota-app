const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  // Login as admin
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@flota.com',
    password: 'password123'
  });
  if (authErr) { console.log("Login err", authErr); return; }

  const { data: v } = await supabase.from('vehiculos').select('id').limit(1);
  const { data: c } = await supabase.from('choferes').select('id').limit(1);
  if (!v || !c || v.length===0 || c.length===0) { console.log("No data", v, c); return; }

  const formData = {
    folio_venta_pos: 'TEST01',
    cliente_nombre: 'Test',
    cliente_direccion: 'Test',
    cliente_latitud: null,
    cliente_longitud: null,
    vehiculo_id: v[0].id,
    chofer_id: c[0].id,
    fecha_entrega_programada: '2026-08-04',
    observaciones: ''
  };
  const { error } = await supabase.from('pedidos').insert([formData]);
  console.log("Insert error:", error);
}
test();
