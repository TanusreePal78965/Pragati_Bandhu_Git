import jwt from 'jsonwebtoken';

const SUPABASE_URL = 'https://xjumfscbazjwhcgmhsyl.supabase.co';
const ADMIN_JWT_SECRET = 'super_secure_jwt_secret_pragati_bandhu_987654321';

const token = jwt.sign({ role: 'superadmin' }, ADMIN_JWT_SECRET, { expiresIn: '1h' });

async function test() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/shops`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text.substring(0, 200));
}

test();
