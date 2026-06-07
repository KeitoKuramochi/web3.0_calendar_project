import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => c.json({ ok: true }));

app.get('/db-check', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const result = await db.select().from(schema.users);
  return c.json(result);
});

export default app;
