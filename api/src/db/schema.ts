import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  googleId: text('google_id').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['teacher', 'student'] }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  joinCode: text('join_code').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const groupMembers = sqliteTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['teacher', 'student'] }).notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
});

export const chatLog = sqliteTable('chat_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const memory = sqliteTable('memory', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id).unique(),
  data: text('data').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const slots = sqliteTable('slots', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id').notNull().references(() => users.id),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const meetingRequests = sqliteTable('meeting_requests', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => users.id),
  teacherId: text('teacher_id').notNull().references(() => users.id),
  slotId: text('slot_id').notNull().references(() => slots.id),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'waiting_student'] }).notNull().default('pending'),
  alternativeStartTime: integer('alt_start_time', { mode: 'timestamp' }),
  alternativeEndTime: integer('alt_end_time', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
