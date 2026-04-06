'use client'

import { useMemo } from 'react'
import type { LotInput } from '@/lib/devis/schemas'
import { calculerTotaux, formatMontant } from '@/lib/devis/calculations'

interface DevisSummaryProps {
  lots: LotInput[]
  discountPercent: number
  depositPercent: number
  isAutoEntrepreneur?: boolean
}

export function DevisSummary({
  lots,
  discountPercent,
  depositPercent,
  isAutoEntrepreneur = false,
}: DevisSummaryProps) {
  const totaux = useMemo(
    () => calculerTotaux(lots, discountPercent, depositPercent, isAutoEntrepreneur),
    [lots, discountPercent, depositPercent, isAutoEntrepreneur]
  )

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Récapitulatif</h3>
      <div className="space-y-1.5">
        <SummaryRow label="Total HT" value={formatMontant(totaux.total_ht)} />

        {totaux.remise_amount > 0 && (
          <>
            <SummaryRow
              label={`Remise (${discountPercent}%)`}
              value={`− ${formatMontant(totaux.remise_amount)}`}
              className="text-orange-600"
            />
            <SummaryRow
              label="Total HT après remise"
              value={formatMontant(totaux.total_ht_apres_remise)}
            />
          </>
        )}

        {isAutoEntrepreneur ? (
          <SummaryRow label="TVA (non applicable)" value="—" className="text-gray-400" />
        ) : (
          totaux.tva_ventilation.map((tva) => (
            <SummaryRow
              key={tva.rate}
              label={`TVA ${tva.rate}% (base ${formatMontant(tva.base_ht)})`}
              value={formatMontant(tva.montant_tva)}
            />
          ))
        )}

        <div className="my-2 border-t border-gray-300" />

        <SummaryRow
          label="TOTAL TTC"
          value={formatMontant(totaux.total_ttc)}
          bold
        />

        {totaux.acompte_amount > 0 && (
          <SummaryRow
            label={`Acompte à la commande (${depositPercent}%)`}
            value={formatMontant(totaux.acompte_amount)}
            className="text-blue-600"
          />
        )}
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  bold = false,
  className = '',
}: {
  label: string
  value: string
  bold?: boolean
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}
