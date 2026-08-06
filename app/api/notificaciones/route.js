import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { chofer_id, folio_venta_pos, cliente_nombre, pedido_id } = body;

    if (!chofer_id) {
      return NextResponse.json({ error: 'Falta chofer_id' }, { status: 400 });
    }

    // 1. Obtener el token del chofer usando supabaseAdmin (ignora RLS)
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .select('expo_push_token')
      .eq('id', chofer_id)
      .single();

    if (perfilError || !perfil) {
      console.error("Error obteniendo perfil en backend:", perfilError);
      return NextResponse.json({ error: 'Chofer no encontrado' }, { status: 404 });
    }

    const expoPushToken = perfil.expo_push_token;

    if (!expoPushToken) {
      console.log(`Chofer ${chofer_id} no tiene token registrado.`);
      return NextResponse.json({ message: 'Sin token' }, { status: 200 });
    }

    // 2. Enviar la notificación a Expo (Desde el servidor de Next.js, 100% seguro)
    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        title: 'Nuevo Pedido Asignado 📦',
        body: `Folio ${folio_venta_pos} para el cliente ${cliente_nombre}.`,
        data: { screen: 'pedido', pedidoId: pedido_id },
      }),
    });

    const expoData = await expoRes.json();
    
    // LOG DETALLADO PARA DIAGNÓSTICO DE EXPO
    console.log("=== RESPUESTA DE EXPO PUSH API ===");
    console.log(JSON.stringify(expoData, null, 2));
    console.log("==================================");

    return NextResponse.json({ success: true, expo: expoData });

  } catch (error) {
    console.error("Error en API de Push:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
