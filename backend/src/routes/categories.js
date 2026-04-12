const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * POST /api/categories
 * Upsert a category.
 */
router.post('/', async (req, res) => {
  const shop_id = req.user.phone;
  const { id, name, icon, icon_color } = req.body;

  const { error } = await supabase.from('categories').upsert(
    { id, shop_id, name, icon, icon_color },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('categories upsert error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

/**
 * DELETE /api/categories/:id
 */
router.delete('/:id', async (req, res) => {
  const shop_id = req.user.phone;

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', req.params.id)
    .eq('shop_id', shop_id);

  if (error) {
    console.error('categories delete error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

module.exports = router;
