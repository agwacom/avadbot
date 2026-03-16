/**
 * Tiny Bun.serve for test fixtures
 * Serves HTML files from test/fixtures/ on a random available port
 */

import * as path from 'path';
import * as fs from 'fs';

const FIXTURES_DIR = path.resolve(import.meta.dir, 'fixtures');

export function startTestServer(port?: number): { server: ReturnType<typeof Bun.serve>; url: string } {
  const MAX_RETRIES = 5;
  const MIN_PORT = 10000;
  const MAX_PORT = 60000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const tryPort = port ?? MIN_PORT + Math.floor(Math.random() * (MAX_PORT - MIN_PORT));
    try {
      const server = Bun.serve({
        port: tryPort,
        hostname: '127.0.0.1',
        fetch(req) {
          const url = new URL(req.url);

          // Echo endpoint — returns request headers as JSON
          if (url.pathname === '/echo') {
            const headers: Record<string, string> = {};
            req.headers.forEach((value, key) => { headers[key] = value; });
            return new Response(JSON.stringify(headers, null, 2), {
              headers: { 'Content-Type': 'application/json' },
            });
          }

          let filePath = url.pathname === '/' ? '/basic.html' : url.pathname;

          // Remove leading slash
          filePath = filePath.replace(/^\//, '');
          const fullPath = path.join(FIXTURES_DIR, filePath);

          if (!fs.existsSync(fullPath)) {
            return new Response('Not Found', { status: 404 });
          }

          const content = fs.readFileSync(fullPath, 'utf-8');
          const ext = path.extname(fullPath);
          const contentType = ext === '.html' ? 'text/html' : 'text/plain';

          return new Response(content, {
            headers: { 'Content-Type': contentType },
          });
        },
      });
      return { server, url: `http://127.0.0.1:${server.port}` };
    } catch (e: any) {
      if (port !== undefined || attempt === MAX_RETRIES - 1) throw e;
    }
  }
  throw new Error('Failed to find available port for test server');
}

// If run directly, start and print URL
if (import.meta.main) {
  const { server, url } = startTestServer(9450);
  console.log(`Test server running at ${url}`);
  console.log(`Fixtures: ${FIXTURES_DIR}`);
  console.log('Press Ctrl+C to stop');
}
