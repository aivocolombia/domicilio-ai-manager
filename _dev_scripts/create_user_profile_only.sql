-- Función RPC para crear solo el perfil de usuario
-- El usuario debe registrarse manualmente en la aplicación

CREATE OR REPLACE FUNCTION create_user_profile_only(
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
  v_admin_check boolean;
BEGIN
  -- Verificar que el usuario que ejecuta la función es admin
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  ) INTO v_admin_check;
  
  IF NOT v_admin_check THEN
    RAISE EXCEPTION 'Solo los administradores pueden crear perfiles de usuario';
  END IF;

  -- Verificar que el email no existe
  IF EXISTS (SELECT 1 FROM profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'El email ya está registrado';
  END IF;

  -- Verificar que el rol es válido
  IF p_role NOT IN ('admin', 'agent') THEN
    RAISE EXCEPTION 'El rol debe ser admin o agent';
  END IF;

  -- Crear el perfil en profiles (sin auth.users)
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

  -- Retornar la información del perfil creado
  SELECT json_build_object(
    'id', p.id,
    'email', p.email,
    'name', p.name,
    'role', p.role,
    'sede_id', p.sede_id,
    'is_active', p.is_active,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'message', 'Perfil creado exitosamente. El usuario debe registrarse manualmente en la aplicación.'
  ) INTO v_user_record
  FROM profiles p
  WHERE p.email = p_email;

  RETURN v_user_record;
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION create_user_profile_only TO authenticated;

-- Comentario sobre seguridad
COMMENT ON FUNCTION create_user_profile_only IS 'Función para crear perfiles de usuario. El usuario debe registrarse manualmente en la aplicación.'; 