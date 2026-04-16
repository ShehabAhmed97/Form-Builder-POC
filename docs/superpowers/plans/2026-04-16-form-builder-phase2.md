# Phase 2: Form Builder Core — DnD, Sidebars, Save/Load

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-panel form builder (element palette, canvas with drag-and-drop, property editor sidebar) that saves/loads forms using the new relational schema. Support basic input types: textfield, textarea, number, email.

**Architecture:** The builder uses a custom React hook (`useBuilderState`) to manage form elements as a flat array with position ordering. The left sidebar fetches element types from `GET /api/registry/element-types`. The canvas renders elements as blocks and handles HTML5 drag-and-drop for adding/reordering. The right sidebar fetches property definitions from `GET /api/registry/element-types/:id/properties` and renders dynamic inputs. Forms are saved via `PUT /api/forms/:id` which creates a new version in a single transaction.

**Tech Stack:** React 18 + TanStack Query, HTML5 Drag and Drop API (native, no library), TailwindCSS, Express + node:sqlite.

**Spec:** `docs/superpowers/specs/2026-04-16-form-builder-redesign-design.md`

**Depends on:** Phase 1 complete (17-table schema, registry API, Form.io isolated)

---

## File Structure

### Files to Create
- `server/routes/forms.js` — full rewrite with relational save/load
- `server/tests/forms.test.js` — tests for new forms API
- `client/src/api/registry.js` — registry API client
- `client/src/components/builder/useBuilderState.js` — builder state management hook
- `client/src/components/builder/ElementPalette.jsx` — left sidebar
- `client/src/components/builder/FormCanvas.jsx` — center canvas with DnD
- `client/src/components/builder/PropertyEditor.jsx` — right sidebar
- `client/src/components/builder/FormBuilderLayout.jsx` — three-panel shell

### Files to Modify
- `client/src/api/forms.js` — update payload format for new schema
- `client/src/pages/admin/FormBuilder.jsx` — use new builder components
- `client/src/components/FormRenderer.jsx` — update to render from relational data

---

## Task 1: Forms API — Relational Save/Load

**Files:**
- Replace: `server/routes/forms.js`
- Create: `server/tests/forms.test.js`

The forms API needs two major changes:
1. `GET /api/forms/:id` must return the full element tree (elements + values + options) from the relational tables
2. `PUT /api/forms/:id` must accept an elements array and persist it across `form_elements`, `form_element_values`, and `form_element_options` as a new version

- [ ] **Step 1: Write the failing tests**

Create `server/tests/forms.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Forms API', () => {
  let app;

  beforeAll(() => {
    app = createApp(':memory:');
  });

  describe('POST /api/forms', () => {
    it('creates a new blank form with version 1', async () => {
      const res = await request(app)
        .post('/api/forms')
        .send({ name: 'Test Form', description: 'A test' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Test Form',
        description: 'A test',
        current_version: 1,
      });
      expect(res.body.id).toBeDefined();
    });

    it('requires name', async () => {
      const res = await request(app).post('/api/forms').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/forms/:id', () => {
    it('returns form with empty elements for new form', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'Empty Form' });

      const res = await request(app).get(`/api/forms/${create.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Empty Form');
      expect(res.body.elements).toEqual([]);
    });

    it('returns 404 for non-existent form', async () => {
      const res = await request(app).get('/api/forms/9999');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/forms/:id — save with elements', () => {
    it('saves elements and creates new version', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'My Form' });
      const formId = create.body.id;

      const res = await request(app)
        .put(`/api/forms/${formId}`)
        .send({
          name: 'My Form Updated',
          description: 'Updated desc',
          elements: [
            {
              element_type_id: 1, // textfield
              element_key: 'first_name',
              position: 0,
              parent_key: null,
              values: { label: 'First Name', placeholder: 'Enter name', required: 'true' },
              options: [],
            },
            {
              element_type_id: 1, // textfield
              element_key: 'last_name',
              position: 1,
              parent_key: null,
              values: { label: 'Last Name' },
              options: [],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('My Form Updated');
      expect(res.body.current_version).toBe(2);
    });

    it('persists elements that can be loaded back', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'Persist Test' });
      const formId = create.body.id;

      // Save with elements
      await request(app)
        .put(`/api/forms/${formId}`)
        .send({
          name: 'Persist Test',
          elements: [
            {
              element_type_id: 1,
              element_key: 'email_field',
              position: 0,
              parent_key: null,
              values: { label: 'Email', required: 'true', pattern: '^.+@.+$' },
              options: [],
            },
          ],
        });

      // Load and verify
      const res = await request(app).get(`/api/forms/${formId}`);
      expect(res.body.elements).toHaveLength(1);
      expect(res.body.elements[0]).toMatchObject({
        element_key: 'email_field',
        type_name: 'textfield',
        position: 0,
        parent_id: null,
      });
      expect(res.body.elements[0].values).toMatchObject({
        label: 'Email',
        required: 'true',
        pattern: '^.+@.+$',
      });
    });

    it('saves options for select elements', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'Options Test' });
      const formId = create.body.id;

      // Get select type ID
      const typesRes = await request(app).get('/api/registry/element-types');
      const selectType = typesRes.body
        .find(c => c.name === 'selection').types
        .find(t => t.name === 'select');

      await request(app)
        .put(`/api/forms/${formId}`)
        .send({
          name: 'Options Test',
          elements: [
            {
              element_type_id: selectType.id,
              element_key: 'department',
              position: 0,
              parent_key: null,
              values: { label: 'Department', required: 'true' },
              options: [
                { label: 'HR', value: 'hr', display_order: 0 },
                { label: 'Engineering', value: 'eng', display_order: 1 },
              ],
            },
          ],
        });

      const res = await request(app).get(`/api/forms/${formId}`);
      expect(res.body.elements[0].options).toHaveLength(2);
      expect(res.body.elements[0].options[0]).toMatchObject({
        label: 'HR',
        value: 'hr',
      });
    });

    it('version pinning works — old version data preserved', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'Version Test' });
      const formId = create.body.id;

      // Save v2 with one field
      await request(app).put(`/api/forms/${formId}`).send({
        name: 'Version Test',
        elements: [
          { element_type_id: 1, element_key: 'field_a', position: 0, parent_key: null, values: { label: 'Field A' }, options: [] },
        ],
      });

      // Save v3 with different field
      await request(app).put(`/api/forms/${formId}`).send({
        name: 'Version Test',
        elements: [
          { element_type_id: 1, element_key: 'field_b', position: 0, parent_key: null, values: { label: 'Field B' }, options: [] },
        ],
      });

      // Current version (v3) has field_b
      const current = await request(app).get(`/api/forms/${formId}`);
      expect(current.body.current_version).toBe(3);
      expect(current.body.elements[0].element_key).toBe('field_b');

      // Version 2 still has field_a
      const versions = await request(app).get(`/api/forms/${formId}/versions`);
      const v2 = versions.body.find(v => v.version_num === 2);

      const v2Detail = await request(app).get(`/api/forms/${formId}/versions/${v2.id}`);
      expect(v2Detail.body.elements[0].element_key).toBe('field_a');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/forms.test.js`
Expected: FAIL — current forms routes don't return `elements` or handle the new save format.

- [ ] **Step 3: Implement the new forms routes**

Replace `server/routes/forms.js`:

```js
import { Router } from 'express';

export function createFormsRoutes(db) {
  const router = Router();

  // Helper: load all elements for a form version with their values and options
  function loadVersionElements(formVersionId) {
    const elements = db.prepare(`
      SELECT fe.id, fe.element_type_id, fe.element_key, fe.position, fe.parent_id,
             et.name as type_name, et.is_layout
      FROM form_elements fe
      JOIN element_types et ON fe.element_type_id = et.id
      WHERE fe.form_version_id = ?
      ORDER BY fe.parent_id NULLS FIRST, fe.position
    `).all(formVersionId);

    const elementIds = elements.map(e => e.id);
    if (elementIds.length === 0) return [];

    // Load values for all elements
    const allValues = db.prepare(`
      SELECT fev.form_element_id, pd.name, fev.value
      FROM form_element_values fev
      JOIN property_definitions pd ON fev.property_definition_id = pd.id
      WHERE fev.form_element_id IN (${elementIds.map(() => '?').join(',')})
    `).all(...elementIds);

    // Load options for all elements
    const allOptions = db.prepare(`
      SELECT form_element_id, id, label, value, display_order
      FROM form_element_options
      WHERE form_element_id IN (${elementIds.map(() => '?').join(',')})
      ORDER BY display_order
    `).all(...elementIds);

    // Group values and options by element
    const valuesByElement = new Map();
    for (const v of allValues) {
      if (!valuesByElement.has(v.form_element_id)) valuesByElement.set(v.form_element_id, {});
      valuesByElement.get(v.form_element_id)[v.name] = v.value;
    }

    const optionsByElement = new Map();
    for (const o of allOptions) {
      if (!optionsByElement.has(o.form_element_id)) optionsByElement.set(o.form_element_id, []);
      optionsByElement.get(o.form_element_id).push({
        id: o.id, label: o.label, value: o.value, display_order: o.display_order,
      });
    }

    return elements.map(e => ({
      id: e.id,
      element_type_id: e.element_type_id,
      element_key: e.element_key,
      type_name: e.type_name,
      is_layout: e.is_layout,
      position: e.position,
      parent_id: e.parent_id,
      values: valuesByElement.get(e.id) || {},
      options: optionsByElement.get(e.id) || [],
    }));
  }

  // GET /api/forms — list all forms
  router.get('/', (req, res) => {
    const forms = db.prepare(
      'SELECT id, name, description, current_version, created_at, updated_at FROM forms ORDER BY created_at DESC'
    ).all();
    res.json(forms);
  });

  // POST /api/forms — create new blank form with version 1
  router.post('/', (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    db.exec('BEGIN');
    try {
      const formResult = db.prepare(
        'INSERT INTO forms (name, description) VALUES (?, ?)'
      ).run(name, description || '');
      const formId = Number(formResult.lastInsertRowid);

      db.prepare('INSERT INTO form_versions (form_id, version_num) VALUES (?, 1)').run(formId);

      db.exec('COMMIT');
      const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
      res.status(201).json(form);
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/forms/:id — get form with current version's elements
  router.get('/:id', (req, res) => {
    const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const version = db.prepare(
      'SELECT id FROM form_versions WHERE form_id = ? AND version_num = ?'
    ).get(form.id, form.current_version);

    const elements = version ? loadVersionElements(version.id) : [];

    res.json({ ...form, elements });
  });

  // PUT /api/forms/:id — save form (creates new version with elements)
  router.put('/:id', (req, res) => {
    const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const { name, description, elements = [] } = req.body;
    const newVersionNum = form.current_version + 1;

    db.exec('BEGIN');
    try {
      // Update form metadata
      db.prepare(
        'UPDATE forms SET name = ?, description = ?, current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(name || form.name, description ?? form.description, newVersionNum, form.id);

      // Create new version
      const versionResult = db.prepare(
        'INSERT INTO form_versions (form_id, version_num) VALUES (?, ?)'
      ).run(form.id, newVersionNum);
      const versionId = Number(versionResult.lastInsertRowid);

      // Insert elements — first pass: create all elements to get IDs
      const keyToId = new Map();
      const insertElement = db.prepare(
        'INSERT INTO form_elements (form_version_id, element_type_id, element_key, position, parent_id) VALUES (?, ?, ?, ?, ?)'
      );

      // First pass: insert elements without parent_id (resolve later)
      for (const el of elements) {
        const result = insertElement.run(versionId, el.element_type_id, el.element_key, el.position, null);
        keyToId.set(el.element_key, Number(result.lastInsertRowid));
      }

      // Second pass: set parent_id for nested elements
      const updateParent = db.prepare('UPDATE form_elements SET parent_id = ? WHERE id = ?');
      for (const el of elements) {
        if (el.parent_key) {
          const parentId = keyToId.get(el.parent_key);
          const elementId = keyToId.get(el.element_key);
          if (parentId && elementId) {
            updateParent.run(parentId, elementId);
          }
        }
      }

      // Insert property values
      const getPropId = db.prepare('SELECT id FROM property_definitions WHERE name = ?');
      const insertValue = db.prepare(
        'INSERT INTO form_element_values (form_element_id, property_definition_id, value) VALUES (?, ?, ?)'
      );

      for (const el of elements) {
        const elementId = keyToId.get(el.element_key);
        if (el.values) {
          for (const [propName, propValue] of Object.entries(el.values)) {
            const prop = getPropId.get(propName);
            if (prop) {
              insertValue.run(elementId, prop.id, propValue);
            }
          }
        }
      }

      // Insert options
      const insertOption = db.prepare(
        'INSERT INTO form_element_options (form_element_id, label, value, display_order) VALUES (?, ?, ?, ?)'
      );

      for (const el of elements) {
        const elementId = keyToId.get(el.element_key);
        if (el.options) {
          for (const opt of el.options) {
            insertOption.run(elementId, opt.label, opt.value, opt.display_order);
          }
        }
      }

      db.exec('COMMIT');

      const updated = db.prepare('SELECT * FROM forms WHERE id = ?').get(form.id);
      res.json(updated);
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/forms/:id/versions — list versions
  router.get('/:id/versions', (req, res) => {
    const versions = db.prepare(
      'SELECT id, form_id, version_num, created_at FROM form_versions WHERE form_id = ? ORDER BY version_num DESC'
    ).all(req.params.id);
    res.json(versions);
  });

  // GET /api/forms/:id/versions/:versionId — get specific version with elements
  router.get('/:id/versions/:versionId', (req, res) => {
    const version = db.prepare(
      'SELECT * FROM form_versions WHERE id = ? AND form_id = ?'
    ).get(req.params.versionId, req.params.id);

    if (!version) return res.status(404).json({ error: 'Version not found' });

    const elements = loadVersionElements(version.id);
    res.json({ ...version, elements });
  });

  return router;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/forms.test.js`
Expected: All 7 tests PASS.

- [ ] **Step 5: Run all server tests**

Run: `cd server && npx vitest run`
Expected: database (10) + registry (8) + forms (7) = 25 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/forms.js server/tests/forms.test.js
git commit -m "feat: rewrite forms API with relational save/load

- GET /api/forms/:id returns elements with values and options
- PUT /api/forms/:id saves elements array as new version in transaction
- GET /api/forms/:id/versions/:versionId returns specific version elements
- Two-pass element insertion handles parent_key resolution
- 7 new tests covering CRUD, persistence, options, and version pinning"
```

---

## Task 2: Frontend API Clients

**Files:**
- Create: `client/src/api/registry.js`
- Modify: `client/src/api/forms.js`

- [ ] **Step 1: Create registry API client**

Create `client/src/api/registry.js`:

```js
const API_BASE = '/api/registry';

export async function getElementTypes() {
  const res = await fetch(`${API_BASE}/element-types`);
  if (!res.ok) throw new Error('Failed to fetch element types');
  return res.json();
}

export async function getElementTypeProperties(typeId) {
  const res = await fetch(`${API_BASE}/element-types/${typeId}/properties`);
  if (!res.ok) throw new Error('Failed to fetch element type properties');
  return res.json();
}

export async function getConditionActions() {
  const res = await fetch(`${API_BASE}/condition-actions`);
  if (!res.ok) throw new Error('Failed to fetch condition actions');
  return res.json();
}

export async function getConditionOperators() {
  const res = await fetch(`${API_BASE}/condition-operators`);
  if (!res.ok) throw new Error('Failed to fetch condition operators');
  return res.json();
}
```

- [ ] **Step 2: Update forms API client**

Replace `client/src/api/forms.js`:

```js
const API_BASE = '/api/forms';

export async function getForms() {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error('Failed to fetch forms');
  return res.json();
}

export async function getForm(id) {
  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) throw new Error('Failed to fetch form');
  return res.json();
}

export async function createForm(data) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create form');
  return res.json();
}

export async function updateForm(id, data) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update form');
  return res.json();
}

export async function duplicateForm(id) {
  const res = await fetch(`${API_BASE}/${id}/duplicate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to duplicate form');
  return res.json();
}

export async function getFormVersions(id) {
  const res = await fetch(`${API_BASE}/${id}/versions`);
  if (!res.ok) throw new Error('Failed to fetch versions');
  return res.json();
}

export async function getFormVersion(formId, versionId) {
  const res = await fetch(`${API_BASE}/${formId}/versions/${versionId}`);
  if (!res.ok) throw new Error('Failed to fetch version');
  return res.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/api/registry.js client/src/api/forms.js
git commit -m "feat: add registry API client and update forms client for relational schema"
```

---

## Task 3: Builder State Hook

**Files:**
- Create: `client/src/components/builder/useBuilderState.js`

This hook manages the entire form builder's state: elements array, selection, and all mutations (add, remove, reorder, update values).

- [ ] **Step 1: Create the builder state hook**

Create `client/src/components/builder/useBuilderState.js`:

```js
import { useState, useCallback } from 'react';

// Generate a URL-safe key from a label
function generateKey(label, existingKeys) {
  let base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (!base) base = 'field';

  let key = base;
  let counter = 1;
  while (existingKeys.has(key)) {
    key = `${base}_${counter}`;
    counter++;
  }
  return key;
}

export function useBuilderState(initialElements = []) {
  const [elements, setElements] = useState(initialElements);
  const [selectedKey, setSelectedKey] = useState(null);

  const selectedElement = elements.find(el => el.element_key === selectedKey) || null;

  // Add a new element (from palette drop or click)
  const addElement = useCallback((elementType, atPosition = null) => {
    setElements(prev => {
      const existingKeys = new Set(prev.map(e => e.element_key));
      const key = generateKey(elementType.label, existingKeys);
      const position = atPosition ?? prev.filter(e => !e.parent_key).length;

      const newElement = {
        element_type_id: elementType.id,
        element_key: key,
        type_name: elementType.name,
        type_label: elementType.label,
        is_layout: elementType.is_layout,
        position,
        parent_key: null,
        values: { label: elementType.label },
        options: [],
      };

      return [...prev, newElement];
    });
  }, []);

  // Remove an element
  const removeElement = useCallback((key) => {
    setElements(prev => {
      const filtered = prev.filter(e => e.element_key !== key && e.parent_key !== key);
      // Re-index positions for root elements
      const roots = filtered.filter(e => !e.parent_key);
      return filtered.map(e => {
        if (!e.parent_key) {
          return { ...e, position: roots.indexOf(e) };
        }
        return e;
      });
    });
    setSelectedKey(prev => prev === key ? null : prev);
  }, []);

  // Move element to new position (drag reorder)
  const moveElement = useCallback((key, newPosition) => {
    setElements(prev => {
      const el = prev.find(e => e.element_key === key);
      if (!el) return prev;

      const siblings = prev
        .filter(e => e.parent_key === el.parent_key && e.element_key !== key)
        .sort((a, b) => a.position - b.position);

      siblings.splice(newPosition, 0, el);

      return prev.map(e => {
        const idx = siblings.findIndex(s => s.element_key === e.element_key);
        if (idx !== -1) return { ...e, position: idx };
        return e;
      });
    });
  }, []);

  // Update a property value on the selected element
  const updateValue = useCallback((key, propName, propValue) => {
    setElements(prev =>
      prev.map(e =>
        e.element_key === key
          ? { ...e, values: { ...e.values, [propName]: propValue } }
          : e
      )
    );
  }, []);

  // Update the element_key itself
  const updateElementKey = useCallback((oldKey, newKey) => {
    setElements(prev => {
      const existingKeys = new Set(prev.map(e => e.element_key));
      if (existingKeys.has(newKey) && newKey !== oldKey) return prev;
      return prev.map(e => {
        if (e.element_key === oldKey) return { ...e, element_key: newKey };
        if (e.parent_key === oldKey) return { ...e, parent_key: newKey };
        return e;
      });
    });
    setSelectedKey(prev => prev === oldKey ? newKey : prev);
  }, []);

  // Update options for select/radio/checkbox_group elements
  const updateOptions = useCallback((key, options) => {
    setElements(prev =>
      prev.map(e =>
        e.element_key === key ? { ...e, options } : e
      )
    );
  }, []);

  // Select an element
  const selectElement = useCallback((key) => {
    setSelectedKey(key);
  }, []);

  // Load elements from API response
  const loadElements = useCallback((apiElements) => {
    // Convert API format (parent_id numeric) to builder format (parent_key string)
    const idToKey = new Map();
    for (const el of apiElements) {
      idToKey.set(el.id, el.element_key);
    }

    const builderElements = apiElements.map(el => ({
      element_type_id: el.element_type_id,
      element_key: el.element_key,
      type_name: el.type_name,
      type_label: el.type_name, // Will be enriched by registry data
      is_layout: el.is_layout,
      position: el.position,
      parent_key: el.parent_id ? idToKey.get(el.parent_id) || null : null,
      values: el.values || {},
      options: el.options || [],
    }));

    setElements(builderElements);
    setSelectedKey(null);
  }, []);

  // Serialize elements for API save
  const serializeForSave = useCallback(() => {
    return elements.map(el => ({
      element_type_id: el.element_type_id,
      element_key: el.element_key,
      position: el.position,
      parent_key: el.parent_key,
      values: el.values,
      options: el.options.map((o, i) => ({
        label: o.label,
        value: o.value,
        display_order: i,
      })),
    }));
  }, [elements]);

  return {
    elements,
    selectedKey,
    selectedElement,
    addElement,
    removeElement,
    moveElement,
    updateValue,
    updateElementKey,
    updateOptions,
    selectElement,
    loadElements,
    serializeForSave,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/builder/useBuilderState.js
git commit -m "feat: add builder state management hook with add/remove/reorder/update"
```

---

## Task 4: Element Palette (Left Sidebar)

**Files:**
- Create: `client/src/components/builder/ElementPalette.jsx`

- [ ] **Step 1: Create the element palette**

Create `client/src/components/builder/ElementPalette.jsx`:

```jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getElementTypes } from '../../api/registry';

export default function ElementPalette({ onAddElement }) {
  const [collapsed, setCollapsed] = useState({});

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['registry', 'element-types'],
    queryFn: getElementTypes,
    staleTime: Infinity, // Registry data never changes during a session
  });

  const toggleCategory = (name) => {
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleDragStart = (e, type) => {
    e.dataTransfer.setData('application/json', JSON.stringify(type));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (isLoading) {
    return <div className="p-4 text-gray-400 text-sm">Loading elements...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Elements
      </h3>
      {categories.map(cat => (
        <div key={cat.name} className="mb-3">
          <button
            onClick={() => toggleCategory(cat.name)}
            className="flex items-center justify-between w-full text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-1 hover:text-gray-700"
          >
            {cat.label}
            <span className="text-gray-400">{collapsed[cat.name] ? '+' : '-'}</span>
          </button>
          {!collapsed[cat.name] && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {cat.types.map(type => (
                <div
                  key={type.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, type)}
                  onClick={() => onAddElement(type)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded-md text-xs cursor-grab active:cursor-grabbing select-none transition-colors"
                  title={type.label}
                >
                  <span className="text-gray-400 text-[10px]">{type.is_layout ? '[ ]' : 'Aa'}</span>
                  {type.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/builder/ElementPalette.jsx
git commit -m "feat: add element palette sidebar reading from registry API"
```

---

## Task 5: Form Canvas

**Files:**
- Create: `client/src/components/builder/FormCanvas.jsx`

- [ ] **Step 1: Create the form canvas**

Create `client/src/components/builder/FormCanvas.jsx`:

```jsx
import { useState } from 'react';

export default function FormCanvas({
  elements,
  selectedKey,
  onSelect,
  onDrop,
  onMove,
  onRemove,
}) {
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Only show root-level elements (parent_key === null), sorted by position
  const rootElements = elements
    .filter(e => !e.parent_key)
    .sort((a, b) => a.position - b.position);

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/json') ? 'copy' : 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    setDragOverIndex(null);

    // Check if dropping a new element from palette
    const json = e.dataTransfer.getData('application/json');
    if (json) {
      try {
        const type = JSON.parse(json);
        onDrop(type, index);
        return;
      } catch { /* not a palette drag */ }
    }

    // Reorder existing element
    const key = e.dataTransfer.getData('text/plain');
    if (key) {
      onMove(key, index);
    }
  };

  const handleElementDragStart = (e, element) => {
    e.dataTransfer.setData('text/plain', element.element_key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    setDragOverIndex(null);
    const json = e.dataTransfer.getData('application/json');
    if (json) {
      try {
        const type = JSON.parse(json);
        onDrop(type);
        return;
      } catch { /* ignore */ }
    }
  };

  return (
    <div
      className="h-full overflow-y-auto p-6 bg-gray-50"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleCanvasDrop}
    >
      {rootElements.length === 0 ? (
        <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-400 text-sm">
            Drag elements here or click them in the palette
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {rootElements.map((element, index) => (
            <div key={element.element_key}>
              {/* Drop zone above element */}
              <div
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={`h-1 transition-all rounded ${
                  dragOverIndex === index ? 'h-8 bg-blue-100 border-2 border-dashed border-blue-400' : ''
                }`}
              />

              {/* Element card */}
              <div
                draggable
                onDragStart={(e) => handleElementDragStart(e, element)}
                onClick={() => onSelect(element.element_key)}
                className={`group relative p-3 bg-white rounded-lg border-2 cursor-pointer transition-all ${
                  selectedKey === element.element_key
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {/* Drag handle + element info */}
                <div className="flex items-center gap-3">
                  <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">{element.type_name}</span>
                      {element.values.required === 'true' && (
                        <span className="text-red-400 text-xs">*</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {element.values.label || element.element_key}
                    </div>
                    {element.values.placeholder && (
                      <div className="text-xs text-gray-400 truncate">
                        {element.values.placeholder}
                      </div>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(element.element_key); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                    title="Remove element"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Drop zone at the end */}
          <div
            onDragOver={(e) => handleDragOver(e, rootElements.length)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, rootElements.length)}
            className={`h-1 transition-all rounded ${
              dragOverIndex === rootElements.length ? 'h-8 bg-blue-100 border-2 border-dashed border-blue-400' : ''
            }`}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/builder/FormCanvas.jsx
git commit -m "feat: add form canvas with HTML5 drag-and-drop for add/reorder"
```

---

## Task 6: Property Editor (Right Sidebar)

**Files:**
- Create: `client/src/components/builder/PropertyEditor.jsx`

- [ ] **Step 1: Create the property editor**

Create `client/src/components/builder/PropertyEditor.jsx`:

```jsx
import { useQuery } from '@tanstack/react-query';
import { getElementTypeProperties } from '../../api/registry';

export default function PropertyEditor({
  element,
  onUpdateValue,
  onUpdateKey,
  onUpdateOptions,
}) {
  const { data: propertyGroups = [], isLoading } = useQuery({
    queryKey: ['registry', 'element-type-properties', element?.element_type_id],
    queryFn: () => getElementTypeProperties(element.element_type_id),
    enabled: !!element,
    staleTime: Infinity,
  });

  if (!element) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-gray-400 text-sm text-center">
        Select an element on the canvas to edit its properties
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4 text-gray-400 text-sm">Loading properties...</div>;
  }

  const hasOptions = ['select', 'radio', 'checkbox_group'].includes(element.type_name);

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Element header */}
      <div className="mb-4 pb-3 border-b border-gray-200">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
          {element.type_name}
        </div>
        <div className="text-sm font-semibold text-gray-800">
          {element.values.label || element.element_key}
        </div>
      </div>

      {/* Element key */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Field Key
        </label>
        <input
          type="text"
          value={element.element_key}
          onChange={(e) => onUpdateKey(element.element_key, e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
        />
      </div>

      {/* Property groups */}
      {propertyGroups.map(group => (
        <div key={group.id} className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {group.label}
          </h4>
          <div className="space-y-2.5">
            {group.properties.map(prop => (
              <PropertyInput
                key={prop.id}
                property={prop}
                value={element.values[prop.name] ?? prop.default_value ?? ''}
                onChange={(val) => onUpdateValue(element.element_key, prop.name, val)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Options editor (for select/radio/checkbox_group) */}
      {hasOptions && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Options
          </h4>
          <OptionsEditor
            options={element.options || []}
            onChange={(opts) => onUpdateOptions(element.element_key, opts)}
          />
        </div>
      )}
    </div>
  );
}

function PropertyInput({ property, value, onChange }) {
  const { name, label, data_type, input_type, is_required } = property;

  if (input_type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">{label}</span>
        {is_required === 1 && <span className="text-red-400 text-xs">*</span>}
      </label>
    );
  }

  if (input_type === 'textarea') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {label} {is_required === 1 && <span className="text-red-400">*</span>}
        </label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {is_required === 1 && <span className="text-red-400">*</span>}
      </label>
      <input
        type={input_type === 'number' ? 'number' : 'text'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
      />
    </div>
  );
}

function OptionsEditor({ options, onChange }) {
  const addOption = () => {
    const next = [...options, { label: '', value: '', display_order: options.length }];
    onChange(next);
  };

  const removeOption = (index) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const updateOption = (index, field, val) => {
    const next = options.map((opt, i) => {
      if (i !== index) return opt;
      const updated = { ...opt, [field]: val };
      // Auto-generate value from label if value is empty or was auto-generated
      if (field === 'label' && (!opt.value || opt.value === opt.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))) {
        updated.value = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      }
      return updated;
    });
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="text"
            value={opt.label}
            onChange={(e) => updateOption(i, 'label', e.target.value)}
            placeholder="Label"
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
          />
          <input
            type="text"
            value={opt.value}
            onChange={(e) => updateOption(i, 'value', e.target.value)}
            placeholder="Value"
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none font-mono"
          />
          <button
            onClick={() => removeOption(i)}
            className="text-gray-400 hover:text-red-500 p-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={addOption}
        className="text-xs text-blue-600 hover:text-blue-800 mt-1"
      >
        + Add option
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/builder/PropertyEditor.jsx
git commit -m "feat: add property editor sidebar with dynamic inputs from registry"
```

---

## Task 7: Builder Layout + Page Integration

**Files:**
- Create: `client/src/components/builder/FormBuilderLayout.jsx`
- Replace: `client/src/pages/admin/FormBuilder.jsx`

- [ ] **Step 1: Create the three-panel builder layout**

Create `client/src/components/builder/FormBuilderLayout.jsx`:

```jsx
import ElementPalette from './ElementPalette';
import FormCanvas from './FormCanvas';
import PropertyEditor from './PropertyEditor';

export default function FormBuilderLayout({
  elements,
  selectedKey,
  selectedElement,
  onAddElement,
  onDropElement,
  onMoveElement,
  onRemoveElement,
  onSelectElement,
  onUpdateValue,
  onUpdateKey,
  onUpdateOptions,
}) {
  return (
    <div className="flex h-[calc(100vh-12rem)] border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Left sidebar — Element Palette */}
      <div className="w-60 border-r border-gray-200 bg-white flex-shrink-0">
        <ElementPalette onAddElement={onAddElement} />
      </div>

      {/* Center — Canvas */}
      <div className="flex-1 min-w-0">
        <FormCanvas
          elements={elements}
          selectedKey={selectedKey}
          onSelect={onSelectElement}
          onDrop={onDropElement}
          onMove={onMoveElement}
          onRemove={onRemoveElement}
        />
      </div>

      {/* Right sidebar — Property Editor */}
      <div className="w-72 border-l border-gray-200 bg-white flex-shrink-0">
        <PropertyEditor
          element={selectedElement}
          onUpdateValue={onUpdateValue}
          onUpdateKey={onUpdateKey}
          onUpdateOptions={onUpdateOptions}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the FormBuilder page**

Replace `client/src/pages/admin/FormBuilder.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getForm, createForm, updateForm } from '../../api/forms';
import { useBuilderState } from '../../components/builder/useBuilderState';
import FormBuilderLayout from '../../components/builder/FormBuilderLayout';

export default function FormBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const builder = useBuilderState();

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
    enabled: isEditing,
  });

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || '');
      if (form.elements) {
        builder.loadElements(form.elements);
      }
    }
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEditing ? updateForm(id, data) : createForm(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      if (!isEditing) {
        // After creating, navigate to edit the new form
        navigate(`/admin/forms/${result.id}/edit`);
      }
    },
  });

  const handleSave = () => {
    const payload = {
      name,
      description,
      elements: builder.serializeForSave(),
    };
    saveMutation.mutate(payload);
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1 py-0.5"
            placeholder="Form name"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-sm text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1 py-0.5 flex-1"
            placeholder="Description (optional)"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !name.trim()}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Three-panel builder */}
      <FormBuilderLayout
        elements={builder.elements}
        selectedKey={builder.selectedKey}
        selectedElement={builder.selectedElement}
        onAddElement={builder.addElement}
        onDropElement={builder.addElement}
        onMoveElement={builder.moveElement}
        onRemoveElement={builder.removeElement}
        onSelectElement={builder.selectElement}
        onUpdateValue={builder.updateValue}
        onUpdateKey={builder.updateElementKey}
        onUpdateOptions={builder.updateOptions}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify the frontend builds**

```bash
cd client && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/builder/FormBuilderLayout.jsx client/src/pages/admin/FormBuilder.jsx
git commit -m "feat: assemble three-panel form builder with save/load integration

- FormBuilderLayout: left palette, center canvas, right property editor
- FormBuilder page: load form from API, save via PUT with elements array
- Inline editable form name and description in top bar"
```

---

## Task 8: Update Form Renderer for Relational Data

**Files:**
- Modify: `client/src/components/FormRenderer.jsx`

The renderer currently expects Formio schema format (`{ display: 'form', components: [...] }`). It needs to also accept the new relational format (array of elements with `type_name`, `values`, `options`).

- [ ] **Step 1: Update FormRenderer to support relational data**

The renderer should detect the format: if it receives a `components` array (old Formio format), use the existing logic. If it receives an `elements` array (new relational format), use the new logic.

Add a new export `RelationalFormRenderer` to `client/src/components/FormRenderer.jsx` (append after the existing component, keeping the old one for backward compatibility):

```jsx
// New renderer for relational form data (used by the new form builder)
export function RelationalFormRenderer({ elements, onSubmit }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});

  // Sort elements by position, only root-level input elements
  const inputElements = elements
    .filter(el => !el.parent_key && !el.is_layout && !['heading', 'subheading', 'text'].includes(el.type_name))
    .sort((a, b) => a.position - b.position);

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const newErrors = {};
    for (const el of inputElements) {
      const val = values[el.element_key];
      if (el.values.required === 'true' && (!val || val === '')) {
        newErrors[el.element_key] = el.values.custom_error || `${el.values.label || el.element_key} is required`;
      }
      if (el.values.min_length && val && val.length < Number(el.values.min_length)) {
        newErrors[el.element_key] = el.values.custom_error || `Minimum ${el.values.min_length} characters`;
      }
      if (el.values.max_length && val && val.length > Number(el.values.max_length)) {
        newErrors[el.element_key] = el.values.custom_error || `Maximum ${el.values.max_length} characters`;
      }
      if (el.values.pattern && val) {
        try {
          if (!new RegExp(el.values.pattern).test(val)) {
            newErrors[el.element_key] = el.values.custom_error || 'Invalid format';
          }
        } catch { /* invalid regex, skip */ }
      }
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(values);
  };

  const renderField = (el) => {
    const value = values[el.element_key] || '';
    const error = errors[el.element_key];
    const label = el.values.label || el.element_key;
    const placeholder = el.values.placeholder || '';
    const required = el.values.required === 'true';

    const inputClass = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
      error ? 'border-red-500' : 'border-gray-300'
    }`;

    let input;
    switch (el.type_name) {
      case 'textarea':
        input = (
          <textarea
            value={value}
            onChange={(e) => handleChange(el.element_key, e.target.value)}
            placeholder={placeholder}
            rows={Number(el.values.rows) || 3}
            className={inputClass}
          />
        );
        break;
      case 'number':
        input = (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(el.element_key, e.target.value)}
            placeholder={placeholder}
            min={el.values.min_value}
            max={el.values.max_value}
            className={inputClass}
          />
        );
        break;
      case 'email':
        input = (
          <input
            type="email"
            value={value}
            onChange={(e) => handleChange(el.element_key, e.target.value)}
            placeholder={placeholder}
            className={inputClass}
          />
        );
        break;
      case 'select':
        input = (
          <select
            value={value}
            onChange={(e) => handleChange(el.element_key, e.target.value)}
            className={inputClass}
          >
            <option value="">{placeholder || 'Select...'}</option>
            {(el.options || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
        break;
      default: // textfield, phone, and fallback
        input = (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(el.element_key, e.target.value)}
            placeholder={placeholder}
            className={inputClass}
          />
        );
    }

    return (
      <div key={el.element_key} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {el.values.description && (
          <p className="text-xs text-gray-500 mb-1">{el.values.description}</p>
        )}
        {input}
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      {inputElements.map(renderField)}
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 mt-4"
      >
        Submit
      </button>
    </form>
  );
}
```

Don't forget to add `import { useState } from 'react';` at the top of the file if not already present (it should be since the existing FormRenderer uses it).

- [ ] **Step 2: Commit**

```bash
git add client/src/components/FormRenderer.jsx
git commit -m "feat: add RelationalFormRenderer for new schema format"
```

---

## Task 9: Smoke Test — Full Stack Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all server tests**

```bash
cd server && npx vitest run
```

Expected: 25+ tests PASS (database: 10, registry: 8, forms: 7).

- [ ] **Step 2: Verify frontend builds**

```bash
cd client && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 3: Manual verification**

Start the full stack (`npm run dev`) and verify:
1. Navigate to `/admin/forms/new`
2. See three-panel layout: palette on left, empty canvas center, "select an element" message on right
3. Click "Text Field" in palette — it appears on the canvas
4. Click the element on canvas — right sidebar shows properties (label, placeholder, required, etc.)
5. Edit the label to "First Name" — canvas updates
6. Enter form name, click Save — form creates and persists
7. Refresh the page — form loads with the element you added
8. Add more elements, reorder by dragging, save again — version increments
9. Registry endpoints still work at `/api/registry/element-types`

- [ ] **Step 4: Commit any fixups if needed**

---

## Summary

**Phase 2 delivers:**
- Forms API rewrite with full relational save/load (elements + values + options)
- Registry API client for frontend
- Three-panel form builder: element palette (left), canvas with DnD (center), property editor (right)
- Builder state management hook (useBuilderState)
- RelationalFormRenderer for user-facing forms
- Version pinning preserved — old versions' elements accessible via API
- 25+ server tests

**What Phase 3 will build on this:**
- Remaining element types (phone, date, time, select, radio, checkbox, toggle, file_upload)
- Options editor already in place — Phase 3 wires it for select/radio/checkbox_group
- Layout elements (Row with nested DnD, Section, Data Table)
- Content elements (Heading, Subheading, Text)
