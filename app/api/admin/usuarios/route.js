import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { email, password, nombre, rol, licencia, tipo_licencia, vigencia_licencia, telefono } = await request.json();

    // 1. Crear el usuario en Auth usando la API Admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirm so they can login immediately
      user_metadata: {
        nombre,
        rol // 'operador' o 'admin'
      }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // The database trigger will automatically create the row in `perfiles` table
    // due to the handle_new_user() trigger we created in Phase 1-3.

    // 2. If it's an operator, also create the `choferes` record, linked with the exact same ID
    if (rol === 'operador') {
      const { error: choferError } = await supabaseAdmin.from('choferes').insert({
        id: userId,
        nombre,
        licencia: licencia || 'PENDIENTE',
        tipo_licencia: tipo_licencia || 'A',
        vigencia_licencia: vigencia_licencia || new Date().toISOString().split('T')[0],
        telefono: telefono || '',
        estado: 'activo'
      });

      if (choferError) {
        // En un caso real haríamos rollback, pero por ahora devolvemos error
        return NextResponse.json({ error: 'Usuario creado pero falló al guardar datos de chofer: ' + choferError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, user: authData.user });

  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
