-- 🔐 CREAR FUNCIÓN SIMPLE PARA VERIFICAR CONTRASEÑAS
-- Esta función simple evita el problema de tipos de la función anterior

BEGIN;

-- Crear función verify_password
CREATE OR REPLACE FUNCTION verify_password(
  password TEXT,
  hash TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN hash = crypt(password, hash);
END;
$$;

COMMIT;

-- Probar la función
SELECT 'Probando verify_password...' as test;
SELECT verify_password('admin123', '$2a$10$2wFjfL2G8JmfHxFIwvKakeAC.0u2ntIx1avE2f3u2tyHN9UoPV.Ua') as password_matches;

SELECT '✅ Función verify_password creada exitosamente' as resultado;