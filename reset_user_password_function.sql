-- Función para resetear la contraseña de un usuario
-- Solo puede ser ejecutada por administradores

CREATE OR REPLACE FUNCTION reset_user_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar que la contraseña tenga al menos 6 caracteres
  IF LENGTH(p_new_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  -- Actualizar la contraseña del usuario
  UPDATE profiles
  SET
    password_hash = crypt(p_new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Verificar que se actualizó el usuario
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  RETURN TRUE;
END;
$$;

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_password(UUID, TEXT) TO service_role;
