import { ErrorRequestHandler } from 'express';
import { AppError } from '../errors';
import { AgentError } from '../agents/agentError';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AgentError) {
    res.status(502).json({ error: err.message });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
};
