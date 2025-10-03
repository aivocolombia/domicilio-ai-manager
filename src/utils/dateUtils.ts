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
 * Formatea una fecha para consultas de base de datos
 * Corregido para manejar correctamente la zona horaria de Colombia
 */
export const formatDateForQuery = (date: Date, isEndOfDay: boolean = false): string => {
  // Validar que la fecha sea válida
  if (!date || isNaN(date.getTime())) {
    console.error('❌ formatDateForQuery: Fecha inválida recibida:', date);
    // Usar fecha actual como fallback
    date = new Date();
  }

  // Crear una nueva fecha basada en la fecha de entrada
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  const day = date.getDate();

  // Validar que los valores extraídos sean válidos
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    console.error('❌ formatDateForQuery: Valores de fecha inválidos:', { year, month, day });
    // Usar fecha actual como fallback
    const now = new Date();
    const fallbackYear = now.getFullYear();
    const fallbackMonth = now.getMonth();
    const fallbackDay = now.getDate();

    const targetDate = isEndOfDay
      ? new Date(fallbackYear, fallbackMonth, fallbackDay, 23, 59, 59, 999)
      : new Date(fallbackYear, fallbackMonth, fallbackDay, 0, 0, 0, 0);

    return targetDate.toISOString();
  }

  // Crear fecha en zona horaria local
  let targetDate: Date;
  if (isEndOfDay) {
    // Fin del día: 23:59:59.999
    targetDate = new Date(year, month, day, 23, 59, 59, 999);
  } else {
    // Inicio del día: 00:00:00.000
    targetDate = new Date(year, month, day, 0, 0, 0, 0);
  }

  // Validar que la fecha target sea válida
  if (isNaN(targetDate.getTime())) {
    console.error('❌ formatDateForQuery: targetDate inválida:', targetDate);
    return new Date().toISOString();
  }

  // Crear manualmente la fecha en formato ISO sin conversión automática de zona horaria
  const localYear = targetDate.getFullYear();
  const localMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const localDay = String(targetDate.getDate()).padStart(2, '0');
  const localHour = String(targetDate.getHours()).padStart(2, '0');
  const localMinute = String(targetDate.getMinutes()).padStart(2, '0');
  const localSecond = String(targetDate.getSeconds()).padStart(2, '0');

  // Validar que todos los componentes sean válidos
  if (isNaN(Number(localYear)) || isNaN(Number(localMonth)) || isNaN(Number(localDay))) {
    console.error('❌ formatDateForQuery: Componentes locales inválidos:', { localYear, localMonth, localDay });
    return new Date().toISOString();
  }

  // Formato sin Z para evitar problemas de zona horaria - Colombia UTC-5
  const result = `${localYear}-${localMonth}-${localDay}T${localHour}:${localMinute}:${localSecond}-05:00`;

  console.log(`🔍 formatDateForQuery: ${isEndOfDay ? 'Final' : 'Inicio'} del día`, {
    inputDate: date.toLocaleDateString('es-CO'),
    targetLocal: `${localDay}/${localMonth}/${localYear} ${localHour}:${localMinute}:${localSecond}`,
    result
  });

  return result;
};

/**
 * Crea un rango de fechas para filtros de consulta
 */
export const createDateRangeForQuery = (fromDate: Date, toDate: Date) => {
  // Validar fechas de entrada
  if (!fromDate || isNaN(fromDate.getTime())) {
    console.error('❌ createDateRangeForQuery: fromDate inválida:', fromDate);
    fromDate = new Date(); // Usar hoy como fallback
  }

  if (!toDate || isNaN(toDate.getTime())) {
    console.error('❌ createDateRangeForQuery: toDate inválida:', toDate);
    toDate = new Date(); // Usar hoy como fallback
  }

  console.log('📅 createDateRangeForQuery: Creando rango', {
    fromDate: fromDate.toLocaleDateString('es-CO'),
    toDate: toDate.toLocaleDateString('es-CO')
  });

  const result = {
    fechaInicio: formatDateForQuery(fromDate, false), // Inicio del día
    fechaFin: formatDateForQuery(toDate, true)        // Final del día
  };

  console.log('📅 createDateRangeForQuery: Resultado', result);

  return result;
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