const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test', // I will just try to auth with something wrong, but I really just want to know the error message! 
  });
  // No, I can't query if I'm not logged in.
  // Wait, I can just query without login and see if there's a parsing error! PostgREST will parse the URL and return 400 if the relation doesn't exist, EVEN IF we don't have access.
  
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, vehiculos(placa), choferes(nombre)')
    .eq('fecha_entrega_programada', '2026-08-04')
    .order('created_at', { ascending: false });
    
  console.log("Error:", error);
}
test();
