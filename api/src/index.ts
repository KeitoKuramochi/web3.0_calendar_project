import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, inArray, desc } from 'drizzle-orm';
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
  GEMINI_API_KEY: string;
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
      alternativeStartTime: r.alternativeStartTime ? Math.floor(r.alternativeStartTime.getTime() / 1000) : null,
      alternativeEndTime: r.alternativeEndTime ? Math.floor(r.alternativeEndTime.getTime() / 1000) : null,
      createdAt: Math.floor(r.createdAt.getTime() / 1000),
    };
  });

  return c.json(data);
});

// PATCH /meeting-requests/:id/approve — 承認（先生のみ）
app.patch('/meeting-requests/:id/approve', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userRole = payload.role as string | null;
  if (userRole !== 'teacher') {
    return c.json({ error: 'forbidden: teacher only' }, 403);
  }

  const userId = payload.id as string;
  const requestId = c.req.param('id');
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.meetingRequests)
    .where(eq(schema.meetingRequests.id, requestId));

  if (existing.length === 0) {
    return c.json({ error: 'not_found' }, 404);
  }

  if (existing[0].teacherId !== userId) {
    return c.json({ error: 'forbidden' }, 403);
  }

  await db
    .update(schema.meetingRequests)
    .set({ status: 'approved' })
    .where(eq(schema.meetingRequests.id, requestId));

  return c.json({ ok: true });
});

// PATCH /meeting-requests/:id/reject — 差し戻し（先生のみ）
app.patch('/meeting-requests/:id/reject', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userRole = payload.role as string | null;
  if (userRole !== 'teacher') {
    return c.json({ error: 'forbidden: teacher only' }, 403);
  }

  const userId = payload.id as string;
  const requestId = c.req.param('id');
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.meetingRequests)
    .where(eq(schema.meetingRequests.id, requestId));

  if (existing.length === 0) {
    return c.json({ error: 'not_found' }, 404);
  }

  if (existing[0].teacherId !== userId) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const body = await c.req.json<{ altStartTime: number; altEndTime: number }>();
  if (!body.altStartTime || !body.altEndTime) {
    return c.json({ error: 'altStartTime and altEndTime required' }, 400);
  }

  await db
    .update(schema.meetingRequests)
    .set({
      status: 'waiting_student',
      alternativeStartTime: new Date(body.altStartTime * 1000),
      alternativeEndTime: new Date(body.altEndTime * 1000),
    })
    .where(eq(schema.meetingRequests.id, requestId));

  return c.json({ ok: true });
});

// PATCH /meeting-requests/:id/select-alt — 学生が代替案を選択
app.patch('/meeting-requests/:id/select-alt', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userRole = payload.role as string | null;
  if (userRole !== 'student') {
    return c.json({ error: 'forbidden: student only' }, 403);
  }

  const userId = payload.id as string;
  const requestId = c.req.param('id');
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.meetingRequests)
    .where(eq(schema.meetingRequests.id, requestId));

  if (existing.length === 0) {
    return c.json({ error: 'not_found' }, 404);
  }

  if (existing[0].studentId !== userId) {
    return c.json({ error: 'forbidden' }, 403);
  }

  await db
    .update(schema.meetingRequests)
    .set({
      status: 'pending',
      alternativeStartTime: null,
      alternativeEndTime: null,
    })
    .where(eq(schema.meetingRequests.id, requestId));

  return c.json({ ok: true });
});

// GET /groups/members — 自分のグループのメンバー一覧（認証必須）
// 先生: 学生一覧を返す / 学生: 先生一覧を返す
app.get('/groups/members', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;
  const userRole = payload.role as string | null;
  const db = drizzle(c.env.DB, { schema });

  // 自分が属するグループを取得
  const myMemberships = await db
    .select()
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.userId, userId));

  const groupIds = myMemberships.map((m) => m.groupId);
  if (groupIds.length === 0) {
    return c.json([]);
  }

  // 先生なら学生、学生なら先生を返す
  const targetRole = userRole === 'teacher' ? 'student' : 'teacher';

  const members = await db
    .select()
    .from(schema.groupMembers)
    .where(
      and(
        inArray(schema.groupMembers.groupId, groupIds),
        eq(schema.groupMembers.role, targetRole)
      )
    );

  if (members.length === 0) {
    return c.json([]);
  }

  const memberUserIds = members.map((m) => m.userId);
  const usersData = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, memberUserIds));

  const data = usersData.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));

  return c.json(data);
});

// GET /assignments — 認証済みユーザーの課題一覧
// 先生: 自分が割り当てた課題（学生名付き）
// 学生: 自分の課題（先生名付き）
app.get('/assignments', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;
  const userRole = payload.role as string | null;
  const db = drizzle(c.env.DB, { schema });

  let items: (typeof schema.assignments.$inferSelect)[];

  if (userRole === 'teacher') {
    items = await db
      .select()
      .from(schema.assignments)
      .where(eq(schema.assignments.teacherId, userId));
  } else {
    items = await db
      .select()
      .from(schema.assignments)
      .where(eq(schema.assignments.studentId, userId));
  }

  if (items.length === 0) {
    return c.json([]);
  }

  // 関連ユーザー情報を取得
  const relatedUserIds = [
    ...new Set([
      ...items.map((a) => a.studentId),
      ...items.map((a) => a.teacherId),
    ]),
  ];
  const usersData = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, relatedUserIds));
  const userMap = new Map(usersData.map((u) => [u.id, u]));

  const data = items.map((a) => ({
    id: a.id,
    groupId: a.groupId,
    studentId: a.studentId,
    studentName: userMap.get(a.studentId)?.name ?? '学生',
    teacherId: a.teacherId,
    teacherName: userMap.get(a.teacherId)?.name ?? '先生',
    title: a.title,
    dueDate: Math.floor(a.dueDate.getTime() / 1000),
    status: a.status,
    createdAt: Math.floor(a.createdAt.getTime() / 1000),
  }));

  return c.json(data);
});

// POST /assignments — 課題追加（先生のみ）
app.post('/assignments', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userRole = payload.role as string | null;
  if (userRole !== 'teacher') {
    return c.json({ error: 'forbidden: teacher only' }, 403);
  }

  const teacherId = payload.id as string;
  const body = await c.req.json<{ studentId: string; title: string; dueDate: number }>();

  if (!body.studentId || !body.title || !body.dueDate) {
    return c.json({ error: 'studentId, title and dueDate required' }, 400);
  }

  const db = drizzle(c.env.DB, { schema });

  // 自分が属するグループを取得
  const myMemberships = await db
    .select()
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.userId, teacherId));

  const groupIds = myMemberships.map((m) => m.groupId);
  if (groupIds.length === 0) {
    return c.json({ error: 'no group found' }, 400);
  }

  // 対象学生が同じグループに属しているか確認
  const studentMemberships = await db
    .select()
    .from(schema.groupMembers)
    .where(
      and(
        inArray(schema.groupMembers.groupId, groupIds),
        eq(schema.groupMembers.userId, body.studentId),
        eq(schema.groupMembers.role, 'student')
      )
    );

  if (studentMemberships.length === 0) {
    return c.json({ error: 'student not in group' }, 400);
  }

  const groupId = studentMemberships[0].groupId;
  const assignmentId = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.assignments).values({
    id: assignmentId,
    groupId,
    studentId: body.studentId,
    teacherId,
    title: body.title,
    dueDate: new Date(body.dueDate * 1000),
    status: 'pending',
    createdAt: now,
  });

  return c.json({ id: assignmentId, ok: true });
});

// PATCH /assignments/:id/done — 完了報告（学生のみ）
app.patch('/assignments/:id/done', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userRole = payload.role as string | null;
  if (userRole !== 'student') {
    return c.json({ error: 'forbidden: student only' }, 403);
  }

  const userId = payload.id as string;
  const assignmentId = c.req.param('id');
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.assignments)
    .where(eq(schema.assignments.id, assignmentId));

  if (existing.length === 0) {
    return c.json({ error: 'not_found' }, 404);
  }

  if (existing[0].studentId !== userId) {
    return c.json({ error: 'forbidden' }, 403);
  }

  await db
    .update(schema.assignments)
    .set({ status: 'done' })
    .where(eq(schema.assignments.id, assignmentId));

  return c.json({ ok: true });
});

// POST /chat — Gemini Flash 2.0 チャット（認証必須）
app.post('/chat', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;
  const userRole = payload.role as string | null;

  const body = await c.req.json<{
    messages: { role: 'user' | 'model'; content: string }[];
  }>();

  if (!body.messages || body.messages.length === 0) {
    return c.json({ error: 'messages required' }, 400);
  }

  const db = drizzle(c.env.DB, { schema });

  // memoryテーブルからユーザーのmemoryを取得
  const memoryRecord = await db
    .select()
    .from(schema.memory)
    .where(eq(schema.memory.userId, userId))
    .get();

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  let systemText = memoryRecord
    ? `研究室の進捗管理ボットです。以下はこのユーザーについての記録です:\n${memoryRecord.data}\n\n今日は${today}です。日本語で簡潔に回答してください。`
    : `研究室の進捗管理ボットです。先生と学生のコミュニケーションをサポートします。今日は${today}です。日本語で簡潔に回答してください。`;

  // 先生ロールの場合: 空き枠操作のsystemInstructionを追加
  if (userRole === 'teacher') {
    systemText += `

あなたは先生の空き枠管理もサポートします。
空き枠の操作が必要な場合、返答の**先頭**に以下のJSON（1行）を含めてください：
- 追加: {"action":"add_slot","startTime":"YYYY-MM-DDTHH:mm","endTime":"YYYY-MM-DDTHH:mm"}
- 削除: {"action":"delete_slot","date":"YYYY-MM-DD","startHour":14}
- 確認が必要: JSONなし（テキストのみ）

JSONの後に改行し、ユーザーへの日本語メッセージを続けてください。
曖昧な表現（「来週後半のどこか」など具体的な日時が特定できない場合）はJSONを含めずに確認してください。
日時は必ずISO 8601形式（YYYY-MM-DDTHH:mm）で記述してください。今日の日付を基準に計算してください。`;
  }

  // userメッセージをGemini呼び出し前にchatLogへ保存
  const lastUserMessage = body.messages[body.messages.length - 1];
  const userLogId = crypto.randomUUID();
  const userLogTime = new Date();
  if (lastUserMessage && lastUserMessage.role === 'user') {
    await db.insert(schema.chatLog).values({
      id: userLogId,
      userId,
      role: 'user',
      content: lastUserMessage.content,
      createdAt: userLogTime,
    });
  }

  const apiKey = c.env.GEMINI_API_KEY;
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const geminiBody = {
    contents: body.messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    systemInstruction: {
      parts: [{ text: systemText }],
    },
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Gemini API error:', errText);
    return c.json({ error: 'gemini_api_error' }, 500);
  }

  const data = await res.json<{
    candidates?: {
      content?: { parts?: { text?: string }[] };
    }[];
  }>();

  const rawReply =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? '返答を取得できませんでした';

  // 先生ロールの場合: 返答の先頭からJSONアクションをパースして空き枠操作を実行
  let actionName: string | null = null;
  let displayReply = rawReply;

  if (userRole === 'teacher') {
    const lines = rawReply.split('\n');
    const firstLine = lines[0].trim();

    type SlotAction =
      | { action: 'add_slot'; startTime: string; endTime: string }
      | { action: 'delete_slot'; date: string; startHour: number };

    let parsedAction: SlotAction | null = null;
    try {
      const parsed = JSON.parse(firstLine) as SlotAction;
      if (
        parsed.action === 'add_slot' ||
        parsed.action === 'delete_slot'
      ) {
        parsedAction = parsed;
      }
    } catch {
      // JSONでなければスキップ
    }

    if (parsedAction !== null) {
      displayReply = lines.slice(1).join('\n').trim();
      actionName = parsedAction.action;

      if (parsedAction.action === 'add_slot') {
        const start = new Date(parsedAction.startTime);
        const end = new Date(parsedAction.endTime);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          await db.insert(schema.slots).values({
            id: crypto.randomUUID(),
            teacherId: userId,
            startTime: start,
            endTime: end,
            createdAt: new Date(),
          });
        }
      } else if (parsedAction.action === 'delete_slot') {
        const targetDate = new Date(parsedAction.date);
        const existing = await db
          .select()
          .from(schema.slots)
          .where(eq(schema.slots.teacherId, userId));
        const toDelete = existing.filter((s) => {
          const d = new Date(s.startTime.getTime());
          return (
            d.toDateString() === targetDate.toDateString() &&
            d.getHours() === parsedAction.startHour
          );
        });
        for (const s of toDelete) {
          await db.delete(schema.slots).where(eq(schema.slots.id, s.id));
        }
      }
    }
  }

  const reply = displayReply;

  // Gemini成功時: assistantの返答もchatLogに保存
  if (lastUserMessage && lastUserMessage.role === 'user') {
    await db.insert(schema.chatLog).values({
      id: crypto.randomUUID(),
      userId,
      role: 'assistant',
      content: reply,
      createdAt: new Date(userLogTime.getTime() + 1),
    });
  }

  return c.json({ reply, action: actionName });
});

// GET /chat/history — 直近20件の会話履歴（認証必須）
app.get('/chat/history', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;
  const db = drizzle(c.env.DB, { schema });

  const rows = await db
    .select()
    .from(schema.chatLog)
    .where(eq(schema.chatLog.userId, userId))
    .orderBy(desc(schema.chatLog.createdAt))
    .limit(20);

  // 古い順に並び替えて返す
  const history = rows.reverse().map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: Math.floor(r.createdAt.getTime() / 1000),
  }));

  return c.json(history);
});

// POST /chat/end-session — 会話終了・memory更新（認証必須）
app.post('/chat/end-session', async (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const payload = await verifySession(token, c.env.SESSION_SECRET);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  const userId = payload.id as string;
  const db = drizzle(c.env.DB, { schema });

  // chatLogから直近30件を取得
  const rows = await db
    .select()
    .from(schema.chatLog)
    .where(eq(schema.chatLog.userId, userId))
    .orderBy(desc(schema.chatLog.createdAt))
    .limit(30);

  if (rows.length === 0) {
    return c.json({ ok: true });
  }

  const historyText = rows
    .reverse()
    .map((r) => `${r.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${r.content}`)
    .join('\n');

  const apiKey = c.env.GEMINI_API_KEY;
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const summaryBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `以下の会話履歴を要約してください。ユーザーの特徴・相談パターン・重要事項をJSON形式のテキストで返してください。\n\n会話履歴:\n${historyText}`,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [
        {
          text: '会話履歴を分析してユーザーの特徴をJSONで要約するアシスタントです。',
        },
      ],
    },
    generationConfig: {
      maxOutputTokens: 512,
      temperature: 0.3,
    },
  };

  const summaryRes = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(summaryBody),
  });

  if (!summaryRes.ok) {
    // フォールバック: chatLogのテキストをそのままmemory.dataに保存（2000文字まで）
    const fallbackData = JSON.stringify({ summary: historyText.slice(0, 2000) });
    const fallbackNow = new Date();
    await db
      .insert(schema.memory)
      .values({
        id: crypto.randomUUID(),
        userId,
        data: fallbackData,
        updatedAt: fallbackNow,
      })
      .onConflictDoUpdate({
        target: schema.memory.userId,
        set: { data: fallbackData, updatedAt: fallbackNow },
      });
    return c.json({ ok: true });
  }

  const summaryData = await summaryRes.json<{
    candidates?: {
      content?: { parts?: { text?: string }[] };
    }[];
  }>();

  const summaryText =
    summaryData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!summaryText) {
    return c.json({ ok: true });
  }

  const now = new Date();

  // memoryテーブルにupsert（userId唯一）
  await db
    .insert(schema.memory)
    .values({
      id: crypto.randomUUID(),
      userId,
      data: summaryText,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.memory.userId,
      set: {
        data: summaryText,
        updatedAt: now,
      },
    });

  return c.json({ ok: true });
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
