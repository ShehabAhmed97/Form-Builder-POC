# ESM + node:sqlite Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the server from CommonJS to ESM and replace `better-sqlite3` with Node's built-in `node:sqlite` module.

**Architecture:** Direct API replacement across 6 source files. `node:sqlite`'s `DatabaseSync` has nearly identical surface to `better-sqlite3` — the main differences are constructor name, pragma syntax, and transaction handling. The 2 test files already use ESM imports and need no changes.

**Tech Stack:** Node 24, `node:sqlite` (`DatabaseSync`), Express, Vitest

---

### Task 1: Convert package.json and database layer

**Files:**
- Modify: `server/package.json`
- Modify: `server/db/database.js`

- [ ] **Step 1: Update `server/package.json`**

Add `"type": "module"` and remove `better-sqlite3` from dependencies:

```json
{
  "name": "poc-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Rewrite `server/db/database.js` to ESM + node:sqlite**

Replace the entire file with:

```js
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createDb(dbPath) {
  const resolvedPath = dbPath || join(__dirname, '..', 'poc.db');
  const db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

let defaultDb;
export function getDb() {
  if (!defaultDb) {
    defaultDb = createDb();
  }
  return defaultDb;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/db/database.js
git commit -m "refactor: convert database layer to ESM + node:sqlite"
```

---

### Task 2: Convert route files to ESM

**Files:**
- Modify: `server/routes/forms.js`
- Modify: `server/routes/subApps.js`
- Modify: `server/routes/submissions.js`

- [ ] **Step 1: Rewrite `server/routes/forms.js`**

Replace the entire file with:

```js
import express from 'express';

export default function formsRoutes(db) {
  const router = express.Router();

  // List all forms
  router.get('/', (req, res) => {
    const forms = db.prepare('SELECT * FROM forms ORDER BY created_at DESC').all();
    res.json(forms);
  });

  // Create form + version 1
  router.post('/', (req, res) => {
    const { name, description, schema } = req.body;

    db.exec('BEGIN');
    try {
      const result = db.prepare(
        'INSERT INTO forms (name, description, current_version) VALUES (?, ?, 1)'
      ).run(name, description || '');
      const formId = result.lastInsertRowid;

      db.prepare(
        'INSERT INTO form_versions (form_id, version_num, schema) VALUES (?, 1, ?)'
      ).run(formId, JSON.stringify(schema));

      db.exec('COMMIT');

      const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
      res.status(201).json(form);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });

  // Get form with current schema
  router.get('/:id', (req, res) => {
    const form = db.prepare(`
      SELECT f.*, fv.schema, fv.version_num
      FROM forms f
      JOIN form_versions fv ON fv.form_id = f.id AND fv.version_num = f.current_version
      WHERE f.id = ?
    `).get(req.params.id);

    if (!form) return res.status(404).json({ error: 'Form not found' });
    form.schema = JSON.parse(form.schema);
    res.json(form);
  });

  // Update form — creates new version
  router.put('/:id', (req, res) => {
    const { name, description, schema } = req.body;
    const formId = req.params.id;

    const existing = db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
    if (!existing) return res.status(404).json({ error: 'Form not found' });

    const newVersion = existing.current_version + 1;

    db.exec('BEGIN');
    try {
      db.prepare(
        'UPDATE forms SET name = ?, description = ?, current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(name || existing.name, description ?? existing.description, newVersion, formId);

      db.prepare(
        'INSERT INTO form_versions (form_id, version_num, schema) VALUES (?, ?, ?)'
      ).run(formId, newVersion, JSON.stringify(schema));

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const updated = db.prepare(`
      SELECT f.*, fv.schema
      FROM forms f
      JOIN form_versions fv ON fv.form_id = f.id AND fv.version_num = f.current_version
      WHERE f.id = ?
    `).get(formId);
    updated.schema = JSON.parse(updated.schema);
    res.json(updated);
  });

  // List all versions of a form
  router.get('/:id/versions', (req, res) => {
    const versions = db.prepare(
      'SELECT * FROM form_versions WHERE form_id = ? ORDER BY version_num DESC'
    ).all(req.params.id);

    versions.forEach(v => { v.schema = JSON.parse(v.schema); });
    res.json(versions);
  });

  return router;
}
```

- [ ] **Step 2: Rewrite `server/routes/subApps.js`**

Replace the entire file with:

```js
import express from 'express';

export default function subAppsRoutes(db) {
  const router = express.Router();

  // List all sub-apps with form info and submission count
  router.get('/', (req, res) => {
    const subApps = db.prepare(`
      SELECT sa.*, f.name as form_name,
        (SELECT COUNT(*) FROM submissions s WHERE s.sub_app_id = sa.id) as submission_count
      FROM sub_apps sa
      LEFT JOIN forms f ON f.id = sa.form_id
      ORDER BY sa.created_at DESC
    `).all();
    res.json(subApps);
  });

  // Create sub-app
  router.post('/', (req, res) => {
    const { name, description, form_id } = req.body;
    const result = db.prepare(
      'INSERT INTO sub_apps (name, description, form_id) VALUES (?, ?, ?)'
    ).run(name, description || '', form_id);

    const subApp = db.prepare('SELECT * FROM sub_apps WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(subApp);
  });

  // Get sub-app with form info and current schema
  router.get('/:id', (req, res) => {
    const subApp = db.prepare(`
      SELECT sa.*, f.name as form_name, f.current_version as form_current_version,
        fv.schema, fv.id as current_form_version_id
      FROM sub_apps sa
      LEFT JOIN forms f ON f.id = sa.form_id
      LEFT JOIN form_versions fv ON fv.form_id = f.id AND fv.version_num = f.current_version
      WHERE sa.id = ?
    `).get(req.params.id);

    if (!subApp) return res.status(404).json({ error: 'Sub-app not found' });
    if (subApp.schema) subApp.schema = JSON.parse(subApp.schema);
    res.json(subApp);
  });

  // Update sub-app
  router.put('/:id', (req, res) => {
    const { name, description, form_id } = req.body;
    db.prepare(
      'UPDATE sub_apps SET name = ?, description = ?, form_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name, description, form_id, req.params.id);

    const subApp = db.prepare('SELECT * FROM sub_apps WHERE id = ?').get(req.params.id);
    res.json(subApp);
  });

  return router;
}
```

- [ ] **Step 3: Rewrite `server/routes/submissions.js`**

Replace the entire file with:

```js
import express from 'express';

export function submissionsRoutes(db) {
  const router = express.Router({ mergeParams: true });

  // List submissions for a sub-app (optionally filtered by user_id)
  router.get('/', (req, res) => {
    const { subAppId } = req.params;
    const { user_id } = req.query;

    let query = `
      SELECT s.*, fv.version_num
      FROM submissions s
      JOIN form_versions fv ON s.form_version_id = fv.id
      WHERE s.sub_app_id = ?
    `;
    const params = [subAppId];

    if (user_id) {
      query += ' AND s.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY s.created_at DESC';

    const submissions = db.prepare(query).all(...params);
    submissions.forEach(s => { s.data = JSON.parse(s.data); });
    res.json(submissions);
  });

  // Create submission — auto-resolves current form version
  router.post('/', (req, res) => {
    const { subAppId } = req.params;
    const { user_id, data } = req.body;

    const subApp = db.prepare(`
      SELECT sa.form_id, fv.id as form_version_id
      FROM sub_apps sa
      JOIN forms f ON f.id = sa.form_id
      JOIN form_versions fv ON fv.form_id = f.id AND fv.version_num = f.current_version
      WHERE sa.id = ?
    `).get(subAppId);

    if (!subApp) return res.status(404).json({ error: 'Sub-app not found' });

    const result = db.prepare(
      'INSERT INTO submissions (sub_app_id, form_version_id, user_id, data, status) VALUES (?, ?, ?, ?, ?)'
    ).run(subAppId, subApp.form_version_id, user_id, JSON.stringify(data), 'submitted');

    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(result.lastInsertRowid);
    submission.data = JSON.parse(submission.data);
    res.status(201).json(submission);
  });

  return router;
}

export function singleSubmissionRoutes(db) {
  const router = express.Router();

  // Get single submission with its form schema
  router.get('/:id', (req, res) => {
    const submission = db.prepare(`
      SELECT s.*, fv.schema, fv.version_num
      FROM submissions s
      JOIN form_versions fv ON s.form_version_id = fv.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    submission.data = JSON.parse(submission.data);
    submission.schema = JSON.parse(submission.schema);
    res.json(submission);
  });

  return router;
}
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/forms.js server/routes/subApps.js server/routes/submissions.js
git commit -m "refactor: convert route files to ESM with manual transactions"
```

---

### Task 3: Convert app and entry point to ESM

**Files:**
- Modify: `server/app.js`
- Modify: `server/index.js`

- [ ] **Step 1: Rewrite `server/app.js`**

Replace the entire file with:

```js
import express from 'express';
import cors from 'cors';
import formsRoutes from './routes/forms.js';
import subAppsRoutes from './routes/subApps.js';
import { submissionsRoutes, singleSubmissionRoutes } from './routes/submissions.js';

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/forms', formsRoutes(db));
  app.use('/api/sub-apps', subAppsRoutes(db));
  app.use('/api/sub-apps/:subAppId/submissions', submissionsRoutes(db));
  app.use('/api/submissions', singleSubmissionRoutes(db));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 2: Rewrite `server/index.js`**

Replace the entire file with:

```js
import { createApp } from './app.js';
import { getDb } from './db/database.js';

const db = getDb();
const app = createApp(db);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Commit**

```bash
git add server/app.js server/index.js
git commit -m "refactor: convert app and entry point to ESM"
```

---

### Task 4: Remove better-sqlite3 and run tests

**Files:**
- Modify: `server/package-lock.json` (via npm)

- [ ] **Step 1: Uninstall better-sqlite3**

```bash
cd server && npm uninstall better-sqlite3
```

This removes it from `node_modules` and updates `package-lock.json`.

- [ ] **Step 2: Run the test suite**

```bash
cd server && npm test
```

Expected: All 9 tests pass (5 in forms.test.js, 4 in submissions.test.js). The tests already use ESM `import` syntax and import from `.js` paths, so they should work with `"type": "module"` without modification.

- [ ] **Step 3: Verify server starts**

```bash
cd server && node index.js &
curl http://localhost:3001/api/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 4: Commit lockfile**

```bash
cd server && git add package-lock.json
git commit -m "chore: remove better-sqlite3 from lockfile"
```
