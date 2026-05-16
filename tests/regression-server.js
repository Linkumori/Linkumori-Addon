/**
 * Linkumori regression test server
 *
 * Zero-dependency HTTP server on port 18080 (or $PORT).
 * Returns 200 for every path so tab navigations in the regression suite
 * complete successfully.  The /health endpoint is used by CI to confirm
 * the server is ready before running tests.
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const PORT = parseInt(process.env.PORT || '18080', 10);
const __dirname = dirname(fileURLToPath(import.meta.url));

let suiteStats = null;
try {
    const suite = JSON.parse(readFileSync(join(__dirname, 'regression-suite.json'), 'utf8'));
    const cases = Array.isArray(suite.cases) ? suite.cases : [];
    suiteStats = {
        total: cases.length,
        byDialect: cases.reduce((acc, c) => {
            acc[c.dialect] = (acc[c.dialect] || 0) + 1;
            return acc;
        }, {})
    };
} catch (_) {}

const server = createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check
    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', port: PORT, suite: suiteStats }));
        return;
    }

    // Every other path: just respond 200 so tab navigations complete
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><html><head><title>Regression fixture</title></head><body><p>${url.pathname}</p></body></html>`);
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Regression server listening on http://127.0.0.1:${PORT}`);
});

server.on('error', err => {
    console.error('Server error:', err.message);
    process.exit(1);
});
