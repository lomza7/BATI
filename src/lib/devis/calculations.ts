import Decimal from 'decimal.js'
import type { DevisTotaux, TvaVentilation } from '@/types/devis'
import type { LotInput } from './schemas'

Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

export function calculerTotaux(
  lots: LotInput[],
  discountPercent: number,
  depositPercent: number,
  isAutoEntrepreneur: boolean
): DevisTotaux {
  // Accumulate per-TVA-rate totals
  const tvaMap = new Map<number, Decimal>()
  let totalHtBrut = new Decimal(0)

  for (const lot of lots) {
    for (const poste of lot.postes) {
      const qty = new Decimal(poste.quantity)
      const pu = new Decimal(poste.unit_price_ht)
      const ligneHt = qty.mul(pu).toDecimalPlaces(2)
      totalHtBrut = totalHtBrut.add(ligneHt)

      const rate = isAutoEntrepreneur ? 0 : poste.tva_rate
      tvaMap.set(rate, (tvaMap.get(rate) ?? new Decimal(0)).add(ligneHt))
    }
  }

  // Apply discount on HT
  const remiseAmount = totalHtBrut.mul(new Decimal(discountPercent).div(100)).toDecimalPlaces(2)
  const totalHtApresRemise = totalHtBrut.sub(remiseAmount).toDecimalPlaces(2)

  // Calculate TVA ventilation on HT after discount (proportional)
  const tvaVentilation: TvaVentilation[] = []
  let totalTva = new Decimal(0)

  const remiseFactor = totalHtBrut.isZero()
    ? new Decimal(1)
    : totalHtApresRemise.div(totalHtBrut)

  for (const [rate, baseHt] of tvaMap.entries()) {
    const adjustedBase = baseHt.mul(remiseFactor).toDecimalPlaces(2)
    const montantTva = adjustedBase.mul(new Decimal(rate).div(100)).toDecimalPlaces(2)
    tvaVentilation.push({
      rate,
      base_ht: adjustedBase.toNumber(),
      montant_tva: montantTva.toNumber(),
    })
    totalTva = totalTva.add(montantTva)
  }

  totalTva = totalTva.toDecimalPlaces(2)
  const totalTtc = totalHtApresRemise.add(totalTva).toDecimalPlaces(2)
  const acompteAmount = totalTtc.mul(new Decimal(depositPercent).div(100)).toDecimalPlaces(2)

  return {
    total_ht: totalHtBrut.toNumber(),
    tva_ventilation: tvaVentilation.sort((a, b) => a.rate - b.rate),
    total_tva: totalTva.toNumber(),
    remise_amount: remiseAmount.toNumber(),
    total_ht_apres_remise: totalHtApresRemise.toNumber(),
    total_ttc: totalTtc.toNumber(),
    acompte_amount: acompteAmount.toNumber(),
  }
}

export function formatMontant(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}
