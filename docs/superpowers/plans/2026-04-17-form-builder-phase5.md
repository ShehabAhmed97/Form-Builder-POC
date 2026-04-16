# Phase 5: Polish & Completion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the platform with form copy/duplicate, version history viewer, submission viewer rebuilt for relational data, undo/redo in the builder, and overall UI/UX polish.

**Architecture:** Form duplication is a server-side deep copy. Version history and submission viewer are frontend pages reading from existing API endpoints. Undo/redo uses an operation stack in the builder state hook. UI polish touches Layout, FormTemplates, SubApps pages, and the builder.

**Tech Stack:** React 18, TanStack Query, Express + node:sqlite, TailwindCSS.

**Depends on:** Phases 1-4 complete.

---

## File Structure

### Files to Create
- `server/tests/forms-duplicate.test.js` — tests for form duplicate endpoint

### Files to Modify
- `server/routes/forms.js` — add POST /api/forms/:id/duplicate endpoint
- `client/src/components/builder/useBuilderState.js` — undo/redo stack
- `client/src/components/builder/FormBuilderLayout.jsx` — undo/redo buttons
- `client/src/pages/admin/FormBuilder.jsx` — wire undo/redo, add copy-from option on new
- `client/src/pages/admin/FormTemplates.jsx` — add duplicate button, refresh UI
- `client/src/pages/admin/FormVersionHistory.jsx` — rebuild for relational data
- `client/src/pages/admin/SubAppSubmissions.jsx` — rebuild submission viewer
- `client/src/components/SubmissionViewer.jsx` — render relational submission values
- `client/src/pages/user/CreateRequest.jsx` — use RelationalFormRenderer
- `client/src/components/Layout.jsx` — UI polish

---

## Task 1: Form Duplicate API

**Files:**
- Modify: `server/routes/forms.js`
- Create: `server/tests/forms-duplicate.test.js`

- [ ] **Step 1: Write the test**

Create `server/tests/forms-duplicate.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('POST /api/forms/:id/duplicate', () => {
  let app;

  beforeAll(() => {
    app = createApp(':memory:');
  });

  it('duplicates a form with all elements, values, options, and conditions', async () => {
    // Create and populate source form
    const create = await request(app).post('/api/forms').send({ name: 'Source Form' });
    const sourceId = create.body.id;

    const typesRes = await request(app).get('/api/registry/element-types');
    const textType = typesRes.body.find(c => c.name === 'basic_input').types.find(t => t.name === 'textfield');
    const selectType = typesRes.body.find(c => c.name === 'selection').types.find(t => t.name === 'select');

    const actionsRes = await request(app).get('/api/registry/condition-actions');
    const showAction = actionsRes.body.find(a => a.name === 'show');
    const opsRes = await request(app).get('/api/registry/condition-operators');
    const equalsOp = opsRes.body.find(o => o.name === 'equals');

    await request(app).put(`/api/forms/${sourceId}`).send({
      name: 'Source Form',
      elements: [
        {
          element_type_id: selectType.id,
          element_key: 'dept',
          position: 0,
          parent_key: null,
          values: { label: 'Department', required: 'true' },
          options: [
            { label: 'Eng', value: 'eng', display_order: 0 },
            { label: 'HR', value: 'hr', display_order: 1 },
          ],
          conditions: [],
        },
        {
          element_type_id: textType.id,
          element_key: 'stack',
          position: 1,
          parent_key: null,
          values: { label: 'Stack' },
          options: [],
          conditions: [
            {
              action_type_id: showAction.id,
              action_value: null,
              logic_operator: 'AND',
              rules: [{ source_key: 'dept', operator_id: equalsOp.id, value: 'eng' }],
            },
          ],
        },
      ],
    });

    // Duplicate
    const dupRes = await request(app).post(`/api/forms/${sourceId}/duplicate`);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.id).not.toBe(sourceId);
    expect(dupRes.body.name).toBe('Source Form (Copy)');
    expect(dupRes.body.current_version).toBe(1);

    // Verify duplicate has all elements
    const loaded = await request(app).get(`/api/forms/${dupRes.body.id}`);
    expect(loaded.body.elements).toHaveLength(2);
    expect(loaded.body.elements[0].element_key).toBe('dept');
    expect(loaded.body.elements[0].options).toHaveLength(2);
    expect(loaded.body.elements[1].element_key).toBe('stack');
    expect(loaded.body.elements[1].conditions).toHaveLength(1);
    expect(loaded.body.elements[1].conditions[0].rules[0].source_key).toBe('dept');
  });

  it('returns 404 for non-existent form', async () => {
    const res = await request(app).post('/api/forms/9999/duplicate');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Add duplicate endpoint to forms.js**

Read `server/routes/forms.js`. Add this route AFTER the `GET /:id/versions/:versionId` route but BEFORE `return router`:

```js
  // POST /api/forms/:id/duplicate — deep copy form as new entity
  router.post('/:id/duplicate', (req, res) => {
    const sourceForm = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!sourceForm) return res.status(404).json({ error: 'Form not found' });

    // Load current version's elements
    const sourceVersion = db.prepare(
      'SELECT id FROM form_versions WHERE form_id = ? AND version_num = ?'
    ).get(sourceForm.id, sourceForm.current_version);

    const sourceElements = sourceVersion ? loadVersionElements(sourceVersion.id) : [];

    db.exec('BEGIN');
    try {
      // Create new form
      const formResult = db.prepare(
        'INSERT INTO forms (name, description) VALUES (?, ?)'
      ).run(`${sourceForm.name} (Copy)`, sourceForm.description);
      const newFormId = Number(formResult.lastInsertRowid);

      // Create version 1
      const versionResult = db.prepare(
        'INSERT INTO form_versions (form_id, version_num) VALUES (?, 1)'
      ).run(newFormId);
      const newVersionId = Number(versionResult.lastInsertRowid);

      // Deep copy elements
      const oldKeyToNewId = new Map();
      const insertElement = db.prepare(
        'INSERT INTO form_elements (form_version_id, element_type_id, element_key, position, parent_id) VALUES (?, ?, ?, ?, ?)'
      );

      // First pass: insert all elements without parent_id
      for (const el of sourceElements) {
        const result = insertElement.run(newVersionId, el.element_type_id, el.element_key, el.position, null);
        oldKeyToNewId.set(el.element_key, Number(result.lastInsertRowid));
      }

      // Second pass: set parent_id
      const updateParent = db.prepare('UPDATE form_elements SET parent_id = ? WHERE id = ?');
      for (const el of sourceElements) {
        if (el.parent_id) {
          // Find the source parent's key
          const parentEl = sourceElements.find(e => e.id === el.parent_id);
          if (parentEl) {
            const newParentId = oldKeyToNewId.get(parentEl.element_key);
            const newElementId = oldKeyToNewId.get(el.element_key);
            if (newParentId && newElementId) {
              updateParent.run(newParentId, newElementId);
            }
          }
        }
      }

      // Copy values
      const getPropId = db.prepare('SELECT id FROM property_definitions WHERE name = ?');
      const insertValue = db.prepare(
        'INSERT INTO form_element_values (form_element_id, property_definition_id, value) VALUES (?, ?, ?)'
      );
      for (const el of sourceElements) {
        const newElId = oldKeyToNewId.get(el.element_key);
        for (const [propName, propValue] of Object.entries(el.values || {})) {
          const prop = getPropId.get(propName);
          if (prop) insertValue.run(newElId, prop.id, propValue);
        }
      }

      // Copy options
      const insertOption = db.prepare(
        'INSERT INTO form_element_options (form_element_id, label, value, display_order) VALUES (?, ?, ?, ?)'
      );
      for (const el of sourceElements) {
        const newElId = oldKeyToNewId.get(el.element_key);
        for (const opt of el.options || []) {
          insertOption.run(newElId, opt.label, opt.value, opt.display_order);
        }
      }

      // Copy conditions and rules
      const insertCondition = db.prepare(
        'INSERT INTO form_element_conditions (form_element_id, action_type_id, action_value, logic_operator, display_order) VALUES (?, ?, ?, ?, ?)'
      );
      const insertRule = db.prepare(
        'INSERT INTO form_element_condition_rules (condition_id, source_element_id, operator_id, value, display_order) VALUES (?, ?, ?, ?, ?)'
      );
      for (const el of sourceElements) {
        const newElId = oldKeyToNewId.get(el.element_key);
        for (const cond of el.conditions || []) {
          const condResult = insertCondition.run(
            newElId, cond.action_type_id, cond.action_value, cond.logic_operator, cond.display_order
          );
          const newCondId = Number(condResult.lastInsertRowid);
          for (const rule of cond.rules || []) {
            const newSourceId = oldKeyToNewId.get(rule.source_key);
            if (newSourceId) {
              insertRule.run(newCondId, newSourceId, rule.operator_id, rule.value, rule.display_order);
            }
          }
        }
      }

      db.exec('COMMIT');

      const newForm = db.prepare('SELECT * FROM forms WHERE id = ?').get(newFormId);
      res.status(201).json(newForm);
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 3: Run tests**

```bash
cd server && npx vitest run
```

Expected: All tests pass including new duplicate tests.

- [ ] **Step 4: Commit**

```bash
git add server/routes/forms.js server/tests/forms-duplicate.test.js
git commit -m "feat: add form duplicate endpoint with deep copy of elements, options, and conditions"
```

---

## Task 2: Undo/Redo in Builder

**Files:**
- Modify: `client/src/components/builder/useBuilderState.js`
- Modify: `client/src/components/builder/FormBuilderLayout.jsx`
- Modify: `client/src/pages/admin/FormBuilder.jsx`

- [ ] **Step 1: Add undo/redo to useBuilderState**

Read `client/src/components/builder/useBuilderState.js`. Add an undo/redo stack using `useRef` for history. The approach:

- Keep a `history` array (past states) and `future` array (undone states) in refs
- Before each mutation, push current elements to history
- `undo()` pops history, pushes current to future
- `canUndo` / `canRedo` booleans

Add these imports and state at the top of the hook:
```js
import { useState, useCallback, useRef } from 'react';
```

Inside the hook, add:
```js
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const maxHistory = 50;

  // Call before any mutation to save current state
  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-(maxHistory - 1)), elements];
    futureRef.current = [];
  }, [elements]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    futureRef.current = [elements, ...futureRef.current];
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setElements(prev);
    setSelectedKey(null);
  }, [elements]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    historyRef.current = [...historyRef.current, elements];
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    setElements(next);
    setSelectedKey(null);
  }, [elements]);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
```

Then wrap each mutating function (`addElement`, `removeElement`, `moveElement`, `moveToParent`, `updateValue`, `updateElementKey`, `updateOptions`, `updateConditions`) to call `pushHistory()` before the `setElements` call. The simplest approach: at the start of each callback body, add `pushHistory();`.

But since `pushHistory` uses `elements` state, you need to be careful with stale closures. The cleanest approach is to push history inside the `setElements` callback using a wrapper:

```js
  const setElementsWithHistory = useCallback((updater) => {
    setElements(prev => {
      historyRef.current = [...historyRef.current.slice(-(maxHistory - 1)), prev];
      futureRef.current = [];
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  }, []);
```

Then replace `setElements` with `setElementsWithHistory` in: `addElement`, `removeElement`, `moveElement`, `moveToParent`, `updateValue`, `updateElementKey`, `updateOptions`, `updateConditions`.

Keep `setElements` (without history) for `loadElements` — loading from API shouldn't be undoable.

Return `undo`, `redo`, `canUndo`, `canRedo` from the hook.

- [ ] **Step 2: Add undo/redo buttons to FormBuilderLayout**

Read `FormBuilderLayout.jsx`. Add `onUndo`, `onRedo`, `canUndo`, `canRedo` to props. Add a toolbar above the three panels:

```jsx
      {/* Toolbar */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          Redo
        </button>
      </div>
```

- [ ] **Step 3: Wire undo/redo in FormBuilder page**

Pass `onUndo={builder.undo}`, `onRedo={builder.redo}`, `canUndo={builder.canUndo}`, `canRedo={builder.canRedo}` to FormBuilderLayout.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/builder/useBuilderState.js client/src/components/builder/FormBuilderLayout.jsx client/src/pages/admin/FormBuilder.jsx
git commit -m "feat: add undo/redo to form builder with 50-step history"
```

---

## Task 3: Frontend Pages — Version History, Submission Viewer, CreateRequest

**Files:**
- Modify: `client/src/pages/admin/FormVersionHistory.jsx`
- Modify: `client/src/pages/admin/SubAppSubmissions.jsx`
- Modify: `client/src/components/SubmissionViewer.jsx`
- Modify: `client/src/pages/admin/FormTemplates.jsx`
- Modify: `client/src/pages/user/CreateRequest.jsx`

These pages need to work with the new relational data format.

- [ ] **Step 1: Update FormVersionHistory.jsx**

Read the current file. Replace it to work with the new API (no more schema JSON — versions have elements):

```jsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getForm, getFormVersions, getFormVersion } from '../../api/forms';
import { useState } from 'react';

export default function FormVersionHistory() {
  const { id } = useParams();
  const [selectedVersionId, setSelectedVersionId] = useState(null);

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
  });

  const { data: versions = [] } = useQuery({
    queryKey: ['form-versions', id],
    queryFn: () => getFormVersions(id),
  });

  const { data: versionDetail } = useQuery({
    queryKey: ['form-version', id, selectedVersionId],
    queryFn: () => getFormVersion(id, selectedVersionId),
    enabled: !!selectedVersionId,
  });

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{form?.name || 'Form'}</h1>
      <p className="text-gray-500 text-sm mb-6">Version History</p>

      <div className="flex gap-6">
        {/* Version list */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow divide-y">
            {versions.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selectedVersionId === v.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="text-sm font-medium">Version {v.version_num}</div>
                <div className="text-xs text-gray-400">
                  {new Date(v.created_at).toLocaleString()}
                </div>
                {v.version_num === form?.current_version && (
                  <span className="text-xs text-green-600 font-medium">Current</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Version detail */}
        <div className="flex-1">
          {versionDetail ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">
                Version {versionDetail.version_num} — {versionDetail.elements?.length || 0} elements
              </h3>
              <div className="space-y-2">
                {(versionDetail.elements || []).map(el => (
                  <div key={el.element_key} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">{el.type_name}</span>
                      <span className="text-sm font-medium">{el.values?.label || el.element_key}</span>
                      {el.values?.required === 'true' && <span className="text-red-400 text-xs">*</span>}
                    </div>
                    {el.options?.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        Options: {el.options.map(o => o.label).join(', ')}
                      </div>
                    )}
                    {el.conditions?.length > 0 && (
                      <div className="text-xs text-blue-400 mt-1">
                        {el.conditions.length} condition(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
              Select a version to view its elements
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update SubmissionViewer.jsx**

Read the current file. Replace it to render relational submission values:

```jsx
export default function SubmissionViewer({ submission }) {
  if (!submission) return null;

  const values = submission.values || {};
  const entries = Object.entries(values);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-600">Submission #{submission.id}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          submission.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
          submission.status === 'approved' ? 'bg-green-100 text-green-700' :
          submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {submission.status}
        </span>
      </div>

      <div className="text-xs text-gray-400 mb-4">
        By: {submission.user_id} | {new Date(submission.created_at).toLocaleString()}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No values submitted</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value]) => (
            <div key={key}>
              <div className="text-xs font-medium text-gray-500">{key}</div>
              <div className="text-sm text-gray-800 mt-0.5">
                {typeof value === 'object' ? JSON.stringify(value) : String(value) || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update SubAppSubmissions.jsx**

Read the current file. Update to use the new submissions API format (submissions have `values` object from GET /api/submissions/:id, not `data` JSON):

```jsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSubApp } from '../../api/subApps';
import { getSubmissions, getSubmission } from '../../api/submissions';
import SubmissionViewer from '../../components/SubmissionViewer';

export default function SubAppSubmissions() {
  const { id } = useParams();
  const [selectedId, setSelectedId] = useState(null);

  const { data: subApp } = useQuery({
    queryKey: ['subApp', id],
    queryFn: () => getSubApp(id),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => getSubmissions(id),
  });

  const { data: selectedSubmission } = useQuery({
    queryKey: ['submission', selectedId],
    queryFn: () => getSubmission(selectedId),
    enabled: !!selectedId,
  });

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{subApp?.name || 'Sub-App'}</h1>
      <p className="text-gray-500 text-sm mb-6">Submissions ({submissions.length})</p>

      <div className="flex gap-6">
        {/* Submissions list */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-lg shadow divide-y">
            {submissions.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">No submissions yet</div>
            ) : (
              submissions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedId === s.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">#{s.id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      s.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                      s.status === 'approved' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{s.status}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{s.user_id}</div>
                  <div className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString()}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected submission */}
        <div className="flex-1">
          {selectedSubmission ? (
            <div className="bg-white rounded-lg shadow p-6">
              <SubmissionViewer submission={selectedSubmission} />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">
              Select a submission to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update FormTemplates.jsx — add duplicate button**

Read the current file. Add a "Duplicate" button to each form row that calls `POST /api/forms/:id/duplicate`:

Import `duplicateForm` from the forms API. Add a mutation:
```jsx
const duplicateMutation = useMutation({
  mutationFn: (id) => duplicateForm(id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forms'] }),
});
```

Add a duplicate button next to the edit/versions links for each form.

- [ ] **Step 5: Update CreateRequest.jsx — use RelationalFormRenderer**

Read `client/src/pages/user/CreateRequest.jsx`. Update it to use `RelationalFormRenderer` when the sub-app returns elements (new relational format). The sub-app API returns `elements` when the form has them.

Import `{ RelationalFormRenderer }` from `../../components/FormRenderer` and use it when `subApp.elements` is available (or fallback to old schema-based renderer).

Since the sub-app GET endpoint currently doesn't return elements, update the CreateRequest page to fetch the form directly:

```jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSubApp } from '../../api/subApps';
import { getForm } from '../../api/forms';
import { createSubmission } from '../../api/submissions';
import { useAuth } from '../../components/AuthContext';
import { RelationalFormRenderer } from '../../components/FormRenderer';

export default function CreateRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [submitError, setSubmitError] = useState(null);

  const { data: subApp, isLoading: loadingSubApp } = useQuery({
    queryKey: ['subApp', id],
    queryFn: () => getSubApp(id),
  });

  const { data: form, isLoading: loadingForm } = useQuery({
    queryKey: ['form', subApp?.form_id],
    queryFn: () => getForm(subApp.form_id),
    enabled: !!subApp?.form_id,
  });

  const submitMutation = useMutation({
    mutationFn: (values) => createSubmission(id, { user_id: userId, values }),
    onSuccess: () => navigate(`/sub-apps/${id}`),
    onError: (err) => setSubmitError(err.message),
  });

  if (loadingSubApp || loadingForm) return <div className="p-6">Loading...</div>;
  if (!subApp) return <div className="p-6">Sub-app not found</div>;

  const elements = form?.elements || [];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{subApp.name}</h1>
      <p className="text-gray-600 mb-6">{subApp.description}</p>

      {submitError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{submitError}</div>
      )}

      {elements.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <RelationalFormRenderer
            elements={elements}
            onSubmit={(values) => submitMutation.mutate(values)}
          />
        </div>
      ) : (
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          No form elements configured. The admin needs to add fields to this form.
        </div>
      )}
    </div>
  );
}
```

Note: The submission API now expects `{ user_id, values: { key: value } }` instead of `{ user_id, data: { key: value } }`.

- [ ] **Step 6: Verify build**

```bash
cd client && npx vite build
```

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/FormVersionHistory.jsx client/src/pages/admin/SubAppSubmissions.jsx client/src/components/SubmissionViewer.jsx client/src/pages/admin/FormTemplates.jsx client/src/pages/user/CreateRequest.jsx
git commit -m "feat: update all pages for relational data format

- FormVersionHistory: shows version elements with properties and conditions
- SubAppSubmissions: two-panel layout with submission value viewer
- SubmissionViewer: renders key-value pairs from submission_values
- FormTemplates: duplicate button for each form
- CreateRequest: uses RelationalFormRenderer with condition evaluation"
```

---

## Task 4: Final Smoke Test

- [ ] **Step 1: Run all tests**

```bash
cd server && npx vitest run
```

- [ ] **Step 2: Verify build**

```bash
cd client && npx vite build
```

- [ ] **Step 3: Comprehensive manual verification**

Full end-to-end flow:
1. Admin creates form, adds fields with drag-and-drop
2. Adds a Row with 2 columns, nests fields inside
3. Adds a select with options, adds a conditional text field
4. Saves form, version 2 created
5. Duplicates form — new form appears with "(Copy)" suffix
6. Version history shows v1 (empty) and v2 (with elements)
7. Edits form, undo works to revert, redo works to re-apply
8. Creates sub-app pointing to form
9. As user, opens sub-app, fills form with conditions working
10. Submits — server validates correctly
11. Admin views submission — values displayed correctly
