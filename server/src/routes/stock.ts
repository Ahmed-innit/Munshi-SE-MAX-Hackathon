import { Router, type Request, type Response } from 'express';
import { pool } from '../config/db';

const router = Router();

router.get('/stock', async (req: Request, res: Response) => {
  try {
    const productId = req.query.productId as string | undefined;

    let queryText = `
      SELECT 
        p.id, 
        p.name, 
        p.base_unit, 
        p.low_stock_threshold_base,
        p.purchase_price_paisa,
        p.sale_price_paisa,
        COALESCE(SUM(s.quantity_base), 0)::BIGINT AS current_stock
      FROM products p
      LEFT JOIN stock_movements s ON s.product_id = p.id
    `;
    const params: any[] = [];

    if (productId) {
      queryText += ' WHERE p.id = $1 ';
      params.push(productId);
    }

    queryText += ' GROUP BY p.id, p.name, p.base_unit, p.low_stock_threshold_base, p.purchase_price_paisa, p.sale_price_paisa ORDER BY p.name ASC';

    const result = await pool.query(queryText, params);

    const stockItems = result.rows.map((row) => {
      const currentStock = parseInt(row.current_stock, 10);
      const lowStockThresholdBase = parseInt(row.low_stock_threshold_base, 10);

      return {
        productId: row.id,
        productName: row.name,
        baseUnit: row.base_unit,
        purchasePricePaisa: parseInt(row.purchase_price_paisa, 10),
        salePricePaisa: parseInt(row.sale_price_paisa, 10),
        currentStock,
        lowStockThresholdBase,
        isLowStock: currentStock <= lowStockThresholdBase
      };
    });

    if (productId && stockItems.length === 0) {
      res.status(404).json({
        status: 'error',
        message: `Product ${productId} not found`
      });
      return;
    }

    res.status(200).json(productId ? stockItems[0] : stockItems);
  } catch (err: any) {
    console.error('Error fetching stock:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to compute stock'
    });
  }
});

export default router;
