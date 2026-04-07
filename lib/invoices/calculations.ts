import Decimal from 'decimal.js'
import type { LotInput } from './schemas'
import type { InvoiceTotaux } from '@/types/invoices'

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 20 })

export function calculerTotaux(
  lots: LotInput[],
  discountPercent: number,
  depositAmountDeducted: number,
  isAutoEntrepreneur: boolean
): InvoiceTotaux {
  const remiseRate = new Decimal(discountPercent).div(100)
  const tvaMap = new Map<number, Decimal>()
  let totalHtBrut = new Decimal(0)

  for (const lot of lots) {
    for (const poste of lot.postes) {
      const lineHt = new Decimal(poste.quantity).mul(poste.unit_price_ht)
      totalHtBrut = totalHtBrut.add(lineHt)
      const rate = isAutoEntrepreneur ? 0 : poste.tva_rate
      tvaMap.set(rate, (tvaMap.get(rate) ?? new Decimal(0)).add(lineHt))
    }
  }

  const remiseAmount = totalHtBrut.mul(remiseRate).toDecimalPlaces(2)
  const totalHtApresRemise = totalHtBrut.sub(remiseAmount).toDecimalPlaces(2)

  const tvaVentilation = Array.from(tvaMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, baseHtBrut]) => {
      const baseHt = baseHtBrut.mul(new Decimal(1).sub(remiseRate)).toDecimalPlaces(2)
      const montantTva = baseHt.mul(rate).div(100).toDecimalPlaces(2)
      return { rate, base_ht: baseHt.toNumber(), montant_tva: montantTva.toNumber() }
    })

  const totalTva = tvaVentilation.reduce((acc, t) => acc.add(t.montant_tva), new Decimal(0))
  const totalTtc = totalHtApresRemise.add(totalTva).toDecimalPlaces(2)

  return {
    total_ht: totalHtBrut.toNumber(),
    remise_amount: remiseAmount.toNumber(),
    total_ht_apres_remise: totalHtApresRemise.toNumber(),
    tva_ventilation: tvaVentilation,
    total_tva: totalTva.toNumber(),
    total_ttc: totalTtc.toNumber(),
    deposit_amount_deducted: depositAmountDeducted,
  }
}

export function formatMontant(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}
