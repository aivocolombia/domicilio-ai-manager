-- 🔐 MIGRACIÓN A AUTENTICACIÓN POR NICKNAME
-- Este script migra de email a nickname authentication

BEGIN;

-- 1. Limpiar usuarios existentes que pueden tener problemas
DELETE FROM profiles; -- Borrar usuarios existentes como solicitado

-- 2. Modificar estructura de la tabla profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS email;
ALTER TABLE profiles ADD COLUMN nickname VARCHAR(50) UNIQUE NOT NULL DEFAULT 'temp_' || gen_random_uuid()::text;
ALTER TABLE profiles ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT 'temp_hash';
ALTER TABLE profiles ALTER COLUMN sede_id SET NOT NULL; -- Sede es obligatoria
ALTER TABLE profiles ALTER COLUMN name RENAME TO display_name; -- Cambiar name por display_name para claridad

-- 3. Crear índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles(nickname);

-- 4. Actualizar tipos de roles
ALTER TABLE profiles ADD CONSTRAINT check_valid_roles 
CHECK (role IN ('agent', 'admin_punto', 'admin_global'));

-- 5. Obtener IDs de sedes disponibles (necesario para usuarios iniciales)
-- Nota: Asumimos que hay al menos una sede disponible

-- 6. Crear función para hash de contraseñas (usando pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 7. Función para autenticar usuarios
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
  -- Verificar credenciales
  RETURN QUERY
  SELECT 
    p.id,
    p.nickname,
    p.display_name,
    p.role,
    p.sede_id,
    s.name as sede_name,
    p.is_active
  FROM profiles p
  LEFT JOIN sedes s ON p.sede_id = s.id
  WHERE p.nickname = p_nickname
    AND p.password_hash = crypt(p_password, p.password_hash)
    AND p.is_active = true;
END;
$$;

-- 8. Función para crear usuarios (solo admins pueden crearlos)
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
  v_caller_role TEXT;
  v_caller_sede_id UUID;
  v_result JSON;
BEGIN
  -- Verificar permisos del que llama la función
  IF p_caller_id IS NOT NULL THEN
    SELECT role, sede_id INTO v_caller_role, v_caller_sede_id 
    FROM profiles 
    WHERE id = p_caller_id AND is_active = true;
    
    -- Solo admin_global puede crear cualquier usuario
    -- admin_punto solo puede crear agentes en su misma sede
    IF v_caller_role = 'admin_punto' AND (p_role != 'agent' OR p_sede_id != v_caller_sede_id) THEN
      RAISE EXCEPTION 'Admin de punto solo puede crear agentes en su propia sede';
    END IF;
    
    IF v_caller_role NOT IN ('admin_global', 'admin_punto') THEN
      RAISE EXCEPTION 'Solo los administradores pueden crear usuarios';
    END IF;
  END IF;

  -- Validar que el nickname no exista
  IF EXISTS (SELECT 1 FROM profiles WHERE nickname = p_nickname) THEN
    RAISE EXCEPTION 'El nickname ya está en uso';
  END IF;

  -- Validar rol
  IF p_role NOT IN ('agent', 'admin_punto', 'admin_global') THEN
    RAISE EXCEPTION 'Rol inválido. Debe ser: agent, admin_punto, admin_global';
  END IF;

  -- Validar que la sede exista
  IF NOT EXISTS (SELECT 1 FROM sedes WHERE id = p_sede_id) THEN
    RAISE EXCEPTION 'La sede especificada no existe';
  END IF;

  -- Crear el usuario
  INSERT INTO profiles (
    id,
    nickname,
    password_hash,
    display_name,
    role,
    sede_id,
    is_active,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_nickname,
    crypt(p_password, gen_salt('bf', 10)),
    p_display_name,
    p_role,
    p_sede_id,
    true,
    NOW()
  ) RETURNING id INTO v_new_user_id;

  -- Retornar información del usuario creado
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

-- 9. Crear usuarios iniciales
-- Primero obtenemos una sede disponible
DO $$
DECLARE
  v_sede_id UUID;
  v_admin_global_id UUID;
  v_admin_punto_id UUID;
  v_agent_id UUID;
BEGIN
  -- Obtener primera sede disponible
  SELECT id INTO v_sede_id FROM sedes WHERE is_active = true LIMIT 1;
  
  IF v_sede_id IS NULL THEN
    RAISE EXCEPTION 'No hay sedes disponibles. Crear al menos una sede primero.';
  END IF;

  -- Crear Admin Global (puede gestionar todo el sistema)
  INSERT INTO profiles (
    id,
    nickname,
    password_hash,
    display_name,
    role,
    sede_id,
    is_active,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'admin_global',
    crypt('admin123', gen_salt('bf', 10)),
    'Administrador Global',
    'admin_global',
    v_sede_id, -- Sede principal por defecto
    true,
    NOW()
  ) RETURNING id INTO v_admin_global_id;

  -- Crear Admin de Punto (puede gestionar solo su sede)
  INSERT INTO profiles (
    id,
    nickname,
    password_hash,
    display_name,
    role,
    sede_id,
    is_active,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'admin_punto',
    crypt('admin123', gen_salt('bf', 10)),
    'Administrador de Punto',
    'admin_punto',
    v_sede_id,
    true,
    NOW()
  ) RETURNING id INTO v_admin_punto_id;

  -- Crear Agente
  INSERT INTO profiles (
    id,
    nickname,
    password_hash,
    display_name,
    role,
    sede_id,
    is_active,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'agente',
    crypt('agente123', gen_salt('bf', 10)),
    'Agente de Ventas',
    'agent',
    v_sede_id,
    true,
    NOW()
  ) RETURNING id INTO v_agent_id;

  RAISE NOTICE 'Usuarios creados exitosamente:';
  RAISE NOTICE '- Admin Global: nickname=admin_global, password=admin123';
  RAISE NOTICE '- Admin Punto: nickname=admin_punto, password=admin123';  
  RAISE NOTICE '- Agente: nickname=agente, password=agente123';
  RAISE NOTICE 'Sede asignada: %', v_sede_id;
END;
$$;

-- 10. Crear políticas RLS actualizadas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política para lectura: usuarios pueden ver su propio perfil y admins pueden ver todos
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT USING (
  auth.uid()::text = id::text OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id::text = auth.uid()::text 
    AND role IN ('admin_global', 'admin_punto')
  )
);

-- Política para inserción: solo admins pueden crear usuarios
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
CREATE POLICY "profiles_insert_policy" ON profiles FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id::text = auth.uid()::text 
    AND role IN ('admin_global', 'admin_punto')
  )
);

-- Política para actualización: usuarios pueden actualizar su propio perfil
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE USING (
  auth.uid()::text = id::text OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id::text = auth.uid()::text 
    AND role IN ('admin_global', 'admin_punto')
  )
);

COMMIT;

-- Verificar usuarios creados
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

-- Mostrar mensaje final
SELECT 'Migración completada. Usuarios listos para usar con autenticación por nickname.' as mensaje;