-- Función para crear usuario con perfil de forma segura
-- Esta función debe ejecutarse con permisos de service_role
CREATE OR REPLACE FUNCTION create_user_with_profile(
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

  -- Verificar que el email no exista
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE email = p_email
  ) THEN
    RAISE EXCEPTION 'El email ya está registrado';
  END IF;

  -- Crear el usuario en auth.users usando la API de Supabase
  -- Nota: Esto requiere que la función se ejecute con service_role
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"' || p_name || '"}'::jsonb,
    false,
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  -- Crear el perfil en la tabla profiles
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
  WHERE p.id = v_user_id;

  RETURN v_user_record;
EXCEPTION
  WHEN OTHERS THEN
    -- Si hay error, hacer rollback y retornar error
    RAISE EXCEPTION 'Error al crear usuario: %', SQLERRM;
END;
$$;

-- Dar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION create_user_with_profile TO authenticated;

-- Crear política RLS para la función
CREATE POLICY "Users can call create_user_with_profile" ON profiles
  FOR ALL USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin' AND is_active = true
  )); 