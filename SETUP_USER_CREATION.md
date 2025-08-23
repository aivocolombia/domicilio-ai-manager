# Configuración para Creación de Usuarios

## Problema Actual
El Admin Panel no puede crear usuarios porque:
1. La Admin API de Supabase (`auth.admin.createUser`) requiere permisos de service_role
2. No se puede usar service_role desde el frontend por seguridad
3. Las funciones RPC anteriores no funcionaban correctamente

## Solución Implementada

### 1. Ejecutar la Función SQL
Primero, ejecuta esta función SQL en tu base de datos de Supabase:

```sql
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
```

### 2. Cómo Funciona Ahora

1. **El administrador crea un perfil** en el Admin Panel
2. **Se crea solo el perfil** en la tabla `profiles` (sin usuario de autenticación)
3. **El usuario debe registrarse manualmente** en la página de login
4. **Cuando el usuario se registra**, Supabase crea automáticamente el usuario de autenticación
5. **El perfil ya existe** y se puede asociar al usuario

### 3. Flujo de Usuario

#### Para el Administrador:
1. Ir al Admin Panel
2. Hacer clic en "Crear Usuario"
3. Llenar el formulario (email, nombre, rol, sede)
4. El sistema crea el perfil
5. Mostrar mensaje: "Perfil creado. El usuario debe registrarse manualmente"

#### Para el Nuevo Usuario:
1. Ir a la página de login
2. Hacer clic en "Registrarse" o "Sign Up"
3. Usar el mismo email que el administrador creó
4. Establecer su contraseña
5. El sistema asociará automáticamente el perfil existente

### 4. Ventajas de esta Solución

✅ **Segura**: No expone service_role en el frontend
✅ **Funcional**: Permite crear usuarios desde el Admin Panel
✅ **Flexible**: El usuario puede elegir su propia contraseña
✅ **Compatible**: Funciona con las políticas de seguridad de Supabase

### 5. Alternativa Futura (Opcional)

Si quieres automatizar completamente el proceso, podrías:

1. **Crear un backend** (Node.js, Python, etc.)
2. **Usar service_role** solo en el backend
3. **Crear endpoint** `/api/create-user` que use `auth.admin.createUser`
4. **Llamar al endpoint** desde el frontend

Pero la solución actual es más simple y segura para la mayoría de casos.

### 6. Verificación

Para verificar que todo funciona:

1. Ejecuta la función SQL en Supabase
2. Crea un usuario desde el Admin Panel
3. Verifica que aparece en la tabla `profiles`
4. Intenta registrarte con ese email en la página de login
5. Verifica que puedes iniciar sesión correctamente

### 7. Troubleshooting

**Error: "Función no encontrada"**
- Asegúrate de ejecutar la función SQL en la base de datos correcta
- Verifica que tienes permisos para crear funciones

**Error: "Solo los administradores pueden crear perfiles"**
- Verifica que el usuario actual tiene `role = 'admin'` en la tabla `profiles`

**Error: "El email ya está registrado"**
- El email ya existe en la tabla `profiles`
- Usa un email diferente o elimina el registro existente

**Error: "El rol debe ser admin o agent"**
- Asegúrate de usar exactamente `'admin'` o `'agent'` (en minúsculas) 