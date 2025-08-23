# Configuración del Sistema de Inventario por Sede

## Resumen de Cambios

Se ha actualizado el sistema de inventario para manejar la disponibilidad de productos por sede. Ahora cada sede puede tener diferentes productos disponibles y precios personalizados.

## Nueva Estructura de Base de Datos

### Tablas Nuevas:
- `sede_platos`: Disponibilidad y precios de platos por sede
- `sede_bebidas`: Disponibilidad y precios de bebidas por sede  
- `sede_toppings`: Disponibilidad y precios de toppings por sede

### Tablas Modificadas:
- `platos`: Removido campo `available` (ahora se maneja por sede)
- `bebidas`: Removido campo `available` (ahora se maneja por sede)
- `toppings`: Removido campo `available` (ahora se maneja por sede)

## Pasos de Configuración

### 1. Ejecutar Script de Población de Datos

Ejecuta el archivo `populate_sede_tables.sql` en tu base de datos de Supabase:

```sql
-- Este script poblará las tablas de sede con datos iniciales
-- Asumiendo que ya tienes datos en platos, bebidas, toppings y sedes
```

### 2. Verificar la Configuración

Después de ejecutar el script, verifica que:

1. **Las tablas de sede tienen datos**:
   ```sql
   SELECT COUNT(*) FROM sede_platos;
   SELECT COUNT(*) FROM sede_bebidas;
   SELECT COUNT(*) FROM sede_toppings;
   ```

2. **Los usuarios tienen sede_id asignado**:
   ```sql
   SELECT id, email, name, sede_id FROM profiles WHERE sede_id IS NOT NULL;
   ```

### 3. Verificar Relaciones Plato-Toppings

Ejecuta el archivo `check_plato_toppings.sql` para verificar que los platos tengan toppings asignados:

```sql
-- Este script verificará las relaciones existentes y mostrará qué platos no tienen toppings
```

Si los platos no tienen toppings asignados, descomenta las líneas de inserción en el script y ejecuta nuevamente.

### 4. Probar el Sistema

1. **Inicia sesión** con un usuario que tenga `sede_id` asignado
2. **Ve al inventario** - deberías ver solo los productos disponibles para tu sede
3. **Verifica que los platos muestran sus toppings** - cada plato debería mostrar una sección "Toppings Incluidos"
4. **Prueba activar/desactivar** productos y toppings - los cambios se guardarán para tu sede específica

## Funcionalidades Nuevas

### ✅ **Disponibilidad por Sede**
- Cada sede puede tener diferentes productos disponibles
- Los cambios de disponibilidad solo afectan a la sede específica

### ✅ **Precios Personalizados por Sede**
- Cada sede puede tener precios diferentes para los mismos productos
- Si no se especifica un precio personalizado, se usa el precio base

### ✅ **Toppings por Plato**
- Los platos muestran sus toppings incluidos
- Cada topping puede tener disponibilidad independiente por sede
- Los toppings se pueden activar/desactivar individualmente

### ✅ **Interfaz Actualizada**
- El inventario muestra claramente qué sede está gestionando
- Los switches de disponibilidad funcionan por sede
- Los toppings se muestran dentro de cada plato con sus propios switches
- Mensajes de error si el usuario no tiene sede asignada

## Estructura de Datos

### Ejemplo de `sede_platos`:
```sql
sede_id | plato_id | available | price_override | updated_at
--------|----------|-----------|----------------|------------
uuid1   | 1        | true      | 15000          | 2024-01-01
uuid1   | 2        | false     | null           | 2024-01-01
uuid2   | 1        | true      | 16000          | 2024-01-01
```

### Ejemplo de `sede_bebidas`:
```sql
sede_id | bebida_id | available | price_override | updated_at
--------|-----------|-----------|----------------|------------
uuid1   | 1         | true      | 5000           | 2024-01-01
uuid1   | 2         | true      | null           | 2024-01-01
```

## API Actualizada

### Nuevas Funciones en `menuService`:

```typescript
// Obtener menú con información de sede
getMenuConSede(sedeId: string): Promise<MenuResponseConSede>

// Actualizar disponibilidad por sede
updatePlatoSedeAvailability(sedeId: string, platoId: number, available: boolean, priceOverride?: number)
updateBebidaSedeAvailability(sedeId: string, bebidaId: number, available: boolean, priceOverride?: number)
updateToppingSedeAvailability(sedeId: string, toppingId: number, available: boolean, priceOverride?: number)
```

## Tipos TypeScript Actualizados

### Nuevas Interfaces:
```typescript
interface PlatoConSede extends Plato {
  sede_available: boolean;
  sede_price: number;
  toppings: ToppingConSede[];
}

interface BebidaConSede extends Bebida {
  sede_available: boolean;
  sede_price: number;
}

interface SedePlato {
  sede_id: string;
  plato_id: number;
  available: boolean;
  price_override: number | null;
  updated_at: string;
}
```

## Troubleshooting

### Error: "No se ha asignado una sede al usuario"
- **Causa**: El usuario no tiene `sede_id` en su perfil
- **Solución**: Asignar una sede al usuario desde el Admin Panel

### Error: "Error al cargar inventario"
- **Causa**: Las tablas de sede no tienen datos
- **Solución**: Ejecutar el script `populate_sede_tables.sql`

### Productos no aparecen
- **Causa**: Los productos no están configurados para la sede
- **Solución**: Verificar que existen registros en `sede_platos`, `sede_bebidas`, etc.

### Cambios no se guardan
- **Causa**: Problemas de permisos en las tablas de sede
- **Solución**: Verificar las políticas RLS de las tablas de sede

### Toppings no aparecen en los platos
- **Causa**: No hay relaciones en la tabla `plato_toppings`
- **Solución**: Ejecutar el script `check_plato_toppings.sql` y crear las relaciones necesarias

### Toppings aparecen pero no se pueden activar/desactivar
- **Causa**: No hay registros en `sede_toppings` para esa sede
- **Solución**: Ejecutar el script `populate_sede_tables.sql` para crear los registros de sede

## Migración de Datos Existentes

Si ya tienes datos en las tablas `platos`, `bebidas`, `toppings` con el campo `available`:

1. **Ejecutar el script de población** - esto creará registros para todas las sedes
2. **Los productos existentes** mantendrán su estado de disponibilidad
3. **Los precios** se usarán como precio base

## Próximos Pasos

1. **Ejecutar el script SQL** para poblar las tablas
2. **Asignar sedes** a los usuarios existentes
3. **Probar la funcionalidad** con diferentes usuarios
4. **Configurar precios personalizados** por sede si es necesario

## Notas Importantes

- **Los cambios son por sede**: Activar/desactivar un producto solo afecta a la sede específica
- **Precios personalizados**: Si no se especifica `price_override`, se usa el precio base del producto
- **Compatibilidad**: El sistema mantiene compatibilidad con el código existente
- **Performance**: Las consultas están optimizadas para evitar N+1 queries 