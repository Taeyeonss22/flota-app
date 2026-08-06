-- 1. Actualizar el constraint de la columna estado para permitir 'cancelado'
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estado_check CHECK (estado IN ('pendiente', 'en_ruta', 'entregado', 'no_entregado', 'cancelado'));

-- 2. Agregar columnas para cancelacion y reasignacion
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS reasignado_de UUID REFERENCES public.choferes(id);
