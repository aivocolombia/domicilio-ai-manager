# Feature: Resetear Contraseña de Usuarios

## Resumen
Se agregó un botón en el AdminPanel para que los administradores puedan resetear las contraseñas de los usuarios.

## ¿Por qué no se pueden "ver" las contraseñas?
Las contraseñas están **hasheadas con bcrypt** en la base de datos (campo `password_hash`). Esto es una medida de seguridad estándar que hace imposible recuperar la contraseña original. El hash es un proceso de una sola vía, no se puede revertir.

## Solución Implementada
En lugar de "ver" contraseñas, se implementó la funcionalidad de **resetear contraseña** con un **modal hermoso**, que:

1. Permite al administrador establecer una **nueva contraseña** para el usuario
2. Muestra un modal elegante con toda la información del usuario
3. Incluye un campo con toggle para mostrar/ocultar la contraseña mientras se escribe
4. Explica por qué no se puede ver la contraseña anterior (seguridad con bcrypt)
5. La nueva contraseña se muestra **una sola vez** en una pantalla de éxito con opción de copiar
6. El administrador debe copiarla y dársela al usuario
7. La contraseña se hashea inmediatamente en la BD

## Funcionalidad

### Botón de Resetear Contraseña
- **Ubicación**: AdminPanel > Gestión de Usuarios > Columna "Acciones"
- **Ícono**: 🔑 (KeyRound)
- **Permisos**:
  - `admin_global`: Puede resetear contraseña de cualquier usuario
  - `admin_punto`: Puede resetear contraseña de usuarios de su sede

### Flujo de Uso
1. Admin hace clic en el botón 🔑 junto al usuario
2. Se abre un **modal elegante** mostrando:
   - Icono de llave (KeyRound) en el título
   - Nickname y nombre completo del usuario
   - **Advertencia de seguridad**: Explica que no se puede ver la contraseña anterior porque está encriptada con bcrypt
   - Campo de entrada para nueva contraseña con toggle mostrar/ocultar (ojo/ojo cerrado)
   - Validación en tiempo real (mínimo 6 caracteres)
3. Admin ingresa la nueva contraseña y hace clic en "Actualizar Contraseña"
4. Si es válida, se actualiza en la BD y se muestra una **pantalla de éxito** con:
   - Icono de check verde grande
   - La nueva contraseña en formato `code` (monospace)
   - Botón de copiar al portapapeles
   - Advertencia: "Guarda esta contraseña. No se volverá a mostrar."
5. Admin copia la contraseña y la entrega al usuario
6. El usuario puede usar esa contraseña para login

## Archivo SQL Requerido

Se creó el archivo `reset_user_password_function.sql` que debe ejecutarse en Supabase:

```sql
CREATE OR REPLACE FUNCTION reset_user_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS BOOLEAN
```

### Cómo ejecutarlo:
1. Ir a Supabase Dashboard
2. SQL Editor
3. Copiar y pegar el contenido de `reset_user_password_function.sql`
4. Ejecutar

## Archivos Modificados

### `src/components/metrics/AdminPanel.tsx`
- **Imports**: Agregados `KeyRound`, `EyeOff`, `Eye`, `Copy`, `CheckCircle2` icons
- **Estados del Modal**:
  - `isPasswordModalOpen`: Controla la apertura/cierre del modal
  - `selectedUserForPassword`: Usuario seleccionado para reset
  - `newPassword`: Nueva contraseña ingresada
  - `showPasswordInModal`: Toggle para mostrar/ocultar contraseña en el input
  - `isResettingPassword`: Estado de carga durante el reset
  - `resetPasswordSuccess`: Indica si el reset fue exitoso
- **Funciones**:
  - `handleShowPassword(userId, userNickname)`: Abre el modal con la información del usuario
  - `handleResetPassword()`: Ejecuta el reset de contraseña llamando a `reset_user_password` RPC
  - `handleClosePasswordModal()`: Cierra el modal y limpia los estados
  - `handleCopyPassword()`: Copia la contraseña al portapapeles
- **UI**:
  - Botón con ícono KeyRound en la columna de acciones
  - **Dialog Modal** con dos pantallas:
    1. **Pantalla de entrada**: Campo de contraseña con toggle, advertencia de seguridad, botones cancelar/actualizar
    2. **Pantalla de éxito**: Check verde, contraseña generada, botón copiar, advertencia de guardar

## Seguridad
✅ Las contraseñas siguen hasheadas en la BD
✅ Solo admins pueden resetear contraseñas
✅ Se valida longitud mínima (6 caracteres)
✅ La nueva contraseña solo se muestra una vez
✅ Se usa bcrypt para el hash (gen_salt('bf'))

## Alternativas Consideradas

1. **Mostrar nickname**: Se descartó porque no muestra la contraseña real
2. **Guardar contraseña reversible**: Se descartó por ser inseguro
3. **Resetear contraseña**: ✅ **Implementado** - Balance perfecto entre seguridad y utilidad

## Próximos Pasos Recomendados

Si en el futuro se necesita un sistema más robusto:
1. Enviar la nueva contraseña por email/SMS al usuario
2. Implementar sistema de "cambio de contraseña obligatorio" al primer login
3. Agregar logs de auditoría para ver quién resetea contraseñas
