/**
 * Utilidades para manejo de fechas en zona horaria de Colombia (UTC-5)
 */

// Zona horaria de Colombia
const COLOMBIA_TIMEZONE = 'America/Bogota';

/**
 * Crea una fecha en zona horaria de Colombia
 */
export const createColombiaDate = (year?: number, month?: number, day?: number, hour: number = 0, minute: number = 0, second: number = 0): Date => {
  if (year !== undefined && month !== undefined && day !== undefined) {
    // Crear fecha específica en zona horaria de Colombia
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    return new Date(dateString);
  }
  return new Date(); // Fecha actual
};

/**
 * Convierte una fecha a string en formato YYYY-MM-DD para consultas de base de datos
 */
export const toDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Obtiene el inicio del día (00:00:00) para una fecha en zona horaria local
 */
export const getStartOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

/**
 * Obtiene el final del día (23:59:59) para una fecha en zona horaria local
 */
export const getEndOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
};

/**
 * Formatea una fecha para consultas de base de datos (inicio del día)
 */
export const formatDateForQuery = (date: Date, isEndOfDay: boolean = false): string => {
  const targetDate = isEndOfDay ? getEndOfDay(date) : getStartOfDay(date);
  
  // IMPORTANTE: Colombia está en UTC-5. Supabase almacena en UTC.
  // Para consultar correctamente, necesitamos ajustar por la diferencia de zona horaria
  const colombiaOffset = -5 * 60; // -5 horas en minutos
  const currentOffset = targetDate.getTimezoneOffset(); // Offset actual del sistema
  const adjustmentMinutes = colombiaOffset - currentOffset;
  
  // Ajustar la fecha por la diferencia de zona horaria
  const adjustedDate = new Date(targetDate.getTime() + (adjustmentMinutes * 60 * 1000));
  
  // Formatear como YYYY-MM-DDTHH:mm:ss.sssZ (con Z para UTC)
  const year = adjustedDate.getUTCFullYear();
  const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
  const hour = String(adjustedDate.getUTCHours()).padStart(2, '0');
  const minute = String(adjustedDate.getUTCMinutes()).padStart(2, '0');
  const second = String(adjustedDate.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
};

/**
 * Crea un rango de fechas para filtros de consulta
 */
export const createDateRangeForQuery = (fromDate: Date, toDate: Date) => {
  return {
    fechaInicio: formatDateForQuery(fromDate, false), // Inicio del día
    fechaFin: formatDateForQuery(toDate, true)        // Final del día
  };
};

/**
 * Obtiene la fecha/hora actual en zona horaria de Colombia
 */
export const getNowInColombia = (): Date => {
  return new Date();
};

/**
 * Formatea una fecha para mostrar en la UI
 */
export const formatDateForDisplay = (date: Date): string => {
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    timeZone: COLOMBIA_TIMEZONE
  });
};

/**
 * Formatea fecha y hora para mostrar en la UI
 */
export const formatDateTimeForDisplay = (date: Date): string => {
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: COLOMBIA_TIMEZONE
  });
};

/**
 * Diagnóstico específico para el filtro "hoy"
 */
export const debugTodayFilter = () => {
  console.log('🔍 === DIAGNÓSTICO FILTRO "HOY" ===');
  
  const now = new Date();
  console.log('⏰ Fecha/hora actual del sistema:');
  console.log('  - Local string:', now.toString());
  console.log('  - ISO string:', now.toISOString());
  console.log('  - Timezone offset:', now.getTimezoneOffset(), 'minutos');
  console.log('  - Fecha local (es-CO):', now.toLocaleDateString('es-CO'));
  console.log('  - Hora local (es-CO):', now.toLocaleTimeString('es-CO'));
  
  const startOfDay = getStartOfDay(now);
  const endOfDay = getEndOfDay(now);
  
  console.log('\n🌅 Inicio del día:');
  console.log('  - Date object:', startOfDay);
  console.log('  - String local:', startOfDay.toString());
  console.log('  - Formatted query:', formatDateForQuery(now, false));
  
  console.log('\n🌇 Final del día:');
  console.log('  - Date object:', endOfDay);
  console.log('  - String local:', endOfDay.toString());
  console.log('  - Formatted query:', formatDateForQuery(now, true));
  
  const range = createDateRangeForQuery(now, now);
  console.log('\n📊 Rango de consulta generado:');
  console.log('  - fechaInicio:', range.fechaInicio);
  console.log('  - fechaFin:', range.fechaFin);
  
  console.log('\n✅ Prueba completada - Revisar logs arriba');
  return range;
};