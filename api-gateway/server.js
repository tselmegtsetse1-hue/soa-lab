require('dotenv').config();
const http = require('http');
const https = require('https');
const express = require('express');
const morgan = require('morgan');
const Redis = require('ioredis');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5000;
const JSON_SERVICE_URL = process.env.JSON_SERVICE_URL || 'http://127.0.0.1:3000';
const SOAP_SERVICE_URL = process.env.SOAP_SERVICE_URL || 'http://127.0.0.1:4000';
const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://127.0.0.1:3001';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '60', 10);

const redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1
});

redis.on('connect', () => console.log('✓ Redis connected:', REDIS_URL));
redis.on('error', (e) => console.error('Redis error:', e.message));

app.use(morgan('dev'));
// Do not parse SOAP/XML (or multipart file) bodies as JSON — avoids 400 on POST /api/soap/*
const jsonParser = express.json();
app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api/soap') || req.originalUrl.startsWith('/api/files')) {
        return next();
    }
    jsonParser(req, res, next);
});

function cacheKey(req) {
    return `gw:${req.method}:${req.originalUrl}`;
}

async function cacheGet(req, res, next) {
    if (req.method !== 'GET' || !req.originalUrl.startsWith('/api/users')) return next();
    try {
        const key = cacheKey(req);
        const cached = await redis.get(key);
        if (!cached) return next();

        const data = JSON.parse(cached);
        console.log(`[Cache Hit] ${req.originalUrl}`);
        res.set('X-Cache', 'HIT');
        return res.status(200).json(data);
    } catch (e) {
        console.error('Cache read failed:', e.message);
        return next();
    }
}

async function invalidateUsersCache() {
    try {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'gw:GET:/api/users*', 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length) await redis.del(keys);
        } while (cursor !== '0');
        console.log('[Cache Invalidate] /api/users*');
    } catch (e) {
        console.error('Cache invalidate failed:', e.message);
    }
}

const usersProxy = createProxyMiddleware({
    target: JSON_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    selfHandleResponse: true,
    onProxyReq: (proxyReq, req) => {
        if (req.headers.authorization) {
            proxyReq.setHeader('Authorization', req.headers.authorization);
        }
    },
    onProxyRes: responseInterceptor(async (buffer, proxyRes, req, res) => {
        const bodyText = buffer.toString('utf8');
        const isJson = (proxyRes.headers['content-type'] || '').includes('application/json');
        let payload = bodyText;

        if (isJson) {
            try {
                payload = JSON.parse(bodyText);
            } catch (_) {
                payload = bodyText;
            }
        }

        if (req.method === 'GET' && proxyRes.statusCode === 200 && isJson) {
            try {
                await redis.set(cacheKey(req), JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
                console.log(`[Cache Miss] ${req.originalUrl} -> cached ${CACHE_TTL_SECONDS}s`);
                res.set('X-Cache', 'MISS');
            } catch (e) {
                console.error('Cache write failed:', e.message);
            }
        } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            await invalidateUsersCache();
        }

        return typeof payload === 'string' ? payload : JSON.stringify(payload);
    }),
    onError: (err, req, res) => {
        console.error('JSON proxy error:', err.message);
        res.status(502).json({ error: 'JSON service unavailable', message: err.message });
    }
});

// Buffer SOAP body manually. express.raw() skips when type-is decides there is “no body”
// (e.g. missing Content-Length through some proxies), leaving req.body as {} → empty forward → 400.
const SOAP_BODY_LIMIT = parseInt(process.env.SOAP_BODY_LIMIT_BYTES || String(5 * 1024 * 1024), 10);

function bufferSoapBody(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        req.soapPayload = Buffer.alloc(0);
        return next();
    }
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
        total += chunk.length;
        if (total > SOAP_BODY_LIMIT) {
            req.destroy();
            try {
                if (!res.headersSent) res.status(413).send('SOAP body too large');
            } catch (_) {}
            return;
        }
        chunks.push(chunk);
    });
    req.on('end', () => {
        req.soapPayload = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
        next();
    });
    req.on('error', next);
}

function forwardSoapRequest(req, res) {
    const tail = (req.originalUrl || '').startsWith('/api/soap')
        ? req.originalUrl.slice('/api/soap'.length) || '/'
        : req.originalUrl || '/';
    let dest;
    try {
        const base = SOAP_SERVICE_URL.endsWith('/') ? SOAP_SERVICE_URL : `${SOAP_SERVICE_URL}/`;
        dest = new URL(tail.startsWith('/') ? tail.slice(1) : tail, base);
    } catch (e) {
        console.error('SOAP forward URL error:', e.message);
        return res.status(500).send('SOAP forward URL invalid');
    }

    const body = Buffer.isBuffer(req.soapPayload) ? req.soapPayload : Buffer.alloc(0);

    const headers = { ...req.headers };
    delete headers.connection;
    delete headers.trailer;
    delete headers['transfer-encoding'];
    delete headers.upgrade;
    headers.host = dest.host;
    headers['content-length'] = String(Buffer.byteLength(body));

    const isHttps = dest.protocol === 'https:';
    const lib = isHttps ? https : http;
    const destPortNum = dest.port ? Number(dest.port) : isHttps ? 443 : 80;
    const opts = {
        hostname: dest.hostname,
        port: destPortNum,
        path: dest.pathname + dest.search,
        method: req.method,
        headers
    };

    const upstream = lib.request(opts, (upstreamRes) => {
        const outHeaders = { ...upstreamRes.headers };
        delete outHeaders['transfer-encoding'];
        res.writeHead(upstreamRes.statusCode || 502, outHeaders);
        upstreamRes.pipe(res);
    });

    upstream.on('error', (err) => {
        console.error('SOAP forward error:', err.message);
        if (!res.headersSent) {
            res.status(502).send('SOAP service unavailable');
        }
    });

    upstream.end(body.length ? body : undefined);
}

const filesProxy = createProxyMiddleware({
    target: FILE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/files': '' },
    onError: (err, req, res) => {
        console.error('File proxy error:', err.message);
        res.status(502).json({ error: 'File service unavailable', message: err.message });
    }
});

app.get('/health', async (req, res) => {
    let redisOk = false;
    try {
        redisOk = (await redis.ping()) === 'PONG';
    } catch (_) {
        redisOk = false;
    }
    res.json({
        status: 'ok',
        service: 'api-gateway',
        redis: redisOk ? 'connected' : 'disconnected',
        routes: ['/api/users/**', '/api/soap/**', '/api/files/**']
    });
});

app.use('/api/users', cacheGet, usersProxy);
app.use('/api/soap', bufferSoapBody, forwardSoapRequest);
app.use('/api/files', filesProxy);

app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        routes: ['/api/users/**', '/api/soap/**', '/api/files/**']
    });
});

async function start() {
    try {
        await redis.connect();
    } catch (e) {
        console.warn('Redis not connected at startup. Gateway will run without cache until Redis is up.');
    }
    app.listen(PORT, () => {
        console.log(`✓ API Gateway running on port ${PORT}`);
        console.log(`  Users proxy: ${JSON_SERVICE_URL} via /api/users/**`);
        console.log(`  SOAP proxy:  ${SOAP_SERVICE_URL} via /api/soap/**`);
        console.log(`  Files proxy: ${FILE_SERVICE_URL} via /api/files/**`);
    });
}

start().catch((e) => {
    console.error('Gateway startup failed:', e);
    process.exit(1);
});
