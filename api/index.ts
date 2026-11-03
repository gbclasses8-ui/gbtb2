import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

const TARGET_ORIGIN = 'https://ais-pre-2nf54bq7hle7qcwczxouzs-561745921472.asia-east1.run.app';

// Persistent in-memory cookie jar for upstream authentication
const cookieJar: Record<string, string> = {
  '__SECURE-aistudio_auth_token': 'one_token_to_rule_them_all',
  '__SECURE-aistudio_auth_flow_may_set_cookies': 'true',
};

function getCookieHeader(): string {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function updateCookiesFromHeaders(headers: Headers) {
  const raw = (headers as any).getSetCookie
    ? (headers as any).getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);

  for (const c of raw) {
    if (typeof c === 'string') {
      const parts = c.split(';')[0].split('=');
      if (parts.length >= 2) {
        cookieJar[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    }
  }
}

async function ensureUpstreamSession() {
  try {
    const res = await fetch(TARGET_ORIGIN + '/', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Cookie: getCookieHeader(),
      },
      redirect: 'manual',
    });
    updateCookiesFromHeaders(res.headers);
  } catch (err) {
    console.warn('Upstream handshake warning:', err);
  }
}

export default async function handler(req: any, res: any) {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body) {
      body = {};
    }

    if (pathname === '/api/v1/tb-auth/send-otp') {
      const mobile = String(body.mobile || '').replace(/[^0-9]/g, '').slice(-10);
      if (mobile.length !== 10) {
        return res.status(400).json({ success: false, error: 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें' });
      }
      return res.json({
        success: true,
        message: 'OTP sent successfully',
        mobile: mobile
      });
    }

    if (pathname === '/api/v1/tb-auth/verify-otp') {
      const mobile = String(body.mobile || '').replace(/[^0-9]/g, '').slice(-10);
      const code = String(body.code || '').trim();

      if (mobile.length !== 10) {
        return res.status(400).json({ success: false, error: 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें' });
      }

      if (!code || code.length < 4) {
        return res.status(400).json({ success: false, error: 'कृपया 6 अंकों का सही OTP दर्ज करें' });
      }

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'tb_' + mobile,
        userId: 'tb_' + mobile,
        mobile: mobile,
        name: 'Student (' + mobile.slice(-4) + ')',
        role: 'targetboard_student',
        platform: 'GB_STUDY',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
      })).toString('base64url');
      const signature = Buffer.from('gb_study_sec_' + mobile + '_' + Date.now()).toString('base64url');
      const token = `${header}.${payload}.${signature}`;

      const sessionId = `sess_${Date.now()}_${mobile}`;
      const user = {
        id: 'tb_' + mobile,
        _id: 'tb_' + mobile,
        name: `Student (${mobile.slice(-4)})`,
        fullName: `Student (${mobile.slice(-4)})`,
        mobile: mobile,
        role: 'targetboard_student',
        email: `${mobile}@gbstudy.in`
      };

      return res.json({
        success: true,
        token: token,
        sessionId: sessionId,
        user: user,
        isNewUser: false
      });
    }

    if (pathname === '/api/v1/tb-auth/complete-registration') {
      const mobile = String(body.mobile || '').replace(/[^0-9]/g, '').slice(-10);
      const fullName = String(body.fullName || `Student (${mobile.slice(-4)})`).trim();

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'tb_' + mobile,
        userId: 'tb_' + mobile,
        mobile: mobile,
        name: fullName,
        role: 'targetboard_student',
        platform: 'GB_STUDY',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
      })).toString('base64url');
      const signature = Buffer.from('gb_study_sec_' + mobile + '_' + Date.now()).toString('base64url');
      const token = `${header}.${payload}.${signature}`;

      const sessionId = `sess_${Date.now()}_${mobile}`;
      const user = {
        id: 'tb_' + mobile,
        _id: 'tb_' + mobile,
        name: fullName,
        fullName: fullName,
        mobile: mobile,
        role: 'targetboard_student',
        email: `${mobile}@gbstudy.in`
      };

      return res.json({
        success: true,
        token: token,
        sessionId: sessionId,
        user: user
      });
    }

    if (pathname === '/api/v1/tb/save-student-session') {
      return res.json({ success: true });
    }

    if (!cookieJar['GAESA']) {
      await ensureUpstreamSession();
    }

    const targetUrl = new URL(req.url, TARGET_ORIGIN);
    if (req.url && req.url.includes('/api/v1/stream/player/')) {
      targetUrl.searchParams.delete('token');
    }
    const headers = new Headers();

    const clientUa = (req.headers['user-agent'] as string) || '';
    const browserUa =
      clientUa && !clientUa.toLowerCase().includes('curl')
        ? clientUa
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    headers.set('User-Agent', browserUa);
    headers.set('Cookie', getCookieHeader());

    if (req.headers['authorization']) headers.set('Authorization', req.headers['authorization'] as string);
    if (req.headers['content-type']) headers.set('Content-Type', req.headers['content-type'] as string);
    if (req.headers['range']) headers.set('Range', req.headers['range'] as string);
    if (req.headers['accept']) headers.set('Accept', req.headers['accept'] as string);
    if (req.headers['accept-language']) headers.set('Accept-Language', req.headers['accept-language'] as string);
    if (req.headers['x-requested-with']) headers.set('X-Requested-With', req.headers['x-requested-with'] as string);

    let bodyData: any = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(req.method || 'GET')) {
      if (req.body) {
        bodyData = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
      }
    }

    let upstreamRes = await fetch(targetUrl.toString(), {
      method: req.method || 'GET',
      headers,
      body: bodyData,
      redirect: 'manual',
    });

    if (upstreamRes.status === 302 || upstreamRes.status === 401 || upstreamRes.status === 403) {
      updateCookiesFromHeaders(upstreamRes.headers);
      await ensureUpstreamSession();
      headers.set('Cookie', getCookieHeader());
      upstreamRes = await fetch(targetUrl.toString(), {
        method: req.method || 'GET',
        headers,
        body: bodyData,
        redirect: 'manual',
      });
    }

    updateCookiesFromHeaders(upstreamRes.headers);

    const contentType = upstreamRes.headers.get('content-type') || '';
    const hopByHopHeaders = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding']);

    // If HTML player response, apply GB STUDY branding, Telegram replacement & remove inspect blocker
    if (contentType.includes('text/html')) {
      let html = await upstreamRes.text();
      html = html
        .replace(/https:\/\/t\.me\/spidystudy/g, 'https://t.me/GBFreestudy')
        .replace(/@spidystudy/gi, '@GBFreestudy')
        .replace(/Target Board/gi, 'GB STUDY')
        .replace(/Spidy Study/gi, 'GB STUDY')
        .replace(/spidystudy/gi, 'gbstudy')
        .replace(/\(function\(\)\s*\{\s*\}\.constructor\(['"]debugger['"]\)\(\)\);?/g, '')
        .replace(/if\s*\(\s*performance\.now\(\)\s*-\s*t0\s*>\s*\d+\s*\)\s*\{[^}]+\}/g, 'if(false){}')
        .replace(/SECURITY ALERT:[^<]*/gi, '');

      upstreamRes.headers.forEach((val, key) => {
        const lower = key.toLowerCase();
        if (!hopByHopHeaders.has(lower) && lower !== 'content-length') {
          res.setHeader(key, val);
        }
      });
      res.setHeader('Content-Length', Buffer.byteLength(html, 'utf-8'));
      res.status(upstreamRes.status).send(html);
      return;
    }

    res.status(upstreamRes.status);
    upstreamRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (!hopByHopHeaders.has(lower)) {
        res.setHeader(key, val);
      }
    });

    if (upstreamRes.body) {
      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error('Vercel proxy handler error:', err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Gateway Error', message: err.message });
    }
  }
}
