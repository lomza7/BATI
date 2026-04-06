import { PDFDocument, rgb, StandardFonts, type RGB } from 'pdf-lib'
import type { FactureWithDetails } from '@/types/factures'
import { formatMontant } from '@/lib/factures/calculations'

export interface ArtisanProfile {
  full_name: string | null
  company_name: string | null
  siret: string | null
  tva_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  phone: string | null
  email: string
  insurance_decennale_number: string | null
  insurance_decennale_company: string | null
  rge_number: string | null
  is_auto_entrepreneur: boolean
}

const COLORS = {
  primary: rgb(0.063, 0.243, 0.682) as RGB,
  dark: rgb(0.1, 0.1, 0.1) as RGB,
  gray: rgb(0.5, 0.5, 0.5) as RGB,
  lightGray: rgb(0.92, 0.92, 0.92) as RGB,
  white: rgb(1, 1, 1) as RGB,
  rowAlt: rgb(0.97, 0.97, 0.97) as RGB,
  lotHeader: rgb(0.85, 0.9, 0.98) as RGB,
}

const MARGINS = { top: 50, bottom: 50, left: 50, right: 50 }
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(iso))
}

function typeLabel(type: string): string {
  if (type === 'avoir') return 'AVOIR'
  if (type === 'situation') return 'SITUATION DE TRAVAUX'
  return 'FACTURE'
}

export async function generateFacturePdf(
  facture: FactureWithDetails,
  profile: ArtisanProfile
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`${facture.reference} — ${profile.company_name ?? profile.full_name ?? ''}`)
  pdfDoc.setAuthor(profile.company_name ?? profile.full_name ?? 'Hellobat')
  pdfDoc.setProducer('Hellobat — hellobat.app')

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGINS.top

  function text(
    str: string,
    x: number,
    yPos: number,
    opts: { size?: number; bold?: boolean; color?: RGB; maxWidth?: number } = {}
  ) {
    const font = opts.bold ? fontBold : fontRegular
    const size = opts.size ?? 9
    const color = opts.color ?? COLORS.dark
    page.drawText(str, { x, y: yPos, size, font, color, maxWidth: opts.maxWidth })
  }

  function newPageIfNeeded(neededHeight: number) {
    if (y - neededHeight < MARGINS.bottom) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGINS.top
    }
  }

  // ── Header ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 90, width: PAGE_WIDTH, height: 90, color: COLORS.primary })
  text(typeLabel(facture.type), MARGINS.left, PAGE_HEIGHT - 35, { size: 22, bold: true, color: COLORS.white })
  text(facture.reference, MARGINS.left, PAGE_HEIGHT - 55, { size: 11, color: COLORS.white })
  text(`Émise le ${formatDate(facture.emitted_at ?? facture.created_at)}`, MARGINS.left, PAGE_HEIGHT - 68, { size: 9, color: COLORS.white })
  if (facture.due_date) {
    text(`Échéance : ${formatDate(facture.due_date)}`, MARGINS.left, PAGE_HEIGHT - 80, { size: 9, color: COLORS.white })
  }
  y = PAGE_HEIGHT - 110

  // ── Artisan / Client ────────────────────────────────────────────────────
  const colMid = MARGINS.left + CONTENT_WIDTH / 2 + 10

  text(profile.company_name ?? profile.full_name ?? 'Artisan', MARGINS.left, y, { size: 10, bold: true })
  y -= 13
  if (profile.siret) { text(`SIRET : ${profile.siret}`, MARGINS.left, y, { size: 8, color: COLORS.gray }); y -= 11 }
  if (profile.tva_number) { text(`N° TVA : ${profile.tva_number}`, MARGINS.left, y, { size: 8, color: COLORS.gray }); y -= 11 }
  if (profile.address) { text(profile.address, MARGINS.left, y, { size: 8, color: COLORS.gray }); y -= 11 }
  if (profile.city) { text(`${profile.postal_code ?? ''} ${profile.city}`.trim(), MARGINS.left, y, { size: 8, color: COLORS.gray }); y -= 11 }
  if (profile.phone) { text(profile.phone, MARGINS.left, y, { size: 8, color: COLORS.gray }); y -= 11 }
  text(profile.email, MARGINS.left, y, { size: 8, color: COLORS.gray })

  let clientY = PAGE_HEIGHT - 110
  if (facture.client) {
    const clientName = facture.client.company_name
      ? `${facture.client.company_name} (${facture.client.name})`
      : facture.client.name
    text('CLIENT', colMid, clientY, { size: 7, bold: true, color: COLORS.gray })
    clientY -= 13
    text(clientName, colMid, clientY, { size: 10, bold: true })
    clientY -= 13
    if (facture.client.siret) { text(`SIRET : ${facture.client.siret}`, colMid, clientY, { size: 8, color: COLORS.gray }); clientY -= 11 }
    if (facture.client.billing_address) { text(facture.client.billing_address, colMid, clientY, { size: 8, color: COLORS.gray }); clientY -= 11 }
    if (facture.client.billing_city) {
      text(`${facture.client.billing_postal_code ?? ''} ${facture.client.billing_city}`.trim(), colMid, clientY, { size: 8, color: COLORS.gray })
      clientY -= 11
    }
    if (facture.client.email) { text(facture.client.email, colMid, clientY, { size: 8, color: COLORS.gray }); clientY -= 11 }
    if (facture.client.phone) { text(facture.client.phone, colMid, clientY, { size: 8, color: COLORS.gray }) }
  }

  y = Math.min(y, clientY) - 20

  // ── Objet / Chantier ────────────────────────────────────────────────────
  if (facture.object || facture.site_address) {
    page.drawRectangle({ x: MARGINS.left, y: y - 30, width: CONTENT_WIDTH, height: 30, color: COLORS.lightGray })
    if (facture.object) text(`Objet : ${facture.object}`, MARGINS.left + 6, y - 10, { size: 9, bold: true })
    if (facture.site_address) {
      text(
        `Chantier : ${facture.site_address}${facture.site_city ? `, ${facture.site_city}` : ''}`,
        MARGINS.left + 6, y - 22, { size: 8, color: COLORS.gray }
      )
    }
    y -= 45
  }

  // Référence devis
  if (facture.devis_id) {
    y -= 8
    text(`Réf. devis : ${facture.devis_id}`, MARGINS.left, y, { size: 8, color: COLORS.gray })
    y -= 14
  }

  // ── Tableau lots/postes ─────────────────────────────────────────────────
  const colDesc = MARGINS.left
  const colQty = MARGINS.left + CONTENT_WIDTH * 0.46
  const colUnit = MARGINS.left + CONTENT_WIDTH * 0.54
  const colPU = MARGINS.left + CONTENT_WIDTH * 0.64
  const colTva = MARGINS.left + CONTENT_WIDTH * 0.76
  const colTotal = MARGINS.left + CONTENT_WIDTH * 0.87

  page.drawRectangle({ x: MARGINS.left, y: y - 16, width: CONTENT_WIDTH, height: 16, color: COLORS.primary })
  text('Description', colDesc + 4, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('Qté', colQty, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('Unité', colUnit, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('PU HT', colPU, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('TVA', colTva, y - 11, { size: 8, bold: true, color: COLORS.white })
  text('Total HT', colTotal, y - 11, { size: 8, bold: true, color: COLORS.white })
  y -= 18

  let rowAlt = false
  for (const lot of facture.lots) {
    newPageIfNeeded(20)
    page.drawRectangle({ x: MARGINS.left, y: y - 14, width: CONTENT_WIDTH, height: 14, color: COLORS.lotHeader })
    text(lot.name, colDesc + 4, y - 10, { size: 9, bold: true, color: COLORS.primary })
    y -= 16

    for (const ligne of lot.lignes ?? []) {
      newPageIfNeeded(14)
      if (rowAlt) {
        page.drawRectangle({ x: MARGINS.left, y: y - 12, width: CONTENT_WIDTH, height: 12, color: COLORS.rowAlt })
      }
      const totalLigne = ligne.quantity * ligne.unit_price_ht
      text(ligne.description, colDesc + 4, y - 9, { size: 8, maxWidth: colQty - colDesc - 8 })
      text(String(ligne.quantity), colQty, y - 9, { size: 8 })
      text(ligne.unit, colUnit, y - 9, { size: 8 })
      text(formatMontant(ligne.unit_price_ht), colPU, y - 9, { size: 8 })
      text(profile.is_auto_entrepreneur ? 'N/A' : `${ligne.tva_rate}%`, colTva, y - 9, { size: 8 })
      text(formatMontant(totalLigne), colTotal, y - 9, { size: 8 })
      y -= 13
      rowAlt = !rowAlt
    }
    y -= 4
  }

  // ── Récapitulatif ────────────────────────────────────────────────────────
  y -= 10
  newPageIfNeeded(120)

  const summaryX = MARGINS.left + CONTENT_WIDTH * 0.55
  const summaryWidth = CONTENT_WIDTH * 0.45

  function summaryLine(label: string, value: string, bold = false) {
    newPageIfNeeded(14)
    text(label, summaryX + 6, y, { size: 9, bold })
    text(value, summaryX + summaryWidth - 6 - fontRegular.widthOfTextAtSize(value, 9), y, { size: 9, bold })
    y -= 13
  }

  summaryLine('Total HT', formatMontant(facture.total_ht))
  if (facture.discount_percent > 0) {
    const remise = parseFloat((facture.total_ht * facture.discount_percent / 100).toFixed(2))
    summaryLine(`Remise (${facture.discount_percent}%)`, `− ${formatMontant(remise)}`)
    summaryLine('Total HT après remise', formatMontant(facture.total_ht - remise))
  }

  if (profile.is_auto_entrepreneur) {
    summaryLine('TVA (Art. 293 B CGI)', formatMontant(0))
  } else {
    summaryLine(`TVA`, formatMontant(facture.total_tva))
  }

  page.drawLine({
    start: { x: summaryX, y },
    end: { x: summaryX + summaryWidth, y },
    thickness: 0.5,
    color: COLORS.gray,
  })
  y -= 5
  summaryLine('TOTAL TTC', formatMontant(facture.total_ttc), true)

  if (facture.deposit_amount_deducted > 0) {
    summaryLine('Acompte déduit', `− ${formatMontant(facture.deposit_amount_deducted)}`)
    summaryLine('NET À PAYER', formatMontant(facture.total_ttc - facture.deposit_amount_deducted), true)
  }

  // ── Conditions de paiement ───────────────────────────────────────────────
  y -= 15
  newPageIfNeeded(30)
  text('Conditions de paiement :', MARGINS.left, y, { size: 8, bold: true })
  y -= 11
  text(facture.payment_conditions, MARGINS.left, y, { size: 8, color: COLORS.gray })
  if (facture.due_date) {
    y -= 11
    text(`Date d'échéance : ${formatDate(facture.due_date)}`, MARGINS.left, y, { size: 8, color: COLORS.gray })
  }
  y -= 20

  // ── Mentions légales ─────────────────────────────────────────────────────
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
    mentions.push(`Assurance décennale : ${profile.insurance_decennale_company ?? ''} n° ${profile.insurance_decennale_number}`)
  }
  if (profile.rge_number) {
    mentions.push(`Qualification RGE n° ${profile.rge_number}`)
  }
  mentions.push('Tout retard de paiement entraîne des pénalités de retard au taux légal en vigueur, ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement (Art. L. 441-10 C. com.)')
  if (facture.type === 'avoir') {
    mentions.push('Ce document constitue un avoir annulant partiellement ou totalement la facture d\'origine.')
  }

  for (const mention of mentions) {
    text(mention, MARGINS.left, y, { size: 7, color: COLORS.gray, maxWidth: CONTENT_WIDTH })
    y -= 10
  }

  // Pied de page avec numéro de facture
  page.drawText(facture.reference, {
    x: PAGE_WIDTH / 2 - fontRegular.widthOfTextAtSize(facture.reference, 8) / 2,
    y: 20,
    size: 8,
    font: fontRegular,
    color: COLORS.gray,
  })

  return pdfDoc.save()
}
