const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * POST /api/shops
 * Upsert shop record. Called during ShopSetup and when the user edits shop info.
 * is_active is admin-only — it is explicitly excluded from user upserts via
 * the ignoreDuplicates: false + explicit column list so the column is never
 * overwritten by the mobile client.
 */
router.post('/', async (req, res) => {
  const shop_id = req.user.phone;
  const { shopName, ownerName, category, whatsappNumber, aiConsent } = req.body;

  const { error } = await supabase.from('shops').upsert(
    {
      id: shop_id,
      phone: shop_id,
      shop_name: shopName,
      owner_name: ownerName,
      business_category: category ?? null,
      whatsapp_number: whatsappNumber ?? null,
      ai_consent: aiConsent ?? false,
      // is_active intentionally omitted — admin controls this field
    },
    { onConflict: 'id', ignoreDuplicates: false }
  );

  if (error) {
    console.error('shops upsert error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

/**
 * GET /api/shops/me
 * Returns the authenticated shop's record including is_active.
 * Used by the mobile app to detect admin deactivation.
 */
router.get('/me', async (req, res) => {
  const shop_id = req.user.phone;

  const { data, error } = await supabase
    .from('shops')
    .select('id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active')
    .eq('id', shop_id)
    .single();

  if (error) {
    console.error('shops /me error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

module.exports = router;
