const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * POST /api/customers
 * Upsert a customer.
 */
router.post('/', async (req, res) => {
  const shop_id = req.user.phone;
  const { id, name, phone, address, udhar_balance, created_at } = req.body;

  const { error } = await supabase.from('customers').upsert(
    { id, shop_id, name, phone, address, udhar_balance, created_at },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('customers upsert error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

/**
 * DELETE /api/customers/:id
 */
router.delete('/:id', async (req, res) => {
  const shop_id = req.user.phone;

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', req.params.id)
    .eq('shop_id', shop_id);

  if (error) {
    console.error('customers delete error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

module.exports = router;
