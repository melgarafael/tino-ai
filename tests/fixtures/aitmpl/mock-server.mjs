// Mock HTTP server for aitmpl-client tests.
// Serves only `GET /components.json` (the real endpoint).
//
// Usage:
//   const mock = await startMockServer();
//   mock.baseUrl;            // http://127.0.0.1:<port>
//   mock.setFailMode(true);  // force next requests to 500
//   await mock.stop();
//
// Spike notes: docs/superpowers/specs/2026-04-27-aitmpl-spike-notes.md

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'components.json');

export async function startMockServer() {
  const fixture = await fs.readFile(FIXTURE_PATH, 'utf8');
  let failMode = false;

  const server = http.createServer((req, res) => {
    if (failMode) {
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain');
      res.end('mock: forced failure');
      return;
    }
    if (req.method === 'GET' && req.url === '/components.json') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(fixture);
      return;
    }
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain');
    res.end('not found');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    setFailMode(v) { failMode = !!v; },
    async stop() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
