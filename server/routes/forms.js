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
