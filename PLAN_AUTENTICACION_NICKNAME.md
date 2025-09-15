# 🔐 Plan de Migración: Email → Nickname Authentication

## 📋 **Cambios Necesarios**

### 1. **Base de Datos**
- ✅ Agregar campo `nickname` (único) a tabla `profiles`
- ✅ Agregar campo `password_hash` a tabla `profiles`
- ✅ Crear índices únicos para `nickname`
- ✅ Migrar usuarios existentes con nicknames temporales

### 2. **Backend/Auth Logic**
- ✅ Desactivar Supabase Auth por email
- ✅ Crear sistema de autenticación personalizado
- ✅ Implementar hash de contraseñas (bcrypt/scrypt)
- ✅ Crear JWT tokens personalizados o usar Supabase con custom claims

### 3. **Frontend**
- ✅ Modificar Login.tsx: Campo `nickname` en lugar de `email`
- ✅ Actualizar useAuth.tsx: `signIn(nickname, password)`
- ✅ Actualizar AdminPanel: Crear usuarios con `nickname`
- ✅ Actualizar types: Cambiar `email` por `nickname` en interfaces

### 4. **Funciones SQL**
- ✅ Actualizar funciones de creación de usuarios
- ✅ Modificar verificaciones de unicidad (nickname vs email)
- ✅ Actualizar políticas RLS si necesario

## 🚨 **Consideraciones Críticas**

### **Opción A: Sistema Completamente Personalizado**
- **Pros**: Control total, no dependencia de Supabase Auth
- **Contras**: Más complejo, gestión manual de sesiones/tokens

### **Opción B: Híbrido (Supabase Auth + Nickname)**
- **Pros**: Aprovechar infraestructura de Supabase
- **Contras**: Más hacky, usar emails ficticios

## 🎯 **Recomendación: Opción A**

**Razón**: Control total y más limpio a largo plazo.

### **Implementación Sugerida:**

1. **Tabla profiles actualizada:**
```sql
ALTER TABLE profiles ADD COLUMN nickname VARCHAR(50) UNIQUE NOT NULL;
ALTER TABLE profiles ADD COLUMN password_hash VARCHAR(255) NOT NULL;
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX idx_profiles_nickname ON profiles(nickname);
```

2. **Autenticación personalizada:**
- Función SQL para login: `authenticate_user(nickname, password)`
- JWT personalizado o usar Supabase `auth.jwt()` con custom claims
- Middleware de autenticación personalizado

3. **Frontend simplificado:**
```typescript
signIn: (nickname: string, password: string) => Promise<{error?: string}>
```

## ⚠️ **Riesgos**
- **Migración de usuarios existentes**
- **Posible downtime durante migración**
- **Cambios en RLS pueden afectar permisos**

## ✅ **¿Proceder?**
**¿Estás seguro de que quieres hacer este cambio? Es un cambio significativo.**