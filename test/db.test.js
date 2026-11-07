import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, addDestination, addJob } from './helpers.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getSettings, openDb } from '../src/db.js';

test('defaults are seeded', () => {
  const { db } = setup();
  const s = getSettings(db);
  assert.equal(s.daily_cap, '10');
  assert.equal(s.group_gap_minutes, '20');
  assert.equal(s.model, 'sonnet');
});

test('destinations default to facebook and reject unknown platforms', () => {
  const { db } = setup();
  assert.equal(addDestination(db).platform, 'facebook');
  const d = addDestination(db);
  assert.throws(() => db.prepare("UPDATE destinations SET platform = 'myspace' WHERE id = ?").run(d.id), /CHECK/);
});

test('an older database gains the platform column as facebook', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'autoposter-old-')), 'old.db');
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE destinations(id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
    audience TEXT NOT NULL DEFAULT 'default', enabled INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    INSERT INTO destinations(name, type, url, created_at) VALUES ('G', 'group', 'https://www.facebook.com/groups/g', 't');`);
  old.close();
  const db = openDb(file);
  assert.equal(db.prepare('SELECT platform FROM destinations').get().platform, 'facebook');
});

test('a post goes to a destination at most once', () => {
  const { db } = setup();
  const d = addDestination(db);
  const job = addJob(db, d.id, new Date());
  assert.throws(() => db.prepare('INSERT INTO jobs(post_id, destination_id, scheduled_at) VALUES (?, ?, ?)')
    .run(job.post_id, d.id, new Date().toISOString()), /UNIQUE/);
});

test('invalid type and status are rejected', () => {
  const { db } = setup();
  assert.throws(() => addDestination(db, { type: 'story' }), /CHECK/);
  const d = addDestination(db);
  const job = addJob(db, d.id, new Date());
  assert.throws(() => db.prepare("UPDATE jobs SET status = 'live' WHERE id = ?").run(job.id), /CHECK/);
});

test('an old jobs table is rebuilt to allow awaiting_join, keeping its rows', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { DatabaseSync } = await import('node:sqlite');
  const { openDb } = await import('../src/db.js');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ap-mig-')), 'old.db');
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE destinations(id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
      audience TEXT NOT NULL DEFAULT 'default', enabled INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE posts(id INTEGER PRIMARY KEY, body TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE jobs(id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id), destination_id INTEGER NOT NULL REFERENCES destinations(id),
      scheduled_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','submitted','pending_approval','failed','cancelled','needs_check')),
      attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, result_json TEXT, post_url TEXT, started_at TEXT, finished_at TEXT, UNIQUE(post_id, destination_id));
    INSERT INTO destinations VALUES (1,'G','group','https://www.facebook.com/groups/g','default',1,0,'2026-01-01');
    INSERT INTO posts VALUES (1,'hi','2026-01-01');
    INSERT INTO jobs(post_id,destination_id,scheduled_at,status) VALUES (1,1,'2026-01-01T00:00:00Z','submitted');`);
  old.close();
  const db = openDb(file);
  assert.equal(db.prepare('SELECT status FROM jobs').get().status, 'submitted');
  db.prepare("UPDATE jobs SET status = 'awaiting_join', join_requested_at = '2026-01-02' WHERE id = 1").run();
  assert.equal(db.prepare('SELECT status FROM jobs').get().status, 'awaiting_join');
});
