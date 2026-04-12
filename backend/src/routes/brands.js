const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * POST /api/brands
 * Upsert a brand.
 */
router.post('/', async (req, res) => {
  const shop_id = req.user.phone;
  const { id, name, color } = req.body;

  const { error } = await supabase.from('brands').upsert(
    { id, shop_id, name, color },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('brands upsert error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

/**
 * DELETE /api/brands/:id
 */
router.delete('/:id', async (req, res) => {
  const shop_id = req.user.phone;

  const { error } = await supabase
    .from('brands')
    .delete()
    .eq('id', req.params.id)
    .eq('shop_id', shop_id);

  if (error) {
    console.error('brands delete error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

module.exports = router;
