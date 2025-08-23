# Configuración de Email en Supabase

## Desactivar Confirmación de Email para Usuarios Creados por Admin

Para que los usuarios creados por el administrador puedan iniciar sesión inmediatamente sin confirmar email:

### 1. Ir a Supabase Dashboard
- Abrir: https://supabase.com/dashboard
- Seleccionar el proyecto

### 2. Configurar Authentication
- Ir a `Authentication` → `Settings`
- En la sección "Email"

### 3. Desactivar Email Confirmation
- Desmarcar: "Enable email confirmations"
- O alternativamente
- Marcar: "Disable signup"
- Y usar solo la creación por admin

### 4. Configuración Avanzada (Opcional)
Si quieres mantener la confirmación para registros públicos pero no para admin:

```sql
-- RPC Function para confirmar email automáticamente
CREATE OR REPLACE FUNCTION confirm_user_email(user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE auth.users 
  SET email_confirmed_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5. Configuración Actual del Proyecto
La configuración actual usa `supabase.auth.signUp()` que:
- ✅ Crea el usuario inmediatamente
- ✅ Crea el perfil correspondiente
- ✅ Usuario puede iniciar sesión según configuración de confirmación

### 6. Verificar Configuración
Para verificar si está funcionando:
1. Crear un usuario desde AdminPanel
2. Intentar iniciar sesión inmediatamente
3. Si pide confirmación, aplicar los pasos 1-3

---

**Nota**: La configuración de confirmación de email se controla desde el Dashboard de Supabase, no desde el código del cliente.