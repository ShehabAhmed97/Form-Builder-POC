import express from 'express';
import cors from 'cors';
import { getDb } from './db/database.js';
import { createFormsRoutes } from './routes/forms.js';
import { createSubAppsRoutes } from './routes/subApps.js';
import { createSubmissionsRoutes, createSingleSubmissionRoutes } from './routes/submissions.js';
import { createRegistryRoutes } from './routes/registry.js';

export function createApp(dbPath) {
  const app = express();
  const db = getDb(dbPath);

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Registry routes (new — read-only)
  app.use('/api/registry', createRegistryRoutes(db));

  // Form routes (adapted for new schema)
  app.use('/api/forms', createFormsRoutes(db));

  // Sub-app routes
  app.use('/api/sub-apps', createSubAppsRoutes(db));

  // Submission routes
  app.use('/api/sub-apps/:subAppId/submissions', createSubmissionsRoutes(db));
  app.use('/api/submissions', createSingleSubmissionRoutes(db));

  return app;
}

// Default export for server startup (index.js)
const app = createApp();
export default app;
