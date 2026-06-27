import express, { Router } from 'express';
import cors from 'cors';
import cvRoutes from './routes/cv.routes';
import jobsRoutes from './routes/jobs.routes';
import scoreRoutes from './routes/score.routes';
import resultsRoutes from './routes/results.routes';
import analyzeRoutes from './routes/analyze.routes';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import titleRoutes from './routes/title.routes';
import cvImproveRoutes from './routes/cvImprove.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const api = Router();
api.use('/auth', authRoutes);
api.use('/admin', adminRoutes);
api.use(cvRoutes);
api.use('/title', titleRoutes);
api.use('/jobs', jobsRoutes);
api.use('/analyze', analyzeRoutes);
api.use('/cv-improve', cvImproveRoutes);
api.use('/score', scoreRoutes);
api.use('/results', resultsRoutes);

app.use('/api', api);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

export default app;
