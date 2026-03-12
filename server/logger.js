const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 1;

function fmt(level, msg, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

export const logger = {
  debug: (msg, meta) => { if (LOG_LEVEL <= 0) console.debug(fmt('debug', msg, meta)); },
  info:  (msg, meta) => { if (LOG_LEVEL <= 1) console.log(fmt('info', msg, meta)); },
  warn:  (msg, meta) => { if (LOG_LEVEL <= 2) console.warn(fmt('warn', msg, meta)); },
  error: (msg, meta) => { if (LOG_LEVEL <= 3) console.error(fmt('error', msg, meta)); },
};
