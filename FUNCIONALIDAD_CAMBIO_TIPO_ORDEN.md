# 🔄 Funcionalidad: Cambiar Tipo de Orden (Delivery ↔ Pickup)

## Problema Resuelto

Antes, cuando un cliente pedía un domicilio pero luego quería pasar a recoger el pedido (o viceversa), los agentes debían:
1. ❌ Cancelar la orden original
2. ❌ Crear una nueva orden desde cero
3. ❌ Esto ensuciaba las métricas con cancelaciones innecesarias

Ahora, pueden **cambiar el tipo de orden directamente** sin cancelar ni crear nuevas órdenes.

## ✨ Nueva Funcionalidad

### Qué hace
Permite cambiar el tipo de una orden entre:
- **Delivery** (Domicilio) → Cliente recibe en su dirección, requiere repartidor
- **Pickup** (Recogida) → Cliente recoge en la sede, NO requiere repartidor

### Cuándo se puede usar
✅ Solo en estados: **"Recibidos"** o **"Cocina"**
❌ NO se puede cambiar si está en **"Camino"** o **"Entregados"** (ya salió el pedido)

### Quién puede usarlo
✅ Todos los roles pueden cambiar el tipo:
- `agent` (Agentes)
- `admin_punto` (Admin de Punto)
- `admin_global` (Admin Global)

## 🎯 Cómo Funciona

### Flujo de Uso

1. **Agente abre el Dashboard**
2. **Encuentra la orden** que quiere cambiar (debe estar en "Recibidos" o "Cocina")
3. **Click en el botón de cambio** (icono de flechas ↔)
4. **Ve el modal de confirmación** con:
   - Tipo actual (ej: Domicilio 🚚)
   - Nuevo tipo (ej: Recogida 📦)
   - Advertencia si tiene repartidor asignado
5. **Confirma el cambio**
6. **Orden actualizada** ✅

### Cambio de Delivery → Pickup

```
ANTES: Orden tipo "delivery"
- Cliente: Juan Pérez
- Repartidor asignado: Carlos Gómez
- Estado: Recibidos

↓ (Click en cambiar tipo)

DESPUÉS: Orden tipo "pickup"
- Cliente: Juan Pérez
- Repartidor: NULL (removido automáticamente)
- Estado: Recibidos
- Nota: Cliente recogerá en sede
```

### Cambio de Pickup → Delivery

```
ANTES: Orden tipo "pickup"
- Cliente: María López
- Sin repartidor
- Estado: Cocina

↓ (Click en cambiar tipo)

DESPUÉS: Orden tipo "delivery"
- Cliente: María López
- Repartidor: (se asignará después)
- Estado: Cocina
- Nota: Se puede asignar repartidor cuando esté lista
```

## 📋 Componentes Implementados

### 1. Servicio: `orderTypeService.ts`

**Ubicación:** `src/services/orderTypeService.ts`

**Funciones principales:**
- `canChangeOrderType(status)` - Valida si el estado permite el cambio
- `changeOrderType(params)` - Ejecuta el cambio en la BD
- `getOrderInfo(ordenId)` - Obtiene info de una orden

**Validaciones:**
- ✅ Estado debe ser "Recibidos" o "Cocina"
- ✅ No permite cambio si ya es del tipo solicitado
- ✅ Remueve repartidor automáticamente al cambiar a pickup
- ✅ Registra todos los cambios en logs

### 2. Componente UI: `ChangeOrderTypeDialog.tsx`

**Ubicación:** `src/components/ChangeOrderTypeDialog.tsx`

**Características:**
- Modal bonito con confirmación visual
- Muestra tipo actual y nuevo con iconos y colores
- Advertencia si hay repartidor asignado
- Deshabilita botón si estado no permite cambio
- Loading state mientras procesa

### 3. Integración en Dashboard

**Ubicación:** `src/components/Dashboard.tsx`

**Cambios:**
- ✅ Nuevo botón en acciones de cada orden (icono ↔)
- ✅ Solo visible en estados "Recibidos" y "Cocina"
- ✅ Tooltip descriptivo
- ✅ Handler para abrir modal
- ✅ Recarga automática después del cambio

## 🎨 UI/UX

### Botón en Dashboard

```
Apariencia:
- Icon: ArrowLeftRight (↔)
- Color: Amber (amarillo/naranja)
- Border: border-amber-300
- Hover: bg-amber-50
- Tamaño: 8x8 (igual a otros botones)
```

### Tooltip del Botón
- Si es delivery: "Cambiar tipo: Cambiar a Recogida"
- Si es pickup: "Cambiar tipo: Cambiar a Domicilio"

### Modal de Confirmación

```
┌─────────────────────────────────────┐
│ Cambiar Tipo de Orden      [#1234]  │
├─────────────────────────────────────┤
│                                      │
│  [🚚] Tipo actual                   │
│       Domicilio                      │
│                                      │
│         ↓                            │
│                                      │
│  [📦] Nuevo tipo                    │
│       Recogida                       │
│                                      │
│  ℹ️ Nota: El repartidor "Carlos"   │
│    será desasignado automáticamente │
│                                      │
├─────────────────────────────────────┤
│         [Cancelar] [Cambiar a ...]  │
└─────────────────────────────────────┘
```

## 🔧 Cambios en Base de Datos

### Tabla afectada: `ordenes`

**Campo modificado:**
- `type_order` - Cambia entre 'delivery' y 'pickup'
- `repartidor_id` - Se pone NULL al cambiar a pickup
- `updated_at` - Se actualiza con timestamp

**NO se modifica:**
- `status` (estado)
- `cliente_id`
- `total`
- `payment_id`
- Ningún otro campo

## 📊 Impacto en Métricas

### Antes (Sin funcionalidad)
```
Órdenes canceladas: 15
- 5 canceladas por cliente cambió de opinión
- 10 canceladas legítimas

Métricas afectadas:
❌ Tasa de cancelación inflada
❌ Órdenes duplicadas
❌ Historial confuso
```

### Después (Con funcionalidad)
```
Órdenes canceladas: 10
- 10 canceladas legítimas

Cambios de tipo: 5
- 5 órdenes modificadas (sin cancelar)

Métricas mejoradas:
✅ Tasa de cancelación real
✅ Sin duplicados
✅ Historial limpio
```

## 🧪 Casos de Prueba

### Caso 1: Cambiar de Delivery a Pickup (Exitoso)
```
DADO: Orden #1234 en estado "Recibidos", tipo "delivery", con repartidor asignado
CUANDO: Agente click en cambiar tipo
Y: Confirma el cambio
ENTONCES:
  - Orden cambia a tipo "pickup"
  - Repartidor se remueve (NULL)
  - Toast de éxito aparece
  - Dashboard se recarga
  - Orden muestra nuevo tipo
```

### Caso 2: Cambiar de Pickup a Delivery (Exitoso)
```
DADO: Orden #5678 en estado "Cocina", tipo "pickup", sin repartidor
CUANDO: Agente click en cambiar tipo
Y: Confirma el cambio
ENTONCES:
  - Orden cambia a tipo "delivery"
  - Repartidor queda NULL (se asignará después)
  - Toast de éxito aparece
  - Dashboard se recarga
```

### Caso 3: Intentar Cambiar en Estado "Camino" (Bloqueado)
```
DADO: Orden #9999 en estado "Camino"
CUANDO: Agente intenta ver la orden
ENTONCES:
  - Botón de cambiar tipo NO aparece
  - (Estado no permite cambio)
```

### Caso 4: Ver Modal en Estado No Permitido
```
DADO: Usuario abre modal para orden en estado "Entregados"
CUANDO: Modal se abre
ENTONCES:
  - Modal muestra advertencia
  - Botón de confirmar está deshabilitado
  - Mensaje: "Solo se puede cambiar cuando está en Recibidos o Cocina"
```

## 🚨 Validaciones Implementadas

### En el Servicio (Backend Logic)

1. ✅ **Validación de Estado**
   ```typescript
   canChangeOrderType(status: string): boolean {
     const validStatuses = ['Recibidos', 'Cocina', 'received', 'kitchen'];
     return validStatuses.includes(status);
   }
   ```

2. ✅ **Validación de Cambio Real**
   ```typescript
   if (currentType === newType) {
     return { success: false, message: "Ya es de este tipo" };
   }
   ```

3. ✅ **Actualización Atómica**
   ```typescript
   // Si cambia a pickup, remueve repartidor
   if (newType === 'pickup') {
     updateData.repartidor_id = null;
   }
   ```

### En el UI (Frontend)

1. ✅ **Botón Solo Visible en Estados Válidos**
   ```typescript
   {(realOrder.estado === 'Recibidos' || realOrder.estado === 'Cocina') && (
     <Button ... />
   )}
   ```

2. ✅ **Modal con Validación**
   ```typescript
   const canChange = orderTypeService.canChangeOrderType(order.estado);
   // Deshabilita botón si no se puede cambiar
   ```

3. ✅ **Loading State**
   ```typescript
   disabled={isChanging}
   // Previene múltiples clicks mientras procesa
   ```

## 📝 Logs Generados

### Logs Exitosos
```
[INFO] OrderTypeService: Iniciando cambio de tipo de orden
  { ordenId: 1234, newType: 'pickup', currentType: 'delivery', currentStatus: 'Recibidos' }

[INFO] OrderTypeService: Cambiando a pickup: removiendo repartidor asignado
  { ordenId: 1234 }

[INFO] OrderTypeService: Tipo de orden actualizado exitosamente
  { ordenId: 1234, oldType: 'delivery', newType: 'pickup', removedRepartidor: true }
```

### Logs de Error
```
[WARN] OrderTypeService: No se puede cambiar el tipo de orden
  { ordenId: 5678, currentStatus: 'Camino' }
  Mensaje: Solo se puede cambiar cuando está en "Recibidos" o "Cocina"

[ERROR] OrderTypeService: Error al actualizar tipo de orden en BD
  { error: {...}, ordenId: 9999 }
```

## 🎓 Guía de Uso para Agentes

### Paso a Paso

1. **Abrir Dashboard** → Ve a la pestaña de Dashboard

2. **Encontrar la orden** → Busca la orden que necesitas cambiar

3. **Verificar estado** → Debe estar en "Recibidos" o "Cocina"
   - ✅ Si ves el botón ↔ → Puedes cambiar
   - ❌ Si no ves el botón → Estado no permite cambio

4. **Click en botón ↔** → Botón amarillo/naranja con flechas

5. **Revisar el modal**:
   - Tipo actual (ej: Domicilio)
   - Nuevo tipo (ej: Recogida)
   - Advertencias (si hay repartidor asignado)

6. **Confirmar** → Click en "Cambiar a [tipo]"

7. **Esperar** → Se verá "Cambiando..."

8. **Ver resultado** → Toast verde de éxito + Dashboard recargado

### Tips

- 💡 Si cambias a Pickup, el repartidor se quita automáticamente
- 💡 Si cambias a Delivery, podrás asignar repartidor después
- 💡 Si el pedido ya salió (está en "Camino"), no podrás cambiarlo
- 💡 No necesitas cancelar la orden, solo cambias el tipo

## 🔐 Permisos

Todos los roles tienen permiso para cambiar el tipo de orden:

| Rol | Puede Cambiar Tipo | Notas |
|-----|-------------------|-------|
| `agent` | ✅ Sí | Puede cambiar órdenes de su sede |
| `admin_punto` | ✅ Sí | Puede cambiar órdenes de su sede |
| `admin_global` | ✅ Sí | Puede cambiar cualquier orden |

No hay restricciones adicionales más allá del estado de la orden.

## 📦 Archivos Creados/Modificados

### Archivos Nuevos
1. `src/services/orderTypeService.ts` - Servicio de cambio de tipo
2. `src/components/ChangeOrderTypeDialog.tsx` - Modal de confirmación

### Archivos Modificados
1. `src/components/Dashboard.tsx` - Agregado:
   - Import de `ArrowLeftRight` icon
   - Import de `ChangeOrderTypeDialog`
   - Estado `isChangeOrderTypeDialogOpen`
   - Estado `selectedOrderForTypeChange`
   - Handler `handleChangeOrderType()`
   - Botón en sección de acciones
   - Renderizado del modal

## ✅ Checklist de Implementación

- [x] Servicio `orderTypeService.ts` creado
- [x] Componente `ChangeOrderTypeDialog.tsx` creado
- [x] Integración en Dashboard completada
- [x] Validaciones de estado implementadas
- [x] Remoción automática de repartidor
- [x] Logs comprehensivos agregados
- [x] UI/UX con iconos y colores
- [x] Build exitoso
- [x] Documentación completa

## 🚀 Próximos Pasos

1. **Probar la funcionalidad:**
   ```bash
   npm run dev
   ```

2. **Crear una orden de prueba** en estado "Recibidos"

3. **Asignar un repartidor** (para probar la remoción)

4. **Click en el botón ↔** y cambiar el tipo

5. **Verificar:**
   - ✅ Tipo cambió correctamente
   - ✅ Repartidor se removió (si cambió a pickup)
   - ✅ Toast apareció
   - ✅ Dashboard se recargó
   - ✅ Logs en consola son claros

## 📞 Soporte

Si encuentras algún problema:
1. Revisa los logs en consola del navegador
2. Verifica el estado de la orden
3. Asegúrate de tener permisos
4. Reporta el issue con los logs completos

---

**Versión:** 1.0.0
**Fecha:** 2025-10-28
**Autor:** Claude Code Assistant
