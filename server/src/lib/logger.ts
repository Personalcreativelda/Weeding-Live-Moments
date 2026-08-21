type LogFields = Record<string, string | number | boolean | null | undefined>;

const REDACTED_KEYS = new Set(['password', 'passwordHash', 'jwt', 'token', 's3SecretKey', 'presignedUrl']);

function sanitize(fields: LogFields = {}): LogFields {
  const clean: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    clean[key] = REDACTED_KEYS.has(key) ? '[redacted]' : value;
  }
  return clean;
}

function write(level: 'info' | 'warn' | 'error', message: string, fields?: LogFields) {
  const entry = { level, message, ...sanitize(fields), timestamp: new Date().toISOString() };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};
