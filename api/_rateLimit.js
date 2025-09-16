// Simple in-memory rate limiter (per-process). For production, prefer Redis.
const store = new Map();

function keyFromReq(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const path = req.url || 'unknown';
  return `${ip}:${path}`;
}

function createRateLimiter({ windowMs, max, keyGenerator }) {
  return function rateLimit(req, res) {
    const key = (keyGenerator || keyFromReq)(req);
    const now = Date.now();
    const rec = store.get(key);
    if (!rec || rec.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (rec.count < max) {
      rec.count += 1;
      return true;
    }
    const retryAfter = Math.max(1, Math.ceil((rec.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too many requests' });
    return false;
  };
}

module.exports = { createRateLimiter };


