# Phase 4: Conditional Logic

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add conditional field logic — admins configure rules in the builder sidebar (e.g., "show field X when field Y equals Z"), and the renderer evaluates them in real-time. Server re-evaluates conditions during submission validation.

**Architecture:** Conditions are stored as `form_element_conditions` (action groups) and `form_element_condition_rules` (individual rules). The builder sidebar renders an inline rule builder. The renderer runs a client-side evaluation engine on every field change. The server re-evaluates conditions before validating submissions.

**Tech Stack:** React 18, Express + node:sqlite.

**Depends on:** Phase 3 complete (all element types, layout nesting, forms API).

---

## File Structure

### Files to Modify
- `server/routes/forms.js` — load/save conditions in loadVersionElements and PUT handler
- `server/routes/submissions.js` — server-side condition evaluation + field validation
- `server/tests/forms.test.js` — test condition persistence
- `server/tests/submissions.test.js` — test conditional validation
- `client/src/components/builder/useBuilderState.js` — condition management + serialization
- `client/src/components/builder/PropertyEditor.jsx` — condition builder UI section
- `client/src/components/FormRenderer.jsx` — condition evaluation engine

### Files to Create
- `client/src/components/builder/ConditionBuilder.jsx` — inline condition rule builder component

---

## Task 1: Backend — Save/Load Conditions

**Files:**
- Modify: `server/routes/forms.js`
- Modify: `server/tests/forms.test.js`

Update the forms API to persist and retrieve conditions.

- [ ] **Step 1: Add condition test to forms.test.js**

Append to the `describe('PUT /api/forms/:id')` block in `server/tests/forms.test.js`:

```js
    it('saves and loads conditions', async () => {
      const create = await request(app)
        .post('/api/forms')
        .send({ name: 'Conditions Test' });
      const formId = create.body.id;

      // Get element type IDs
      const typesRes = await request(app).get('/api/registry/element-types');
      const selectType = typesRes.body.find(c => c.name === 'selection').types.find(t => t.name === 'select');
      const textType = typesRes.body.find(c => c.name === 'basic_input').types.find(t => t.name === 'textfield');

      // Get condition action/operator IDs
      const actionsRes = await request(app).get('/api/registry/condition-actions');
      const showAction = actionsRes.body.find(a => a.name === 'show');
      const requireAction = actionsRes.body.find(a => a.name === 'require');
      const opsRes = await request(app).get('/api/registry/condition-operators');
      const equalsOp = opsRes.body.find(o => o.name === 'equals');

      await request(app).put(`/api/forms/${formId}`).send({
        name: 'Conditions Test',
        elements: [
          {
            element_type_id: selectType.id,
            element_key: 'department',
            position: 0,
            parent_key: null,
            values: { label: 'Department' },
            options: [
              { label: 'Engineering', value: 'eng', display_order: 0 },
              { label: 'HR', value: 'hr', display_order: 1 },
            ],
            conditions: [],
          },
          {
            element_type_id: textType.id,
            element_key: 'tech_stack',
            position: 1,
            parent_key: null,
            values: { label: 'Tech Stack' },
            options: [],
            conditions: [
              {
                action_type_id: showAction.id,
                action_value: null,
                logic_operator: 'AND',
                rules: [
                  { source_key: 'department', operator_id: equalsOp.id, value: 'eng' },
                ],
              },
              {
                action_type_id: requireAction.id,
                action_value: null,
                logic_operator: 'AND',
                rules: [
                  { source_key: 'department', operator_id: equalsOp.id, value: 'eng' },
                ],
              },
            ],
          },
        ],
      });

      const res = await request(app).get(`/api/forms/${formId}`);
      const techStack = res.body.elements.find(e => e.element_key === 'tech_stack');
      expect(techStack.conditions).toHaveLength(2);
      expect(techStack.conditions[0]).toMatchObject({
        action_name: 'show',
        logic_operator: 'AND',
      });
      expect(techStack.conditions[0].rules).toHaveLength(1);
      expect(techStack.conditions[0].rules[0]).toMatchObject({
        source_key: 'department',
        operator_name: 'equals',
        value: 'eng',
      });
    });
```

- [ ] **Step 2: Update loadVersionElements in forms.js to load conditions**

In the `loadVersionElements` function, after loading options, add condition loading:

```js
    // Load conditions for all elements
    const allConditions = db.prepare(`
      SELECT fec.id, fec.form_element_id, fec.action_type_id, fec.action_value,
             fec.logic_operator, fec.display_order,
             cat.name as action_name
      FROM form_element_conditions fec
      JOIN condition_action_types cat ON fec.action_type_id = cat.id
      WHERE fec.form_element_id IN (${placeholders})
      ORDER BY fec.display_order
    `).all(...elementIds);

    const conditionIds = allConditions.map(c => c.id);
    let allRules = [];
    if (conditionIds.length > 0) {
      const condPlaceholders = conditionIds.map(() => '?').join(',');
      allRules = db.prepare(`
        SELECT fecr.id, fecr.condition_id, fecr.source_element_id, fecr.operator_id,
               fecr.value, fecr.display_order,
               co.name as operator_name,
               fe.element_key as source_key
        FROM form_element_condition_rules fecr
        JOIN condition_operators co ON fecr.operator_id = co.id
        JOIN form_elements fe ON fecr.source_element_id = fe.id
        WHERE fecr.condition_id IN (${condPlaceholders})
        ORDER BY fecr.display_order
      `).all(...conditionIds);
    }

    // Group conditions by element and rules by condition
    const conditionsByElement = new Map();
    for (const c of allConditions) {
      if (!conditionsByElement.has(c.form_element_id)) conditionsByElement.set(c.form_element_id, []);
      conditionsByElement.get(c.form_element_id).push({
        id: c.id,
        action_type_id: c.action_type_id,
        action_name: c.action_name,
        action_value: c.action_value,
        logic_operator: c.logic_operator,
        display_order: c.display_order,
        rules: allRules
          .filter(r => r.condition_id === c.id)
          .map(r => ({
            id: r.id,
            source_element_id: r.source_element_id,
            source_key: r.source_key,
            operator_id: r.operator_id,
            operator_name: r.operator_name,
            value: r.value,
            display_order: r.display_order,
          })),
      });
    }
```

And add `conditions` to the element map at the end:

```js
    return elements.map(e => ({
      ...existing fields...,
      conditions: conditionsByElement.get(e.id) || [],
    }));
```

- [ ] **Step 3: Update PUT handler to save conditions**

In the PUT handler's transaction, after the options insertion loop, add:

```js
      // Insert conditions
      const insertCondition = db.prepare(
        'INSERT INTO form_element_conditions (form_element_id, action_type_id, action_value, logic_operator, display_order) VALUES (?, ?, ?, ?, ?)'
      );
      const insertRule = db.prepare(
        'INSERT INTO form_element_condition_rules (condition_id, source_element_id, operator_id, value, display_order) VALUES (?, ?, ?, ?, ?)'
      );

      for (const el of elements) {
        const elementId = keyToId.get(el.element_key);
        if (el.conditions) {
          for (let ci = 0; ci < el.conditions.length; ci++) {
            const cond = el.conditions[ci];
            const condResult = insertCondition.run(
              elementId, cond.action_type_id, cond.action_value || null, cond.logic_operator || 'AND', ci
            );
            const condId = Number(condResult.lastInsertRowid);

            if (cond.rules) {
              for (let ri = 0; ri < cond.rules.length; ri++) {
                const rule = cond.rules[ri];
                const sourceId = keyToId.get(rule.source_key);
                if (sourceId) {
                  insertRule.run(condId, sourceId, rule.operator_id, rule.value, ri);
                }
              }
            }
          }
        }
      }
```

- [ ] **Step 4: Run tests**

```bash
cd server && npx vitest run tests/forms.test.js
```

Expected: All tests pass including new condition test.

- [ ] **Step 5: Commit**

```bash
git add server/routes/forms.js server/tests/forms.test.js
git commit -m "feat: save and load conditions in forms API

- loadVersionElements now fetches conditions and rules with JOINs
- PUT handler saves conditions and rules in the version transaction
- Conditions include action_name, rules include source_key and operator_name"
```

---

## Task 2: Backend — Submission Validation with Conditions

**Files:**
- Modify: `server/routes/submissions.js`
- Create: `server/tests/submissions.test.js`

- [ ] **Step 1: Write submission validation test**

Create `server/tests/submissions.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Submissions API with conditions', () => {
  let app, formId, subAppId;
  let selectTypeId, textTypeId, showActionId, requireActionId, equalsOpId;

  beforeAll(async () => {
    app = createApp(':memory:');

    // Get registry IDs
    const types = await request(app).get('/api/registry/element-types');
    selectTypeId = types.body.find(c => c.name === 'selection').types.find(t => t.name === 'select').id;
    textTypeId = types.body.find(c => c.name === 'basic_input').types.find(t => t.name === 'textfield').id;

    const actions = await request(app).get('/api/registry/condition-actions');
    showActionId = actions.body.find(a => a.name === 'show').id;
    requireActionId = actions.body.find(a => a.name === 'require').id;

    const ops = await request(app).get('/api/registry/condition-operators');
    equalsOpId = ops.body.find(o => o.name === 'equals').id;

    // Create form with conditional field
    const form = await request(app).post('/api/forms').send({ name: 'Conditional Form' });
    formId = form.body.id;

    await request(app).put(`/api/forms/${formId}`).send({
      name: 'Conditional Form',
      elements: [
        {
          element_type_id: selectTypeId,
          element_key: 'department',
          position: 0,
          parent_key: null,
          values: { label: 'Department', required: 'true' },
          options: [
            { label: 'Engineering', value: 'eng', display_order: 0 },
            { label: 'HR', value: 'hr', display_order: 1 },
          ],
          conditions: [],
        },
        {
          element_type_id: textTypeId,
          element_key: 'tech_stack',
          position: 1,
          parent_key: null,
          values: { label: 'Tech Stack' },
          options: [],
          conditions: [
            {
              action_type_id: showActionId,
              action_value: null,
              logic_operator: 'AND',
              rules: [{ source_key: 'department', operator_id: equalsOpId, value: 'eng' }],
            },
            {
              action_type_id: requireActionId,
              action_value: null,
              logic_operator: 'AND',
              rules: [{ source_key: 'department', operator_id: equalsOpId, value: 'eng' }],
            },
          ],
        },
      ],
    });

    // Create sub-app
    const sa = await request(app).post('/api/sub-apps').send({ name: 'Test App', form_id: formId });
    subAppId = sa.body.id;
  });

  it('accepts submission when conditional field is hidden and not provided', async () => {
    const res = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({
        user_id: 'user1',
        values: { department: 'hr' },
      });
    expect(res.status).toBe(201);
  });

  it('rejects submission when conditional field is visible+required but missing', async () => {
    const res = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({
        user_id: 'user1',
        values: { department: 'eng' },
      });
    expect(res.status).toBe(400);
    expect(res.body.errors.tech_stack).toBeDefined();
  });

  it('accepts submission when conditional field is visible+required and provided', async () => {
    const res = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({
        user_id: 'user1',
        values: { department: 'eng', tech_stack: 'React, Node.js' },
      });
    expect(res.status).toBe(201);
  });

  it('saves submission values as individual rows', async () => {
    const create = await request(app)
      .post(`/api/sub-apps/${subAppId}/submissions`)
      .send({
        user_id: 'user2',
        values: { department: 'eng', tech_stack: 'Python' },
      });

    const res = await request(app).get(`/api/submissions/${create.body.id}`);
    expect(res.body.values).toBeDefined();
    expect(res.body.values.department).toBe('eng');
    expect(res.body.values.tech_stack).toBe('Python');
  });
});
```

- [ ] **Step 2: Rewrite submissions routes with validation**

Replace `server/routes/submissions.js`:

```js
import { Router } from 'express';

// Evaluate a single condition rule against submitted values
function evaluateRule(rule, values) {
  const fieldValue = values[rule.source_key] ?? '';
  switch (rule.operator_name) {
    case 'equals': return String(fieldValue) === String(rule.value);
    case 'not_equals': return String(fieldValue) !== String(rule.value);
    case 'contains': return String(fieldValue).includes(String(rule.value));
    case 'not_contains': return !String(fieldValue).includes(String(rule.value));
    case 'greater_than': return Number(fieldValue) > Number(rule.value);
    case 'less_than': return Number(fieldValue) < Number(rule.value);
    case 'is_empty': return !fieldValue || fieldValue === '';
    case 'is_not_empty': return fieldValue && fieldValue !== '';
    default: return false;
  }
}

// Evaluate a condition group (AND/OR logic)
function evaluateCondition(condition, values) {
  if (!condition.rules || condition.rules.length === 0) return false;
  if (condition.logic_operator === 'OR') {
    return condition.rules.some(rule => evaluateRule(rule, values));
  }
  return condition.rules.every(rule => evaluateRule(rule, values));
}

// Determine the effective state of each element based on conditions
function resolveConditions(elements, values) {
  const state = new Map(); // element_key -> { visible, required, disabled }

  // Initialize all elements as visible by default
  for (const el of elements) {
    state.set(el.element_key, { visible: true, required: el.values?.required === 'true', disabled: el.values?.disabled === 'true' });
  }

  // Check if any element has a "show" condition — if it does, it starts hidden
  for (const el of elements) {
    if (el.conditions?.some(c => c.action_name === 'show')) {
      state.get(el.element_key).visible = false;
    }
  }

  // Evaluate all conditions
  for (const el of elements) {
    if (!el.conditions) continue;
    for (const cond of el.conditions) {
      const result = evaluateCondition(cond, values);
      const s = state.get(el.element_key);
      if (result) {
        switch (cond.action_name) {
          case 'show': s.visible = true; break;
          case 'hide': s.visible = false; break;
          case 'require': s.required = true; break;
          case 'unrequire': s.required = false; break;
          case 'disable': s.disabled = true; break;
          case 'enable': s.disabled = false; break;
        }
      }
    }
  }

  return state;
}

export function createSubmissionsRoutes(db) {
  const router = Router({ mergeParams: true });

  // Helper: load elements with values and conditions for a form version
  function loadVersionForValidation(formVersionId) {
    const elements = db.prepare(`
      SELECT fe.id, fe.element_key, fe.parent_id, et.name as type_name, et.is_layout
      FROM form_elements fe
      JOIN element_types et ON fe.element_type_id = et.id
      WHERE fe.form_version_id = ?
    `).all(formVersionId);

    if (elements.length === 0) return [];

    const elementIds = elements.map(e => e.id);
    const placeholders = elementIds.map(() => '?').join(',');

    // Load property values
    const allValues = db.prepare(`
      SELECT fev.form_element_id, pd.name, fev.value
      FROM form_element_values fev
      JOIN property_definitions pd ON fev.property_definition_id = pd.id
      WHERE fev.form_element_id IN (${placeholders})
    `).all(...elementIds);

    const valuesByElement = new Map();
    for (const v of allValues) {
      if (!valuesByElement.has(v.form_element_id)) valuesByElement.set(v.form_element_id, {});
      valuesByElement.get(v.form_element_id)[v.name] = v.value;
    }

    // Load conditions
    const allConditions = db.prepare(`
      SELECT fec.id, fec.form_element_id, cat.name as action_name,
             fec.action_value, fec.logic_operator
      FROM form_element_conditions fec
      JOIN condition_action_types cat ON fec.action_type_id = cat.id
      WHERE fec.form_element_id IN (${placeholders})
      ORDER BY fec.display_order
    `).all(...elementIds);

    let allRules = [];
    if (allConditions.length > 0) {
      const condIds = allConditions.map(c => c.id);
      const condPlaceholders = condIds.map(() => '?').join(',');
      allRules = db.prepare(`
        SELECT fecr.condition_id, co.name as operator_name,
               fe.element_key as source_key, fecr.value
        FROM form_element_condition_rules fecr
        JOIN condition_operators co ON fecr.operator_id = co.id
        JOIN form_elements fe ON fecr.source_element_id = fe.id
        WHERE fecr.condition_id IN (${condPlaceholders})
        ORDER BY fecr.display_order
      `).all(...condIds);
    }

    const condsByElement = new Map();
    for (const c of allConditions) {
      if (!condsByElement.has(c.form_element_id)) condsByElement.set(c.form_element_id, []);
      condsByElement.get(c.form_element_id).push({
        action_name: c.action_name,
        action_value: c.action_value,
        logic_operator: c.logic_operator,
        rules: allRules.filter(r => r.condition_id === c.id),
      });
    }

    return elements.map(e => ({
      ...e,
      values: valuesByElement.get(e.id) || {},
      conditions: condsByElement.get(e.id) || [],
    }));
  }

  router.get('/', (req, res) => {
    const { subAppId } = req.params;
    const { user_id } = req.query;

    let query = `
      SELECT s.id, s.sub_app_id, s.form_version_id, s.user_id, s.status,
             s.created_at, s.updated_at, fv.version_num
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
    res.json(db.prepare(query).all(...params));
  });

  router.post('/', (req, res) => {
    const { subAppId } = req.params;
    const { user_id, values = {} } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const subApp = db.prepare('SELECT form_id FROM sub_apps WHERE id = ?').get(subAppId);
    if (!subApp) return res.status(404).json({ error: 'Sub-app not found' });

    const form = db.prepare('SELECT current_version FROM forms WHERE id = ?').get(subApp.form_id);
    const version = db.prepare(
      'SELECT id FROM form_versions WHERE form_id = ? AND version_num = ?'
    ).get(subApp.form_id, form.current_version);

    // Load form structure for validation
    const elements = loadVersionForValidation(version.id);

    // Resolve conditions to determine visibility/required state
    const elementState = resolveConditions(elements, values);

    // Validate visible, non-layout, non-content input elements
    const errors = {};
    const contentTypes = ['heading', 'subheading', 'text'];
    for (const el of elements) {
      if (el.is_layout || contentTypes.includes(el.type_name)) continue;
      const state = elementState.get(el.element_key);
      if (!state || !state.visible) continue;

      const val = values[el.element_key];
      if (state.required && (!val || val === '')) {
        errors[el.element_key] = el.values.custom_error || `${el.values.label || el.element_key} is required`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Save submission + values
    db.exec('BEGIN');
    try {
      const result = db.prepare(
        'INSERT INTO submissions (sub_app_id, form_version_id, user_id, status) VALUES (?, ?, ?, ?)'
      ).run(subAppId, version.id, user_id, 'submitted');
      const submissionId = Number(result.lastInsertRowid);

      const insertValue = db.prepare(
        'INSERT INTO submission_values (submission_id, form_element_id, value) VALUES (?, ?, ?)'
      );

      // Only save values for visible input elements
      for (const el of elements) {
        if (el.is_layout || contentTypes.includes(el.type_name)) continue;
        const state = elementState.get(el.element_key);
        if (!state || !state.visible) continue;

        const val = values[el.element_key];
        if (val !== undefined && val !== null && val !== '') {
          insertValue.run(submissionId, el.id, String(val));
        }
      }

      db.exec('COMMIT');

      const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
      res.status(201).json(submission);
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

export function createSingleSubmissionRoutes(db) {
  const router = Router();

  router.get('/:id', (req, res) => {
    const submission = db.prepare(`
      SELECT s.*, fv.version_num
      FROM submissions s
      JOIN form_versions fv ON s.form_version_id = fv.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    // Load submission values
    const valueRows = db.prepare(`
      SELECT sv.value, fe.element_key
      FROM submission_values sv
      JOIN form_elements fe ON sv.form_element_id = fe.id
      WHERE sv.submission_id = ?
    `).all(req.params.id);

    const values = {};
    for (const v of valueRows) {
      values[v.element_key] = v.value;
    }

    res.json({ ...submission, values });
  });

  return router;
}
```

- [ ] **Step 3: Run tests**

```bash
cd server && npx vitest run
```

Expected: All tests pass including new submission tests.

- [ ] **Step 4: Commit**

```bash
git add server/routes/submissions.js server/tests/submissions.test.js
git commit -m "feat: server-side condition evaluation and submission validation

- evaluateRule/evaluateCondition/resolveConditions for condition logic
- POST submission validates visible fields based on condition state
- Elements with 'show' condition start hidden, become visible when condition met
- Submission values saved as individual rows (submission_values table)
- GET submission returns values as key-value object"
```

---

## Task 3: Frontend — Condition Builder UI

**Files:**
- Create: `client/src/components/builder/ConditionBuilder.jsx`
- Modify: `client/src/components/builder/PropertyEditor.jsx`
- Modify: `client/src/components/builder/useBuilderState.js`

- [ ] **Step 1: Add condition management to useBuilderState**

Add two new functions to useBuilderState:

```js
  // Update conditions for an element
  const updateConditions = useCallback((key, conditions) => {
    setElements(prev =>
      prev.map(e =>
        e.element_key === key ? { ...e, conditions } : e
      )
    );
  }, []);
```

Add `conditions` to the serializeForSave output for each element:

```js
      conditions: (el.conditions || []).map((c, ci) => ({
        action_type_id: c.action_type_id,
        action_value: c.action_value || null,
        logic_operator: c.logic_operator || 'AND',
        rules: (c.rules || []).map((r, ri) => ({
          source_key: r.source_key,
          operator_id: r.operator_id,
          value: r.value,
        })),
      })),
```

Add `conditions: el.conditions || []` to loadElements mapping.

Return `updateConditions` from the hook.

- [ ] **Step 2: Create ConditionBuilder.jsx**

Create `client/src/components/builder/ConditionBuilder.jsx`:

```jsx
import { useQuery } from '@tanstack/react-query';
import { getConditionActions, getConditionOperators } from '../../api/registry';

export default function ConditionBuilder({ element, elements, onChange }) {
  const { data: actions = [] } = useQuery({
    queryKey: ['registry', 'condition-actions'],
    queryFn: getConditionActions,
    staleTime: Infinity,
  });

  const { data: operators = [] } = useQuery({
    queryKey: ['registry', 'condition-operators'],
    queryFn: getConditionOperators,
    staleTime: Infinity,
  });

  const conditions = element.conditions || [];

  // Available source fields (all input elements except the current one)
  const sourceFields = elements.filter(
    e => e.element_key !== element.element_key
      && !e.is_layout
      && !['heading', 'subheading', 'text'].includes(e.type_name)
  );

  const addCondition = () => {
    onChange([
      ...conditions,
      {
        action_type_id: actions[0]?.id,
        action_name: actions[0]?.name,
        action_value: null,
        logic_operator: 'AND',
        rules: [],
      },
    ]);
  };

  const removeCondition = (index) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index, field, value) => {
    onChange(conditions.map((c, i) => {
      if (i !== index) return c;
      const updated = { ...c, [field]: value };
      // Sync action_name when action_type_id changes
      if (field === 'action_type_id') {
        const action = actions.find(a => a.id === Number(value));
        updated.action_name = action?.name;
        updated.action_type_id = Number(value);
      }
      return updated;
    }));
  };

  const addRule = (condIndex) => {
    onChange(conditions.map((c, i) => {
      if (i !== condIndex) return c;
      return {
        ...c,
        rules: [
          ...c.rules,
          {
            source_key: sourceFields[0]?.element_key || '',
            operator_id: operators[0]?.id,
            operator_name: operators[0]?.name,
            value: '',
          },
        ],
      };
    }));
  };

  const removeRule = (condIndex, ruleIndex) => {
    onChange(conditions.map((c, i) => {
      if (i !== condIndex) return c;
      return { ...c, rules: c.rules.filter((_, ri) => ri !== ruleIndex) };
    }));
  };

  const updateRule = (condIndex, ruleIndex, field, value) => {
    onChange(conditions.map((c, i) => {
      if (i !== condIndex) return c;
      return {
        ...c,
        rules: c.rules.map((r, ri) => {
          if (ri !== ruleIndex) return r;
          const updated = { ...r, [field]: value };
          if (field === 'operator_id') {
            const op = operators.find(o => o.id === Number(value));
            updated.operator_name = op?.name;
            updated.operator_id = Number(value);
          }
          return updated;
        }),
      };
    }));
  };

  // Check for circular dependencies
  const getCircularWarning = (condIndex) => {
    const cond = conditions[condIndex];
    if (!cond?.rules) return null;
    for (const rule of cond.rules) {
      const sourceEl = elements.find(e => e.element_key === rule.source_key);
      if (sourceEl?.conditions?.some(c =>
        c.rules?.some(r => r.source_key === element.element_key)
      )) {
        return `Circular dependency: "${rule.source_key}" also depends on "${element.element_key}"`;
      }
    }
    return null;
  };

  if (sourceFields.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">
        Add more fields to create conditions
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {conditions.map((cond, ci) => {
        const circularWarning = getCircularWarning(ci);
        return (
          <div key={ci} className="border border-gray-200 rounded-lg p-2.5 bg-gray-50">
            {/* Condition header: action + remove */}
            <div className="flex items-center gap-2 mb-2">
              <select
                value={cond.action_type_id || ''}
                onChange={(e) => updateCondition(ci, 'action_type_id', e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:border-blue-500 outline-none"
              >
                {actions.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>

              {cond.action_name === 'set_value' && (
                <input
                  type="text"
                  value={cond.action_value || ''}
                  onChange={(e) => updateCondition(ci, 'action_value', e.target.value)}
                  placeholder="Value"
                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                />
              )}

              <button
                onClick={() => removeCondition(ci)}
                className="text-gray-400 hover:text-red-500 p-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Circular dependency warning */}
            {circularWarning && (
              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mb-2">
                {circularWarning}
              </div>
            )}

            {/* Logic operator */}
            {cond.rules.length > 1 && (
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[10px] text-gray-400">When</span>
                <select
                  value={cond.logic_operator}
                  onChange={(e) => updateCondition(ci, 'logic_operator', e.target.value)}
                  className="px-1.5 py-0.5 text-[10px] border border-gray-300 rounded"
                >
                  <option value="AND">ALL</option>
                  <option value="OR">ANY</option>
                </select>
                <span className="text-[10px] text-gray-400">of these are true:</span>
              </div>
            )}

            {/* Rules */}
            <div className="space-y-1.5">
              {cond.rules.map((rule, ri) => (
                <div key={ri} className="flex items-center gap-1">
                  <select
                    value={rule.source_key || ''}
                    onChange={(e) => updateRule(ci, ri, 'source_key', e.target.value)}
                    className="flex-1 px-1.5 py-1 text-[11px] border border-gray-300 rounded focus:border-blue-500 outline-none"
                  >
                    <option value="">Select field...</option>
                    {sourceFields.map(f => (
                      <option key={f.element_key} value={f.element_key}>
                        {f.values.label || f.element_key}
                      </option>
                    ))}
                  </select>
                  <select
                    value={rule.operator_id || ''}
                    onChange={(e) => updateRule(ci, ri, 'operator_id', e.target.value)}
                    className="px-1.5 py-1 text-[11px] border border-gray-300 rounded focus:border-blue-500 outline-none"
                  >
                    {operators.map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                  {!['is_empty', 'is_not_empty'].includes(rule.operator_name) && (
                    <input
                      type="text"
                      value={rule.value || ''}
                      onChange={(e) => updateRule(ci, ri, 'value', e.target.value)}
                      placeholder="value"
                      className="w-16 px-1.5 py-1 text-[11px] border border-gray-300 rounded focus:border-blue-500 outline-none"
                    />
                  )}
                  <button
                    onClick={() => removeRule(ci, ri)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => addRule(ci)}
              className="text-[10px] text-blue-600 hover:text-blue-800 mt-1.5"
            >
              + Add rule
            </button>
          </div>
        );
      })}

      <button
        onClick={addCondition}
        className="text-xs text-blue-600 hover:text-blue-800"
      >
        + Add condition
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Add conditions section to PropertyEditor**

In `PropertyEditor.jsx`, after the options section, add the conditions section. Import `ConditionBuilder` and add a new prop `onUpdateConditions` and `allElements`:

```jsx
// Add import:
import ConditionBuilder from './ConditionBuilder';

// Add to props: allElements, onUpdateConditions

// Add section after options (before closing </div>):
      {/* Conditions section — not for layout/content elements */}
      {!element.is_layout && !['heading', 'subheading', 'text'].includes(element.type_name) && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Conditions
          </h4>
          <ConditionBuilder
            element={element}
            elements={allElements}
            onChange={(conditions) => onUpdateConditions(element.element_key, conditions)}
          />
        </div>
      )}
```

- [ ] **Step 4: Wire conditions through FormBuilderLayout and FormBuilder page**

In `FormBuilderLayout.jsx`, add `allElements` and `onUpdateConditions` props, pass them to PropertyEditor.

In `FormBuilder.jsx` page, pass `allElements={builder.elements}` and `onUpdateConditions={builder.updateConditions}`.

- [ ] **Step 5: Verify build**

```bash
cd client && npx vite build
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components/builder/ConditionBuilder.jsx client/src/components/builder/PropertyEditor.jsx client/src/components/builder/useBuilderState.js client/src/components/builder/FormBuilderLayout.jsx client/src/pages/admin/FormBuilder.jsx
git commit -m "feat: add condition builder UI in property editor sidebar

- ConditionBuilder: inline rule builder with action/source/operator/value dropdowns
- Circular dependency detection with visual warning
- AND/OR logic toggle for multi-rule conditions
- Conditions managed in useBuilderState and serialized for API save"
```

---

## Task 4: Frontend — Condition Evaluation in Renderer

**Files:**
- Modify: `client/src/components/FormRenderer.jsx`

- [ ] **Step 1: Add condition evaluation to RelationalFormRenderer**

The same `evaluateRule`, `evaluateCondition`, and `resolveConditions` logic from the server needs to run client-side in real-time. Add these functions and integrate them into the render cycle.

Key changes to `RelationalFormRenderer`:
1. Add `evaluateRule(rule, values)` and `evaluateCondition(condition, values)` functions
2. Add `resolveConditions(elements, values)` that returns a Map of element states
3. Call `resolveConditions` on every render (it recalculates when `values` change)
4. Use the resolved state to show/hide fields, toggle required, set values, toggle disabled
5. Only validate visible fields

The condition evaluation logic:
- Elements with a "show" condition start hidden, become visible when condition evaluates to true
- Elements with a "hide" condition start visible, become hidden when condition evaluates to true  
- "require"/"unrequire" toggle the required state
- "set_value" sets the field value when condition is true
- "disable"/"enable" toggle the disabled state

- [ ] **Step 2: Commit**

```bash
git add client/src/components/FormRenderer.jsx
git commit -m "feat: real-time condition evaluation in form renderer

- evaluateRule/evaluateCondition/resolveConditions client-side engine
- Show/hide, require/unrequire, set_value, disable/enable actions
- Elements with 'show' conditions start hidden
- Only visible fields validated on submit"
```

---

## Task 5: Smoke Test

- [ ] **Step 1: Run all server tests**

```bash
cd server && npx vitest run
```

- [ ] **Step 2: Verify frontend builds**

```bash
cd client && npx vite build
```

- [ ] **Step 3: Manual verification**

1. Create form with a Department dropdown (options: Engineering, HR)
2. Add a "Tech Stack" text field
3. Select Tech Stack, open Conditions in right sidebar
4. Add condition: action=Show, rule: department equals eng
5. Add another condition: action=Make Required, rule: department equals eng
6. Save form
7. Create a sub-app pointing to this form
8. As a user, open the sub-app submission page
9. Select "HR" — Tech Stack field should be hidden
10. Select "Engineering" — Tech Stack field appears and is required
11. Try to submit without Tech Stack — should show validation error
12. Fill Tech Stack and submit — should succeed
