import { Router, type Request, type Response } from 'express';
import { SyncService } from '../services/syncService';

const router = Router();

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const result = await SyncService.processSync(req.body);
    res.status(result.statusCode).json(result.data);
  } catch (err: any) {
    console.error('Unexpected error processing sync operation:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Internal server error'
    });
  }
});

export default router;
