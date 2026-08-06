const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, folio_venta_pos, cliente_telefono, estado, whatsapp_enviado, whatsapp_enviado_at, whatsapp_error')
    .order('created_at', { ascending: false })
    .limit(3);
    
  console.log("Error:", error);
  console.dir(data, { depth: null });
}
check();
