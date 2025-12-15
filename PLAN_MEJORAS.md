# 📋 PLAN DE MEJORAS - DOMICILIO AI MANAGER

**Fecha Inicio**: 2025-12-14
**Estado**: 🟡 EN PROGRESO
**Prioridad**: 🔴 CRÍTICA

---

## ✅ PROGRESO GENERAL

- [x] Auditoría técnica completada
- [ ] Fase 1 - Estabilización (0/5)
- [ ] Fase 2 - Optimización (0/5)
- [ ] Fase 3 - Resiliencia (0/4)

**Progreso Total**: 1/15 tareas completadas (6.7%)

---

## 🚨 FASE 1 - ESTABILIZACIÓN (CRÍTICO - Día 1-5)

### ✅ 1.1 - Arreglar Memory Leak en Realtime
- [ ] Implementar cleanup adecuado en useSharedRealtime
- [ ] Agregar AbortController en useRealtimeMetrics
- [ ] Limitar reconexiones a 5 intentos máximo
- [ ] Agregar cleanup global en App.tsx
- [ ] Testing: Verificar que no hay leaks después de 2 horas de uso

**Archivos a modificar**:
- `src/hooks/useSharedRealtime.ts`
- `src/hooks/useRealtimeMetrics.ts`
- `src/App.tsx`

**Tiempo estimado**: 4 horas
**Impacto**: 🔴 CRÍTICO - Elimina crashes después de 1-2 horas

---

### ✅ 1.2 - Arreglar Race Conditions en Dashboard
- [ ] Crear DashboardRequestQueue class
- [ ] Implementar AbortController en loadDashboardOrders
- [ ] Consolidar múltiples useEffect en uno solo
- [ ] Agregar debouncing en filtros (300ms)
- [ ] Testing: Cambiar filtros rápidamente sin crashes

**Archivos a modificar**:
- `src/hooks/useDashboard.ts`
- `src/components/orders/Dashboard.tsx`

**Tiempo estimado**: 6 horas
**Impacto**: 🔴 CRÍTICO - Elimina estados inconsistentes y requests perdidos

---

### ✅ 1.3 - Implementar Retry Logic en Supabase Client
- [ ] Configurar custom fetch con retry exponencial
- [ ] Agregar manejo de 429 (rate limiting)
- [ ] Configurar realtime params (eventsPerSecond: 10)
- [ ] Agregar X-Client-Info header
- [ ] Testing: Simular pérdida de conexión y verificar recovery

**Archivos a modificar**:
- `src/lib/supabase.ts`

**Tiempo estimado**: 3 horas
**Impacto**: 🔴 CRÍTICO - Previene errores 429 y mejora resiliencia

---

### ✅ 1.4 - Renovación Automática de Token
- [ ] Crear método ensureValidToken()
- [ ] Crear método renewToken()
- [ ] Agregar validación antes de cada request
- [ ] Implementar auto-logout si renovación falla
- [ ] Testing: Verificar renovación 2 horas antes de expirar

**Archivos a modificar**:
- `src/services/customAuthService.ts`
- `src/hooks/useAuth.tsx`

**Tiempo estimado**: 4 horas
**Impacto**: 🟠 ALTO - Previene deslogueos inesperados

---

### ✅ 1.5 - Consolidar useEffect en Componentes Principales
- [ ] Dashboard: Reducir de 12 a 3-4 effects
- [ ] AdminPanel: Reducir de 7 a 2-3 effects
- [ ] SedeOrders: Reducir de 7 a 2-3 effects
- [ ] Crear hook useDataLoader para consolidar lógica
- [ ] Testing: Verificar que no hay loops infinitos

**Archivos a modificar**:
- `src/components/orders/Dashboard.tsx`
- `src/components/metrics/AdminPanel.tsx`
- `src/components/orders/SedeOrders.tsx`
- `src/hooks/useDataLoader.ts` (nuevo)

**Tiempo estimado**: 8 horas
**Impacto**: 🟠 ALTO - Mejora performance significativamente

---

## 🎯 FASE 2 - OPTIMIZACIÓN (Día 6-10)

### 📦 2.1 - Implementar Circuit Breaker Pattern
- [ ] Crear CircuitBreaker class
- [ ] Integrar en DashboardService
- [ ] Integrar en MenuService
- [ ] Integrar en AdminService
- [ ] Configurar fallback a caché

**Archivos a modificar**:
- `src/utils/circuitBreaker.ts` (nuevo)
- `src/services/dashboardService.ts`
- `src/services/menuService.ts`
- `src/services/adminService.ts`

**Tiempo estimado**: 6 horas
**Impacto**: 🟠 ALTO - Degrada elegantemente en caso de errores

---

### 📦 2.2 - Eliminar Console.logs y Usar Logger
- [ ] Migrar customAuthService.ts (29 logs)
- [ ] Migrar dashboardService.ts (41 logs)
- [ ] Migrar menuService.ts (38 logs)
- [ ] Migrar useSharedRealtime.ts (26 logs)
- [ ] Configurar logger para silenciar en producción

**Archivos a modificar**:
- Todos los archivos en `src/services/`
- Todos los archivos en `src/hooks/`
- `src/utils/logger.ts`

**Tiempo estimado**: 4 horas
**Impacto**: 🟡 MEDIO - Mejora performance y seguridad

---

### 📦 2.3 - Optimizar Bundle y Code Splitting
- [ ] Actualizar manualChunks en vite.config.ts
- [ ] Lazy load Dashboard component
- [ ] Lazy load Inventory component
- [ ] Lazy load CRM component
- [ ] Analizar bundle con vite-bundle-visualizer

**Archivos a modificar**:
- `vite.config.ts`
- `src/pages/Index.tsx`

**Tiempo estimado**: 3 horas
**Impacto**: 🟡 MEDIO - Reduce tiempo de carga inicial

---

### 📦 2.4 - Configurar QueryClient con Error Recovery
- [ ] Agregar retry condicional (no retry en 4xx)
- [ ] Agregar onError global
- [ ] Configurar max retry delay a 10s
- [ ] Agregar notificación al usuario en errores 401
- [ ] Testing: Verificar comportamiento en errores

**Archivos a modificar**:
- `src/App.tsx`

**Tiempo estimado**: 2 horas
**Impacto**: 🟡 MEDIO - Mejora UX en errores

---

### 📦 2.5 - Optimizar Cache y Cleanup
- [ ] Cambiar interval de cleanup de 1min a 5min
- [ ] Implementar LRU cache (max 100 entries)
- [ ] Agregar cache stats en DevTools
- [ ] Configurar TTL diferenciado por tipo de dato
- [ ] Testing: Verificar que no hay memory leak en cache

**Archivos a modificar**:
- `src/hooks/useCache.tsx`

**Tiempo estimado**: 3 horas
**Impacto**: 🟡 MEDIO - Reduce overhead de cache

---

## 🛡️ FASE 3 - RESILIENCIA (Día 11-15)

### 🔒 3.1 - Implementar Error Boundaries Específicos
- [ ] ErrorBoundary para Dashboard
- [ ] ErrorBoundary para Inventory
- [ ] ErrorBoundary para AdminPanel
- [ ] ErrorBoundary para CRM
- [ ] Crear componentes de fallback personalizados

**Archivos a modificar**:
- `src/components/layout/ErrorBoundary.tsx`
- Todos los componentes principales

**Tiempo estimado**: 4 horas
**Impacto**: 🟠 ALTO - Previene crashes completos de la app

---

### 🔒 3.2 - Implementar Rate Limiting en Auth
- [ ] Crear AuthRateLimiter class
- [ ] Limitar a 5 intentos por 15 minutos
- [ ] Mostrar mensaje al usuario cuando se bloquea
- [ ] Agregar captcha después de 3 fallos
- [ ] Testing: Verificar protección contra brute force

**Archivos a modificar**:
- `src/services/customAuthService.ts`
- `src/utils/authRateLimiter.ts` (nuevo)

**Tiempo estimado**: 3 horas
**Impacto**: 🟡 MEDIO - Mejora seguridad

---

### 🔒 3.3 - Agregar Monitoring y Error Tracking
- [ ] Configurar Sentry en producción
- [ ] Agregar performance monitoring
- [ ] Configurar source maps para debugging
- [ ] Crear dashboard de métricas
- [ ] Testing: Verificar que errores se reportan correctamente

**Archivos a crear/modificar**:
- `src/config/sentry.ts` (nuevo)
- `src/App.tsx`
- `vite.config.ts`

**Tiempo estimado**: 4 horas
**Impacto**: 🟠 ALTO - Permite detectar problemas en producción

---

### 🔒 3.4 - Implementar Tests Unitarios Críticos
- [ ] Setup Vitest + React Testing Library
- [ ] Tests para customAuthService
- [ ] Tests para dashboardService
- [ ] Tests para useSharedRealtime
- [ ] Tests para useDashboard

**Archivos a crear**:
- `vitest.config.ts`
- `src/services/__tests__/customAuthService.test.ts`
- `src/services/__tests__/dashboardService.test.ts`
- `src/hooks/__tests__/useSharedRealtime.test.ts`
- `src/hooks/__tests__/useDashboard.test.ts`

**Tiempo estimado**: 8 horas
**Impacto**: 🟡 MEDIO - Previene regresiones futuras

---

## 📊 MÉTRICAS DE ÉXITO

### Métricas a Medir:

| Métrica | Antes | Objetivo | Actual |
|---------|-------|----------|--------|
| Memory Usage (idle) | 150 MB | 80 MB | - |
| Memory Usage (2h) | 300+ MB | 120 MB | - |
| Time to Interactive | 3-5s | <2s | - |
| Crash Rate | ~15% | <1% | - |
| API Error Rate | ~10% | <2% | - |
| Console Logs (prod) | 500+ | 0 | - |
| Bundle Size | - | <500KB | - |
| Lighthouse Score | - | >90 | - |

---

## 🚀 QUICK WINS (Implementar HOY)

### Fix 1: Limitar Reconexiones en Realtime (15 min)
```typescript
// src/hooks/useSharedRealtime.ts línea 151
if (this.reconnectAttempts >= this.maxReconnectAttempts) {
  console.error('❌ [SHARED_REALTIME] Máximo de intentos alcanzado. Deteniendo reconexiones.');
  return; // ← Agregar return para detener
}
```

### Fix 2: Cleanup en useRealtimeMetrics (10 min)
```typescript
// src/hooks/useRealtimeMetrics.ts línea 47
useEffect(() => {
  if (!enabled) return;

  const controller = new AbortController(); // ← Agregar

  // ... código existente ...

  return () => {
    controller.abort(); // ← Agregar
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };
}, [enabled, sedeId, handleOrderChange, onMetricsUpdated]);
```

### Fix 3: Debouncing en Dashboard (10 min)
```typescript
// src/components/orders/Dashboard.tsx
const debouncedLoadOrders = useDebouncedCallback(
  (filters: DashboardFilters) => {
    loadDashboardOrders(filters);
  },
  300 // 300ms de debounce
);
```

---

## 📝 NOTAS

- **Prioridad**: Fase 1 es CRÍTICA - debe completarse en 5 días
- **Testing**: Cada fix debe ser probado en entorno local antes de deploy
- **Rollback Plan**: Mantener backup de archivos modificados
- **Comunicación**: Notificar al equipo antes de cada deploy

---

## 🔄 CHANGELOG

### 2025-12-14
- ✅ Auditoría técnica completada
- ✅ Plan de mejoras creado
- 🟡 Iniciando Fase 1

---

**Última actualización**: 2025-12-14
**Próxima revisión**: Cada día al finalizar la jornada
