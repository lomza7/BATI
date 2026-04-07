'use client'

import type { LotInput, PosteInput } from '@/lib/devis/schemas'
import { PosteRow } from './poste-row'

interface LotEditorProps {
  lot: LotInput
  index: number
  isFirst: boolean
  isLast: boolean
  isAutoEntrepreneur: boolean
  isRenovation2yr: boolean
  onChange: (updated: LotInput) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

function defaultPoste(isRenovation2yr: boolean, isAutoEntrepreneur: boolean): PosteInput {
  return {
    description: '',
    quantity: 1,
    unit: 'u',
    unit_price_ht: 0,
    tva_rate: isAutoEntrepreneur ? 0 : isRenovation2yr ? 10 : 20,
    sort_order: 0,
  }
}

export function LotEditor({
  lot,
  isFirst,
  isLast,
  isAutoEntrepreneur,
  isRenovation2yr,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: LotEditorProps) {
  function updatePoste(i: number, updated: PosteInput) {
    const postes = lot.postes.map((p, idx) => (idx === i ? updated : p))
    onChange({ ...lot, postes })
  }

  function addPoste() {
    const newPoste: PosteInput = {
      ...defaultPoste(isRenovation2yr, isAutoEntrepreneur),
      sort_order: lot.postes.length,
    }
    onChange({ ...lot, postes: [...lot.postes, newPoste] })
  }

  function removePoste(i: number) {
    const postes = lot.postes
      .filter((_, idx) => idx !== i)
      .map((p, idx) => ({ ...p, sort_order: idx }))
    onChange({ ...lot, postes })
  }

  function movePoste(i: number, direction: 'up' | 'down') {
    const postes = [...lot.postes]
    const target = direction === 'up' ? i - 1 : i + 1
    ;[postes[i], postes[target]] = [postes[target]!, postes[i]!]
    onChange({
      ...lot,
      postes: postes.map((p, idx) => ({ ...p, sort_order: idx })),
    })
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50">
      {/* Lot header */}
      <div className="flex items-center gap-2 rounded-t-lg border-b border-blue-200 bg-blue-100 px-3 py-2">
        <input
          type="text"
          placeholder="Nom du lot (ex: Lot 1 — Plomberie) *"
          value={lot.name}
          onChange={(e) => onChange({ ...lot, name: e.target.value })}
          className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ minHeight: 44 }}
          required
        />

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Monter le lot"
            className="flex h-9 w-9 items-center justify-center rounded border border-blue-300 bg-white text-blue-600 disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Descendre le lot"
            className="flex h-9 w-9 items-center justify-center rounded border border-blue-300 bg-white text-blue-600 disabled:opacity-30"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Supprimer le lot"
            className="flex h-9 w-9 items-center justify-center rounded border border-red-200 bg-white text-red-500"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Postes */}
      <div className="space-y-2 p-3">
        {lot.postes.map((poste, i) => (
          <PosteRow
            key={i}
            poste={poste}
            index={i}
            isFirst={i === 0}
            isLast={i === lot.postes.length - 1}
            isAutoEntrepreneur={isAutoEntrepreneur}
            onChange={(updated) => updatePoste(i, updated)}
            onMoveUp={() => movePoste(i, 'up')}
            onMoveDown={() => movePoste(i, 'down')}
            onRemove={() => removePoste(i)}
          />
        ))}

        {lot.postes.length === 0 && (
          <p className="py-2 text-center text-sm text-blue-400">
            Aucun poste — ajoutez-en un ci-dessous
          </p>
        )}

        <button
          type="button"
          onClick={addPoste}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-blue-400 py-3 text-sm font-medium text-blue-600 hover:bg-blue-100"
          style={{ minHeight: 48 }}
        >
          + Ajouter un poste
        </button>
      </div>
    </div>
  )
}
