import { describe, it, expect } from 'vitest'
import { generateFacturxXml, type FacturxInput } from './template'

const baseSeller = {
  name: 'Martin Plomberie',
  siret: '73042926600015',
  tva_number: 'FR12730429266',
  address: '12 rue de la Paix',
  city: 'Lyon',
  postal_code: '69001',
}

const baseBuyer = {
  name: 'Syndicat de copropriété Les Acacias',
  address: '45 avenue des Acacias',
  city: 'Lyon',
  postal_code: '69003',
}

const minimalInput: FacturxInput = {
  invoice_number: 'FAC-2026-001',
  invoice_type_code: '380',
  issue_date: '20260406',
  seller: baseSeller,
  buyer: baseBuyer,
  lines: [
    {
      id: 1,
      description: 'Remplacement robinet',
      quantity: 1,
      unit_price_ht: 150.0,
      total_ht: 150.0,
      tva_rate: 10,
    },
  ],
  tva_totals: [{ rate: 10, base_ht: 150.0, montant_tva: 15.0 }],
  total_ht: 150.0,
  total_tva: 15.0,
  total_ttc: 165.0,
}

describe('generateFacturxXml()', () => {
  // ── Structure XML ───────────────────────────────────────────────────────────

  it('generates valid XML starting with XML declaration', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml.trim()).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  })

  it('uses CrossIndustryInvoice root element', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<rsm:CrossIndustryInvoice')
    expect(xml).toContain('</rsm:CrossIndustryInvoice>')
  })

  it('includes EN16931 guideline URI', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain(
      'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931'
    )
  })

  it('declares all required namespaces', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('xmlns:rsm=')
    expect(xml).toContain('xmlns:ram=')
    expect(xml).toContain('xmlns:udt=')
    expect(xml).toContain('xmlns:qdt=')
  })

  // ── ExchangedDocument ────────────────────────────────────────────────────────

  it('includes invoice number as ram:ID', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:ID>FAC-2026-001</ram:ID>')
  })

  it('includes TypeCode 380 for invoice', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>')
  })

  it('includes TypeCode 381 for credit note (avoir)', () => {
    const xml = generateFacturxXml({ ...minimalInput, invoice_type_code: '381' })
    expect(xml).toContain('<ram:TypeCode>381</ram:TypeCode>')
  })

  it('includes issue date in format="102"', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<udt:DateTimeString format="102">20260406</udt:DateTimeString>')
  })

  // ── Parties ──────────────────────────────────────────────────────────────────

  it('includes seller name', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('Martin Plomberie')
  })

  it('includes seller SIRET with schemeID="FC"', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:ID schemeID="FC">73042926600015</ram:ID>')
  })

  it('includes seller TVA number with schemeID="VA"', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:ID schemeID="VA">FR12730429266</ram:ID>')
  })

  it('includes buyer name', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('Syndicat de copropriété Les Acacias')
  })

  it('includes seller postal address', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:PostcodeCode>69001</ram:PostcodeCode>')
    expect(xml).toContain('12 rue de la Paix')
    expect(xml).toContain('<ram:CityName>Lyon</ram:CityName>')
  })

  it('defaults to country code FR', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:CountryID>FR</ram:CountryID>')
  })

  // ── Line items ───────────────────────────────────────────────────────────────

  it('includes line item description', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('Remplacement robinet')
  })

  it('includes line item quantity', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:BilledQuantity unitCode="C62">1</ram:BilledQuantity>')
  })

  it('includes line item total_ht', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:LineTotalAmount>150.00</ram:LineTotalAmount>')
  })

  it('sets CategoryCode "S" for non-zero TVA', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:CategoryCode>S</ram:CategoryCode>')
  })

  it('sets CategoryCode "Z" for TVA 0% (auto-entrepreneur)', () => {
    const autoInput: FacturxInput = {
      ...minimalInput,
      lines: [{ ...minimalInput.lines[0]!, tva_rate: 0 }],
      tva_totals: [{ rate: 0, base_ht: 150, montant_tva: 0 }],
      total_tva: 0,
      total_ttc: 150,
    }
    const xml = generateFacturxXml(autoInput)
    expect(xml).toContain('<ram:CategoryCode>Z</ram:CategoryCode>')
  })

  // ── Monetary totals ──────────────────────────────────────────────────────────

  it('includes TaxBasisTotalAmount (total HT)', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:TaxBasisTotalAmount>150.00</ram:TaxBasisTotalAmount>')
  })

  it('includes TaxTotalAmount with currencyID', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">15.00</ram:TaxTotalAmount>')
  })

  it('includes GrandTotalAmount (total TTC)', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:GrandTotalAmount>165.00</ram:GrandTotalAmount>')
  })

  it('includes DuePayableAmount equal to total TTC', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:DuePayableAmount>165.00</ram:DuePayableAmount>')
  })

  // ── Payment ───────────────────────────────────────────────────────────────────

  it('defaults to payment means code 30 (virement)', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:TypeCode>30</ram:TypeCode>')
  })

  it('includes IBAN when provided', () => {
    const xml = generateFacturxXml({ ...minimalInput, iban: 'FR7630001007941234567890185' })
    expect(xml).toContain('FR7630001007941234567890185')
  })

  it('includes due date when provided', () => {
    const xml = generateFacturxXml({ ...minimalInput, due_date: '20260506' })
    expect(xml).toContain('<udt:DateTimeString format="102">20260506</udt:DateTimeString>')
  })

  // ── Security: XML escaping ───────────────────────────────────────────────────

  it('escapes XML special characters in party names', () => {
    const xml = generateFacturxXml({
      ...minimalInput,
      seller: { ...baseSeller, name: 'Durand & Fils <BTP>' },
    })
    expect(xml).toContain('Durand &amp; Fils &lt;BTP&gt;')
    expect(xml).not.toContain('Durand & Fils <BTP>')
  })

  it('escapes XML special characters in line descriptions', () => {
    const xml = generateFacturxXml({
      ...minimalInput,
      lines: [
        {
          ...minimalInput.lines[0]!,
          description: 'Pose "robinet" 1/2"',
        },
      ],
    })
    expect(xml).toContain('Pose &quot;robinet&quot; 1/2&quot;')
  })

  // ── Note ──────────────────────────────────────────────────────────────────────

  it('includes note when provided', () => {
    const xml = generateFacturxXml({
      ...minimalInput,
      note: 'Paiement à 30 jours fin de mois',
    })
    expect(xml).toContain('Paiement à 30 jours fin de mois')
  })

  it('omits note element when absent', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).not.toContain('<ram:IncludedNote>')
  })

  // ── Currency ──────────────────────────────────────────────────────────────────

  it('defaults to EUR currency', () => {
    const xml = generateFacturxXml(minimalInput)
    expect(xml).toContain('<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>')
  })
})
