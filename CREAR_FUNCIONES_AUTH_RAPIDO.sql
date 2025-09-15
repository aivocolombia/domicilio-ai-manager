-- 🚀 SCRIPT RÁPIDO PARA CREAR FUNCIONES DE AUTENTICACIÓN
-- Ejecutar PRIMERO este script antes de usar la aplicación

BEGIN;

-- 1. Asegurar que pgcrypto esté disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Limpiar funciones existentes si hay conflictos
DROP FUNCTION IF EXISTS authenticate_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_user_with_nickname(TEXT, TEXT, TEXT, TEXT, UUID, UUID);

-- 3. Función para autenticar usuarios (CRÍTICA)
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
  -- Verificar credenciales y retornar datos del usuario
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

-- 4. Función para crear usuarios (OPCIONAL - para AdminPanel)
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
  -- Validar que el nickname no exista
  IF EXISTS (SELECT 1 FROM profiles WHERE nickname = p_nickname) THEN
    RAISE EXCEPTION 'El nickname ya está en uso';
  END IF;

  -- Validar rol
  IF p_role NOT IN ('agent', 'admin_punto', 'admin_global') THEN
    RAISE EXCEPTION 'Rol inválido. Debe ser: agent, admin_punto, admin_global';
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

COMMIT;

-- 5. Verificar que las funciones se crearon correctamente
SELECT 'authenticate_user' as funcion, 
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc WHERE proname = 'authenticate_user'
       ) THEN '✅ CREADA' ELSE '❌ ERROR' END as estado;

SELECT 'create_user_with_nickname' as funcion,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc WHERE proname = 'create_user_with_nickname'  
       ) THEN '✅ CREADA' ELSE '❌ ERROR' END as estado;

-- 6. Mensaje final
SELECT '🎉 Funciones de autenticación creadas. Ahora puedes usar la aplicación.' as mensaje;