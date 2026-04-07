import { PDFDocument, rgb, StandardFonts, type RGB } from 'pdf-lib'
import type { DevisWithDetails } from '@/types/devis'
import { calculerTotaux, formatMontant } from '@/lib/devis/calculations'
import type { LotInput } from '@/lib/devis/schemas'

interface ArtisanProfile {
  full_name: string | null
  company_name: string | null
  siret: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  phone: string | null
  email: string
  insurance_decennale_number: string | null
  insurance_decennale_company: string | null
  rge_number: string | null
  tva_number: string | null
  is_auto_entrepreneur: boolean
}

const COLORS = {
  primary: rgb(0.063, 0.243, 0.682) as RGB, // #102EAE — bleu Hellobat
  dark: rgb(0.1, 0.1, 0.1) as RGB,
  gray: rgb(0.5, 0.5, 0.5) as RGB,
  lightGray: rgb(0.92, 0.92, 0.92) as RGB,
  white: rgb(1, 1, 1) as RGB,
}

const MARGINS = { top: 50, bottom: 50, left: 50, right: 50 }
const PAGE_WIDTH = 595 // A4
const PAGE_HEIGHT = 842
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(iso))
}

export async function generateDevisPdf(
  devis: DevisWithDetails,
  profile: ArtisanProfile
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGINS.top

  // Helper: draw text
  function text(
    str: string,
    x: number,
    yPos: number,
    opts: { size?: number; bold?: boolean; color?: RGB; maxWidth?: number } = {}
  ) {
    const font = opts.bold ? fontBold : fontRegular
    const size = opts.size ?? 9
    const color = opts.color ?? COLORS.dark
    page.drawText(str, { x, y: yPos, size, font, color, ...(opts.maxWidth !== undefined ? { maxWidth: opts.maxWidth } : {}) })
  }

  function newPageIfNeeded(neededHeight: number) {
    if (y - neededHeight < MARGINS.bottom) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGINS.top
    }
  }

  // ── Header: bande bleue ──────────────────────────────────────────
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 90,
    width: PAGE_WIDTH,
    height: 90,
    color: COLORS.primary,
  })
  text('DEVIS', MARGINS.left, PAGE_HEIGHT - 35, { size: 24, bold: true, color: COLORS.white })
  text(devis.reference, MARGINS.left, PAGE_HEIGHT - 55, { size: 11, color: COLORS.white })
  text(`Émis le ${formatDate(devis.created_at)}`, MARGINS.left, PAGE_HEIGHT - 68, {
    size: 9,
    color: COLORS.white,
  })
  if (devis.valid_until) {
    text(`Valable jusqu'au ${formatDate(devis.valid_until)}`, MARGINS.left, PAGE_HEIGHT - 80, {
      size: 9,
      color: COLORS.white,
    })
  }
  y = PAGE_HEIGHT - 110

  // ── Artisan (gauche) / Client (droite) ──────────────────────────
  const colMid = MARGINS.left + CONTENT_WIDTH / 2 + 10

  // Artisan
  text(profile.company_name ?? profile.full_name ?? 'Artisan', MARGINS.left, y, {
    size: 10,
    bold: true,
  })
  y -= 13
  if (profile.siret) {
    text(`SIRET : ${profile.siret}`, MARGINS.left, y, { size: 8, color: COLORS.gray })
    y -= 11
  }
  if (profile.tva_number) {
    text(`N° TVA : ${profile.tva_number}`, MARGINS.left, y, { size: 8, color: COLORS.gray })
    y -= 11
  }
  if (profile.address) {
    text(profile.address, MARGINS.left, y, { size: 8, color: COLORS.gray })
    y -= 11
  }
  if (profile.city) {
    text(`${profile.postal_code ?? ''} ${profile.city}`.trim(), MARGINS.left, y, {
      size: 8,
      color: COLORS.gray,
    })
    y -= 11
  }
  if (profile.phone) {
    text(profile.phone, MARGINS.left, y, { size: 8, color: COLORS.gray })
    y -= 11
  }
  text(profile.email, MARGINS.left, y, { size: 8, color: COLORS.gray })

  // Client (same starting y as artisan block)
  let clientY = PAGE_HEIGHT - 110
  if (devis.client) {
    const clientName = devis.client.company_name
      ? `${devis.client.company_name} (${devis.client.name})`
      : devis.client.name
    text('CLIENT', colMid, clientY, { size: 7, bold: true, color: COLORS.gray })
    clientY -= 13
    text(clientName, colMid, clientY, { size: 10, bold: true })
    clientY -= 13
    if (devis.client.billing_address) {
      text(devis.client.billing_address, colMid, clientY, { size: 8, color: COLORS.gray })
      clientY -= 11
    }
    if (devis.client.billing_city) {
      text(
        `${devis.client.billing_postal_code ?? ''} ${devis.client.billing_city}`.trim(),
        colMid,
        clientY,
        { size: 8, color: COLORS.gray }
      )
      clientY -= 11
    }
    if (devis.client.email) {
      text(devis.client.email, colMid, clientY, { size: 8, color: COLORS.gray })
      clientY -= 11
    }
    if (devis.client.phone) {
      text(devis.client.phone, colMid, clientY, { size: 8, color: COLORS.gray })
    }
  }

  y = Math.min(y, clientY) - 20

  // ── Objet / Chantier ──────────────────────────────────────────
  if (devis.object || devis.site_address) {
    page.drawRectangle({
      x: MARGINS.left,
      y: y - 30,
      width: CONTENT_WIDTH,
      height: 30,
      color: COLORS.lightGray,
    })
    if (devis.object) {
      text(`Objet : ${devis.object}`, MARGINS.left + 6, y - 10, { size: 9, bold: true })
    }
    if (devis.site_address) {
      text(
        `Chantier : ${devis.site_address}${devis.site_city ? `, ${devis.site_city}` : ''}`,
        MARGINS.left + 6,
        y - 22,
        { size: 8, color: COLORS.gray }
      )
    }
    y -= 45
  }

  // ── Tableau lots/postes ──────────────────────────────────────────
  const colDesc = MARGINS.left
  const colQty = MARGINS.left + CONTENT_WIDTH * 0.46
  const colUnit = MARGINS.left + CONTENT_WIDTH * 0.54
  const colPU = MARGINS.left + CONTENT_WIDTH * 0.64
  const colTva = MARGINS.left + CONTENT_WIDTH * 0.76
  const colTotal = MARGINS.left + CONTENT_WIDTH * 0.87

  // Header tableau
  page.drawRectangle({
    x: MARGINS.left,
    y: y - 16,
    width: CONTENT_WIDTH,
    height: 16,
    color: COLORS.primary,
  })
  text('Description', colDesc + 4, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('Qté', colQty, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('Unité', colUnit, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('PU HT', colPU, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('TVA', colTva, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('Total HT', colTotal, y - 11, { size: 8, bold: true, color: COLORS.white })
  y -= 18

  let rowAlt = false
  for (const lot of devis.lots) {
    newPageIfNeeded(20)
    // Lot header
    page.drawRectangle({
      x: MARGINS.left,
      y: y - 14,
      width: CONTENT_WIDTH,
      height: 14,
      color: rgb(0.85, 0.9, 0.98),
    })
    text(lot.name, colDesc + 4, y - 10, { size: 9, bold: true, color: COLORS.primary })
    y -= 16

    for (const ligne of lot.lignes ?? []) {
      newPageIfNeeded(14)
      if (rowAlt) {
        page.drawRectangle({ x: MARGINS.left, y: y - 12, width: CONTENT_WIDTH, height: 12, color: rgb(0.97, 0.97, 0.97) })
      }
      const totalLigne = ligne.quantity * ligne.unit_price_ht
      text(ligne.description, colDesc + 4, y - 9, { size: 8, maxWidth: colQty - colDesc - 8 })
      text(String(ligne.quantity), colQty, y - 9, { size: 8 })
      text(ligne.unit, colUnit, y - 9, { size: 8 })
      text(formatMontant(ligne.unit_price_ht), colPU, y - 9, { size: 8 })
      text(`${ligne.tva_rate}%`, colTva, y - 9, { size: 8 })
      text(formatMontant(totalLigne), colTotal, y - 9, { size: 8 })
      y -= 13
      rowAlt = !rowAlt
    }
    y -= 4
  }

  // ── Récapitulatif TVA + totaux ───────────────────────────────────
  y -= 10
  newPageIfNeeded(120)

  const lotsAsInput: LotInput[] = devis.lots.map((lot) => ({
    name: lot.name,
    sort_order: lot.sort_order,
    postes: (lot.lignes ?? []).map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unit_price_ht: l.unit_price_ht,
      tva_rate: l.tva_rate,
      sort_order: l.sort_order,
    })),
  }))

  const totaux = calculerTotaux(
    lotsAsInput,
    devis.discount_percent,
    devis.deposit_percent,
    profile.is_auto_entrepreneur
  )

  const summaryX = MARGINS.left + CONTENT_WIDTH * 0.55
  const summaryWidth = CONTENT_WIDTH * 0.45

  function summaryLine(label: string, value: string, bold = false) {
    newPageIfNeeded(14)
    text(label, summaryX + 6, y, { size: 9, bold })
    text(value, summaryX + summaryWidth - 6 - fontRegular.widthOfTextAtSize(value, 9), y, {
      size: 9,
      bold,
    })
    y -= 13
  }

  summaryLine('Total HT', formatMontant(totaux.total_ht))
  if (totaux.remise_amount > 0) {
    summaryLine(`Remise (${devis.discount_percent}%)`, `− ${formatMontant(totaux.remise_amount)}`)
    summaryLine('Total HT après remise', formatMontant(totaux.total_ht_apres_remise))
  }

  for (const tva of totaux.tva_ventilation) {
    summaryLine(`TVA ${tva.rate}% (base ${formatMontant(tva.base_ht)})`, formatMontant(tva.montant_tva))
  }

  page.drawLine({
    start: { x: summaryX, y },
    end: { x: summaryX + summaryWidth, y },
    thickness: 0.5,
    color: COLORS.gray,
  })
  y -= 5
  summaryLine('TOTAL TTC', formatMontant(totaux.total_ttc), true)

  if (devis.deposit_percent > 0) {
    summaryLine(
      `Acompte à la commande (${devis.deposit_percent}%)`,
      formatMontant(totaux.acompte_amount)
    )
  }

  // ── Conditions de paiement ───────────────────────────────────────
  y -= 15
  newPageIfNeeded(30)
  text('Conditions de paiement :', MARGINS.left, y, { size: 8, bold: true })
  y -= 11
  text(devis.payment_conditions, MARGINS.left, y, { size: 8, color: COLORS.gray })
  y -= 20

  // ── Mentions légales ─────────────────────────────────────────────
  newPageIfNeeded(80)
  page.drawLine({
    start: { x: MARGINS.left, y },
    end: { x: PAGE_WIDTH - MARGINS.right, y },
    thickness: 0.5,
    color: COLORS.lightGray,
  })
  y -= 12

  const mentions: string[] = []
  if (profile.is_auto_entrepreneur) {
    mentions.push('TVA non applicable, art. 293 B du CGI')
  }
  if (profile.insurance_decennale_number) {
    mentions.push(
      `Assurance décennale : ${profile.insurance_decennale_company ?? ''} n° ${profile.insurance_decennale_number}`
    )
  }
  if (profile.rge_number) {
    mentions.push(`Qualification RGE n° ${profile.rge_number}`)
  }
  mentions.push(
    'Devis valable 30 jours à compter de sa date d\'émission.',
    'En cas d\'acceptation, renvoyez ce devis signé avec la mention "Bon pour accord".'
  )

  for (const mention of mentions) {
    text(mention, MARGINS.left, y, { size: 7, color: COLORS.gray, maxWidth: CONTENT_WIDTH })
    y -= 10
  }

  // ── Signature ────────────────────────────────────────────────────
  y -= 20
  newPageIfNeeded(60)
  text('Signature client :', MARGINS.left, y, { size: 8, bold: true })
  text('Cachet + Signature artisan :', PAGE_WIDTH / 2, y, { size: 8, bold: true })
  y -= 40
  page.drawRectangle({
    x: MARGINS.left,
    y,
    width: CONTENT_WIDTH / 2 - 10,
    height: 40,
    borderColor: COLORS.lightGray,
    borderWidth: 0.5,
  })
  page.drawRectangle({
    x: PAGE_WIDTH / 2,
    y,
    width: CONTENT_WIDTH / 2 - 10,
    height: 40,
    borderColor: COLORS.lightGray,
    borderWidth: 0.5,
  })

  return pdfDoc.save()
}
