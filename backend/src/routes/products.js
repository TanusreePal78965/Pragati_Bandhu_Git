const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * POST /api/products
 * Upsert a product (handles INSERT and UPDATE from sync_queue).
 */
router.post('/', async (req, res) => {
  const shop_id = req.user.phone;
  const { id, name, category_id, brand_id, purchase_price, selling_price,
          stock_quantity, min_stock_threshold, uom, updated_at } = req.body;

  const { error } = await supabase.from('products').upsert(
    { id, shop_id, name, category_id, brand_id, purchase_price, selling_price,
      stock_quantity, min_stock_threshold, uom, updated_at },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('products upsert error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

/**
 * DELETE /api/products/:id
 * Delete a product. Only deletes rows owned by the requesting shop.
 */
router.delete('/:id', async (req, res) => {
  const shop_id = req.user.phone;

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', req.params.id)
    .eq('shop_id', shop_id);

  if (error) {
    console.error('products delete error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

module.exports = router;
