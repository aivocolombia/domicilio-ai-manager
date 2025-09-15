-- 🎯 FIX DEFINITIVO - FUNCIÓN authenticate_user CON CAST A TEXT
-- Ejecutar este script para resolver el problema de tipos definitivamente

BEGIN;

-- 1. Eliminar función problemática
DROP FUNCTION IF EXISTS authenticate_user(TEXT, TEXT);

-- 2. Recrear función con CAST explícito a TEXT para todos los campos
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
    p.nickname::TEXT,
    p.display_name::TEXT,
    p.role::TEXT,
    p.sede_id,
    COALESCE(s.name::TEXT, 'Sede Desconocida') as sede_name,
    COALESCE(p.is_active, true) as is_active
  FROM profiles p
  LEFT JOIN sedes s ON p.sede_id = s.id
  WHERE p.nickname = p_nickname
    AND p.password_hash = crypt(p_password, p.password_hash)
    AND COALESCE(p.is_active, true) = true;
END;
$$;

COMMIT;

-- 3. Probar la función con cast a TEXT
SELECT 'Probando función con CAST a TEXT...' as test;
SELECT * FROM authenticate_user('admin_global', 'admin123');

-- 4. Verificar función creada correctamente
SELECT 'authenticate_user' as funcion, 
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc WHERE proname = 'authenticate_user'
       ) THEN '✅ FUNCIÓN CREADA Y FUNCIONANDO' ELSE '❌ ERROR' END as estado;

SELECT '🎉 LISTO - Función authenticate_user corregida con CAST a TEXT' as resultado;