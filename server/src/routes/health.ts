import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT 1 AS connected');
    if (result.rows.length > 0) {
      res.status(200).json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
      return;
    }
    res.status(503).json({
      status: 'error',
      database: 'unhealthy'
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    });
  }
});

export default router;
