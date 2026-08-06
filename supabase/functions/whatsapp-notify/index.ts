import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER"); // e.g., "whatsapp:+14155238886"

serve(async (req) => {
  try {
    const payload = await req.json();

    // Verify it's an UPDATE on the pedidos table where estado changed to 'en_ruta'
    if (payload.type === "UPDATE" && payload.table === "pedidos") {
      const oldRecord = payload.old_record;
      const newRecord = payload.record;

      if (oldRecord.estado !== "en_ruta" && newRecord.estado === "en_ruta") {
        const clienteNombre = newRecord.cliente_nombre;
        const folio = newRecord.folio_venta_pos;
        let clienteTelefono = newRecord.cliente_telefono;
        const pedidoId = newRecord.id;

        if (clienteTelefono && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
          // Format phone number to WhatsApp format if not already (basic check)
          if (!clienteTelefono.startsWith("whatsapp:")) {
            if (!clienteTelefono.startsWith("+")) {
              clienteTelefono = "+" + clienteTelefono;
            }
            clienteTelefono = "whatsapp:" + clienteTelefono;
          }

          // In Twilio Sandbox, you might need a pre-approved template if the 24h window is closed.
          // For testing, just send a basic text message. If the user hasn't joined the sandbox, it will fail.
          // They need to reply "join <sandbox-keyword>" first.
          const messageBody = `Hola ${clienteNombre}, tu pedido de FerreMix (folio ${folio}) va en camino. ¡Gracias por tu compra!`;

          // Twilio API URL for sending messages
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

          const twilioParams = new URLSearchParams();
          twilioParams.append("To", clienteTelefono);
          twilioParams.append("From", twilioPhoneNumber);
          twilioParams.append("Body", messageBody);

          const response = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
            },
            body: twilioParams.toString(),
          });

          const result = await response.json();

          // Initialize Supabase Client to update the pedido record
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          const supabase = createClient(supabaseUrl, supabaseKey);

          if (response.ok) {
            // Update order as successfully sent
            await supabase
              .from("pedidos")
              .update({ whatsapp_enviado: true, whatsapp_enviado_at: new Date().toISOString(), whatsapp_error: null })
              .eq("id", pedidoId);
              
            return new Response(JSON.stringify({ success: true, messageId: result.sid }), {
              headers: { "Content-Type": "application/json" },
            });
          } else {
            // Failed from Twilio's side
            await supabase
              .from("pedidos")
              .update({ whatsapp_error: result.message || "Error desconocido de Twilio" })
              .eq("id", pedidoId);
              
            return new Response(JSON.stringify({ success: false, error: result }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ignored: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
