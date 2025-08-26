// Logger configurable para desarrollo y producción

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none'

interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enablePersistence: boolean
}

class Logger {
  private config: LoggerConfig
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 4
  }

  constructor(config: LoggerConfig) {
    this.config = config
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.level]
  }

  private formatMessage(level: LogLevel, category: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const baseMessage = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}`
    
    if (data) {
      return `${baseMessage} ${JSON.stringify(data)}`
    }
    return baseMessage
  }

  debug(category: string, message: string, data?: any) {
    if (!this.shouldLog('debug')) return
    
    if (this.config.enableConsole) {
      console.debug(this.formatMessage('debug', category, message, data))
    }
  }

  info(category: string, message: string, data?: any) {
    if (!this.shouldLog('info')) return
    
    if (this.config.enableConsole) {
      console.info(this.formatMessage('info', category, message, data))
    }
  }

  warn(category: string, message: string, data?: any) {
    if (!this.shouldLog('warn')) return
    
    if (this.config.enableConsole) {
      console.warn(this.formatMessage('warn', category, message, data))
    }
  }

  error(category: string, message: string, data?: any) {
    if (!this.shouldLog('error')) return
    
    if (this.config.enableConsole) {
      console.error(this.formatMessage('error', category, message, data))
    }
  }

  setLevel(level: LogLevel) {
    this.config.level = level
  }
}

// Configuración basada en el entorno
const isDevelopment = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development'

export const logger = new Logger({
  level: isDevelopment ? 'debug' : 'warn',
  enableConsole: true,
  enablePersistence: false
})

// Exports de conveniencia para uso directo
export const logDebug = (category: string, message: string, data?: any) => 
  logger.debug(category, message, data)

export const logInfo = (category: string, message: string, data?: any) => 
  logger.info(category, message, data)

export const logWarn = (category: string, message: string, data?: any) => 
  logger.warn(category, message, data)

export const logError = (category: string, message: string, data?: any) => 
  logger.error(category, message, data)