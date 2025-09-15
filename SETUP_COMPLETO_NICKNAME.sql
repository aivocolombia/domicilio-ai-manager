-- 🔥 SETUP COMPLETO PARA AUTENTICACIÓN POR NICKNAME
-- Ejecutar TODO este script en Supabase SQL Editor

BEGIN;

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Limpiar y recrear tabla profiles
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('agent', 'admin_punto', 'admin_global')),
  sede_id UUID NOT NULL REFERENCES sedes(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear índices
CREATE UNIQUE INDEX idx_profiles_nickname ON profiles(nickname);
CREATE INDEX idx_profiles_sede ON profiles(sede_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- 4. Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS básicas (permisivas para desarrollo)
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_all" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_all" ON profiles FOR UPDATE USING (true);

-- 6. Función para autenticar usuarios
CREATE OR REPLACE FUNCTION authenticate_user(
  p_nickname TEXT,
  p_password TEXT
) RETURNS TABLE (
  user_id UUID,
  nickname TEXT,
  display_name TEXT,
  role TEXT,
  sede_id UUID,
  sede_name TEXT,
  is_active BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.nickname,
    p.display_name,
    p.role,
    p.sede_id,
    COALESCE(s.name, 'Sede Desconocida') as sede_name,
    COALESCE(p.is_active, true) as is_active
  FROM profiles p
  LEFT JOIN sedes s ON p.sede_id = s.id
  WHERE p.nickname = p_nickname
    AND p.password_hash = crypt(p_password, p.password_hash)
    AND COALESCE(p.is_active, true) = true;
END;
$$;

-- 7. Función para crear usuarios
CREATE OR REPLACE FUNCTION create_user_with_nickname(
  p_nickname TEXT,
  p_password TEXT,
  p_display_name TEXT,
  p_role TEXT,
  p_sede_id UUID,
  p_caller_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_user_id UUID;
  v_result JSON;
BEGIN
  -- Validar nickname único
  IF EXISTS (SELECT 1 FROM profiles WHERE nickname = p_nickname) THEN
    RAISE EXCEPTION 'El nickname ya está en uso';
  END IF;

  -- Validar rol
  IF p_role NOT IN ('agent', 'admin_punto', 'admin_global') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;

  -- Validar sede existe
  IF NOT EXISTS (SELECT 1 FROM sedes WHERE id = p_sede_id) THEN
    RAISE EXCEPTION 'La sede no existe';
  END IF;

  -- Crear usuario
  INSERT INTO profiles (
    nickname,
    password_hash,
    display_name,
    role,
    sede_id,
    is_active,
    created_at
  ) VALUES (
    p_nickname,
    crypt(p_password, gen_salt('bf', 10)),
    p_display_name,
    p_role,
    p_sede_id,
    true,
    NOW()
  ) RETURNING id INTO v_new_user_id;

  SELECT json_build_object(
    'id', v_new_user_id,
    'nickname', p_nickname,
    'display_name', p_display_name,
    'role', p_role,
    'sede_id', p_sede_id,
    'message', 'Usuario creado exitosamente'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 8. Crear usuarios iniciales
DO $$
DECLARE
  v_sede_id UUID;
BEGIN
  -- Obtener primera sede disponible
  SELECT id INTO v_sede_id FROM sedes WHERE is_active = true LIMIT 1;
  
  IF v_sede_id IS NULL THEN
    RAISE EXCEPTION 'No hay sedes activas. Crear al menos una sede primero.';
  END IF;

  -- Admin Global
  INSERT INTO profiles (nickname, password_hash, display_name, role, sede_id, is_active)
  VALUES ('admin_global', crypt('admin123', gen_salt('bf', 10)), 'Administrador Global', 'admin_global', v_sede_id, true);

  -- Admin Punto  
  INSERT INTO profiles (nickname, password_hash, display_name, role, sede_id, is_active)
  VALUES ('admin_punto', crypt('admin123', gen_salt('bf', 10)), 'Administrador de Punto', 'admin_punto', v_sede_id, true);

  -- Agente
  INSERT INTO profiles (nickname, password_hash, display_name, role, sede_id, is_active)  
  VALUES ('agente', crypt('agente123', gen_salt('bf', 10)), 'Agente de Ventas', 'agent', v_sede_id, true);

  RAISE NOTICE 'Usuarios creados en sede: %', v_sede_id;
END;
$$;

COMMIT;

-- 9. Verificar usuarios creados
SELECT 
  nickname,
  display_name,
  role,
  sede_id,
  is_active,
  created_at
FROM profiles
ORDER BY 
  CASE role 
    WHEN 'admin_global' THEN 1 
    WHEN 'admin_punto' THEN 2 
    WHEN 'agent' THEN 3 
  END;

-- 10. Probar autenticación
SELECT 'Probando login admin_global...' as test;
SELECT * FROM authenticate_user('admin_global', 'admin123');

-- 11. Verificar funciones
SELECT 'authenticate_user' as funcion, 
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'authenticate_user') 
       THEN '✅ OK' ELSE '❌ ERROR' END as estado;

SELECT '🎉 Setup completo. Credenciales:
admin_global / admin123
admin_punto / admin123  
agente / agente123' as mensaje_final;