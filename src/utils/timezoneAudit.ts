/**
 * Auditoría y corrección de problemas de zona horaria
 */

import { formatDateForQuery } from './dateUtils';

/**
 * Valida que una fecha de consulta use el formato correcto para Colombia
 */
export const validateQueryDate = (dateString: string): boolean => {
  // Ahora esperamos que termine con 'Z' porque hacemos la conversión correcta a UTC
  if (!dateString.endsWith('Z')) {
    console.warn('⚠️ Zona horaria: Fecha de consulta debería estar en UTC con Z:', dateString);
    return false;
  }
  
  // Verificar formato esperado: YYYY-MM-DDTHH:mm:ssZ
  const validFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(dateString);
  if (!validFormat) {
    console.warn('⚠️ Zona horaria: Formato de fecha incorrecto:', dateString);
    return false;
  }
  
  return true;
};

/**
 * Convierte una fecha UTC a formato local para consultas
 */
export const convertUTCToLocal = (utcDateString: string): string => {
  if (utcDateString.endsWith('Z')) {
    // Remover la Z y usar como fecha local
    const localDate = new Date(utcDateString);
    return formatDateForQuery(localDate);
  }
  return utcDateString;
};

/**
 * Audita los filtros de fecha y los corrige si es necesario
 */
export const auditAndFixDateFilters = (filters: any): any => {
  const fixedFilters = { ...filters };
  
  if (filters.fechaInicio) {
    if (!validateQueryDate(filters.fechaInicio)) {
      console.log('🔧 Corrigiendo fechaInicio:', filters.fechaInicio);
      fixedFilters.fechaInicio = convertUTCToLocal(filters.fechaInicio);
      console.log('✅ Fechas corregida a:', fixedFilters.fechaInicio);
    }
  }
  
  if (filters.fechaFin) {
    if (!validateQueryDate(filters.fechaFin)) {
      console.log('🔧 Corrigiendo fechaFin:', filters.fechaFin);
      fixedFilters.fechaFin = convertUTCToLocal(filters.fechaFin);
      console.log('✅ Fecha corregida a:', fixedFilters.fechaFin);
    }
  }
  
  return fixedFilters;
};

/**
 * Test para verificar que las fechas se están manejando correctamente
 */
export const testTimezoneHandling = () => {
  console.log('🧪 Probando manejo de zona horaria...');
  
  const testDate = new Date('2025-08-25');
  
  // Probar formateo correcto
  const localFormat = formatDateForQuery(testDate, false);
  const localFormatEnd = formatDateForQuery(testDate, true);
  
  console.log('📅 Fecha de prueba:', testDate.toLocaleDateString('es-CO'));
  console.log('🌅 Inicio del día (local):', localFormat);
  console.log('🌅 Final del día (local):', localFormatEnd);
  
  // Validar formato
  const isValidStart = validateQueryDate(localFormat);
  const isValidEnd = validateQueryDate(localFormatEnd);
  
  console.log('✅ Formato válido (inicio):', isValidStart);
  console.log('✅ Formato válido (fin):', isValidEnd);
  
  if (isValidStart && isValidEnd) {
    console.log('🎉 Manejo de zona horaria correcto!');
    return true;
  } else {
    console.error('❌ Problemas con el manejo de zona horaria');
    return false;
  }
};