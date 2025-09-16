// Simple in-memory rate limiter for serverless functions. For production,
// prefer a shared store like Redis to rate-limit across instances.

type RateKeyFn = (req: any) => string;

interface RateLimitOptions {
  windowMs: number; // time window in ms
  max: number; // max requests per window per key
  keyGenerator?: RateKeyFn; // derive key from request
}

const keyToHits: Map<string, { count: number; resetAt: number }> = new Map();

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, keyGenerator } = options;
  return function rateLimit(req: any, res: any): boolean {
    const key = (keyGenerator || defaultKeyFromReq)(req);
    const now = Date.now();
    const record = keyToHits.get(key);
    if (!record || record.resetAt <= now) {
      keyToHits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (record.count < max) {
      record.count += 1;
      return true;
    }
    const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    res.setHeader?.('Retry-After', retryAfterSec.toString());
    res.status?.(429).json?.({ error: 'Too many requests' });
    return false;
  };
}

function defaultKeyFromReq(req: any): string {
  const ip = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const path = req.url || 'unknown';
  return `${ip}:${path}`;
}


