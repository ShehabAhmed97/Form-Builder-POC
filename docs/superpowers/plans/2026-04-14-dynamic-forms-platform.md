# Dynamic Forms & Sub-Apps Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a POC platform where admins create versioned form templates and assign them to sub-apps, and users submit requests through those forms.

**Architecture:** Monorepo with separate client (React/Vite) and server (Express/SQLite) directories. Form.io handles form building (drag-and-drop) and rendering. A custom simple builder provides an alternative UI that outputs the same Form.io JSON schema. Form versioning ensures old submissions always render correctly.

**Tech Stack:** React 18, Vite, TailwindCSS 3, TanStack Query v5, React Router v6, Express 4, better-sqlite3, formio.js / @formio/react

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `server/package.json`
- Create: `server/index.js`
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/vite.config.js`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/src/index.css`
- Create: `client/src/main.jsx`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "poc-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "cd server && npm run dev",
    "dev:client": "cd client && npm run dev"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

- [ ] **Step 2: Create server/package.json**

```json
{
  "name": "poc-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "node --watch index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Create server/index.js (minimal placeholder)**

```js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 4: Create client/package.json**

```json
{
  "name": "poc-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@formio/react": "^5.3.0",
    "@tanstack/react-query": "^5.60.0",
    "formiojs": "^4.21.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 5: Create client config files**

`client/vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

`client/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

`client/postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create client entry files**

`client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>POC Platform</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

`client/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`client/src/main.jsx`:
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'formiojs/dist/formio.full.min.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="p-8 text-lg">POC Platform - Setup Complete</div>
  </React.StrictMode>
);
```

- [ ] **Step 7: Install dependencies and verify**

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

Run `npm run dev` and verify:
- Server responds at `http://localhost:3001/api/health` with `{"status":"ok"}`
- Client loads at `http://localhost:5173` showing "POC Platform - Setup Complete"

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with React/Vite client and Express server"
```

---

### Task 2: Database Schema & Connection Layer

**Files:**
- Create: `server/db/schema.sql`
- Create: `server/db/database.js`

- [ ] **Step 1: Create server/db/schema.sql**

```sql
CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  current_version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  version_num INTEGER NOT NULL,
  schema TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(form_id, version_num)
);

CREATE TABLE IF NOT EXISTS sub_apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  form_id INTEGER NOT NULL REFERENCES forms(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_app_id INTEGER NOT NULL REFERENCES sub_apps(id),
  form_version_id INTEGER NOT NULL REFERENCES form_versions(id),
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  status TEXT DEFAULT 'submitted',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: Create server/db/database.js**

```js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function createDb(dbPath) {
  const resolvedPath = dbPath || path.join(__dirname, '..', 'poc.db');
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

let defaultDb;
function getDb() {
  if (!defaultDb) {
    defaultDb = createDb();
  }
  return defaultDb;
}

module.exports = { createDb, getDb };
```

- [ ] **Step 3: Verify database initializes**

Add a quick check to `server/index.js` temporarily:

```js
const { getDb } = require('./db/database');
const db = getDb();
console.log('Database initialized. Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
```

Run `cd server && node index.js`. Expected: logs showing all 4 tables (forms, form_versions, sub_apps, submissions). Remove the temporary log after verifying.

- [ ] **Step 4: Commit**

```bash
git add server/db/
git commit -m "feat: SQLite database schema and connection layer"
```

---

### Task 3: Express App Setup & Forms API

**Files:**
- Create: `server/app.js`
- Create: `server/routes/forms.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create server/app.js**

```js
const express = require('express');
const cors = require('cors');

function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/forms', require('./routes/forms')(db));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  return app;
}

module.exports = { createApp };
```

- [ ] **Step 2: Create server/routes/forms.js**

```js
const express = require('express');

module.exports = function formsRoutes(db) {
  const router = express.Router();

  // List all forms
  router.get('/', (req, res) => {
    const forms = db.prepare('SELECT * FROM forms ORDER BY created_at DESC').all();
    res.json(forms);
  });

  // Create form + version 1
  router.post('/', (req, res) => {
    const { name, description, schema } = req.body;

    const transaction = db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO forms (name, description, current_version) VALUES (?, ?, 1)'
      ).run(name, description || '');
      const formId = result.lastInsertRowid;

      db.prepare(
        'INSERT INTO form_versions (form_id, version_num, schema) VALUES (?, 1, ?)'
      ).run(formId, JSON.stringify(schema));

      return formId;
    });

    const formId = transaction();
    const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
    res.status(201).json(form);
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

    const transaction = db.transaction(() => {
      db.prepare(
        'UPDATE forms SET name = ?, description = ?, current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(name || existing.name, description ?? existing.description, newVersion, formId);

      db.prepare(
        'INSERT INTO form_versions (form_id, version_num, schema) VALUES (?, ?, ?)'
      ).run(formId, newVersion, JSON.stringify(schema));
    });

    transaction();

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
};
```

- [ ] **Step 3: Update server/index.js to use app.js**

Replace `server/index.js` entirely:

```js
const { createApp } = require('./app');
const { getDb } = require('./db/database');

const db = getDb();
const app = createApp(db);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 4: Verify forms API manually**

```bash
cd server && node index.js
# In another terminal:
curl -X POST http://localhost:3001/api/forms -H "Content-Type: application/json" -d "{\"name\":\"Test\",\"schema\":{\"components\":[]}}"
curl http://localhost:3001/api/forms
curl http://localhost:3001/api/forms/1
```

Expected: form created with id=1, current_version=1. List returns array with one form. Get returns form with schema.

- [ ] **Step 5: Commit**

```bash
git add server/app.js server/routes/forms.js server/index.js
git commit -m "feat: Express app setup with Forms CRUD API and versioning"
```

---

### Task 4: Sub-Apps API

**Files:**
- Create: `server/routes/subApps.js`
- Modify: `server/app.js`

- [ ] **Step 1: Create server/routes/subApps.js**

```js
const express = require('express');

module.exports = function subAppsRoutes(db) {
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
};
```

- [ ] **Step 2: Register sub-apps routes in server/app.js**

Add to `server/app.js` after the forms route:

```js
app.use('/api/sub-apps', require('./routes/subApps')(db));
```

The full `createApp` function should now be:

```js
function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/forms', require('./routes/forms')(db));
  app.use('/api/sub-apps', require('./routes/subApps')(db));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/subApps.js server/app.js
git commit -m "feat: Sub-Apps CRUD API with form info and submission counts"
```

---

### Task 5: Submissions API

**Files:**
- Create: `server/routes/submissions.js`
- Modify: `server/app.js`

- [ ] **Step 1: Create server/routes/submissions.js**

```js
const express = require('express');

function submissionsRoutes(db) {
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

function singleSubmissionRoutes(db) {
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

module.exports = { submissionsRoutes, singleSubmissionRoutes };
```

- [ ] **Step 2: Register submissions routes in server/app.js**

Update `server/app.js`:

```js
const express = require('express');
const cors = require('cors');

function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/forms', require('./routes/forms')(db));
  app.use('/api/sub-apps', require('./routes/subApps')(db));

  const { submissionsRoutes, singleSubmissionRoutes } = require('./routes/submissions');
  app.use('/api/sub-apps/:subAppId/submissions', submissionsRoutes(db));
  app.use('/api/submissions', singleSubmissionRoutes(db));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  return app;
}

module.exports = { createApp };
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/submissions.js server/app.js
git commit -m "feat: Submissions API with auto form version resolution"
```

---

### Task 6: Backend API Tests

**Files:**
- Create: `server/tests/forms.test.js`
- Create: `server/tests/submissions.test.js`

- [ ] **Step 1: Create server/tests/forms.test.js**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb } from '../db/database.js';
import { createApp } from '../app.js';

let db, app;

beforeEach(() => {
  db = createDb(':memory:');
  app = createApp(db);
});

describe('Forms API', () => {
  it('POST /api/forms creates form with version 1', async () => {
    const res = await request(app)
      .post('/api/forms')
      .send({ name: 'Test Form', description: 'A test', schema: { display: 'form', components: [] } });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Form');
    expect(res.body.current_version).toBe(1);
  });

  it('GET /api/forms lists all forms', async () => {
    await request(app).post('/api/forms').send({ name: 'Form A', schema: { components: [] } });
    await request(app).post('/api/forms').send({ name: 'Form B', schema: { components: [] } });

    const res = await request(app).get('/api/forms');
    expect(res.body).toHaveLength(2);
  });

  it('GET /api/forms/:id returns form with current schema', async () => {
    await request(app).post('/api/forms').send({
      name: 'Test',
      schema: { components: [{ type: 'textfield', key: 'name', label: 'Name' }] },
    });

    const res = await request(app).get('/api/forms/1');
    expect(res.status).toBe(200);
    expect(res.body.schema.components).toHaveLength(1);
    expect(res.body.schema.components[0].key).toBe('name');
  });

  it('PUT /api/forms/:id creates new version', async () => {
    await request(app).post('/api/forms').send({ name: 'Test', schema: { components: [] } });

    const res = await request(app).put('/api/forms/1').send({
      name: 'Test Updated',
      schema: { components: [{ type: 'textfield', key: 'email', label: 'Email' }] },
    });

    expect(res.body.current_version).toBe(2);
    expect(res.body.schema.components[0].key).toBe('email');

    const versions = await request(app).get('/api/forms/1/versions');
    expect(versions.body).toHaveLength(2);
    expect(versions.body[0].version_num).toBe(2);
    expect(versions.body[1].version_num).toBe(1);
  });

  it('GET /api/forms/:id returns 404 for missing form', async () => {
    const res = await request(app).get('/api/forms/999');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Create server/tests/submissions.test.js**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb } from '../db/database.js';
import { createApp } from '../app.js';

let db, app;

beforeEach(async () => {
  db = createDb(':memory:');
  app = createApp(db);

  await request(app).post('/api/forms').send({
    name: 'Test Form',
    schema: { components: [{ type: 'textfield', key: 'name', label: 'Name' }] },
  });
  await request(app).post('/api/sub-apps').send({
    name: 'Test App', description: 'Test', form_id: 1,
  });
});

describe('Submissions API', () => {
  it('POST creates submission pinned to current form version', async () => {
    const res = await request(app)
      .post('/api/sub-apps/1/submissions')
      .send({ user_id: 'user1', data: { name: 'John' } });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('John');
    expect(res.body.status).toBe('submitted');
  });

  it('old submissions keep old version after form edit', async () => {
    // Submit with version 1
    await request(app)
      .post('/api/sub-apps/1/submissions')
      .send({ user_id: 'user1', data: { name: 'John' } });

    // Edit form -> version 2
    await request(app).put('/api/forms/1').send({
      name: 'Test Form',
      schema: { components: [{ type: 'textfield', key: 'name' }, { type: 'email', key: 'email' }] },
    });

    // Submit with version 2
    await request(app)
      .post('/api/sub-apps/1/submissions')
      .send({ user_id: 'user1', data: { name: 'Jane', email: 'jane@test.com' } });

    // First submission still has version 1 schema (1 component)
    const sub1 = await request(app).get('/api/submissions/1');
    expect(sub1.body.version_num).toBe(1);
    expect(sub1.body.schema.components).toHaveLength(1);

    // Second submission has version 2 schema (2 components)
    const sub2 = await request(app).get('/api/submissions/2');
    expect(sub2.body.version_num).toBe(2);
    expect(sub2.body.schema.components).toHaveLength(2);
  });

  it('GET /api/submissions/:id returns submission with schema', async () => {
    await request(app)
      .post('/api/sub-apps/1/submissions')
      .send({ user_id: 'user1', data: { name: 'Test' } });

    const res = await request(app).get('/api/submissions/1');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Test');
    expect(res.body.schema.components).toBeDefined();
  });

  it('GET filters submissions by user_id', async () => {
    await request(app).post('/api/sub-apps/1/submissions').send({ user_id: 'user1', data: { name: 'A' } });
    await request(app).post('/api/sub-apps/1/submissions').send({ user_id: 'user2', data: { name: 'B' } });

    const res = await request(app).get('/api/sub-apps/1/submissions?user_id=user1');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].data.name).toBe('A');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd server && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/tests/
git commit -m "test: API tests for forms versioning and submissions"
```

---

### Task 7: Frontend Shell (Layout, Routing, Auth, API Clients)

**Files:**
- Create: `client/src/components/AuthContext.jsx`
- Create: `client/src/components/Layout.jsx`
- Create: `client/src/api/forms.js`
- Create: `client/src/api/subApps.js`
- Create: `client/src/api/submissions.js`
- Create: `client/src/App.jsx`
- Modify: `client/src/main.jsx`

- [ ] **Step 1: Create client/src/components/AuthContext.jsx**

```jsx
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem('poc_role') || 'admin');
  const [userId, setUserId] = useState(() => localStorage.getItem('poc_user_id') || 'user1');

  const updateRole = (newRole) => {
    setRole(newRole);
    localStorage.setItem('poc_role', newRole);
  };

  const updateUserId = (newId) => {
    setUserId(newId);
    localStorage.setItem('poc_user_id', newId);
  };

  return (
    <AuthContext.Provider value={{ role, userId, setRole: updateRole, setUserId: updateUserId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Create client/src/components/Layout.jsx**

```jsx
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useEffect } from 'react';

export default function Layout() {
  const { role, userId, setRole, setUserId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const adminLinks = [
    { to: '/admin/forms', label: 'Form Templates' },
    { to: '/admin/sub-apps', label: 'Sub-Apps' },
  ];

  const userLinks = [
    { to: '/sub-apps', label: 'Sub-Apps' },
  ];

  const links = role === 'admin' ? adminLinks : userLinks;

  useEffect(() => {
    if (role === 'admin' && location.pathname.startsWith('/sub-apps')) {
      navigate('/admin/forms');
    } else if (role === 'user' && location.pathname.startsWith('/admin')) {
      navigate('/sub-apps');
    }
  }, [role]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold text-gray-900">POC Platform</Link>
          <nav className="flex gap-4">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm ${
                  location.pathname.startsWith(link.to)
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="text-sm border rounded px-2 py-1 w-24"
            placeholder="User ID"
          />
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create API client modules**

`client/src/api/forms.js`:
```js
const BASE = '/api/forms';

export async function getForms() {
  const res = await fetch(BASE);
  return res.json();
}

export async function getForm(id) {
  const res = await fetch(`${BASE}/${id}`);
  return res.json();
}

export async function createForm(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateForm(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getFormVersions(id) {
  const res = await fetch(`${BASE}/${id}/versions`);
  return res.json();
}
```

`client/src/api/subApps.js`:
```js
const BASE = '/api/sub-apps';

export async function getSubApps() {
  const res = await fetch(BASE);
  return res.json();
}

export async function getSubApp(id) {
  const res = await fetch(`${BASE}/${id}`);
  return res.json();
}

export async function createSubApp(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateSubApp(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
```

`client/src/api/submissions.js`:
```js
export async function getSubmissions(subAppId, userId) {
  const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`/api/sub-apps/${subAppId}/submissions${params}`);
  return res.json();
}

export async function createSubmission(subAppId, data) {
  const res = await fetch(`/api/sub-apps/${subAppId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getSubmission(id) {
  const res = await fetch(`/api/submissions/${id}`);
  return res.json();
}
```

- [ ] **Step 4: Create placeholder pages and client/src/App.jsx**

Create empty placeholder components so routing works. Create these files with minimal content:

`client/src/pages/admin/FormTemplates.jsx`:
```jsx
export default function FormTemplates() {
  return <div>Form Templates (TODO)</div>;
}
```

`client/src/pages/admin/FormBuilder.jsx`:
```jsx
export default function FormBuilderPage() {
  return <div>Form Builder (TODO)</div>;
}
```

`client/src/pages/admin/FormVersionHistory.jsx`:
```jsx
export default function FormVersionHistory() {
  return <div>Version History (TODO)</div>;
}
```

`client/src/pages/admin/SubApps.jsx`:
```jsx
export default function SubApps() {
  return <div>Sub-Apps (TODO)</div>;
}
```

`client/src/pages/admin/SubAppForm.jsx`:
```jsx
export default function SubAppForm() {
  return <div>Sub-App Form (TODO)</div>;
}
```

`client/src/pages/admin/SubAppSubmissions.jsx`:
```jsx
export default function SubAppSubmissions() {
  return <div>Sub-App Submissions (TODO)</div>;
}
```

`client/src/pages/user/SubAppsList.jsx`:
```jsx
export default function SubAppsList() {
  return <div>Sub-Apps List (TODO)</div>;
}
```

`client/src/pages/user/MySubmissions.jsx`:
```jsx
export default function MySubmissions() {
  return <div>My Submissions (TODO)</div>;
}
```

`client/src/pages/user/CreateRequest.jsx`:
```jsx
export default function CreateRequest() {
  return <div>Create Request (TODO)</div>;
}
```

Now create `client/src/App.jsx`:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './components/AuthContext';
import FormTemplates from './pages/admin/FormTemplates';
import FormBuilderPage from './pages/admin/FormBuilder';
import FormVersionHistory from './pages/admin/FormVersionHistory';
import SubApps from './pages/admin/SubApps';
import SubAppForm from './pages/admin/SubAppForm';
import SubAppSubmissions from './pages/admin/SubAppSubmissions';
import SubAppsList from './pages/user/SubAppsList';
import MySubmissions from './pages/user/MySubmissions';
import CreateRequest from './pages/user/CreateRequest';

export default function App() {
  const { role } = useAuth();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/admin/forms" element={<FormTemplates />} />
        <Route path="/admin/forms/new" element={<FormBuilderPage />} />
        <Route path="/admin/forms/:id/edit" element={<FormBuilderPage />} />
        <Route path="/admin/forms/:id/versions" element={<FormVersionHistory />} />
        <Route path="/admin/sub-apps" element={<SubApps />} />
        <Route path="/admin/sub-apps/new" element={<SubAppForm />} />
        <Route path="/admin/sub-apps/:id/edit" element={<SubAppForm />} />
        <Route path="/admin/sub-apps/:id/submissions" element={<SubAppSubmissions />} />

        <Route path="/sub-apps" element={<SubAppsList />} />
        <Route path="/sub-apps/:id" element={<MySubmissions />} />
        <Route path="/sub-apps/:id/new" element={<CreateRequest />} />

        <Route path="/" element={<Navigate to={role === 'admin' ? '/admin/forms' : '/sub-apps'} replace />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 5: Update client/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './components/AuthContext';
import App from './App';
import 'formiojs/dist/formio.full.min.css';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);
```

- [ ] **Step 6: Verify frontend shell**

Run `npm run dev`. Navigate to `http://localhost:5173`. Expected:
- Header with "POC Platform", nav links, role switcher, user ID input
- Defaults to admin role, shows "Form Templates" and "Sub-Apps" nav
- Switching to "User" role redirects to `/sub-apps`
- Placeholder text renders for each route

- [ ] **Step 7: Commit**

```bash
git add client/src/
git commit -m "feat: frontend shell with routing, auth context, and API clients"
```

---

### Task 8: Admin - Form Templates List Page

**Files:**
- Modify: `client/src/pages/admin/FormTemplates.jsx`

- [ ] **Step 1: Implement FormTemplates.jsx**

Replace `client/src/pages/admin/FormTemplates.jsx`:

```jsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getForms } from '../../api/forms';

export default function FormTemplates() {
  const { data: forms, isLoading } = useQuery({
    queryKey: ['forms'],
    queryFn: getForms,
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Form Templates</h2>
        <Link
          to="/admin/forms/new"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Create New
        </Link>
      </div>

      {forms?.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No form templates yet. Create your first one!</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forms?.map(form => (
                <tr key={form.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{form.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{form.description}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                      v{form.current_version}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {new Date(form.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link to={`/admin/forms/${form.id}/edit`} className="text-blue-600 hover:underline text-sm">
                        Edit
                      </Link>
                      <Link to={`/admin/forms/${form.id}/versions`} className="text-gray-600 hover:underline text-sm">
                        History
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify with running backend**

Run `npm run dev`. Navigate to `/admin/forms`. Expected: empty state message. Backend must be running to avoid fetch errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/FormTemplates.jsx
git commit -m "feat: admin form templates list page"
```

---

### Task 9: Admin - Drag-and-Drop Form Builder (Form.io)

**Files:**
- Create: `client/src/components/FormPreview.jsx`
- Modify: `client/src/pages/admin/FormBuilder.jsx`

- [ ] **Step 1: Create client/src/components/FormPreview.jsx**

```jsx
import { Form } from '@formio/react';

export default function FormPreview({ schema }) {
  if (!schema?.components?.length) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
        No fields to preview. Add some fields first.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-medium mb-4 text-gray-700">Form Preview</h3>
      <Form
        form={schema}
        onSubmit={(submission) => {
          alert('Preview submit:\n' + JSON.stringify(submission.data, null, 2));
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Implement FormBuilder.jsx with drag-and-drop mode**

Replace `client/src/pages/admin/FormBuilder.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FormBuilder } from '@formio/react';
import { getForm, createForm, updateForm } from '../../api/forms';
import FormPreview from '../../components/FormPreview';

export default function FormBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState({ display: 'form', components: [] });
  const [mode, setMode] = useState('dnd');
  const [activeTab, setActiveTab] = useState('build');
  const builderRef = useRef(null);

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
    enabled: isEditing,
  });

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || '');
      setSchema(form.schema);
    }
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEditing ? updateForm(id, data) : createForm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      navigate('/admin/forms');
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;
    saveMutation.mutate({ name, description, schema });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        {isEditing ? 'Edit' : 'Create'} Form Template
      </h2>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g. Employee Onboarding Form"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Brief description"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('dnd')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                mode === 'dnd' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Drag & Drop
            </button>
            <button
              onClick={() => setMode('simple')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                mode === 'simple' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Simple
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('build')}
              className={`px-3 py-1.5 rounded text-sm ${
                activeTab === 'build' ? 'bg-gray-200 font-medium' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Build
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded text-sm ${
                activeTab === 'preview' ? 'bg-gray-200 font-medium' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'build' ? (
        mode === 'dnd' ? (
          <div className="bg-white rounded-lg shadow p-6" ref={builderRef}>
            <FormBuilder
              form={schema}
              onChange={(newSchema) => setSchema(newSchema)}
            />
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">
            Simple builder will be implemented in the next task.
          </div>
        )
      ) : (
        <FormPreview schema={schema} />
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSave}
          disabled={!name.trim() || saveMutation.isPending}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => navigate('/admin/forms')}
          className="bg-gray-100 text-gray-700 px-6 py-2 rounded hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify drag-and-drop builder**

Run `npm run dev`. Navigate to `/admin/forms/new`. Expected:
- Name and description fields appear
- Form.io drag-and-drop builder renders with field palette on left
- Can drag a "Text Field" onto the canvas
- Switching to Preview tab shows the field
- Saving with a name creates the form and redirects to list

- [ ] **Step 4: Commit**

```bash
git add client/src/components/FormPreview.jsx client/src/pages/admin/FormBuilder.jsx
git commit -m "feat: admin form builder page with Form.io drag-and-drop"
```

---

### Task 10: Admin - Simple Config-Based Builder

**Files:**
- Create: `client/src/components/SimpleBuilder.jsx`
- Modify: `client/src/pages/admin/FormBuilder.jsx`

- [ ] **Step 1: Create client/src/components/SimpleBuilder.jsx**

```jsx
import { useState } from 'react';

const FIELD_TYPES = [
  { type: 'textfield', label: 'Text Field', icon: 'Aa' },
  { type: 'textarea', label: 'Text Area', icon: '\u00b6' },
  { type: 'number', label: 'Number', icon: '#' },
  { type: 'email', label: 'Email', icon: '@' },
  { type: 'phoneNumber', label: 'Phone', icon: '\u260e' },
  { type: 'datetime', label: 'Date/Time', icon: '\u29d6' },
  { type: 'select', label: 'Dropdown', icon: '\u25bc' },
  { type: 'radio', label: 'Radio', icon: '\u25cb' },
  { type: 'checkbox', label: 'Checkbox', icon: '\u2610' },
  { type: 'file', label: 'File Upload', icon: '\u2191' },
];

function generateKey(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'field';
}

function fieldToFormioComponent(field) {
  const comp = {
    type: field.type,
    key: field.key,
    label: field.label,
    input: true,
  };

  if (field.placeholder) comp.placeholder = field.placeholder;
  if (field.required) comp.validate = { required: true };

  if (field.type === 'select') {
    comp.data = { values: field.values || [] };
    comp.widget = 'choicesjs';
  }
  if (field.type === 'radio') {
    comp.values = field.values || [];
  }
  if (field.type === 'file') {
    comp.storage = 'base64';
  }

  return comp;
}

function formioComponentToField(comp, index) {
  return {
    id: `field_${index}_${Date.now()}`,
    type: comp.type,
    label: comp.label || '',
    key: comp.key || '',
    placeholder: comp.placeholder || '',
    required: comp.validate?.required || false,
    values: comp.data?.values || comp.values || [],
  };
}

export default function SimpleBuilder({ schema, onChange }) {
  const [fields, setFields] = useState(() =>
    (schema?.components || []).map((comp, i) => formioComponentToField(comp, i))
  );

  const updateSchema = (updatedFields) => {
    setFields(updatedFields);
    onChange({
      display: 'form',
      components: updatedFields.map(fieldToFormioComponent),
    });
  };

  const addField = (type) => {
    const typeDef = FIELD_TYPES.find(t => t.type === type);
    const label = typeDef?.label || type;
    const newField = {
      id: `field_${Date.now()}`,
      type,
      label,
      key: generateKey(label),
      placeholder: '',
      required: false,
      values: (type === 'select' || type === 'radio')
        ? [{ label: 'Option 1', value: 'option1' }]
        : [],
    };
    updateSchema([...fields, newField]);
  };

  const updateField = (id, updates) => {
    updateSchema(fields.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id) => {
    updateSchema(fields.filter(f => f.id !== id));
  };

  const moveField = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    updateSchema(newFields);
  };

  const hasValues = (type) => type === 'select' || type === 'radio';

  return (
    <div className="flex gap-6">
      <div className="w-48 shrink-0">
        <div className="bg-white rounded-lg shadow p-4 sticky top-6">
          <h3 className="font-medium mb-3 text-sm text-gray-700">Add Field</h3>
          <div className="flex flex-col gap-1.5">
            {FIELD_TYPES.map(ft => (
              <button
                key={ft.type}
                onClick={() => addField(ft.type)}
                className="flex items-center gap-2 text-left text-sm px-3 py-2 bg-gray-50 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <span className="w-5 text-center text-gray-400 font-mono text-xs">{ft.icon}</span>
                {ft.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {fields.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
            Click a field type on the left to add it to your form.
          </div>
        )}

        {fields.map((field, index) => (
          <div key={field.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {FIELD_TYPES.find(t => t.type === field.type)?.label}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveField(index, -1)}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1.5 py-0.5 text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveField(index, 1)}
                  disabled={index === fields.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1.5 py-0.5 text-sm"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeField(field.id)}
                  className="text-red-400 hover:text-red-600 px-1.5 py-0.5 ml-2 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Label</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) =>
                    updateField(field.id, {
                      label: e.target.value,
                      key: generateKey(e.target.value),
                    })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Key</label>
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => updateField(field.id, { key: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm font-mono"
                />
              </div>
              {field.type !== 'checkbox' && field.type !== 'file' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder}
                    onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              )}
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                    className="rounded"
                  />
                  Required
                </label>
              </div>
            </div>

            {hasValues(field.type) && (
              <div className="mt-3 pt-3 border-t">
                <label className="block text-xs text-gray-500 mb-2">Options</label>
                {field.values.map((v, vi) => (
                  <div key={vi} className="flex gap-2 mb-1.5">
                    <input
                      type="text"
                      value={v.label}
                      placeholder="Label"
                      onChange={(e) => {
                        const newValues = [...field.values];
                        newValues[vi] = {
                          label: e.target.value,
                          value: generateKey(e.target.value),
                        };
                        updateField(field.id, { values: newValues });
                      }}
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() =>
                        updateField(field.id, {
                          values: field.values.filter((_, i) => i !== vi),
                        })
                      }
                      className="text-red-400 hover:text-red-600 px-2 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    updateField(field.id, {
                      values: [...field.values, { label: '', value: '' }],
                    })
                  }
                  className="text-sm text-blue-600 hover:underline mt-1"
                >
                  + Add option
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire simple builder into FormBuilder.jsx**

In `client/src/pages/admin/FormBuilder.jsx`, add the import at the top:

```jsx
import SimpleBuilder from '../../components/SimpleBuilder';
```

Replace the placeholder `<div>` for simple mode:

```jsx
// Find this block:
          <div className="text-gray-400 text-center py-8">
            Simple builder will be implemented in the next task.
          </div>

// Replace with:
          <SimpleBuilder schema={schema} onChange={setSchema} />
```

- [ ] **Step 3: Verify simple builder**

Run `npm run dev`. Navigate to `/admin/forms/new`. Click "Simple" mode. Expected:
- Field type picker on the left
- Click "Text Field" adds a text field card
- Can edit label, key, placeholder, required
- Click "Dropdown" adds a select with options editor
- Up/down arrows reorder fields
- Switching to Preview tab renders the form via Form.io
- Switching between Simple and DnD modes preserves the schema
- Save works and creates the form

- [ ] **Step 4: Commit**

```bash
git add client/src/components/SimpleBuilder.jsx client/src/pages/admin/FormBuilder.jsx
git commit -m "feat: simple config-based form builder with Form.io schema output"
```

---

### Task 11: Admin - Form Version History

**Files:**
- Modify: `client/src/pages/admin/FormVersionHistory.jsx`

- [ ] **Step 1: Implement FormVersionHistory.jsx**

Replace `client/src/pages/admin/FormVersionHistory.jsx`:

```jsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Form } from '@formio/react';
import { getForm, getFormVersions } from '../../api/forms';

export default function FormVersionHistory() {
  const { id } = useParams();
  const [previewVersion, setPreviewVersion] = useState(null);

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
  });

  const { data: versions, isLoading } = useQuery({
    queryKey: ['form-versions', id],
    queryFn: () => getFormVersions(id),
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/forms" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back to Forms
        </Link>
        <h2 className="text-2xl font-bold">Version History: {form?.name}</h2>
      </div>

      <div className="flex gap-6">
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {versions?.map(v => (
              <button
                key={v.id}
                onClick={() => setPreviewVersion(v)}
                className={`w-full text-left p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                  previewVersion?.id === v.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                }`}
              >
                <div className="font-medium text-sm">
                  Version {v.version_num}
                  {v.version_num === form?.current_version && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      current
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(v.created_at).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {v.schema?.components?.length || 0} fields
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {previewVersion ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700">
                  Preview: Version {previewVersion.version_num}
                </h3>
                <span className="text-xs text-gray-400">
                  {previewVersion.schema?.components?.length || 0} fields
                </span>
              </div>
              <Form form={previewVersion.schema} options={{ readOnly: true }} />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
              Select a version to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Create a form, edit it a few times to create versions. Navigate to `/admin/forms/:id/versions`. Expected: version list on left, clicking shows read-only form preview on right. Current version has a "current" badge.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/FormVersionHistory.jsx
git commit -m "feat: admin form version history with preview"
```

---

### Task 12: Admin - Sub-App Management (List + Create/Edit)

**Files:**
- Modify: `client/src/pages/admin/SubApps.jsx`
- Modify: `client/src/pages/admin/SubAppForm.jsx`

- [ ] **Step 1: Implement SubApps.jsx**

Replace `client/src/pages/admin/SubApps.jsx`:

```jsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getSubApps } from '../../api/subApps';

export default function SubApps() {
  const { data: subApps, isLoading } = useQuery({
    queryKey: ['sub-apps'],
    queryFn: getSubApps,
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Sub-Apps</h2>
        <Link
          to="/admin/sub-apps/new"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Create New
        </Link>
      </div>

      {subApps?.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No sub-apps yet. Create your first one!</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Form Template</th>
                <th className="px-4 py-3 font-medium">Submissions</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subApps?.map(sa => (
                <tr key={sa.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{sa.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{sa.description}</td>
                  <td className="px-4 py-3 text-sm">{sa.form_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                      {sa.submission_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link to={`/admin/sub-apps/${sa.id}/edit`} className="text-blue-600 hover:underline text-sm">
                        Edit
                      </Link>
                      <Link to={`/admin/sub-apps/${sa.id}/submissions`} className="text-gray-600 hover:underline text-sm">
                        Submissions
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement SubAppForm.jsx**

Replace `client/src/pages/admin/SubAppForm.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubApp, createSubApp, updateSubApp } from '../../api/subApps';
import { getForms } from '../../api/forms';

export default function SubAppForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formId, setFormId] = useState('');

  const { data: subApp } = useQuery({
    queryKey: ['sub-app', id],
    queryFn: () => getSubApp(id),
    enabled: isEditing,
  });

  const { data: forms } = useQuery({
    queryKey: ['forms'],
    queryFn: getForms,
  });

  useEffect(() => {
    if (subApp) {
      setName(subApp.name);
      setDescription(subApp.description || '');
      setFormId(String(subApp.form_id));
    }
  }, [subApp]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEditing ? updateSubApp(id, data) : createSubApp(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-apps'] });
      navigate('/admin/sub-apps');
    },
  });

  const handleSave = () => {
    if (!name.trim() || !formId) return;
    saveMutation.mutate({ name, description, form_id: Number(formId) });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        {isEditing ? 'Edit' : 'Create'} Sub-App
      </h2>

      <div className="bg-white rounded-lg shadow p-6 max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g. IT Equipment Request"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={3}
              placeholder="What is this sub-app for?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Form Template *</label>
            <select
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select a form template...</option>
              {forms?.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} (v{f.current_version})
                </option>
              ))}
            </select>
            {forms?.length === 0 && (
              <p className="text-sm text-amber-600 mt-1">
                No form templates yet. Create one first.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!name.trim() || !formId || saveMutation.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => navigate('/admin/sub-apps')}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Navigate to `/admin/sub-apps`. Create a sub-app, pick a form template. Verify it appears in the list with submission count 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/SubApps.jsx client/src/pages/admin/SubAppForm.jsx
git commit -m "feat: admin sub-app management (list, create, edit)"
```

---

### Task 13: Admin - Sub-App Submissions View

**Files:**
- Modify: `client/src/pages/admin/SubAppSubmissions.jsx`

- [ ] **Step 1: Implement SubAppSubmissions.jsx**

Replace `client/src/pages/admin/SubAppSubmissions.jsx`:

```jsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Form } from '@formio/react';
import { getSubApp } from '../../api/subApps';
import { getSubmissions, getSubmission } from '../../api/submissions';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function SubAppSubmissions() {
  const { id } = useParams();
  const [selectedId, setSelectedId] = useState(null);

  const { data: subApp } = useQuery({
    queryKey: ['sub-app', id],
    queryFn: () => getSubApp(id),
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => getSubmissions(id),
  });

  const { data: selected } = useQuery({
    queryKey: ['submission', selectedId],
    queryFn: () => getSubmission(selectedId),
    enabled: Boolean(selectedId),
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/sub-apps" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back to Sub-Apps
        </Link>
        <h2 className="text-2xl font-bold">Submissions: {subApp?.name}</h2>
        <span className="text-sm text-gray-500">({submissions?.length || 0} total)</span>
      </div>

      {submissions?.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No submissions yet.</p>
      ) : (
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="text-left text-sm text-gray-600">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Form Version</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions?.map(s => (
                    <tr
                      key={s.id}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedId === s.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <td className="px-4 py-3 text-sm">{s.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{s.user_id}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                          v{s.version_num}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <div className="w-[400px] shrink-0">
              <div className="bg-white rounded-lg shadow p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Submission #{selected.id}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[selected.status] || ''}`}>
                    {selected.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-4">
                  Form version: v{selected.version_num} | User: {selected.user_id}
                </div>
                <Form
                  form={selected.schema}
                  submission={{ data: selected.data }}
                  options={{ readOnly: true }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to a sub-app's submissions view. If there are no submissions yet, create some via the user flow (or wait until Task 14). The view should show a table with a detail panel on click.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/SubAppSubmissions.jsx
git commit -m "feat: admin sub-app submissions view with detail panel"
```

---

### Task 14: User Pages (Sub-Apps List, My Submissions, Create Request)

**Files:**
- Modify: `client/src/pages/user/SubAppsList.jsx`
- Modify: `client/src/pages/user/MySubmissions.jsx`
- Modify: `client/src/pages/user/CreateRequest.jsx`

- [ ] **Step 1: Implement SubAppsList.jsx**

Replace `client/src/pages/user/SubAppsList.jsx`:

```jsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getSubApps } from '../../api/subApps';

export default function SubAppsList() {
  const { data: subApps, isLoading } = useQuery({
    queryKey: ['sub-apps'],
    queryFn: getSubApps,
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Available Sub-Apps</h2>

      {subApps?.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No sub-apps available yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subApps?.map(sa => (
            <Link
              key={sa.id}
              to={`/sub-apps/${sa.id}`}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group"
            >
              <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 transition-colors">
                {sa.name}
              </h3>
              <p className="text-gray-600 text-sm">{sa.description || 'No description'}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement MySubmissions.jsx**

Replace `client/src/pages/user/MySubmissions.jsx`:

```jsx
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSubApp } from '../../api/subApps';
import { getSubmissions } from '../../api/submissions';
import { useAuth } from '../../components/AuthContext';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function MySubmissions() {
  const { id } = useParams();
  const { userId } = useAuth();

  const { data: subApp } = useQuery({
    queryKey: ['sub-app', id],
    queryFn: () => getSubApp(id),
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['my-submissions', id, userId],
    queryFn: () => getSubmissions(id, userId),
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <Link to="/sub-apps" className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back
        </Link>
        <h2 className="text-2xl font-bold">{subApp?.name}</h2>
      </div>
      {subApp?.description && (
        <p className="text-gray-600 mb-6">{subApp.description}</p>
      )}

      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">
          {submissions?.length || 0} request{submissions?.length !== 1 ? 's' : ''}
        </span>
        <Link
          to={`/sub-apps/${id}/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Create New Request
        </Link>
      </div>

      {submissions?.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          No submissions yet. Create your first request!
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3 font-medium">Request #</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions?.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm">#{s.id}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement CreateRequest.jsx**

Replace `client/src/pages/user/CreateRequest.jsx`:

```jsx
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Form } from '@formio/react';
import { getSubApp } from '../../api/subApps';
import { createSubmission } from '../../api/submissions';
import { useAuth } from '../../components/AuthContext';

export default function CreateRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  const { data: subApp, isLoading } = useQuery({
    queryKey: ['sub-app', id],
    queryFn: () => getSubApp(id),
  });

  const submitMutation = useMutation({
    mutationFn: (data) => createSubmission(id, { user_id: userId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-submissions', id] });
      queryClient.invalidateQueries({ queryKey: ['submissions', id] });
      navigate(`/sub-apps/${id}`);
    },
  });

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  if (!subApp?.schema) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No form assigned to this sub-app.</p>
        <Link to={`/sub-apps/${id}`} className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/sub-apps/${id}`} className="text-gray-500 hover:text-gray-700 text-sm">
          &larr; Back
        </Link>
        <h2 className="text-2xl font-bold">New Request: {subApp.name}</h2>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-3xl">
        <Form
          form={subApp.schema}
          onSubmit={(submission) => {
            submitMutation.mutate(submission.data);
          }}
        />
        {submitMutation.isPending && (
          <div className="mt-4 text-sm text-gray-500">Submitting...</div>
        )}
        {submitMutation.isError && (
          <div className="mt-4 text-sm text-red-600">
            Failed to submit. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: End-to-end verification**

Run `npm run dev`. Full test flow:
1. As Admin: Create a form template with a few fields (text, email, dropdown)
2. As Admin: Create a sub-app assigned to that form
3. Switch to User role
4. See the sub-app in the list, click it
5. Click "Create New Request", fill the form, submit
6. See the submission in the list with "submitted" status
7. Switch back to Admin, view submissions for the sub-app
8. Click a submission to see the detail panel with filled form
9. Edit the form template (add a new field) — creates version 2
10. As User: create another request (should show updated form)
11. As Admin: view submissions — first submission shows v1 schema, second shows v2

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/user/
git commit -m "feat: user pages - sub-apps list, submissions, and create request"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|---|---|
| SQLite with JSON columns | Task 2 |
| Form versioning strategy | Tasks 3, 6 (tested) |
| Form.io drag-and-drop builder | Task 9 |
| Simple config-based builder | Task 10 |
| Both builders output same schema | Task 10 (uses same Form.io JSON) |
| Single Form.io renderer | Tasks 9, 11, 13, 14 |
| Admin: form template CRUD | Tasks 3, 8 |
| Admin: version history | Task 11 |
| Admin: sub-app CRUD | Tasks 4, 12 |
| Admin: view submissions | Task 13 |
| User: browse sub-apps | Task 14 |
| User: my submissions | Task 14 |
| User: create request | Task 14 |
| POC auth (role switcher) | Task 7 |
| Forms reusable across sub-apps | Task 4 (form_id FK, no unique constraint) |
| Submissions pin form version | Tasks 5, 6 (tested) |
| API endpoints (all listed) | Tasks 3, 4, 5 |
