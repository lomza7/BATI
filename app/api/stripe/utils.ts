import Stripe from 'stripe';

export async function resolveStripePrice(
  stripe: Stripe,
  priceOrProductId: string
) {
  const normalizedId = priceOrProductId.trim();

  if (!normalizedId) {
    throw new Error('Identifiant Stripe vide');
  }

  if (normalizedId.startsWith('price_')) {
    return stripe.prices.retrieve(normalizedId, {
      expand: ['product'],
    });
  }

  if (normalizedId.startsWith('prod_')) {
    const product = await stripe.products.retrieve(normalizedId, {
      expand: ['default_price'],
    });

    if (product.default_price && typeof product.default_price !== 'string') {
      return stripe.prices.retrieve(product.default_price.id, {
        expand: ['product'],
      });
    }

    const { data } = await stripe.prices.list({
      product: normalizedId,
      active: true,
      limit: 10,
    });

    const resolvedPrice = data.find((price) => price.type === 'recurring') || data[0];

    if (!resolvedPrice) {
      throw new Error('Aucun prix actif trouve pour ce produit Stripe');
    }

    return stripe.prices.retrieve(resolvedPrice.id, {
      expand: ['product'],
    });
  }

  throw new Error('Identifiant Stripe invalide. Collez un price_... ou un prod_...');
}
