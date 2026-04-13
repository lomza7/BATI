import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const ADMIN_EMAIL = 'louis@maaza.pro';

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

function getStripe() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return null;
  return new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });
}

// GET — list all promotion codes
export async function GET(request: Request) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Stripe non configure' }, { status: 503 });

  try {
    const promoCodes = await stripe.promotionCodes.list({
      limit: 100,
      expand: ['data.promotion.coupon'],
    });

    const codes = promoCodes.data.map(pc => {
      const coupon = typeof pc.promotion.coupon === 'object' && pc.promotion.coupon
        ? pc.promotion.coupon
        : null;
      return {
        id: pc.id,
        code: pc.code,
        active: pc.active,
        percent_off: coupon?.percent_off ?? null,
        amount_off: coupon?.amount_off ?? null,
        currency: coupon?.currency ?? null,
        duration: coupon?.duration ?? null,
        duration_in_months: coupon?.duration_in_months ?? null,
        max_redemptions: pc.max_redemptions,
        times_redeemed: pc.times_redeemed,
        expires_at: pc.expires_at ? new Date(pc.expires_at * 1000).toISOString() : null,
        created: new Date(pc.created * 1000).toISOString(),
      };
    });

    return NextResponse.json({ codes });
  } catch (e) {
    console.error('promo-codes GET error', e);
    return NextResponse.json({ error: 'Erreur Stripe' }, { status: 500 });
  }
}

// POST — create a new promotion code
export async function POST(request: Request) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Stripe non configure' }, { status: 503 });

  try {
    const body = await request.json();
    const {
      code,
      percent_off,
      amount_off,
      duration = 'once',
      duration_in_months,
      max_redemptions,
      expires_at,
    } = body as {
      code: string;
      percent_off?: number;
      amount_off?: number;
      duration?: 'once' | 'repeating' | 'forever';
      duration_in_months?: number;
      max_redemptions?: number;
      expires_at?: string;
    };

    if (!code) {
      return NextResponse.json({ error: 'Le code est requis' }, { status: 400 });
    }
    if (!percent_off && !amount_off) {
      return NextResponse.json({ error: 'Indiquez un pourcentage ou un montant de réduction' }, { status: 400 });
    }

    // Create the coupon first
    const couponParams: Stripe.CouponCreateParams = {
      name: `Promo ${code.toUpperCase()}`,
      duration,
      ...(duration === 'repeating' && duration_in_months ? { duration_in_months } : {}),
      ...(percent_off ? { percent_off } : {}),
      ...(amount_off ? { amount_off: amount_off * 100, currency: 'eur' } : {}),
    };

    const coupon = await stripe.coupons.create(couponParams);

    // Create the promotion code linked to the coupon
    const promoParams: Stripe.PromotionCodeCreateParams = {
      promotion: { type: 'coupon', coupon: coupon.id },
      coupon: coupon.id,
      code: code.toUpperCase(),
      ...(max_redemptions ? { max_redemptions } : {}),
      ...(expires_at ? { expires_at: Math.floor(new Date(expires_at).getTime() / 1000) } : {}),
    };

    const promoCode = await stripe.promotionCodes.create(promoParams);

    return NextResponse.json({
      id: promoCode.id,
      code: promoCode.code,
      percent_off: coupon.percent_off,
      amount_off: coupon.amount_off ? coupon.amount_off / 100 : null,
    });
  } catch (e) {
    console.error('promo-codes POST error', e);
    const msg = e instanceof Stripe.errors.StripeError ? e.message : 'Erreur lors de la creation du code promo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — deactivate a promotion code
export async function DELETE(request: Request) {
  const user = await verifyAdmin(request);
  if (!user) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Stripe non configure' }, { status: 503 });

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

    await stripe.promotionCodes.update(id, { active: false });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('promo-codes DELETE error', e);
    return NextResponse.json({ error: 'Erreur lors de la desactivation' }, { status: 500 });
  }
}
