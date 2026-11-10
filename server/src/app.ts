import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import healthRouter from './routes/health';
import syncRouter from './routes/sync';
import balancesRouter from './routes/balances';
import stockRouter from './routes/stock';
import parseRouter from './routes/parse';

export const app = express();

// Serve frontend static files from workspace root
app.use(express.static(path.resolve(__dirname, '../../')));

// Parse ALLOWED_ORIGINS env variable
const rawOrigins = process.env.ALLOWED_ORIGINS;
const allowedOrigins = rawOrigins
  ? rawOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

app.use(express.json());

// Handle malformed JSON input: JSON errors, never stack traces
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      status: 'rejected',
      code: 'INVALID_DATA',
      reason: 'Malformed JSON payload'
    });
    return;
  }
  next(err);
});

// API Routes (supports both direct Express routing and Vercel serverless rewrites)
app.use('/api', healthRouter);
app.use('/api', syncRouter);
app.use('/api', balancesRouter);
app.use('/api', stockRouter);
app.use('/api', parseRouter);

app.use(healthRouter);
app.use(syncRouter);
app.use(balancesRouter);
app.use(stockRouter);
app.use(parseRouter);

// Global error handler: Return JSON, never stack traces
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

export default app;
