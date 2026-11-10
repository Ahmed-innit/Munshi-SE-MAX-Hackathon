import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';

const router = Router();

router.get('/balances', async (req: Request, res: Response) => {
  try {
    const customerId = req.query.customerId as string | undefined;

    let queryText = `
      SELECT 
        c.id, 
        c.name, 
        c.phone, 
        c.opening_balance_paisa,
        COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount_paisa ELSE 0 END), 0)::BIGINT AS debit_paisa,
        COALESCE(SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount_paisa ELSE 0 END), 0)::BIGINT AS credit_paisa
      FROM customers c
      LEFT JOIN ledger_entries l ON l.customer_id = c.id
    `;
    const params: any[] = [];

    if (customerId) {
      queryText += ' WHERE c.id = $1 ';
      params.push(customerId);
    }

    queryText += ' GROUP BY c.id, c.name, c.phone, c.opening_balance_paisa ORDER BY c.name ASC';

    const result = await pool.query(queryText, params);

    const balances = result.rows.map((row) => {
      const opening = parseInt(row.opening_balance_paisa, 10);
      const debit = parseInt(row.debit_paisa, 10);
      const credit = parseInt(row.credit_paisa, 10);
      const balance = opening + debit - credit;

      return {
        customerId: row.id,
        customerName: row.name,
        phone: row.phone,
        openingBalancePaisa: opening,
        debitPaisa: debit,
        creditPaisa: credit,
        balancePaisa: balance
      };
    });

    if (customerId && balances.length === 0) {
      res.status(404).json({
        status: 'error',
        message: `Customer ${customerId} not found`
      });
      return;
    }

    res.status(200).json(customerId ? balances[0] : balances);
  } catch (err: any) {
    console.error('Error fetching balances:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to compute balances'
    });
  }
});

export default router;
