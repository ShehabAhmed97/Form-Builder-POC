import { Router } from 'express';

export function createFormsRoutes(db) {
  const router = Router();

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

      db.prepare(
        'INSERT INTO form_versions (form_id, version_num) VALUES (?, 1)'
      ).run(formId);

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
    res.json(form);
  });

  router.put('/:id', (req, res) => {
    const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const { name, description } = req.body;
    db.prepare(
      'UPDATE forms SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name || form.name, description ?? form.description, req.params.id);

    const updated = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    res.json(updated);
  });

  router.get('/:id/versions', (req, res) => {
    const versions = db.prepare(
      'SELECT id, form_id, version_num, created_at FROM form_versions WHERE form_id = ? ORDER BY version_num DESC'
    ).all(req.params.id);
    res.json(versions);
  });

  return router;
}
