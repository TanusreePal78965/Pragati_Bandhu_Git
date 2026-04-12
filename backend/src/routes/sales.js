const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * POST /api/sales
 * Insert a complete bill transaction: bill + bill_items + sales_log entries.
 *
 * The sync_queue for bills carries the full payload:
 * { bill: {...}, items: [...], salesLog: [...] }
 *
 * Uses upsert throughout so retries from the sync queue are safe.
 */
router.post('/', async (req, res) => {
  const shop_id = req.user.phone;
  const { bill, items, salesLog } = req.body;

  if (!bill || !items) {
    return res.status(400).json({ error: 'bill and items are required' });
  }

  // 1. Upsert bill
  const { error: billError } = await supabase
    .from('bills')
    .upsert({ ...bill, shop_id }, { onConflict: 'id' });

  if (billError) {
    console.error('sales bill upsert error:', billError.message);
    return res.status(500).json({ error: billError.message });
  }

  // 2. Upsert bill items
  const { error: itemsError } = await supabase
    .from('bill_items')
    .upsert(items, { onConflict: 'id' });

  if (itemsError) {
    console.error('sales bill_items upsert error:', itemsError.message);
    return res.status(500).json({ error: itemsError.message });
  }

  // 3. Insert sales log entries (if provided)
  if (salesLog && salesLog.length > 0) {
    const { error: logError } = await supabase
      .from('sales_log')
      .upsert(
        salesLog.map((entry) => ({ ...entry, shop_id })),
        { onConflict: 'id' }
      );

    if (logError) {
      console.error('sales_log upsert error:', logError.message);
      return res.status(500).json({ error: logError.message });
    }
  }

  res.json({ success: true });
});

module.exports = router;
