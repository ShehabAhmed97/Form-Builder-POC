const express = require('express');
const cors = require('cors');

function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/forms', require('./routes/forms')(db));
  app.use('/api/sub-apps', require('./routes/subApps')(db));

  const { submissionsRoutes, singleSubmissionRoutes } = require('./routes/submissions');
  app.use('/api/sub-apps/:subAppId/submissions', submissionsRoutes(db));
  app.use('/api/submissions', singleSubmissionRoutes(db));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  return app;
}

module.exports = { createApp };
