/**
 * send-sms Edge Function
 *
 * Supabase Auth "Send SMS Hook" — called internally by Supabase whenever
 * a Phone OTP is generated. Routes the OTP delivery through Fast2SMS.
 *
 * Hook payload:
 *   { user: { phone: "+919876543210", ... }, sms: { otp: "123456" } }
 *
 * Supabase Dashboard setup:
 *   Authentication → Hooks → Send SMS Hook → point to this function URL
 *   Edge Functions → Secrets → add FAST2SMS_API_KEY
 */
Deno.serve(async (req) => {
  const { user, sms } = await req.json();

  // Supabase stores phone in E.164 format (+919876543210)
  // Fast2SMS expects 10-digit number only
  const phone = user.phone.replace('+91', '');
  const otp = sms.otp;

  const params = new URLSearchParams({
    authorization: Deno.env.get('FAST2SMS_API_KEY')!,
    route: 'otp',
    variables_values: otp,
    flash: '0',
    numbers: phone,
  });

  const response = await fetch(
    `https://www.fast2sms.com/dev/bulkV2?${params.toString()}`
  );

  if (!response.ok) {
    console.error('Fast2SMS error:', await response.text());
    return new Response(
      JSON.stringify({ error: 'Failed to send OTP' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Supabase expects an empty 200 response on success
  return new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
