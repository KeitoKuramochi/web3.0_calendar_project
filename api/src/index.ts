import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import { signSession, verifySession } from './auth';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const REDIRECT_URI = 'http://localhost:4321/api/auth/callback';

type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
};

type SessionUser = {
  id: string;
  googleId: string;
  name: string;
  email: string;
  picture: string;
  role: 'teacher' | 'student' | null;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => c.json({ ok: true }));

app.get('/db-check', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const result = await db.select().from(schema.users);
  return c.json(result);
});

// GET /auth/login → Google OAuth にリダイレクト
app.get('/auth/login', (c) => {
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
  });
  return c.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

// GET /auth/callback → コード交換 → JWT cookie セット → リダイレクト
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.redirect('/?error=no_code');

  // code → token交換
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return c.redirect('/?error=token_exchange_failed');
  }

  const tokenData = await tokenRes.json<{ access_token: string }>();
  const accessToken = tokenData.access_token;

  // userinfo取得
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    return c.redirect('/?error=userinfo_failed');
  }

  const userInfo = await userRes.json<{
    id: string;
    name: string;
    email: string;
    picture: string;
  }>();

  // D1にユーザー保存（upsert）
  const db = drizzle(c.env.DB, { schema });
  const userId = crypto.randomUUID();
  const now = new Date();

  // 既存ユーザーを検索
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.googleId, userInfo.id));

  let finalUserId: string;
  let userRole: 'teacher' | 'student' | null = null;

  if (existing.length > 0) {
    finalUserId = existing[0].id;
    userRole = existing[0].role ?? null;
  } else {
    await db.insert(schema.users).values({
      id: userId,
      googleId: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      role: null,
      createdAt: now,
    });
    finalUserId = userId;
  }

  // JWT cookie セット
  const sessionPayload: Record<string, unknown> = {
    id: finalUserId,
    googleId: userInfo.id,
    name: userInfo.name,
    email: userInfo.email,
    picture: userInfo.picture,
    role: userRole,
  };

  const token = await signSession(sessionPayload, c.env.SESSION_SECRET);

  setCookie(c, 'session', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'Lax',
  });

  // ロールに応じてリダイレクト
  if (userRole === 'teacher') {
    return c.redirect('/teacher');
  } else if (userRole === 'student') {
    return c.redirect('/student');
  } else {
    return c.redirect('/onboarding');
  }
});

// GET /auth/me → 現在のセッションユーザーを返す
app.get('/auth/me', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) {
    return c.json({ user: null }, 401);
  }

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) {
    return c.json({ user: null }, 401);
  }

  const user: SessionUser = {
    id: payload.id as string,
    googleId: payload.googleId as string,
    name: payload.name as string,
    email: payload.email as string,
    picture: payload.picture as string,
    role: payload.role as 'teacher' | 'student' | null,
  };

  return c.json({ user });
});

// POST /auth/logout → cookie削除
app.post('/auth/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ ok: true });
});

export default app;
