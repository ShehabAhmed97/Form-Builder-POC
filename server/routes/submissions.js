const express = require('express');

function submissionsRoutes(db) {
  const router = express.Router({ mergeParams: true });

  // List submissions for a sub-app (optionally filtered by user_id)
  router.get('/', (req, res) => {
    const { subAppId } = req.params;
    const { user_id } = req.query;

    let query = `
      SELECT s.*, fv.version_num
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
    submissions.forEach(s => { s.data = JSON.parse(s.data); });
    res.json(submissions);
  });

  // Create submission — auto-resolves current form version
  router.post('/', (req, res) => {
    const { subAppId } = req.params;
    const { user_id, data } = req.body;

    const subApp = db.prepare(`
      SELECT sa.form_id, fv.id as form_version_id
      FROM sub_apps sa
      JOIN forms f ON f.id = sa.form_id
      JOIN form_versions fv ON fv.form_id = f.id AND fv.version_num = f.current_version
      WHERE sa.id = ?
    `).get(subAppId);

    if (!subApp) return res.status(404).json({ error: 'Sub-app not found' });

    const result = db.prepare(
      'INSERT INTO submissions (sub_app_id, form_version_id, user_id, data, status) VALUES (?, ?, ?, ?, ?)'
    ).run(subAppId, subApp.form_version_id, user_id, JSON.stringify(data), 'submitted');

    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(result.lastInsertRowid);
    submission.data = JSON.parse(submission.data);
    res.status(201).json(submission);
  });

  return router;
}

function singleSubmissionRoutes(db) {
  const router = express.Router();

  // Get single submission with its form schema
  router.get('/:id', (req, res) => {
    const submission = db.prepare(`
      SELECT s.*, fv.schema, fv.version_num
      FROM submissions s
      JOIN form_versions fv ON s.form_version_id = fv.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    submission.data = JSON.parse(submission.data);
    submission.schema = JSON.parse(submission.schema);
    res.json(submission);
  });

  return router;
}

module.exports = { submissionsRoutes, singleSubmissionRoutes };
