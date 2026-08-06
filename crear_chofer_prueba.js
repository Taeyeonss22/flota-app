const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const email = 'chofer1@flota.com';
  const password = 'password123';
  
  console.log('Creando usuario en Auth...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre: 'Chofer de Prueba', rol: 'operador' }
    }
  });

  if (authError && authError.message !== 'User already registered') {
    console.error('Error Auth:', authError);
    return;
  }

  // Attempt login to get session if already registered
  const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
  const userId = loginData?.user?.id || authData?.user?.id;
  
  if (!userId) {
    console.error('No se pudo obtener el ID del usuario');
    return;
  }

  console.log('ID del usuario:', userId);

  // Check if chofer exists
  const { data: choferExistente } = await supabase.from('choferes').select('id').eq('id', userId).single();
  
  if (!choferExistente) {
    console.log('Creando registro en choferes...');
    await supabase.from('choferes').insert({
      id: userId,
      nombre: 'Chofer de Prueba',
      licencia: 'LIC-TEST-' + Math.floor(Math.random() * 1000),
      tipo_licencia: 'A',
      vigencia_licencia: '2028-01-01',
      telefono: '5551234567',
      estado: 'activo'
    });
  }

  // Create a mock pedido for today
  console.log('Creando pedido de prueba para hoy...');
  const today = new Date().toISOString().split('T')[0];
  
  // Need a vehiculo id first
  let { data: vehiculo } = await supabase.from('vehiculos').select('id').limit(1).single();
  
  if (!vehiculo) {
    console.log('Creando vehiculo temporal...');
    const { data: newVehiculo } = await supabase.from('vehiculos').insert({
      placa: 'TEST-' + Math.floor(Math.random() * 1000),
      marca: 'Toyota',
      modelo: 'Hilux',
      anio: 2024,
      tipo: 'Camioneta',
      capacidad_tanque_litros: 80,
      kilometraje_actual: 100
    }).select().single();
    vehiculo = newVehiculo;
  }

  await supabase.from('pedidos').insert({
    folio_venta_pos: 'PED-' + Math.floor(Math.random() * 10000),
    cliente_nombre: 'Cliente de Prueba SA',
    cliente_direccion: 'Av. Reforma 222, CDMX',
    cliente_latitud: 19.42847,
    cliente_longitud: -99.16171,
    vehiculo_id: vehiculo.id,
    chofer_id: userId,
    fecha_entrega_programada: today,
    estado: 'pendiente'
  });

  console.log('\n--- ¡ÉXITO! ---');
  console.log('Usa estas credenciales en tu App Móvil:');
  console.log('Email: chofer1@flota.com');
  console.log('Password: password123');
}

main();
