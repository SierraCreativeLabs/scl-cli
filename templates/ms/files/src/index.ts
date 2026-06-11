import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
  return c.json({
    message: 'Hello from your SCL Hono Microservice!',
    projectName: '{{projectName}}',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

const port = Number(process.env.PORT || {{port}});
console.log(`🚀 Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
