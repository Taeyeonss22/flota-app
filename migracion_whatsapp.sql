-- 1. Agregar columnas para notificaciones por WhatsApp
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_telefono TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS whatsapp_enviado BOOLEAN DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS whatsapp_enviado_at TIMESTAMPTZ;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS whatsapp_error TEXT;
