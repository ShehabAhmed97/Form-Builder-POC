import { Router } from 'express';

export function createSubmissionsRoutes(db) {
  const router = Router({ mergeParams: true });

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
    const submissions = db.prepare(query).all(...params);
    res.json(submissions);
  });

  router.post('/', (req, res) => {
    const { subAppId } = req.params;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const subApp = db.prepare('SELECT form_id FROM sub_apps WHERE id = ?').get(subAppId);
    if (!subApp) return res.status(404).json({ error: 'Sub-app not found' });

    const form = db.prepare('SELECT current_version FROM forms WHERE id = ?').get(subApp.form_id);
    const version = db.prepare(
      'SELECT id FROM form_versions WHERE form_id = ? AND version_num = ?'
    ).get(subApp.form_id, form.current_version);

    const result = db.prepare(
      'INSERT INTO submissions (sub_app_id, form_version_id, user_id, status) VALUES (?, ?, ?, ?)'
    ).run(subAppId, version.id, user_id, 'submitted');

    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json(submission);
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
    res.json(submission);
  });

  return router;
}
