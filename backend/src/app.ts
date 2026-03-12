import express from 'express';
import cors from 'cors';
import cvRoutes from './routes/cv.routes';
import jobsRoutes from './routes/jobs.routes';
import scoreRoutes from './routes/score.routes';
import resultsRoutes from './routes/results.routes';
import analyzeRoutes from './routes/analyze.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/cv', cvRoutes);
app.use('/jobs', jobsRoutes);
app.use('/score', scoreRoutes);
app.use('/results', resultsRoutes);
app.use('/analyze', analyzeRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

export default app;
