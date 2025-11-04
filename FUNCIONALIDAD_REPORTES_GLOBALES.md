# 📊 Funcionalidad: Sistema de Reportes Globales (Excel y PDF)

## Problema Resuelto

Antes, los administradores no tenían forma de exportar métricas consolidadas para análisis externo o presentaciones ejecutivas. Debían:
1. ❌ Tomar screenshots de las métricas
2. ❌ Copiar datos manualmente a Excel
3. ❌ Crear reportes desde cero en otros programas
4. ❌ No había formato profesional para presentar a gerencia

Ahora, pueden **generar reportes completos y profesionales** con un solo clic.

## ✨ Nueva Funcionalidad

### Qué hace
Genera reportes comprehensivos a nivel global con dos formatos:
- **Reporte Excel**: Múltiples hojas con análisis detallado y datos tabulados
- **Reporte PDF**: Documento profesional con diseño visual atractivo

### Cuándo se puede usar
✅ Disponible en la sección **"Métricas"** del AdminPanel
✅ Requiere que haya datos cargados (botón deshabilitado si no hay métricas)
✅ Respeta los filtros actuales (fechas y sede seleccionada)

### Quién puede usarlo
✅ **admin_global**: Puede generar reportes de todas las sedes o sedes específicas
✅ **admin_punto**: Genera reportes solo de su sede asignada

## 🎯 Contenido de los Reportes

### Reporte Excel - Estructura de Hojas

#### Hoja 1: Resumen General
- Título del reporte
- Período del reporte (fecha inicio - fecha fin)
- Fecha de generación
- **Métricas clave:**
  - Total de Ventas
  - Total Ingresos
  - Total Cancelados
  - Tasa de Cancelación
  - Monto Perdido por Cancelaciones
  - Total Descuentos Aplicados
  - Monto Total Descuentos

#### Hoja 2: Análisis de Tiempos
- Tiempo promedio por etapa:
  - Recibo → Cocina
  - Cocina → Camino
  - Camino → Entrega
  - Total Promedio

#### Hoja 3: Análisis de Cancelaciones
- Total cancelados
- Tasa de cancelación
- Monto perdido
- **Tabla de causales:**
  - Motivo
  - Cantidad
  - Porcentaje

#### Hoja 4: Análisis de Descuentos
- Total descuentos
- Monto total
- **Tabla de causales:**
  - Razón
  - Cantidad
  - Monto Total

#### Hoja 5: Análisis de Ventas por Producto
- **Tabla completa:**
  - Producto
  - Cantidad Vendida
  - Valor Total
- Total general al final

#### Hoja 6: Métricas por Sede
- **Tabla comparativa:**
  - Nombre de Sede
  - Total Pedidos
  - Total Ingresos
  - Pedidos Cancelados
  - Tasa de Cancelación

### Reporte PDF - Diseño Profesional

#### Página 1: Resumen Ejecutivo
- **Header elegante:**
  - Título principal con fondo azul
  - Rango de fechas del reporte

- **Tarjetas de Métricas Principales:**
  - Total Ventas (verde)
  - Ingresos Totales (azul)
  - Tasa Cancelación (rojo)

- **Segunda Fila de Métricas:**
  - Pedidos Cancelados (rojo)
  - Monto Perdido (naranja)
  - Total Descuentos (naranja)

- **Tabla: Análisis de Tiempos**
  - Tema rayado con header morado
  - Tiempos por etapa en minutos

#### Página 2: Análisis Detallado
- **Tabla: Análisis de Cancelaciones**
  - Header rojo
  - Motivos con cantidades y porcentajes

- **Tabla: Análisis de Descuentos**
  - Header naranja
  - Top 10 razones de descuentos

#### Página 3: Ventas y Comparativas
- **Tabla: Top 10 Productos Más Vendidos**
  - Header verde
  - Cantidad y valor total por producto

- **Tabla: Comparativa por Sede**
  - Header azul
  - Formato de grid
  - Alineación de números a la derecha
  - Cantidades abreviadas (ej: $123k)

#### Pie de Página (todas las páginas)
- Fecha de generación
- Número de página (X de Y)

## 🎨 UI/UX

### Ubicación de los Botones
Los botones están en la sección de **Métricas**, justo después del botón "Actualizar":

```
┌────────────────────────────────────────────────┐
│  [Filtros de fecha]  [Filtro sede]            │
│                                                │
│  [Actualizar]  [Reporte Excel]  [Reporte PDF] │
└────────────────────────────────────────────────┘
```

### Diseño de Botones

**Botón Excel:**
- Borde verde (`border-green-300`)
- Hover con fondo verde claro (`hover:bg-green-50`)
- Icono: `FileSpreadsheet` (verde)
- Texto: "Reporte Excel"
- Loading: "Generando..." con spinner

**Botón PDF:**
- Borde rojo (`border-red-300`)
- Hover con fondo rojo claro (`hover:bg-red-50`)
- Icono: `FileText` (rojo)
- Texto: "Reporte PDF"
- Loading: "Generando..." con spinner

### Estados de los Botones

**Habilitado:**
- Borde de color
- Hover muestra fondo de color claro
- Icono y texto visibles

**Deshabilitado:**
- Cuando no hay datos de métricas cargados
- Cuando ya se está generando un reporte
- Apariencia atenuada

**Loading:**
- Spinner animado
- Texto cambia a "Generando..."
- Botón deshabilitado mientras procesa

### Notificaciones (Toasts)

**Éxito:**
```
✅ Reporte Excel Generado
El reporte ha sido descargado exitosamente
```

```
✅ Reporte PDF Generado
El reporte ha sido descargado exitosamente
```

**Error:**
```
❌ Error
No se pudo generar el reporte Excel/PDF. Por favor, intenta nuevamente.
```

## 📋 Flujo de Uso

### Paso a Paso

1. **Ir a Métricas**
   - Click en el botón "Métricas" en el menú lateral
   - Ver que las métricas se carguen

2. **Configurar Filtros**
   - Seleccionar rango de fechas deseado
   - Seleccionar sede (o "Todas las sedes" para admin_global)
   - Click en "Actualizar" para cargar métricas

3. **Generar Reporte Excel**
   - Click en botón "Reporte Excel" (verde)
   - Esperar mientras se genera (spinner)
   - Ver toast de confirmación
   - Archivo se descarga automáticamente

4. **Generar Reporte PDF**
   - Click en botón "Reporte PDF" (rojo)
   - Esperar mientras se genera (spinner)
   - Ver toast de confirmación
   - Archivo se descarga automáticamente

### Nombres de Archivos

Los archivos se descargan con nombres automáticos:

**Excel:**
```
reporte-metricas-2025-01-15-2025-01-31.xlsx
```

**PDF:**
```
reporte-metricas-2025-01-15-2025-01-31.pdf
```

Formato: `reporte-metricas-[fecha_inicio]-[fecha_fin].[extension]`

## 🔧 Arquitectura Técnica

### Servicio: `reportService.ts`

**Ubicación:** `src/services/reportService.ts`

**Clase Principal:**
```typescript
export class ReportService {
  async collectReportData(filters: MetricsFilters): Promise<ReportData>
  async generateExcelReport(filters: MetricsFilters): Promise<Blob>
  async generatePDFReport(filters: MetricsFilters): Promise<Blob>
  async downloadExcelReport(filters: MetricsFilters, filename?: string): Promise<void>
  async downloadPDFReport(filters: MetricsFilters, filename?: string): Promise<void>

  // Métodos privados
  private async getCancellationCausals(filters: MetricsFilters)
  private async getAgentMetrics(filters: MetricsFilters)
}
```

**Interfaz de Datos:**
```typescript
export interface ReportData {
  timeMetrics: {
    avgReciboACocina: number
    avgCocinaACamino: number
    avgCaminoAEntrega: number
    avgTotalPromedio: number
  }

  cancellationMetrics: {
    totalCancelados: number
    tasaCancelacion: number
    montoPerdido: number
    causales: Array<{ motivo: string; cantidad: number; porcentaje: number }>
  }

  discountMetrics: {
    totalDescuentos: number
    montoTotalDescuentos: number
    causales: Array<{ razon: string; cantidad: number; monto: number }>
  }

  salesMetrics: {
    volumenVenta: Array<{ producto: string; cantidad: number; valor: number }>
    totalVentas: number
    totalIngresos: number
  }

  sedesMetrics: Array<{
    nombre: string
    totalPedidos: number
    totalIngresos: number
    cancelados: number
    tasaCancelacion: number
    avgTiempoEntrega: number
  }>

  agentMetrics: Array<{
    nombre: string
    totalOrdenes: number
    sede: string
  }>

  reportInfo: {
    fechaInicio: string
    fechaFin: string
    fechaGeneracion: string
  }
}
```

### Integración en AdminPanel

**Imports:**
```typescript
import { reportService } from '@/services/reportService'
import { FileText, FileSpreadsheet } from 'lucide-react'
```

**Estados:**
```typescript
const [isGeneratingExcelReport, setIsGeneratingExcelReport] = useState(false)
const [isGeneratingPDFReport, setIsGeneratingPDFReport] = useState(false)
```

**Handlers:**
```typescript
const handleDownloadExcelReport = async () => { ... }
const handleDownloadPDFReport = async () => { ... }
```

### Dependencias Instaladas

**Para Excel:**
```json
"xlsx": "^0.18.5"
```

**Para PDF:**
```json
"jspdf": "^2.5.2",
"jspdf-autotable": "^3.8.4"
```

## 📊 Recopilación de Datos

El servicio recopila datos de múltiples fuentes en paralelo:

```typescript
const [
  phaseStats,           // Tiempos por fase
  cancelledMetrics,     // Métricas de cancelaciones
  discountMetrics,      // Métricas de descuentos
  productMetrics,       // Productos más vendidos
  sedeMetrics,          // Métricas por sede
  dashboardMetrics,     // Métricas generales
] = await Promise.all([
  metricsService.getPhaseTimeStats(filters),
  metricsService.getCancelledOrderMetrics(filters),
  discountService.getDiscountMetrics(...),
  metricsService.getProductMetrics(filters),
  metricsService.getSedeMetrics(filters),
  metricsService.getDashboardMetrics(filters),
])
```

### Queries Optimizadas

El sistema aprovecha las mejoras recientes de paginación automática:
- Obtiene TODOS los registros (no limitado a 1000)
- Paginación transparente en queries grandes
- Sin pérdida de datos en reportes de períodos extensos

## 🎨 Diseño del PDF

### Paleta de Colores

```typescript
const primaryColor: [number, number, number] = [59, 130, 246]    // blue-500
const secondaryColor: [number, number, number] = [139, 92, 246]  // violet-500
const successColor: [number, number, number] = [34, 197, 94]     // green-500
const dangerColor: [number, number, number] = [239, 68, 68]      // red-500
const warningColor: [number, number, number] = [249, 115, 22]    // orange-500
```

### Funciones Auxiliares del PDF

```typescript
// Agregar encabezado con fondo de color
addHeader(title: string)

// Agregar sección con banner de color
addSection(title: string, color: [number, number, number])

// Agregar tarjeta de métrica con borde de color
addMetricCard(label: string, value: string, color: [number, number, number], x: number, width: number)
```

### Configuración de Tablas

Todas las tablas usan `autoTable` con:
- Tema consistente (`striped` o `grid`)
- Headers con colores según contexto
- Márgenes estándar (10mm izquierda/derecha)
- Formato numérico correcto
- Alineación inteligente

## 🧪 Casos de Prueba

### Caso 1: Generar Reporte Excel Global (Exitoso)

```
DADO: Admin global en sección de Métricas con filtro "Todas las sedes" y rango de 1 mes
CUANDO: Click en botón "Reporte Excel"
Y: Esperar a que se genere
ENTONCES:
  - Botón muestra "Generando..." con spinner
  - Toast de éxito aparece
  - Archivo .xlsx se descarga
  - Al abrir Excel:
    - 6 hojas presentes
    - Datos correctos en cada hoja
    - Todas las sedes incluidas
    - Rango de fechas correcto en resumen
```

### Caso 2: Generar Reporte PDF de Sede Específica (Exitoso)

```
DADO: Admin global con filtro de sede "Chapinero" y rango de 1 semana
CUANDO: Click en botón "Reporte PDF"
Y: Esperar a que se genere
ENTONCES:
  - Botón muestra "Generando..." con spinner
  - Toast de éxito aparece
  - Archivo .pdf se descarga
  - Al abrir PDF:
    - 3 páginas con diseño profesional
    - Solo datos de sede Chapinero
    - Colores corporativos correctos
    - Tablas bien formateadas
    - Pie de página con fecha en todas las páginas
```

### Caso 3: Intentar Generar Sin Datos (Bloqueado)

```
DADO: Admin en Métricas sin haber cargado datos (metricsData = null)
CUANDO: Intentar ver los botones de reportes
ENTONCES:
  - Botones están deshabilitados (opacidad reducida)
  - Click no hace nada
  - No se genera error
```

### Caso 4: Error de Red Durante Generación

```
DADO: Admin intenta generar reporte Excel
CUANDO: Ocurre error de red durante la recopilación de datos
ENTONCES:
  - Botón vuelve a estado normal
  - Toast de error aparece:
    "Error - No se pudo generar el reporte Excel. Por favor, intenta nuevamente."
  - No se descarga ningún archivo
  - Usuario puede reintentar
```

### Caso 5: Admin Punto - Filtro Automático

```
DADO: Admin punto con sede asignada "Suba"
CUANDO: Abre sección de Métricas
Y: Genera reporte Excel
ENTONCES:
  - Filtro de sede se configura automáticamente a "Suba"
  - Reporte solo incluye datos de "Suba"
  - No puede cambiar sede (filtro bloqueado)
  - Todas las métricas son específicas de su sede
```

## 🚨 Validaciones Implementadas

### En el Servicio

1. ✅ **Validación de Fechas**
   - Verifica que fecha_inicio y fecha_fin estén presentes
   - Convierte a formato correcto para queries

2. ✅ **Manejo de Datos Vacíos**
   - Retorna arrays vacíos si no hay datos
   - No falla si alguna métrica está vacía
   - Muestra "Sin especificar" en causales sin motivo

3. ✅ **Paginación Automática**
   - Obtiene todos los registros sin límite de 1000
   - Transparente para el usuario

### En el UI

1. ✅ **Botones Deshabilitados**
   - Si no hay metricsData cargado
   - Si ya se está generando un reporte
   - Validación visual clara

2. ✅ **Loading State**
   - Spinner mientras genera
   - Texto cambia a "Generando..."
   - No permite múltiples clics

3. ✅ **Error Handling**
   - Try-catch en ambos handlers
   - Toast de error descriptivo
   - Estado se resetea correctamente

## 📝 Logs y Debugging

### Console Logs (Solo en desarrollo)

```javascript
// Al generar Excel
console.log('Generando reporte Excel...', { filters })

// Al generar PDF
console.log('Generando reporte PDF...', { filters })

// En caso de error
console.error('Error generando reporte Excel:', error)
console.error('Error generando reporte PDF:', error)
```

## 📦 Archivos Creados/Modificados

### Archivos Nuevos

1. **`src/services/reportService.ts`**
   - Servicio completo de generación de reportes
   - Clase ReportService con métodos públicos y privados
   - Interfaces TypeScript para ReportData
   - Generación de Excel con múltiples hojas
   - Generación de PDF con diseño profesional

### Archivos Modificados

1. **`src/components/AdminPanel.tsx`**
   - Import de reportService
   - Import de iconos FileText y FileSpreadsheet
   - Estados isGeneratingExcelReport e isGeneratingPDFReport
   - Handlers handleDownloadExcelReport y handleDownloadPDFReport
   - UI: botones de reportes después del botón Actualizar

2. **`package.json` y `package-lock.json`**
   - Agregadas dependencias: xlsx, jspdf, jspdf-autotable

## ✅ Checklist de Implementación

- [x] Servicio reportService.ts creado
- [x] Método collectReportData implementado
- [x] Método generateExcelReport con 6 hojas
- [x] Método generatePDFReport con diseño profesional
- [x] Métodos de descarga implementados
- [x] Integración en AdminPanel
- [x] Estados de loading agregados
- [x] Handlers de descarga
- [x] UI: botones con iconos y colores
- [x] Validación de datos antes de habilitar botones
- [x] Error handling con toasts
- [x] Build exitoso
- [x] Dependencias instaladas
- [x] Documentación completa

## 🚀 Próximos Pasos / Mejoras Futuras

### Posibles Mejoras

1. **Gráficos en PDF**
   - Agregar chart.js para generar gráficos
   - Insertar gráficos como imágenes en PDF
   - Gráfico de barras de ventas por día
   - Gráfico circular de cancelaciones por motivo

2. **Más Métricas**
   - Agregar tracking de agentes call center
   - Incluir métricas de repartidores en reportes
   - Estadísticas de tiempos promedio por día de semana
   - Análisis de horarios pico

3. **Personalización**
   - Permitir seleccionar qué secciones incluir
   - Opción de logo personalizado en PDF
   - Plantillas de reporte customizables

4. **Automatización**
   - Programar envío automático de reportes por email
   - Reportes semanales/mensuales automáticos
   - Alertas cuando métricas superen umbrales

5. **Compartir**
   - Botón para enviar reporte por email
   - Generar link público temporal del reporte
   - Exportar a Google Sheets

## 📞 Soporte

### Si el reporte no se descarga

1. Verificar que hay datos de métricas cargados
2. Revisar la consola del navegador para errores
3. Comprobar que el navegador permite descargas
4. Intentar con otro navegador (Chrome recomendado)

### Si faltan datos en el reporte

1. Verificar filtros de fecha y sede
2. Comprobar que existen datos en ese período
3. Revisar permisos del usuario (admin_punto vs admin_global)
4. Refrescar métricas con botón "Actualizar"

---

**Versión:** 1.0.0
**Fecha:** 2025-11-04
**Autor:** Claude Code Assistant
