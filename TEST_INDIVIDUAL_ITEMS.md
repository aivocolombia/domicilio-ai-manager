# TEST PLAN: Individual Item Substitutions

## Pasos para Testing Controlado

### 1. **Preparar Test Environment**
- Crear orden nueva con productos duplicados (2 frijoles)
- Verificar que aparezcan como items separados en EditOrderModal

### 2. **Debug durante Sustitución**
- Abrir consola del navegador
- Editar orden
- Cambiar topping SOLO en uno de los frijoles
- Observar logs de debug específicamente:

#### **Logs Esperados:**
```
🔍 DEBUG: Preparando sustitución para guardar:
  substitution: {type: "topping_substitution", ...}
  enrichedSub_orden_item_id: NÚMERO (NO null)

🔍 DEBUG substitutionHistoryService: Record a insertar:
  orden_item_id: NÚMERO (NO null)
```

#### **Logs Actuales (Problema):**
```
🔍 DEBUG: Preparando sustitución para guardar:
  enrichedSub_orden_item_id: null  ← PROBLEMA AQUÍ

🔍 DEBUG substitutionHistoryService: Record a insertar:
  orden_item_id: null  ← RESULTADO DEL PROBLEMA
```

### 3. **Verificar en Base de Datos**
Ejecutar SQL para ver qué se guardó:
```sql
SELECT * FROM order_substitution_history
WHERE orden_id = [ORDEN_ID]
ORDER BY applied_at DESC LIMIT 5;
```

### 4. **Diagnosis del Problema**
Si `orden_item_id` es null, significa que:
- La función `handleToppingsChanged` no está agregando el `orden_item_id` correctamente
- O el `updatedItem.orden_item_id` está undefined en ese momento

### 5. **Fix Approach**
1. Verificar que `updatedItem` tenga `orden_item_id` en `handleToppingsChanged`
2. Asegurar que se pase correctamente al `substitutionDetail`
3. Confirmar que llegue al momento de guardar

## Expected Result
Después del fix:
- Solo UNO de los frijoles debe mostrar la sustitución
- La minuta debe mostrar cada item por separado con sus cambios específicos
- La base de datos debe tener `orden_item_id` no-null

## Test Cases
1. **Caso 1**: 2 Frijoles, cambiar topping solo en el primero
2. **Caso 2**: 2 Frijoles, cambiar topping solo en el segundo
3. **Caso 3**: 3+ productos del mismo tipo, cambiar solo uno

## Success Criteria
✅ Logs muestran `orden_item_id` correcto (no null)
✅ DB tiene `orden_item_id` correcto
✅ Solo el item específico muestra la sustitución
✅ Minuta refleja cambios individuales
✅ No warnings de React keys duplicadas