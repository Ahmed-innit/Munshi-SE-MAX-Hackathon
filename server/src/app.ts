import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import syncRouter from './routes/sync';

export const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', healthRouter);
app.use('/api', syncRouter);

export default app;
