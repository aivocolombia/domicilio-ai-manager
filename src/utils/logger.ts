type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';
type ConsoleWriter = (...args: unknown[]) => void;
type LegacyLogMethod = (scope: string, message?: unknown, ...meta: unknown[]) => void;

const resolveEnv = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return {
        dev: Boolean(import.meta.env.DEV),
        enableDebug: import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true'
      };
    }
  } catch {
    // ignore when import.meta is not available
  }

  return {
    dev: process.env.NODE_ENV !== 'production',
    enableDebug: process.env.VITE_ENABLE_DEBUG_LOGS === 'true'
  };
};

const env = resolveEnv();
const shouldEmitDebug = env.enableDebug === true;

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  debug: (console.debug || console.log).bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

const noop = () => {
  /* intentionally empty */
};

if (!shouldEmitDebug) {
  console.log = noop as typeof console.log;
  console.info = noop as typeof console.info;
  console.debug = noop as typeof console.debug;
} else {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
}

const buildArgs = (scope: string, args: unknown[]): unknown[] => {
  if (!scope) {
    return args;
  }

  if (args.length === 0) {
    return [`[${scope}]`];
  }

  const [first, ...rest] = args;

  if (typeof first === 'string') {
    return [`[${scope}] ${first}`, ...rest];
  }

  return [`[${scope}]`, first, ...rest];
};

const emit = (writer: ConsoleWriter, scope: string, args: unknown[], guardDebug = false) => {
  if (guardDebug && !shouldEmitDebug) {
    return;
  }
  writer(...buildArgs(scope, args));
};

const legacyEmit = (
  writer: ConsoleWriter,
  scope: string,
  message: unknown,
  meta: unknown[],
  guardDebug = false
) => {
  const args = message === undefined ? meta : [message, ...meta];
  emit(writer, scope, args, guardDebug);
};

export const logDebug: LegacyLogMethod = (scope, message, ...meta) => {
  legacyEmit(originalConsole.debug, scope, message, meta, true);
};

export const logInfo: LegacyLogMethod = (scope, message, ...meta) => {
  legacyEmit(originalConsole.info, scope, message, meta, true);
};

export const logWarn: LegacyLogMethod = (scope, message, ...meta) => {
  legacyEmit(originalConsole.warn, scope, message, meta, true);
};

export const logError: LegacyLogMethod = (scope, message, ...meta) => {
  legacyEmit(originalConsole.error, scope, message, meta);
};

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export const createLogger = (scope: string): Logger => ({
  debug: (...args: unknown[]) => emit(originalConsole.debug, scope, args, true),
  info: (...args: unknown[]) => emit(originalConsole.info, scope, args, true),
  warn: (...args: unknown[]) => emit(originalConsole.warn, scope, args, true),
  error: (...args: unknown[]) => emit(originalConsole.error, scope, args)
});

export const logger = createLogger('App');
