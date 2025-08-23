-- Función simple para crear perfil de usuario
-- Esta función es muy básica y solo inserta en la tabla profiles
CREATE OR REPLACE FUNCTION simple_create_user(
  p_email text,
  p_name text,
  p_role text DEFAULT 'agent',
  p_sede_id text DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_record json;
BEGIN
  -- Verificar que el email no exista
  IF EXISTS (SELECT 1 FROM profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'El email ya está registrado';
  END IF;

  -- Insertar el perfil
  INSERT INTO profiles (
    email,
    name,
    role,
    sede_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    p_email,
    p_name,
    p_role,
    p_sede_id,
    p_is_active,
    now(),
    now()
  );

  -- Retornar los datos del usuario creado
  SELECT json_build_object(
    'id', p.id,
    'email', p.email,
    'name', p.name,
    'role', p.role,
    'sede_id', p.sede_id,
    'is_active', p.is_active,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) INTO v_user_record
  FROM profiles p
  WHERE p.email = p_email;

  RETURN v_user_record;
END;
$$;

-- Dar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION simple_create_user TO authenticated; 