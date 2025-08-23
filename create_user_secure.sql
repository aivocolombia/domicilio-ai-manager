-- Función RPC segura para crear usuarios con autenticación y perfil
-- Esta función debe ser ejecutada con permisos de service_role desde el backend

CREATE OR REPLACE FUNCTION create_user_secure(
  p_email text,
  p_password text,
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
  v_user_id uuid;
  v_user_record json;
  v_admin_check boolean;
BEGIN
  -- Verificar que el usuario que ejecuta la función es admin
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  ) INTO v_admin_check;
  
  IF NOT v_admin_check THEN
    RAISE EXCEPTION 'Solo los administradores pueden crear usuarios';
  END IF;

  -- Verificar que el email no existe
  IF EXISTS (SELECT 1 FROM profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'El email ya está registrado';
  END IF;

  -- Verificar que el rol es válido
  IF p_role NOT IN ('admin', 'agent') THEN
    RAISE EXCEPTION 'El rol debe ser admin o agent';
  END IF;

  -- Crear el usuario en auth.users usando la función nativa de Supabase
  -- Nota: Esta función requiere permisos especiales
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
  ) VALUES (
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('name', p_name, 'source', 'admin-panel')
  ) RETURNING id INTO v_user_id;

  -- Crear el perfil en profiles
  INSERT INTO profiles (
    id,
    email,
    name,
    role,
    sede_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_email,
    p_name,
    p_role,
    p_sede_id,
    p_is_active,
    now(),
    now()
  );

  -- Retornar la información del usuario creado
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
  WHERE p.id = v_user_id;

  RETURN v_user_record;
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION create_user_secure TO authenticated;

-- Comentario sobre seguridad
COMMENT ON FUNCTION create_user_secure IS 'Función segura para crear usuarios con autenticación y perfil. Solo puede ser ejecutada por administradores.'; 