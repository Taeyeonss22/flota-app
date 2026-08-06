-- Habilitar extensión pgcrypto para UUIDs si no está habilitada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. TABLA: perfiles
-- ==========================================
CREATE TABLE public.perfiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'operador')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. TABLA: vehiculos
-- ==========================================
CREATE TABLE public.vehiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa TEXT NOT NULL UNIQUE,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    anio INT NOT NULL,
    tipo TEXT NOT NULL,
    capacidad_tanque_litros NUMERIC NOT NULL CHECK (capacidad_tanque_litros > 0),
    kilometraje_actual NUMERIC NOT NULL DEFAULT 0 CHECK (kilometraje_actual >= 0),
    estado TEXT NOT NULL CHECK (estado IN ('activo', 'mantenimiento', 'inactivo')) DEFAULT 'activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. TABLA: choferes
-- ==========================================
CREATE TABLE public.choferes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    licencia TEXT NOT NULL UNIQUE,
    tipo_licencia TEXT NOT NULL,
    vigencia_licencia DATE NOT NULL,
    telefono TEXT,
    estado TEXT NOT NULL CHECK (estado IN ('activo', 'inactivo')) DEFAULT 'activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 4. TABLA: asignaciones
-- ==========================================
CREATE TABLE public.asignaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
    chofer_id UUID NOT NULL REFERENCES public.choferes(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

-- ==========================================
-- 5. TABLA: recorridos
-- ==========================================
CREATE TABLE public.recorridos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
    chofer_id UUID NOT NULL REFERENCES public.choferes(id) ON DELETE CASCADE,
    fecha_salida TIMESTAMPTZ NOT NULL,
    fecha_llegada TIMESTAMPTZ NOT NULL,
    origen TEXT NOT NULL,
    destino TEXT NOT NULL,
    km_inicial NUMERIC NOT NULL CHECK (km_inicial >= 0),
    km_final NUMERIC NOT NULL CHECK (km_final >= km_inicial),
    km_recorridos NUMERIC NOT NULL DEFAULT 0,
    proposito TEXT NOT NULL,
    observaciones TEXT,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 6. TABLA: cargas_combustible
-- ==========================================
CREATE TABLE public.cargas_combustible (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
    chofer_id UUID NOT NULL REFERENCES public.choferes(id) ON DELETE CASCADE,
    fecha TIMESTAMPTZ NOT NULL,
    litros NUMERIC NOT NULL CHECK (litros > 0),
    costo_total NUMERIC NOT NULL CHECK (costo_total >= 0),
    precio_litro NUMERIC NOT NULL CHECK (precio_litro >= 0),
    km_al_cargar NUMERIC NOT NULL CHECK (km_al_cargar >= 0),
    estacion TEXT,
    rendimiento_calculado NUMERIC,
    registrado_por UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 7. TABLA: mantenimientos
-- ==========================================
CREATE TABLE public.mantenimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('preventivo', 'correctivo')),
    descripcion TEXT NOT NULL,
    fecha DATE NOT NULL,
    km_al_mantenimiento NUMERIC NOT NULL CHECK (km_al_mantenimiento >= 0),
    costo NUMERIC NOT NULL CHECK (costo >= 0),
    taller TEXT,
    proximo_mantenimiento_km NUMERIC CHECK (proximo_mantenimiento_km >= 0),
    proximo_mantenimiento_fecha DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 8. TABLA: pedidos
-- ==========================================
CREATE TABLE public.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_venta_pos TEXT NOT NULL,
    cliente_nombre TEXT NOT NULL,
    cliente_direccion TEXT NOT NULL,
    cliente_latitud NUMERIC,
    cliente_longitud NUMERIC,
    vehiculo_id UUID NOT NULL REFERENCES public.vehiculos(id),
    chofer_id UUID NOT NULL REFERENCES public.choferes(id),
    fecha_entrega_programada DATE NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'en_ruta', 'entregado', 'no_entregado')) DEFAULT 'pendiente',
    hora_llegada_real TIMESTAMPTZ,
    latitud_llegada_real NUMERIC,
    longitud_llegada_real NUMERIC,
    evidencia_foto_url TEXT,
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- FUNCIONES DE SEGURIDAD Y TRIGGERS
-- ==========================================

-- Función para obtener rol sin causar recursión en RLS
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid();
$$;

-- Trigger para perfiles: Crear automáticamente cuando se registra un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario Nuevo'), COALESCE(NEW.raw_user_meta_data->>'rol', 'operador'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger para recorridos: Calcular km_recorridos y actualizar kilometraje_actual del vehículo
CREATE OR REPLACE FUNCTION public.calcular_recorrido()
RETURNS TRIGGER AS $$
BEGIN
  NEW.km_recorridos := NEW.km_final - NEW.km_inicial;
  -- Actualizar kilometraje del vehículo si es mayor
  UPDATE public.vehiculos 
  SET kilometraje_actual = GREATEST(kilometraje_actual, NEW.km_final)
  WHERE id = NEW.vehiculo_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_update_recorridos
  BEFORE INSERT OR UPDATE ON public.recorridos
  FOR EACH ROW EXECUTE PROCEDURE public.calcular_recorrido();

-- Trigger para cargas_combustible: Calcular rendimiento (km/l)
CREATE OR REPLACE FUNCTION public.calcular_rendimiento()
RETURNS TRIGGER AS $$
DECLARE
  km_anterior NUMERIC;
BEGIN
  -- Obtener el km de la carga de combustible anterior más reciente
  SELECT km_al_cargar INTO km_anterior
  FROM public.cargas_combustible
  WHERE vehiculo_id = NEW.vehiculo_id AND fecha < NEW.fecha
  ORDER BY fecha DESC LIMIT 1;

  IF km_anterior IS NOT NULL AND NEW.km_al_cargar > km_anterior THEN
    NEW.rendimiento_calculado := (NEW.km_al_cargar - km_anterior) / NEW.litros;
  ELSE
    NEW.rendimiento_calculado := NULL;
  END IF;

  -- Actualizar kilometraje del vehículo si es mayor
  UPDATE public.vehiculos 
  SET kilometraje_actual = GREATEST(kilometraje_actual, NEW.km_al_cargar)
  WHERE id = NEW.vehiculo_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_update_cargas
  BEFORE INSERT OR UPDATE ON public.cargas_combustible
  FOR EACH ROW EXECUTE PROCEDURE public.calcular_rendimiento();


-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recorridos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargas_combustible ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mantenimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- PERFILES
CREATE POLICY "Admin: all perfiles" ON public.perfiles FOR ALL USING (public.get_auth_user_role() = 'admin');
CREATE POLICY "Operador: read own perfil" ON public.perfiles FOR SELECT USING (id = auth.uid());

-- VEHICULOS
CREATE POLICY "Admin: all vehiculos" ON public.vehiculos FOR ALL USING (public.get_auth_user_role() = 'admin');
CREATE POLICY "Operador: read vehiculos" ON public.vehiculos FOR SELECT USING (public.get_auth_user_role() = 'operador');

-- CHOFERES
CREATE POLICY "Admin: all choferes" ON public.choferes FOR ALL USING (public.get_auth_user_role() = 'admin');
CREATE POLICY "Operador: read choferes" ON public.choferes FOR SELECT USING (public.get_auth_user_role() = 'operador');

-- ASIGNACIONES
CREATE POLICY "Admin: all asignaciones" ON public.asignaciones FOR ALL USING (public.get_auth_user_role() = 'admin');
CREATE POLICY "Operador: read asignaciones" ON public.asignaciones FOR SELECT USING (public.get_auth_user_role() = 'operador');

-- RECORRIDOS
CREATE POLICY "Admin: all recorridos" ON public.recorridos FOR ALL USING (public.get_auth_user_role() = 'admin');
CREATE POLICY "Operador: read own recorridos" ON public.recorridos FOR SELECT USING (
  public.get_auth_user_role() = 'operador' AND registrado_por = auth.uid()
);
CREATE POLICY "Operador: insert recorridos" ON public.recorridos FOR INSERT WITH CHECK (
  public.get_auth_user_role() = 'operador' AND registrado_por = auth.uid()
);

-- CARGAS COMBUSTIBLE
CREATE POLICY "Admin: all cargas_combustible" ON public.cargas_combustible FOR ALL USING (public.get_auth_user_role() = 'admin');
CREATE POLICY "Operador: read own cargas_combustible" ON public.cargas_combustible FOR SELECT USING (
  public.get_auth_user_role() = 'operador' AND registrado_por = auth.uid()
);
CREATE POLICY "Operador: insert cargas_combustible" ON public.cargas_combustible FOR INSERT WITH CHECK (
  public.get_auth_user_role() = 'operador' AND registrado_por = auth.uid()
);

-- MANTENIMIENTOS
CREATE POLICY "Admin: all mantenimientos" ON public.mantenimientos FOR ALL USING (public.get_auth_user_role() = 'admin');

-- PEDIDOS
CREATE POLICY "Admin: all pedidos" ON public.pedidos FOR ALL USING (public.get_auth_user_role() = 'admin');
CREATE POLICY "Operador: read own pedidos" ON public.pedidos FOR SELECT USING (
  public.get_auth_user_role() = 'operador' AND chofer_id = auth.uid()
);
CREATE POLICY "Operador: update own pedidos" ON public.pedidos FOR UPDATE USING (
  public.get_auth_user_role() = 'operador' AND chofer_id = auth.uid()
) WITH CHECK (
  public.get_auth_user_role() = 'operador' AND chofer_id = auth.uid()
);

-- ==========================================
-- REALTIME
-- ==========================================
alter publication supabase_realtime add table public.vehiculos;
alter publication supabase_realtime add table public.choferes;
alter publication supabase_realtime add table public.asignaciones;
alter publication supabase_realtime add table public.recorridos;
alter publication supabase_realtime add table public.cargas_combustible;
alter publication supabase_realtime add table public.mantenimientos;
alter publication supabase_realtime add table public.pedidos;
