-- 🔧 FIX PARA FUNCIÓN authenticate_user - ARREGLAR TIPOS DE DATOS
-- Ejecutar este script para corregir el error de tipos

BEGIN;

-- 1. Eliminar función con problema de tipos
DROP FUNCTION IF EXISTS authenticate_user(TEXT, TEXT);

-- 2. Recrear función con tipos correctos
CREATE OR REPLACE FUNCTION authenticate_user(
  p_nickname TEXT,
  p_password TEXT
) RETURNS TABLE (
  user_id UUID,
  nickname VARCHAR(50),  -- Usar VARCHAR(50) en lugar de TEXT
  display_name VARCHAR(100), -- Usar VARCHAR(100) en lugar de TEXT  
  role VARCHAR(20),      -- Usar VARCHAR(20) en lugar de TEXT
  sede_id UUID,
  sede_name TEXT,        -- Este puede ser TEXT porque viene de COALESCE
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

COMMIT;

-- 3. Probar la función corregida
SELECT 'Probando función corregida...' as test;
SELECT * FROM authenticate_user('admin_global', 'admin123');

SELECT '✅ Función authenticate_user corregida exitosamente' as resultado;