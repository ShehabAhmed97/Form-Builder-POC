import express from 'express';
import cors from 'cors';
import formsRoutes from './routes/forms.js';
import subAppsRoutes from './routes/subApps.js';
import { submissionsRoutes, singleSubmissionRoutes } from './routes/submissions.js';

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/forms', formsRoutes(db));
  app.use('/api/sub-apps', subAppsRoutes(db));
  app.use('/api/sub-apps/:subAppId/submissions', submissionsRoutes(db));
  app.use('/api/submissions', singleSubmissionRoutes(db));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  return app;
}
