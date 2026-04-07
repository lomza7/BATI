'use client'

import type { PosteInput } from '@/lib/quotes/schemas'
import { formatMontant } from '@/lib/quotes/calculations'
import Decimal from 'decimal.js'

interface PosteRowProps {
  poste: PosteInput
  index: number
  isFirst: boolean
  isLast: boolean
  isAutoEntrepreneur: boolean
  onChange: (updated: PosteInput) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

const TVA_OPTIONS = [0, 10, 20]
const UNITS = ['u', 'm', 'm²', 'm³', 'ml', 'h', 'j', 'lot', 'forfait']

export function PosteRow({
  poste,
  isFirst,
  isLast,
  isAutoEntrepreneur,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: PosteRowProps) {
  const totalHt = new Decimal(poste.quantity || 0)
    .mul(new Decimal(poste.unit_price_ht || 0))
    .toDecimalPlaces(2)
    .toNumber()

  function update(field: keyof PosteInput, value: string | number) {
    onChange({ ...poste, [field]: value })
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      {/* Description */}
      <div className="mb-2">
        <input
          type="text"
          placeholder="Description du poste *"
          value={poste.description}
          onChange={(e) => update('description', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ minHeight: 44 }}
          required
        />
      </div>

      {/* Qty / Unit / PU HT / TVA — responsive grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Quantité</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={poste.quantity}
            onChange={(e) => update('quantity', parseFloat(e.target.value) || 0)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ minHeight: 44 }}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Unité</label>
          <select
            value={poste.unit}
            onChange={(e) => update('unit', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ minHeight: 44 }}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">PU HT (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={poste.unit_price_ht}
            onChange={(e) => update('unit_price_ht', parseFloat(e.target.value) || 0)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ minHeight: 44 }}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">TVA</label>
          {isAutoEntrepreneur ? (
            <div className="flex items-center rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" style={{ minHeight: 44 }}>
              0% (AE)
            </div>
          ) : (
            <select
              value={poste.tva_rate}
              onChange={(e) => update('tva_rate', parseInt(e.target.value))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ minHeight: 44 }}
            >
              {TVA_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Total + actions */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          Total HT : {formatMontant(totalHt)}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Monter le poste"
            className="flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-gray-500 disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Descendre le poste"
            className="flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-gray-500 disabled:opacity-30"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Supprimer le poste"
            className="flex h-9 w-9 items-center justify-center rounded border border-red-200 text-red-500"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
