import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';
import { parseCommand } from '../services/parserService';

const router = Router();

router.post('/parse', async (req: Request, res: Response): Promise<void> => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';

    // Fetch active customers and products for context matching
    const [custResult, prodResult] = await Promise.all([
      pool.query('SELECT id, name, phone, opening_balance_paisa as balance FROM customers ORDER BY name'),
      pool.query('SELECT id, name, base_unit as "baseUnit", purchase_price_paisa as "purchasePricePaisa", sale_price_paisa as "salePricePaisa", aliases FROM products ORDER BY name')
    ]);

    const customers = custResult.rows.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      balance: r.balance / 100
    }));

    const products = prodResult.rows.map(r => ({
      id: r.id,
      name: r.name,
      baseUnit: r.baseUnit,
      purchasePricePaisa: parseInt(r.purchasePricePaisa, 10),
      salePricePaisa: parseInt(r.salePricePaisa, 10),
      aliases: Array.isArray(r.aliases) ? r.aliases : []
    }));

    const draft = parseCommand(text, customers, products);
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to parse command'
    });
  }
});

export default router;
