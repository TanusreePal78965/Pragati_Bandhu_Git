// mobile-shopai/src/services/subscription.ts
import { supabase } from '../lib/supabase';

export type ShopStatus = {
  isActive: boolean;
  activeDeviceId: string | null;
  aiConsent: boolean;
  allowOutOfStockBilling: boolean;
  planType: string | null;
  planExpiresAt: string | null;
};

/**
 * Shop flags plus this app's subscription. Plans live in app_subscriptions
 * (one row per app); RLS returns only this shop's rows.
 */
export const fetchShopStatus = async (shopId: string): Promise<ShopStatus | null> => {
  const [{ data: shop, error: shopError }, { data: sub, error: subError }] = await Promise.all([
    supabase
      .from('shops')
      .select('is_active, active_device_id, ai_consent, allow_out_of_stock_billing')
      .eq('id', shopId)
      .maybeSingle(),
    supabase
      .from('app_subscriptions')
      .select('plan_type, expires_at, is_active')
      .eq('shop_id', shopId)
      .eq('app', 'shopai')
      .maybeSingle(),
  ]);
  if (shopError || subError || !shop) return null;
  return {
    isActive: shop.is_active !== false && sub?.is_active !== false,
    activeDeviceId: shop.active_device_id ?? null,
    aiConsent: shop.ai_consent === true,
    allowOutOfStockBilling: shop.allow_out_of_stock_billing === true,
    planType: sub?.plan_type ?? null,
    planExpiresAt: sub?.expires_at ?? null,
  };
};

export const isPlanExpired = (planExpiresAt: string | null | undefined): boolean =>
  planExpiresAt ? new Date(planExpiresAt) < new Date() : false;
