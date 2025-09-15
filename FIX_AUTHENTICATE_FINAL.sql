-- 🔧 FIX FINAL PARA FUNCIÓN authenticate_user - TODOS LOS TIPOS VARCHAR
-- Ejecutar este script para corregir completamente el error de tipos

BEGIN;

-- 1. Eliminar función con problema de tipos
DROP FUNCTION IF EXISTS authenticate_user(TEXT, TEXT);

-- 2. Recrear función con tipos VARCHAR para todo (sin especificar longitud)
CREATE OR REPLACE FUNCTION authenticate_user(
  p_nickname TEXT,
  p_password TEXT
) RETURNS TABLE (
  user_id UUID,
  nickname VARCHAR,  -- Sin especificar longitud
  display_name VARCHAR, -- Sin especificar longitud
  role VARCHAR,      -- Sin especificar longitud
  sede_id UUID,
  sede_name VARCHAR, -- Sin especificar longitud
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
    COALESCE(s.name, 'Sede Desconocida'::VARCHAR) as sede_name,
    COALESCE(p.is_active, true) as is_active
  FROM profiles p
  LEFT JOIN sedes s ON p.sede_id = s.id
  WHERE p.nickname = p_nickname
    AND p.password_hash = crypt(p_password, p.password_hash)
    AND COALESCE(p.is_active, true) = true;
END;
$$;

COMMIT;

-- 3. Probar la función corregida
SELECT 'Probando función con tipos VARCHAR...' as test;
SELECT * FROM authenticate_user('admin_global', 'admin123');

-- 4. Verificar que la función existe
SELECT 'authenticate_user' as funcion, 
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc WHERE proname = 'authenticate_user'
       ) THEN '✅ CREADA CORRECTAMENTE' ELSE '❌ ERROR' END as estado;

SELECT '✅ Función authenticate_user corregida con tipos VARCHAR' as resultado;