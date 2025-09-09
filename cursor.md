# Domicilio AI Manager - Guía técnica (cursor.md)

## 1. Overview
Aplicación web en React + TypeScript (Vite) para gestión de pedidos (delivery y pickup) con integración a Supabase (autenticación, base de datos y RLS). Usa React Query para cache/estado remoto, React Router, y un set de UI (Shadcn + Tailwind).

- Punto de entrada: `src/main.tsx` monta `App`.
- Componente raíz: `src/App.tsx` configura ErrorBoundary, React Query, proveedor de Auth y enrutamiento.
- Ruteo: `"/"` protegido por `ProtectedRoute` carga `pages/Index`. Ruta comodín `*` a `pages/NotFound`.

## 2. Arquitectura de Frontend
- Estado remoto: @tanstack/react-query con configuración de reintentos y tiempos de vida.
- Autenticación: Contexto en `hooks/useAuth.tsx` con `supabase.auth`. Enriquecimiento de perfil con `sedes.name`.
- Permisos por rol: `hooks/usePermissions.ts` define roles (`admin`, `administrador_punto`, `agent`) y capacidades.
- Contextos:
  - `SedeContext`: provee `effectiveSedeId` y `currentSedeName` a todo el árbol.
  - `InventoryContext`: emite `lastUpdate` y `triggerUpdate` para invalidaciones locales.
- UI principal: `pages/Index.tsx` orquesta tabs, `StatusBar`, y carga diferida (`lazy`) de `AdminPanel` y `TimeMetricsPage`.

## 3. Enrutamiento y navegación
- `App.tsx` define:
  - `/` → `ProtectedRoute` → `Index`.
  - `*` → `NotFound` (404 con registro a consola).
- `Index.tsx` controla vista principal con tabs: Dashboard, Inventario, Repartidores, (Call Center si permisos), Sede Local. Admin y Métricas se manejan con estado global vía `useAppState` (navegación interna condicional).

## 4. Integración con Supabase
- Cliente: `src/lib/supabase.ts` crea `supabase` a partir de `SUPABASE_CONFIG` en `src/config/api.ts` (lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
- Tipado de tablas: `Database` en `lib/supabase.ts` replica el esquema público con tipos fuertes (platos, bebidas, toppings, relaciones por sede, órdenes, clientes, repartidores, pagos y tablas puente `ordenes_*`).
- Autenticación: `useAuth`
  - Lee sesión inicial, escucha cambios de auth.
  - Carga `profiles` por `id`. Si falta, crea perfil temporal heurístico con `role` y `sede_id` por defecto y lo enriquece con `sedes.name`.
- Seguridad: Se espera RLS en tablas. Hay scripts en raíz para habilitar/diagnosticar RLS.

## 5. Módulos y funcionalidades
- Dashboard (`components/Dashboard.tsx`): métricas/estado de órdenes por sede; consume servicios y/o `useRealtimeOrders`/`useRealtimeMetrics` si aplica.
- Inventario (`components/Inventory.tsx`): gestión de productos (platos/bebidas/toppings), disponibilidad y precios por sede.
- Repartidores (`components/DeliveryPersonnel.tsx`): listado y estado de repartidores, históricos y métricas.
- Call Center (`components/CallCenter.tsx`): captura y administración de órdenes telefónicas. Visible según permisos.
- Sede Local (`components/SedeOrders.tsx`): órdenes y flujo específico de la sede efectiva.
- Panel Admin (`components/AdminPanel.tsx` lazy): configuración avanzada (usuarios, sedes, catálogos, permisos, etc.).
- Métricas de tiempo (`components/TimeMetricsPage.tsx` lazy): panel de tiempos (preparación/entrega) y SLAs.
- Perfil de usuario (`components/UserProfile.tsx`), `StatusBar`, `Loading`, `ErrorBoundary`, `ProtectedRoute`.

## 6. Servicios (src/services)
Los servicios centralizan acceso a datos, transformaciones y reglas de negocio. Principales:
- `menuService.ts`: catálogo de `platos`, `bebidas`, `toppings`, relaciones `plato_toppings` y por sede (`sede_*`), con mapeos a modelos de UI y utilidades de disponibilidad/precio. Punto neurálgico del inventario.
- `sedeOrdersService.ts`: lectura/gestión de órdenes por `sede_id`, joins con `clientes`, `pagos`, `repartidores`, `sedes`, y mapeo a `types/delivery.Order`.
- `dashboardService.ts`: agregaciones para panel principal; puede combinar métricas, estado de capacidad y últimas órdenes.
- `deliveryService.ts`: operaciones relacionadas con repartidores y asignaciones.
- `metricsService.ts`: KPIs de tiempo y rendimiento; puede usar funciones SQL materializadas o vistas.
- `orderStatusService.ts`: transición y validación de estados (`received` → `kitchen` → `delivery` → `delivered/cancelled`), con side-effects (p.ej. horarios/estimados).
- `adminService.ts` y `adminDataLoader.ts`: administración de sedes, usuarios (profiles), roles y datos semilla/cargas iniciales.

Notas de uso:
- Usan `supabase.from(...).select(...)` con composiciones y filtros por `sede_id`.
- Mapean resultados a tipos de `src/types/delivery.ts`.
- Manejan errores/logging y reintentos según `config/api.ts`.

## 7. Hooks clave
- `useAuth`: estado de usuario, perfil y métodos `signIn/signOut/refreshProfile`.
- `usePermissions`: deriva `userRole`, `permissions`, `canAccessResource(resourceSedeId)` e indicadores `isAdmin/isAdministradorPunto/isAgent`.
- Otros hooks (no exhaustivo): `useRealtimeMetrics`, `useRealtimeOrders`, `useMenu`, `useDelivery`, `useDashboard`, `useActiveTab`, `useAppState`, `useAsyncOperation`.

## 8. Datos y modelos (src/types)
- `types/delivery.ts` define `Order`, `OrderItem`, `DeliveryPerson`, `Sede`, enumeraciones (`OrderStatus`, `OrderSource`, `PaymentMethod`, `PaymentStatus`, `DeliveryType`) y modelos de catálogo (`PlatoFuerte`, `Bebida`, `Topping`, etc.).

## 9. Base de datos (Supabase) y relaciones
Tablas principales (resumen):
- `profiles (uuid)`: usuario, `role`, `sede_id` → FK a `sedes`.
- `sedes (uuid)`: sede, capacidad (`current_capacity`, `max_capacity`).
- Catálogo global: `platos (bigint)`, `bebidas (smallint)`, `toppings (int)` y relación `plato_toppings`.
- Catálogo por sede: `sede_platos`, `sede_bebidas`, `sede_toppings` con `available`/`price_override`.
- Órdenes: `ordenes` con `cliente_id`, `sede_id`, `repartidor_id`, `payment_id`, tiempos, estado, `hora_entrega`.
- Entidades relacionadas: `clientes`, `repartidores`, `pagos`.
- Tablas puente: `ordenes_platos`, `ordenes_bebidas`.

Relaciones clave:
- `profiles.sede_id` → `sedes.id`.
- `ordenes.cliente_id` → `clientes.id`.
- `ordenes.repartidor_id` → `repartidores.id`.
- `ordenes.payment_id` → `pagos.id`.
- `ordenes.sede_id` → `sedes.id`.
- `plato_toppings` une `platos` con `toppings` (global) y `sede_*` ajusta disponibilidad/precio por sede.

Scripts SQL en raíz ayudan a:
- Crear usuarios y perfiles (`create_user_*`, `insert-users.sql`).
- Poblar catálogos y sedes (`insert-menu-data.sql`, `insert_sedes_test.sql`, `populate_sede_tables.sql`).
- Depurar RLS y relaciones (`fix-rls.sql`, `fix-menu-rls.sql`, `debug_*`).

## 10. Flujos principales
- Inicio de sesión → `useAuth` obtiene sesión y perfil; `ProtectedRoute` restringe acceso.
- Selección de sede efectiva: `usePermissions` controla visibilidad y acceso. `Index.tsx` mantiene `selectedSedeId` (admins) o `userSedeId`.
- Carga de sedes: `Index.loadSedes()` consulta `sedes` para admins y setea `selectedSedeId` por defecto.
- Carga de órdenes: `Index.loadOrders()` consulta `ordenes` filtradas por `sede_id`, hace left joins (`clientes`, `pagos`, `repartidores`, `sedes`) y mapea a `Order`.
- Inventario: servicios `menuService` + contextos para reflejar disponibilidad y trigger de actualizaciones.
- Métricas: `metricsService` agrega tiempos y estados.

## 11. Permisos y visibilidad
- `admin`: acceso total; ve Call Center, Admin Panel, todas las sedes y métricas globales.
- `administrador_punto`: opera en su `sede_id`; Call Center visible, sin transferir a otras sedes.
- `agent`: vista restringida; no Call Center, no configuraciones, no métricas.

## 12. Operativa y entorno
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` deben estar definidas.
- Construcción/Dev: Vite (`npm run dev`, `npm run build`). Tailwind configurado en `tailwind.config.ts`.
- Notificaciones: `components/ui/toaster` y `ui/sonner` para toasts.

## 13. Notas y gaps detectados
- `Index.loadOrders()` deja TODOs: dirección del cliente, items de orden, origen de pedido.
- Generadores mock (`generateMock*`) se usan como fallback si falta `sede_id`.
- Alinear tipos duplicados de `InventoryItem` en `types/delivery.ts`.
- Revisar RLS y políticas para tablas `sede_*` y `ordenes_*` según roles.

## 14. Referencias rápidas
- Entrada: `src/main.tsx`
- App y ruteo: `src/App.tsx`
- Página principal: `src/pages/Index.tsx`
- Auth: `src/hooks/useAuth.tsx`
- Permisos: `src/hooks/usePermissions.ts`
- Supabase: `src/lib/supabase.ts`, `src/config/api.ts`
- Servicios: `src/services/*`
- Tipos: `src/types/delivery.ts`
- Contextos: `src/contexts/*` 