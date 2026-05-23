import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';

const app = new Hono();
const api = new Hono();
const internal = new Hono();

// Status/Health endpoint
api.get('/health', (c) => {
  return c.json({
    status: 'ok',
    app: 'teamspace',
    timestamp: Date.now()
  });
});

app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});

export { app };
