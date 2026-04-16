import { Router } from 'express';

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

function evaluateCondition(condition, values) {
  if (!condition.rules || condition.rules.length === 0) return false;
  if (condition.logic_operator === 'OR') {
    return condition.rules.some(rule => evaluateRule(rule, values));
  }
  return condition.rules.every(rule => evaluateRule(rule, values));
}

function resolveConditions(elements, values) {
  const state = new Map();

  for (const el of elements) {
    state.set(el.element_key, {
      visible: true,
      required: el.values?.required === 'true',
      disabled: el.values?.disabled === 'true',
    });
  }

  for (const el of elements) {
    if (el.conditions?.some(c => c.action_name === 'show')) {
      state.get(el.element_key).visible = false;
    }
  }

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
    if (user_id) { query += ' AND s.user_id = ?'; params.push(user_id); }
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

    const elements = loadVersionForValidation(version.id);
    const elementState = resolveConditions(elements, values);

    // Identify data_table elements and their children
    const dataTableElements = elements.filter(e => e.type_name === 'data_table');
    const dataTableChildIds = new Set();
    for (const table of dataTableElements) {
      for (const child of elements) {
        if (child.parent_id === table.id) dataTableChildIds.add(child.element_key);
      }
    }

    const errors = {};
    const contentTypes = ['heading', 'subheading', 'text'];
    for (const el of elements) {
      if (el.is_layout || contentTypes.includes(el.type_name)) continue;
      if (dataTableChildIds.has(el.element_key)) continue;
      const state = elementState.get(el.element_key);
      if (!state || !state.visible) continue;
      const val = values[el.element_key];
      if (state.required && (!val || val === '')) {
        errors[el.element_key] = el.values.custom_error || `${el.values.label || el.element_key} is required`;
      }
    }

    // Data table validation
    for (const table of dataTableElements) {
      const tableState = elementState.get(table.element_key);
      if (!tableState || !tableState.visible) continue;

      const tableKey = table.element_key;
      const rawValue = values[tableKey];
      const rows = Array.isArray(rawValue) ? rawValue : [];
      const minRows = Number(table.values?.min_rows) || 0;
      const tableChildren = elements.filter(e => e.parent_id === table.id);

      if (minRows > 0 && rows.length < minRows) {
        errors[tableKey] = `At least ${minRows} row${minRows > 1 ? 's' : ''} required`;
      }

      for (let ri = 0; ri < rows.length; ri++) {
        for (const col of tableChildren) {
          const cellVal = rows[ri]?.[col.element_key] ?? '';
          const cellErrorKey = `${tableKey}.${ri}.${col.element_key}`;
          if (col.values?.required === 'true' && (!cellVal || cellVal === '')) {
            errors[cellErrorKey] = col.values.custom_error || `${col.values.label || col.element_key} is required`;
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    db.exec('BEGIN');
    try {
      const result = db.prepare(
        'INSERT INTO submissions (sub_app_id, form_version_id, user_id, status) VALUES (?, ?, ?, ?)'
      ).run(subAppId, version.id, user_id, 'submitted');
      const submissionId = Number(result.lastInsertRowid);

      const insertValue = db.prepare(
        'INSERT INTO submission_values (submission_id, form_element_id, value) VALUES (?, ?, ?)'
      );
      for (const el of elements) {
        if (el.is_layout || contentTypes.includes(el.type_name)) continue;
        if (dataTableChildIds.has(el.element_key)) continue;
        const state = elementState.get(el.element_key);
        if (!state || !state.visible) continue;
        const val = values[el.element_key];
        if (val !== undefined && val !== null && val !== '') {
          insertValue.run(submissionId, el.id, String(val));
        }
      }

      // Store data_table values as JSON arrays
      for (const table of dataTableElements) {
        const tableState = elementState.get(table.element_key);
        if (!tableState || !tableState.visible) continue;
        const rawValue = values[table.element_key];
        if (Array.isArray(rawValue) && rawValue.length > 0) {
          insertValue.run(submissionId, table.id, JSON.stringify(rawValue));
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

    const valueRows = db.prepare(`
      SELECT sv.value, fe.element_key
      FROM submission_values sv
      JOIN form_elements fe ON sv.form_element_id = fe.id
      WHERE sv.submission_id = ?
    `).all(req.params.id);

    const values = {};
    for (const v of valueRows) {
      if (v.value && v.value.startsWith('[')) {
        try {
          values[v.element_key] = JSON.parse(v.value);
          continue;
        } catch { /* not JSON, store as string */ }
      }
      values[v.element_key] = v.value;
    }

    res.json({ ...submission, values });
  });

  return router;
}
