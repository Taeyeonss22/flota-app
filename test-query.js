const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, vehiculos(placa), choferes!pedidos_chofer_id_fkey(nombre)')
    .order('created_at', { ascending: false });
  console.log("Error:", error);
  console.log("Data length:", data ? data.length : null);
}
test();
