import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * Endpoint public — vérifie si un code promo Stripe est valide et
 * retourne une description lisible à afficher côté UI ("Pro gratuit
 * pendant 12 mois", "50% la première année", etc.).
 *
 * Public car utilisé au moment du signup (pas encore de session).
 * Rate-limité agressivement pour éviter l'énumération de codes.
 */

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`promo-validate:ip:${ip}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ valid: false, error: 'Configuration indisponible' }, { status: 503 });
  }

  let body: { code?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, error: 'Requête invalide' }, { status: 400 });
  }

  const rawCode = (body.code || '').trim().toUpperCase();
  if (!rawCode) {
    return NextResponse.json({ valid: false, error: 'Code manquant' }, { status: 400 });
  }
  if (rawCode.length > 50) {
    return NextResponse.json({ valid: false, error: 'Code trop long' }, { status: 400 });
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });
    const list = await stripe.promotionCodes.list({
      code: rawCode,
      active: true,
      limit: 1,
      expand: ['data.promotion.coupon'],
    });

    const promo = list.data[0];
    if (!promo) {
      return NextResponse.json({ valid: false, error: 'Code inconnu ou expiré' });
    }

    const couponAny = (promo.promotion as unknown as { coupon: Stripe.Coupon | string | null })?.coupon;
    const coupon: Stripe.Coupon | null =
      couponAny && typeof couponAny === 'object' ? (couponAny as Stripe.Coupon) : null;

    // Limite utilisation atteinte ?
    if (
      typeof promo.max_redemptions === 'number' &&
      promo.times_redeemed >= promo.max_redemptions
    ) {
      return NextResponse.json({ valid: false, error: 'Ce code a atteint sa limite d\u2019utilisations' });
    }

    // Description lisible
    const description = buildDescription(coupon);

    return NextResponse.json({
      valid: true,
      code: promo.code,
      description,
      percent_off: coupon?.percent_off ?? null,
      amount_off_eur: coupon?.amount_off ? coupon.amount_off / 100 : null,
      duration: coupon?.duration ?? 'once',
      duration_in_months: coupon?.duration_in_months ?? null,
    });
  } catch (e) {
    console.error('[promo-codes/validate] stripe error', e);
    return NextResponse.json({ valid: false, error: 'Impossible de vérifier ce code' }, { status: 502 });
  }
}

function buildDescription(coupon: Stripe.Coupon | null): string {
  if (!coupon) return 'Code promo valide';
  const percentOff = coupon.percent_off;
  const amountOffEur = coupon.amount_off ? coupon.amount_off / 100 : null;
  const months = coupon.duration_in_months;

  // 100% = gratuit → message Pro spécifique
  if (percentOff === 100) {
    if (coupon.duration === 'forever') return 'Pro gratuit à vie';
    if (coupon.duration === 'once') return 'Pro gratuit le 1er mois';
    if (coupon.duration === 'repeating' && months) {
      return months === 1
        ? 'Pro gratuit pendant 1 mois'
        : `Pro gratuit pendant ${months} mois`;
    }
    return 'Pro gratuit';
  }

  // Réduction pourcentage
  if (percentOff) {
    const pctStr = Number.isInteger(percentOff) ? String(percentOff) : percentOff.toFixed(0);
    if (coupon.duration === 'forever') return `${pctStr}% de réduction à vie`;
    if (coupon.duration === 'once') return `${pctStr}% de réduction le 1er mois`;
    if (coupon.duration === 'repeating' && months) {
      return months === 1
        ? `${pctStr}% de réduction le 1er mois`
        : `${pctStr}% de réduction pendant ${months} mois`;
    }
    return `${pctStr}% de réduction`;
  }

  // Réduction montant fixe
  if (amountOffEur) {
    const amountStr = Number.isInteger(amountOffEur) ? String(amountOffEur) : amountOffEur.toFixed(2).replace('.', ',');
    if (coupon.duration === 'forever') return `${amountStr} € de réduction à vie`;
    if (coupon.duration === 'once') return `${amountStr} € de réduction le 1er mois`;
    if (coupon.duration === 'repeating' && months) {
      return months === 1
        ? `${amountStr} € de réduction le 1er mois`
        : `${amountStr} € de réduction pendant ${months} mois`;
    }
    return `${amountStr} € de réduction`;
  }

  return 'Code promo valide';
}
