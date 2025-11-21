-- Script para crear dos perfiles de prueba con sistema de nickname
-- Ejecutar en el SQL Editor de Supabase

BEGIN;

-- Asegurar que pgcrypto esté disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Obtener el ID de la primera sede disponible (para asignar a los usuarios)
DO $$
DECLARE
  v_sede_id UUID;
BEGIN
  -- Obtener la primera sede disponible
  SELECT id INTO v_sede_id FROM sedes WHERE is_active = true LIMIT 1;

  IF v_sede_id IS NULL THEN
    RAISE EXCEPTION 'No hay sedes activas disponibles. Crea una sede primero.';
  END IF;

  -- Perfil 1: Admin Global
  INSERT INTO profiles (
    id,
    nickname,
    password_hash,
    display_name,
    role,
    sede_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    'admin',
    crypt('admin123', gen_salt('bf', 10)),
    'Administrador Global',
    'admin_global',
    v_sede_id,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (nickname) DO UPDATE
  SET password_hash = crypt('admin123', gen_salt('bf', 10)),
      display_name = 'Administrador Global',
      role = 'admin_global',
      is_active = true,
      updated_at = NOW();

  -- Perfil 2: Agente
  INSERT INTO profiles (
    id,
    nickname,
    password_hash,
    display_name,
    role,
    sede_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    'agente1',
    crypt('agente123', gen_salt('bf', 10)),
    'Agente de Prueba',
    'agent',
    v_sede_id,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (nickname) DO UPDATE
  SET password_hash = crypt('agente123', gen_salt('bf', 10)),
      display_name = 'Agente de Prueba',
      role = 'agent',
      is_active = true,
      updated_at = NOW();

  RAISE NOTICE 'Perfiles creados exitosamente:';
  RAISE NOTICE '1. Usuario: admin, Password: admin123, Rol: admin_global';
  RAISE NOTICE '2. Usuario: agente1, Password: agente123, Rol: agent';
  RAISE NOTICE 'Sede asignada: %', v_sede_id;
END $$;

COMMIT;

-- Verificar que se crearon correctamente
SELECT
  nickname,
  display_name,
  role,
  sede_id,
  is_active,
  created_at
FROM profiles
WHERE nickname IN ('admin', 'agente1')
ORDER BY role DESC;
