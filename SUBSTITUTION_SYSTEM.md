# Sistema de Sustituciones de Productos

Este documento describe el sistema completo de sustituciones de productos implementado en el gestor de domicilios.

## Funcionalidades Implementadas

### 1. Sustitución de Productos Completos
- Cambiar un plato por otro (ej: frijoles → ajiaco)
- Cambiar una bebida por otra
- Calcular automáticamente las diferencias de precio
- Reglas bidireccionales de sustitución

### 2. Sustitución de Toppings
- Cambiar toppings individuales dentro de un plato
- Ejemplo: Arroz ($4,800) → Aguacate ($4,200)
- Múltiples cambios de toppings en un mismo plato
- Cálculo automático del precio total del plato

### 3. Visualización en Detalles de Orden
- Indicadores visuales de productos sustituidos
- Detalles de cambios de toppings
- Diferencias de precio mostradas con colores (rojo = más caro, verde = más barato)

### 4. Actualización de Comanda
- La comanda (minuta) automáticamente refleja los productos sustituidos
- Los nombres y precios actualizados aparecen en la impresión para cocina

### 5. Actualización Automática de Precios
- Recálculo inmediato del total de la orden
- Actualización del registro de pago en la base de datos
- Preservación de la consistencia de datos

### 6. Historial de Sustituciones (Opcional)
- Registro completo de todas las sustituciones realizadas
- Trazabilidad para auditoría y análisis
- Base de datos dedicada para el historial

## Archivos Implementados

### Componentes React
- `src/components/ProductSubstitutionDialog.tsx` - Modal para sustitución de productos
- `src/components/PlatoToppingsDialog.tsx` - Modal para cambio de toppings
- `src/components/EditOrderModal.tsx` - Modal principal de edición (actualizado)
- `src/components/OrderDetailsModal.tsx` - Modal de detalles (actualizado)

### Servicios
- `src/services/substitutionService.ts` - Lógica de negocio para sustituciones
- `src/services/substitutionHistoryService.ts` - Gestión del historial
- `src/hooks/useSubstitutions.ts` - Hook personalizado para sustituciones

### Base de Datos
- `final_substitutions.sql` - Tabla de reglas de sustitución y datos iniciales
- `create_substitution_table.sql` - Tabla para historial de sustituciones (opcional)

## Configuración Inicial

### 1. Ejecutar Scripts de Base de Datos

```sql
-- 1. Crear tabla de reglas de sustitución
\i final_substitutions.sql

-- 2. (Opcional) Crear tabla de historial
\i create_substitution_table.sql
```

### 2. Verificar Reglas de Sustitución
Las reglas incluidas permiten:
- Mazorca ↔ Plátano (bidireccional, mismo precio)
- Arroz → Aguacate (precio diferente)
- Frijoles ↔ Ajiaco (bidireccional)
- Y más...

### 3. Configurar Toppings de Platos
Verificar que los platos tengan toppings asociados en la tabla `plato_toppings`.

## Uso del Sistema

### Para Sustituir un Producto Completo
1. En el modal de edición de orden, hacer clic en el botón ↗️ junto a un producto
2. Seleccionar el producto sustituto de la lista disponible
3. Revisar la diferencia de precio
4. Confirmar el cambio

### Para Cambiar Toppings
1. En el modal de edición, hacer clic en "🧀 Toppings" junto a un plato
2. En el modal de toppings, seleccionar las nuevas opciones para cada topping
3. Revisar el resumen de cambios y diferencias de precio
4. Aplicar los cambios

### Visualizar Cambios
1. Los detalles de la orden mostrarán indicadores azules con los cambios realizados
2. La comanda de cocina automáticamente mostrará los productos finales
3. El total se actualiza inmediatamente

## Características Técnicas

### Reglas de Negocio
- Solo se permiten sustituciones configuradas en la tabla `product_substitution_rules`
- Las reglas pueden ser unidireccionales o bidireccionales
- Los precios se calculan automáticamente basados en las diferencias configuradas

### Seguridad
- Row Level Security (RLS) habilitado en todas las tablas
- Validaciones de tipos de producto en la base de datos
- Manejo de errores robusto

### Performance
- Consultas optimizadas con índices apropiados
- Carga en paralelo de sustituciones disponibles
- Caché de productos de sede para mejor rendimiento

## Mantenimiento

### Agregar Nuevas Reglas de Sustitución
```sql
INSERT INTO product_substitution_rules (
  original_product_id, original_product_type,
  substitute_product_id, substitute_product_type,
  price_difference, is_bidirectional, is_active
) VALUES (
  1, 'plato', 2, 'plato',
  0, true, true  -- Bidireccional, mismo precio
);
```

### Desactivar Reglas
```sql
UPDATE product_substitution_rules
SET is_active = false
WHERE id = [rule_id];
```

### Consultar Historial
```sql
SELECT * FROM order_substitution_history
WHERE orden_id = [order_id]
ORDER BY applied_at;
```

## Solución de Problemas

### La tabla de historial no existe
- Ejecutar `create_substitution_table.sql` en el dashboard de Supabase
- Verificar permisos de la base de datos

### No aparecen sustituciones disponibles
- Verificar que existan reglas activas en `product_substitution_rules`
- Confirmar que los productos existen y están disponibles en la sede

### Los toppings no se muestran
- Verificar relaciones en `plato_toppings`
- Confirmar que los toppings tienen reglas de sustitución configuradas

## Estado del Sistema

✅ **Completado:**
- Sustitución de productos completos
- Sustitución de toppings individuales
- Actualización de detalles de orden
- Actualización de comanda/minuta
- Recálculo automático de precios
- Arquitectura de historial de sustituciones

🔄 **Pendiente (opcional):**
- Activación del historial de sustituciones (requiere crear tabla)
- Reportes de análisis de sustituciones
- Interfaz administrativa para gestión de reglas