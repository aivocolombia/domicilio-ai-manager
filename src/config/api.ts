// Configuración de Supabase

export const SUPABASE_CONFIG = {
  // URL de Supabase
  URL: import.meta.env.VITE_SUPABASE_URL,
  
  // Clave anónima para el cliente
  ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  
  // Timeout para las peticiones (en milisegundos)
  TIMEOUT: 10000,
  
  // Configuración de reintentos
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000, // milisegundos
  },
} as const;

// Debug: Verificar variables de entorno
console.log('Supabase configurado:', !!SUPABASE_CONFIG.URL && !!SUPABASE_CONFIG.ANON_KEY);

// Nombres de las tablas en Supabase
export const TABLES = {
  PLATOS: 'platos',
  TOPPINGS: 'toppings',
  PLATO_TOPPINGS: 'plato_toppings',
  BEBIDAS: 'bebidas',
} as const;

// Tipos de error de la API
export enum API_ERROR_TYPES {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Clase para manejar errores de la API
export class APIError extends Error {
  public type: API_ERROR_TYPES;
  public status?: number;
  public code?: string;

  constructor(
    message: string,
    type: API_ERROR_TYPES = API_ERROR_TYPES.UNKNOWN_ERROR,
    status?: number,
    code?: string
  ) {
    super(message);
    this.name = 'APIError';
    this.type = type;
    this.status = status;
    this.code = code;
  }
}

// Función para crear un error de API basado en la respuesta
export const createAPIError = (response: Response, message?: string): APIError => {
  const status = response.status;
  let type: API_ERROR_TYPES;
  let errorMessage: string;

  if (status >= 500) {
    type = API_ERROR_TYPES.SERVER_ERROR;
    errorMessage = message || 'Error del servidor';
  } else if (status >= 400) {
    type = API_ERROR_TYPES.CLIENT_ERROR;
    errorMessage = message || 'Error de cliente';
  } else {
    type = API_ERROR_TYPES.UNKNOWN_ERROR;
    errorMessage = message || 'Error desconocido';
  }

  return new APIError(errorMessage, type, status);
}; 