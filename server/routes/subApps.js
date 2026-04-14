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
