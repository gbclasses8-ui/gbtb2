import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const UPSTREAM = 'https://gbstudytb2.vercel.app';

// Middleware for parsing JSON requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to sanitize any text containing "spidy"
function sanitizeText(str: string): string {
  return str
    .replace(/SPIDY\s*STUDY/gi, 'GB STUDY')
    .replace(/Spidy\s*Study/gi, 'GB Study')
    .replace(/spidy\s*study/gi, 'gb study')
    .replace(/SPIDY/g, 'GB')
    .replace(/Spidy/g, 'GB')
    .replace(/spidy/g, 'GB');
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'upgrade',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'te',
  'trailer',
  'proxy-authorization',
  'proxy-authenticate',
  'host',
  'content-length',
]);

// 1. Proxy all /api/* requests to upstream
app.all('/api/*', async (req: Request, res: Response) => {
  try {
    const targetUrl = UPSTREAM + req.originalUrl;
    const reqHeaders: Record<string, string> = {};

    for (const [k, v] of Object.entries(req.headers)) {
      const lower = k.toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(lower) && typeof v === 'string') {
        reqHeaders[k] = v;
      }
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: reqHeaders,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!reqHeaders['content-type']) {
        reqHeaders['content-type'] = 'application/json';
      }
    }

    const upstreamRes = await fetch(targetUrl, fetchOptions);

    res.status(upstreamRes.status);
    upstreamRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(lower) && lower !== 'content-encoding') {
        res.setHeader(key, val);
      }
    });

    const contentType = upstreamRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const text = await upstreamRes.text();
      const sanitized = sanitizeText(text);
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.send(sanitized);
    } else {
      const arrayBuffer = await upstreamRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    }
  } catch (err: any) {
    console.error('API Proxy Error:', err);
    res.status(502).json({ error: 'Proxy upstream failed', message: err?.message });
  }
});

// 2. Batch thumbs fallback proxy if not found locally
app.get('/batch_thumbs/*', async (req: Request, res: Response, next: NextFunction) => {
  const localFile = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(localFile)) {
    return res.sendFile(localFile);
  }
  try {
    const upstreamUrl = UPSTREAM + req.originalUrl;
    const upstreamRes = await fetch(upstreamUrl);
    if (!upstreamRes.ok) return next();
    res.status(upstreamRes.status);
    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());
    // Also cache locally for future fast response
    try {
      fs.mkdirSync(path.dirname(localFile), { recursive: true });
      fs.writeFileSync(localFile, buffer);
    } catch {}
    res.send(buffer);
  } catch {
    next();
  }
});

// 3. Static assets from public
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// 4. In development mode mount Vite; in production serve dist
async function setupVite() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GB STUDY server running at http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
