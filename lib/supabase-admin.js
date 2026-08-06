import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Faltan variables de entorno para Supabase Admin.');
}

// Cliente con SERVICE ROLE KEY que ignora RLS. 
// NUNCA EXPONER AL CLIENTE. SOLO USAR EN SERVER COMPONENTS Y API ROUTES.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
