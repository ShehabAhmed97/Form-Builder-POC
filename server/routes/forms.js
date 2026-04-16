import { Router } from 'express';

export function createFormsRoutes(db) {
  const router = Router();

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

    const placeholders = elementIds.map(() => '?').join(',');

    const allValues = db.prepare(`
      SELECT fev.form_element_id, pd.name, fev.value
      FROM form_element_values fev
      JOIN property_definitions pd ON fev.property_definition_id = pd.id
      WHERE fev.form_element_id IN (${placeholders})
    `).all(...elementIds);

    const allOptions = db.prepare(`
      SELECT form_element_id, id, label, value, display_order
      FROM form_element_options
      WHERE form_element_id IN (${placeholders})
      ORDER BY display_order
    `).all(...elementIds);

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

  router.get('/', (req, res) => {
    const forms = db.prepare(
      'SELECT id, name, description, current_version, created_at, updated_at FROM forms ORDER BY created_at DESC'
    ).all();
    res.json(forms);
  });

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

  router.get('/:id', (req, res) => {
    const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const version = db.prepare(
      'SELECT id FROM form_versions WHERE form_id = ? AND version_num = ?'
    ).get(form.id, form.current_version);

    const elements = version ? loadVersionElements(version.id) : [];
    res.json({ ...form, elements });
  });

  router.put('/:id', (req, res) => {
    const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const { name, description, elements = [] } = req.body;
    const newVersionNum = form.current_version + 1;

    db.exec('BEGIN');
    try {
      db.prepare(
        'UPDATE forms SET name = ?, description = ?, current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(name || form.name, description ?? form.description, newVersionNum, form.id);

      const versionResult = db.prepare(
        'INSERT INTO form_versions (form_id, version_num) VALUES (?, ?)'
      ).run(form.id, newVersionNum);
      const versionId = Number(versionResult.lastInsertRowid);

      const keyToId = new Map();
      const insertElement = db.prepare(
        'INSERT INTO form_elements (form_version_id, element_type_id, element_key, position, parent_id) VALUES (?, ?, ?, ?, ?)'
      );

      for (const el of elements) {
        const result = insertElement.run(versionId, el.element_type_id, el.element_key, el.position, null);
        keyToId.set(el.element_key, Number(result.lastInsertRowid));
      }

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

  router.get('/:id/versions', (req, res) => {
    const versions = db.prepare(
      'SELECT id, form_id, version_num, created_at FROM form_versions WHERE form_id = ? ORDER BY version_num DESC'
    ).all(req.params.id);
    res.json(versions);
  });

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
