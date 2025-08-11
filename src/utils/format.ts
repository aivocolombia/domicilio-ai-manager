// Utilidades de formateo

/**
 * Formatea un número como moneda colombiana
 * @param amount - Cantidad en pesos (sin decimales)
 * @returns String formateado como moneda
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Formatea un número como moneda sin el símbolo de moneda
 * @param amount - Cantidad en pesos (sin decimales)
 * @returns String formateado con separadores de miles
 */
export const formatNumber = (amount: number): string => {
  return new Intl.NumberFormat('es-CO').format(amount);
};

/**
 * Formatea una fecha en formato legible
 * @param date - Fecha a formatear
 * @returns String formateado
 */
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);
};

/**
 * Formatea una fecha solo con fecha (sin hora)
 * @param date - Fecha a formatear
 * @returns String formateado
 */
export const formatDateOnly = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj);
};

/**
 * Formatea una hora en formato legible
 * @param date - Fecha a formatear
 * @returns String formateado solo con hora
 */
export const formatTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);
};

/**
 * Formatea un número de teléfono colombiano
 * @param phone - Número de teléfono
 * @returns String formateado
 */
export const formatPhone = (phone: string): string => {
  // Remover todos los caracteres no numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Si empieza con 57 (código de país), removerlo
  const withoutCountry = cleaned.startsWith('57') ? cleaned.slice(2) : cleaned;
  
  // Si empieza con 3, es celular
  if (withoutCountry.startsWith('3')) {
    return `${withoutCountry.slice(0, 3)}-${withoutCountry.slice(3, 6)}-${withoutCountry.slice(6, 10)}`;
  }
  
  // Si empieza con 6, es fijo
  if (withoutCountry.startsWith('6')) {
    return `${withoutCountry.slice(0, 1)}-${withoutCountry.slice(1, 4)}-${withoutCountry.slice(4, 8)}`;
  }
  
  // Si no coincide con ningún patrón, devolver como está
  return phone;
}; 