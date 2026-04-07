'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImportReport {
  created: number
  skipped: number
  errors: Array<{ row: number; message: string }>
  async?: boolean
  message?: string
}

export function CsvImporter() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.csv') && f.type !== 'text/csv') {
      alert('Veuillez sélectionner un fichier CSV (.csv)')
      return
    }
    setFile(f)
    setReport(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setReport(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/clients/import', {
        method: 'POST',
        body: formData,
      })

      const data: ImportReport = await res.json()

      if (!res.ok && res.status !== 202) {
        throw new Error(data.message ?? "Erreur lors de l'import")
      }

      setReport(data)

      if (data.created > 0) {
        router.refresh()
      }
    } catch (err) {
      setReport({
        created: 0,
        skipped: 0,
        errors: [{ row: 0, message: err instanceof Error ? err.message : 'Erreur inconnue' }],
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Drag & drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : file
            ? 'border-green-500 bg-green-50'
            : 'border-border hover:border-primary hover:bg-accent'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        {file ? (
          <>
            <FileText className="h-10 w-10 text-green-600" />
            <div>
              <p className="font-medium text-green-700">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(1)} Ko — Prêt à importer
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
              className="text-sm text-muted-foreground hover:text-destructive"
            >
              Changer de fichier
            </button>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Déposez votre fichier CSV ici</p>
              <p className="text-sm text-muted-foreground">
                ou cliquez pour parcourir — formats EBP, Ciel Compta, générique
              </p>
            </div>
          </>
        )}
      </div>

      {/* Help */}
      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Formats supportés</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>EBP — export clients (colonnes : Nom ou Raison sociale, Email, Téléphone...)</li>
          <li>Ciel Compta — export tiers (colonnes : Intitulé, N° SIRET...)</li>
          <li>Générique — colonnes Nom, Email, Téléphone, Adresse, Ville, Code postal, SIRET</li>
        </ul>
        <p>Encodage : UTF-8 ou ISO-8859-1. Séparateur : virgule ou point-virgule.</p>
      </div>

      {file && !report && (
        <Button
          size="lg"
          onClick={handleImport}
          disabled={loading}
          className="w-full min-h-[48px] gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Import en cours...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Importer les clients
            </>
          )}
        </Button>
      )}

      {/* Report */}
      {report && (
        <div className="space-y-3">
          {report.async ? (
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Loader2 className="h-5 w-5 shrink-0 text-blue-600 animate-spin" />
              <div>
                <p className="font-medium text-blue-700">Import en cours en arrière-plan</p>
                <p className="text-sm text-blue-600">{report.message}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <p className="font-medium">Résultat de l&apos;import</p>
              <div className="flex gap-6">
                <span className="flex items-center gap-1.5 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {report.created} créé{report.created > 1 ? 's' : ''}
                </span>
                {report.skipped > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    {report.skipped} ignoré{report.skipped > 1 ? 's' : ''} (doublons)
                  </span>
                )}
                {report.errors.length > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-destructive">
                    <XCircle className="h-4 w-4" />
                    {report.errors.length} erreur{report.errors.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {report.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
              <p className="text-sm font-medium text-destructive">Erreurs détaillées</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {report.errors.map((e) => (
                  <li key={e.row} className="text-xs text-destructive">
                    {e.row > 0 ? `Ligne ${e.row} : ` : ''}{e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.created > 0 && (
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/clients')}
              className="w-full min-h-[48px]"
            >
              Voir les clients importés
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
