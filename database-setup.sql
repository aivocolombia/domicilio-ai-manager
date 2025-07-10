-- Script de configuración de la base de datos para Domicilio AI Manager
-- Ejecutar este script en el SQL Editor de Supabase

-- Habilitar RLS (Row Level Security)
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sedes ENABLE ROW LEVEL SECURITY;

-- Crear tabla de sedes
CREATE TABLE IF NOT EXISTS sedes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    current_capacity INTEGER DEFAULT 0,
    max_capacity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'agent')) DEFAULT 'agent',
    sede_id UUID REFERENCES sedes(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear triggers para actualizar updated_at
CREATE TRIGGER update_sedes_updated_at BEFORE UPDATE ON sedes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Crear función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'agent');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para nuevos usuarios
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Políticas RLS para sedes
CREATE POLICY "Sedes son visibles para todos los usuarios autenticados" ON sedes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Solo admins pueden insertar sedes" ON sedes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Solo admins pueden actualizar sedes" ON sedes
    FOR UPDATE USING (auth.role() = 'authenticated' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ));

-- Políticas RLS para profiles
CREATE POLICY "Usuarios pueden ver su propio perfil" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins pueden ver todos los perfiles" ON profiles
    FOR SELECT USING (auth.role() = 'authenticated' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Admins pueden actualizar todos los perfiles" ON profiles
    FOR UPDATE USING (auth.role() = 'authenticated' AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ));

-- Insertar datos de ejemplo (opcional)
INSERT INTO sedes (name, address, phone, max_capacity) VALUES
    ('Sede Principal', 'Calle 123 #45-67, Bogotá', '+57 1 234 5678', 100),
    ('Sede Norte', 'Carrera 15 #90-45, Bogotá', '+57 1 345 6789', 80),
    ('Sede Sur', 'Avenida 68 #45-12, Bogotá', '+57 1 456 7890', 60)
ON CONFLICT DO NOTHING;

-- Crear un usuario admin de ejemplo (reemplazar con tu email)
-- INSERT INTO profiles (id, email, name, role) VALUES
--     ('tu-uuid-aqui', 'admin@ejemplo.com', 'Administrador', 'admin')
-- ON CONFLICT DO NOTHING; 