import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, inArray } from 'drizzle-orm';
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

// POST /groups/create — 研究室作成（先生）
app.post('/groups/create', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;

  const body = await c.req.json<{ name: string }>();
  const name = body.name?.trim();
  if (!name) return c.json({ error: 'name_required' }, 400);

  const db = drizzle(c.env.DB, { schema });
  const now = new Date();

  const joinCode = Math.random().toString(36).slice(2, 10).toUpperCase();
  const groupId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  await db.insert(schema.groups).values({
    id: groupId,
    name,
    createdBy: userId,
    joinCode,
    createdAt: now,
  });

  await db.insert(schema.groupMembers).values({
    id: memberId,
    groupId,
    userId,
    role: 'teacher',
    joinedAt: now,
  });

  await db
    .update(schema.users)
    .set({ role: 'teacher' })
    .where(eq(schema.users.id, userId));

  const newPayload: Record<string, unknown> = {
    ...payload,
    role: 'teacher',
  };
  const newToken = await signSession(newPayload, c.env.SESSION_SECRET);
  setCookie(c, 'session', newToken, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'Lax',
  });

  return c.json({ joinCode });
});

// POST /groups/join — 研究室参加（学生）
app.post('/groups/join', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;

  const body = await c.req.json<{ joinCode: string }>();
  const joinCode = body.joinCode?.trim().toUpperCase();
  if (!joinCode) return c.json({ error: 'join_code_required' }, 400);

  const db = drizzle(c.env.DB, { schema });
  const now = new Date();

  const found = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.joinCode, joinCode));

  if (found.length === 0) {
    return c.json({ error: 'invalid_code' }, 404);
  }

  const group = found[0];
  const memberId = crypto.randomUUID();

  await db.insert(schema.groupMembers).values({
    id: memberId,
    groupId: group.id,
    userId,
    role: 'student',
    joinedAt: now,
  });

  await db
    .update(schema.users)
    .set({ role: 'student' })
    .where(eq(schema.users.id, userId));

  const newPayload: Record<string, unknown> = {
    ...payload,
    role: 'student',
  };
  const newToken = await signSession(newPayload, c.env.SESSION_SECRET);
  setCookie(c, 'session', newToken, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'Lax',
  });

  return c.json({ ok: true });
});

// GET /slots — 自分の空き枠一覧（認証必須）
app.get('/slots', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;
  const db = drizzle(c.env.DB, { schema });

  const result = await db
    .select()
    .from(schema.slots)
    .where(eq(schema.slots.teacherId, userId));

  // startTime/endTime はUnix秒で返す
  const data = result.map((s) => ({
    id: s.id,
    teacherId: s.teacherId,
    startTime: Math.floor(s.startTime.getTime() / 1000),
    endTime: Math.floor(s.endTime.getTime() / 1000),
    createdAt: Math.floor(s.createdAt.getTime() / 1000),
  }));

  return c.json(data);
});

// POST /slots — 空き枠追加（認証必須）
app.post('/slots', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;

  const body = await c.req.json<{ startTime: number; endTime: number }>();
  if (!body.startTime || !body.endTime) {
    return c.json({ error: 'startTime and endTime required' }, 400);
  }

  const db = drizzle(c.env.DB, { schema });
  const now = new Date();
  const slotId = crypto.randomUUID();

  await db.insert(schema.slots).values({
    id: slotId,
    teacherId: userId,
    startTime: new Date(body.startTime * 1000),
    endTime: new Date(body.endTime * 1000),
    createdAt: now,
  });

  return c.json({ id: slotId, ok: true });
});

// GET /teacher/slots — 学生が閲覧できる先生の空き枠一覧（認証必須）
app.get('/teacher/slots', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;
  const db = drizzle(c.env.DB, { schema });

  // 同じgroupに所属する先生のIDをgroupMembersから取得
  const myMemberships = await db
    .select()
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.userId, userId));

  const groupIds = myMemberships.map((m) => m.groupId);
  if (groupIds.length === 0) {
    return c.json([]);
  }

  // 同じグループの先生メンバーを取得
  const teacherMembers = await db
    .select()
    .from(schema.groupMembers)
    .where(
      and(
        inArray(schema.groupMembers.groupId, groupIds),
        eq(schema.groupMembers.role, 'teacher')
      )
    );

  const teacherIds = teacherMembers.map((m) => m.userId);
  if (teacherIds.length === 0) {
    return c.json([]);
  }

  // 先生のスロットを取得
  const result = await db
    .select()
    .from(schema.slots)
    .where(inArray(schema.slots.teacherId, teacherIds));

  // 先生の情報も取得
  const teachers = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, teacherIds));

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  const data = result.map((s) => ({
    id: s.id,
    teacherId: s.teacherId,
    teacherName: teacherMap.get(s.teacherId)?.name ?? '先生',
    startTime: Math.floor(s.startTime.getTime() / 1000),
    endTime: Math.floor(s.endTime.getTime() / 1000),
    createdAt: Math.floor(s.createdAt.getTime() / 1000),
  }));

  return c.json(data);
});

// POST /meeting-requests — 面談リクエスト送信（認証必須・学生のみ）
app.post('/meeting-requests', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userRole = payload.role as string | null;
  if (userRole !== 'student') {
    return c.json({ error: 'forbidden: student only' }, 403);
  }

  const studentId = payload.id as string;
  const body = await c.req.json<{ slotId: string; teacherId: string }>();

  if (!body.slotId || !body.teacherId) {
    return c.json({ error: 'slotId and teacherId required' }, 400);
  }

  const db = drizzle(c.env.DB, { schema });
  const now = new Date();
  const requestId = crypto.randomUUID();

  await db.insert(schema.meetingRequests).values({
    id: requestId,
    studentId,
    teacherId: body.teacherId,
    slotId: body.slotId,
    status: 'pending',
    createdAt: now,
  });

  return c.json({ id: requestId, ok: true });
});

// GET /meeting-requests — 自分に関連するリクエスト一覧（認証必須）
// 先生: 自分宛のリクエスト / 学生: 自分が送ったリクエスト
app.get('/meeting-requests', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;
  const userRole = payload.role as string | null;
  const db = drizzle(c.env.DB, { schema });

  let requests: (typeof schema.meetingRequests.$inferSelect)[];

  if (userRole === 'teacher') {
    requests = await db
      .select()
      .from(schema.meetingRequests)
      .where(eq(schema.meetingRequests.teacherId, userId));
  } else {
    requests = await db
      .select()
      .from(schema.meetingRequests)
      .where(eq(schema.meetingRequests.studentId, userId));
  }

  if (requests.length === 0) {
    return c.json([]);
  }

  // スロット情報を取得
  const slotIds = requests.map((r) => r.slotId);
  const slotsData = await db
    .select()
    .from(schema.slots)
    .where(inArray(schema.slots.id, slotIds));
  const slotMap = new Map(slotsData.map((s) => [s.id, s]));

  // ユーザー情報を取得（学生名・先生名）
  const userIds = [
    ...new Set([
      ...requests.map((r) => r.studentId),
      ...requests.map((r) => r.teacherId),
    ]),
  ];
  const usersData = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, userIds));
  const userMap = new Map(usersData.map((u) => [u.id, u]));

  const data = requests.map((r) => {
    const slot = slotMap.get(r.slotId);
    return {
      id: r.id,
      studentId: r.studentId,
      studentName: userMap.get(r.studentId)?.name ?? '学生',
      teacherId: r.teacherId,
      teacherName: userMap.get(r.teacherId)?.name ?? '先生',
      slotId: r.slotId,
      startTime: slot ? Math.floor(slot.startTime.getTime() / 1000) : null,
      endTime: slot ? Math.floor(slot.endTime.getTime() / 1000) : null,
      status: r.status,
      createdAt: Math.floor(r.createdAt.getTime() / 1000),
    };
  });

  return c.json(data);
});

// DELETE /slots/:id — 空き枠削除（認証必須・自分のものだけ）
app.delete('/slots/:id', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;
  const slotId = c.req.param('id');

  const db = drizzle(c.env.DB, { schema });

  // 自分のスロットか確認
  const existing = await db
    .select()
    .from(schema.slots)
    .where(eq(schema.slots.id, slotId));

  if (existing.length === 0) {
    return c.json({ error: 'not_found' }, 404);
  }

  if (existing[0].teacherId !== userId) {
    return c.json({ error: 'forbidden' }, 403);
  }

  await db.delete(schema.slots).where(eq(schema.slots.id, slotId));

  return c.json({ ok: true });
});

export default app;
