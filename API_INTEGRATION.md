# Integración de Supabase para el Menú

Este documento describe cómo se ha integrado Supabase para el menú en el frontend, reemplazando los datos hardcodeados.

## Estructura de Archivos

### Tipos (`src/types/menu.ts`)
Contiene todas las interfaces TypeScript para el menú basadas en el esquema de base de datos:

- `Plato` - Platos principales
- `Topping` - Toppings/aderezos
- `Bebida` - Bebidas
- `PlatoConToppings` - Plato con sus toppings incluidos
- `MenuResponse` - Respuesta completa del menú
- Tipos para crear/actualizar productos

### Servicio (`src/services/menuService.ts`)
Clase que maneja todas las operaciones con Supabase:

- Métodos CRUD para platos, bebidas y toppings
- Manejo de errores y timeouts
- Configuración centralizada

### Hook (`src/hooks/useMenu.ts`)
Hook personalizado que proporciona:

- Estado del menú (platos, bebidas, toppings)
- Estados de carga y error
- Métodos para todas las operaciones CRUD
- Actualización automática del estado

### Configuración (`src/config/api.ts`)
Configuración centralizada de Supabase:

- URL y claves de Supabase
- Manejo de errores
- Nombres de tablas

### Utilidades (`src/utils/format.ts`)
Funciones de formateo:

- `formatCurrency()` - Formatea precios en pesos colombianos
- `formatDate()` - Formatea fechas
- `formatPhone()` - Formatea números de teléfono

## Uso en Componentes

### Componente de Inventario Actualizado

El componente `Inventory` ahora usa el hook `useMenu`:

```tsx
import { useMenu } from '@/hooks/useMenu';

export const Inventory: React.FC = () => {
  const {
    platos,
    bebidas,
    toppings,
    loading,
    error,
    updatePlato,
    updateBebida,
    updateTopping,
    clearError
  } = useMenu();

  // El componente maneja automáticamente:
  // - Carga de datos desde la API
  // - Estados de carga y error
  // - Actualización de disponibilidad
  // - Formateo de precios
};
```

### Características Implementadas

1. **Carga Automática**: Los datos se cargan automáticamente al montar el componente
2. **Estados de Carga**: Indicadores visuales durante las peticiones
3. **Manejo de Errores**: Mensajes de error y opción de reintentar
4. **Actualización en Tiempo Real**: Los cambios se reflejan inmediatamente
5. **Formateo de Precios**: Precios formateados en pesos colombianos
6. **Categorización**: Productos organizados por tipo (platos, bebidas, toppings)

## Configuración de Supabase

### Variables de Entorno

Las siguientes variables ya están configuradas en tu proyecto:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_clave_de_servicio_de_supabase
```

### Tablas de Supabase

El sistema usa las siguientes tablas en Supabase:

```
platos           - Platos principales
toppings         - Toppings/aderezos
plato_toppings   - Tabla puente para relación N:M
bebidas          - Bebidas
```

### Operaciones Soportadas

El servicio maneja automáticamente todas las operaciones CRUD:

- **Platos**: Crear, leer, actualizar, eliminar
- **Bebidas**: Crear, leer, actualizar, eliminar  
- **Toppings**: Crear, leer, actualizar, eliminar
- **Relaciones**: Asignar/remover toppings de platos

### Formato de Respuesta

#### GET /api/menu
```json
{
  "platos": [
    {
      "id": 1,
      "name": "Ajiaco Santafereño",
      "description": "Sopa típica colombiana",
      "pricing": 18000,
      "available": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "toppings": [
        {
          "id": 1,
          "name": "Arroz",
          "pricing": 0,
          "available": true,
          "created_at": "2024-01-01T00:00:00Z",
          "updated_at": "2024-01-01T00:00:00Z"
        }
      ]
    }
  ],
  "bebidas": [
    {
      "id": 1,
      "name": "Limonada Natural",
      "pricing": 5000,
      "available": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Migración de Datos Hardcodeados

### Cambios Realizados

1. **Eliminación de datos mock**: Removidos todos los generadores de datos hardcodeados
2. **Actualización de tipos**: Tipos actualizados para coincidir con el esquema de BD
3. **Nuevo sistema de estado**: Uso de hooks personalizados para manejo de estado
4. **Manejo de errores**: Sistema robusto de manejo de errores y estados de carga
5. **Formateo**: Utilidades de formateo para mejor UX

### Componentes Actualizados

- ✅ `Inventory` - Completamente migrado a API real
- ⏳ `CallCenter` - Necesita actualización para usar API
- ⏳ `SedeOrders` - Necesita actualización para usar API
- ⏳ `Dashboard` - Necesita actualización para usar API

## Próximos Pasos

1. **✅ Configuración de Supabase**: Completada
2. **✅ Migración de componentes**: Inventory, CallCenter y SedeOrders completados
3. **⏳ Actualizar Dashboard**: Migrar para usar API real
4. **⏳ Testing**: Agregar tests para el servicio y hook
5. **⏳ Optimización**: Implementar caché y paginación si es necesario
6. **⏳ Autenticación**: Agregar autenticación si es requerida

## Troubleshooting

### Error de Conexión
Si Supabase no está disponible, el componente mostrará un mensaje de error con opción de reintentar.

### Problemas de Autenticación
Verifica que las variables de entorno de Supabase estén correctamente configuradas.

### Timeout
Las peticiones tienen un timeout de 10 segundos. Si Supabase es lento, considera optimizar las consultas.

### Formato de Fechas
Las fechas deben estar en formato ISO 8601 para el correcto formateo en el frontend.

### Permisos de Tabla
Asegúrate de que las políticas de seguridad (RLS) en Supabase permitan las operaciones necesarias. 