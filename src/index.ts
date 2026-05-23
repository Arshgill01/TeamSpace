import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { menu } from './routes/menu.js';
import { triggers } from './routes/triggers.js';

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

internal.route('/menu', menu);
internal.route('/triggers', triggers);

app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});

export { app };
