import { Router } from 'express';

export function createSubAppsRoutes(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const subApps = db.prepare(`
      SELECT sa.*, f.name as form_name,
        (SELECT COUNT(*) FROM submissions s WHERE s.sub_app_id = sa.id) as submission_count
      FROM sub_apps sa
      LEFT JOIN forms f ON sa.form_id = f.id
      ORDER BY sa.created_at DESC
    `).all();
    res.json(subApps);
  });

  router.post('/', (req, res) => {
    const { name, description, form_id } = req.body;
    if (!name || !form_id) return res.status(400).json({ error: 'Name and form_id are required' });

    const result = db.prepare(
      'INSERT INTO sub_apps (name, description, form_id) VALUES (?, ?, ?)'
    ).run(name, description || '', form_id);

    const subApp = db.prepare('SELECT * FROM sub_apps WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json(subApp);
  });

  router.get('/:id', (req, res) => {
    const subApp = db.prepare(`
      SELECT sa.*, f.name as form_name, f.current_version as form_current_version
      FROM sub_apps sa
      LEFT JOIN forms f ON sa.form_id = f.id
      WHERE sa.id = ?
    `).get(req.params.id);

    if (!subApp) return res.status(404).json({ error: 'Sub-app not found' });
    res.json(subApp);
  });

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
