-- Función simplificada para crear perfil de usuario
-- Esta función solo maneja la tabla profiles, el usuario debe hacer signup manualmente
CREATE OR REPLACE FUNCTION create_user_profile(
  p_email text,
  p_name text,
  p_role text DEFAULT 'agent',
  p_sede_id text DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record json;
BEGIN
  -- Verificar que el usuario que llama la función sea admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Solo los administradores pueden crear usuarios';
  END IF;

  -- Verificar que el email no exista en profiles
  IF EXISTS (
    SELECT 1 FROM profiles WHERE email = p_email
  ) THEN
    RAISE EXCEPTION 'El email ya está registrado';
  END IF;

  -- Crear el perfil en la tabla profiles
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
  ) RETURNING id;

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
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al crear perfil de usuario: %', SQLERRM;
END;
$$;

-- Dar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated; 