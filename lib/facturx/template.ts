/**
 * Factur-X XML generator — EN16931 profile (minimum obligatoire France 2026).
 *
 * Spec: FNFE-MPE Factur-X v1.0.07 / UN/CEFACT Cross-Industry Invoice CII D22B
 * Profile: EN 16931 (urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931)
 *
 * This module generates the CII XML string to be embedded in a PDF/A-3 document
 * via pdf-lib (see embed.ts).
 */

export interface FacturxParty {
  name: string
  siret?: string
  tva_number?: string
  address?: string
  city?: string
  postal_code?: string
  country_code?: string // default 'FR'
}

export interface FacturxLine {
  id: string | number
  description: string
  quantity: number
  unit_price_ht: number | string
  total_ht: number | string
  tva_rate: 0 | 10 | 20
}

export interface FacturxTvaTotal {
  rate: 0 | 10 | 20
  base_ht: number | string
  montant_tva: number | string
}

export interface FacturxInput {
  invoice_number: string // e.g. FAC-2026-001
  invoice_type_code: '380' | '381' // 380 = invoice, 381 = credit note (avoir)
  issue_date: string // YYYYMMDD
  due_date?: string // YYYYMMDD
  seller: FacturxParty
  buyer: FacturxParty
  lines: FacturxLine[]
  tva_totals: FacturxTvaTotal[]
  total_ht: number | string
  total_tva: number | string
  total_ttc: number | string
  currency_code?: string // default 'EUR'
  payment_means_code?: string // default '30' (virement)
  iban?: string
  note?: string
}

/**
 * Formats a date string "YYYYMMDD" for the CII DateTimeString element.
 */
function formatDate(yyyymmdd: string): string {
  return `<udt:DateTimeString format="102">${yyyymmdd}</udt:DateTimeString>`
}

/**
 * Escapes XML special characters.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Formats a number as a 2-decimal string for amounts.
 */
function amt(value: number | string): string {
  return Number(value).toFixed(2)
}

/**
 * Generates Factur-X EN16931 CII XML for a facture.
 * Returns the XML string (UTF-8, no BOM).
 */
export function generateFacturxXml(input: FacturxInput): string {
  const currency = input.currency_code ?? 'EUR'
  const countryCode = 'FR'

  const sellerPartyXml = buildPartyXml(input.seller, countryCode)
  const buyerPartyXml = buildPartyXml(input.buyer, countryCode)

  const linesXml = input.lines
    .map(line => buildLineXml(line, currency))
    .join('\n')

  const tvaXml = input.tva_totals
    .map(t => buildTaxXml(t, currency))
    .join('\n')

  const paymentMeans = input.payment_means_code ?? '30'
  const ibanXml = input.iban
    ? `<ram:PayeePartyCreditorFinancialAccount>
        <ram:IBANID>${escapeXml(input.iban)}</ram:IBANID>
      </ram:PayeePartyCreditorFinancialAccount>`
    : ''

  const dueDateXml = input.due_date
    ? `<ram:DueDateDateTime>${formatDate(input.due_date)}</ram:DueDateDateTime>`
    : ''

  const noteXml = input.note
    ? `<ram:Content>${escapeXml(input.note)}</ram:Content>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(input.invoice_number)}</ram:ID>
    <ram:TypeCode>${input.invoice_type_code}</ram:TypeCode>
    <ram:IssueDateTime>${formatDate(input.issue_date)}</ram:IssueDateTime>
    ${noteXml ? `<ram:IncludedNote>${noteXml}</ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>

    ${linesXml}

    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        ${sellerPartyXml}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        ${buyerPartyXml}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${paymentMeans}</ram:TypeCode>
        ${ibanXml}
      </ram:SpecifiedTradeSettlementPaymentMeans>
      ${tvaXml}
      <ram:SpecifiedTradePaymentTerms>
        ${dueDateXml}
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amt(input.total_ht)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amt(input.total_ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${amt(input.total_tva)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amt(input.total_ttc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amt(input.total_ttc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`
}

function buildPartyXml(party: FacturxParty, defaultCountry: string): string {
  const taxIdXml =
    party.tva_number
      ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(party.tva_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
      : ''

  const siretXml =
    party.siret
      ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${escapeXml(party.siret)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
      : ''

  const addressXml =
    party.address || party.city || party.postal_code
      ? `<ram:PostalTradeAddress>
          ${party.postal_code ? `<ram:PostcodeCode>${escapeXml(party.postal_code)}</ram:PostcodeCode>` : ''}
          ${party.address ? `<ram:LineOne>${escapeXml(party.address)}</ram:LineOne>` : ''}
          ${party.city ? `<ram:CityName>${escapeXml(party.city)}</ram:CityName>` : ''}
          <ram:CountryID>${party.country_code ?? defaultCountry}</ram:CountryID>
        </ram:PostalTradeAddress>`
      : `<ram:PostalTradeAddress>
          <ram:CountryID>${party.country_code ?? defaultCountry}</ram:CountryID>
        </ram:PostalTradeAddress>`

  return `<ram:Name>${escapeXml(party.name)}</ram:Name>
    ${addressXml}
    ${taxIdXml}
    ${siretXml}`
}

function buildLineXml(line: FacturxLine, _currency: string): string {
  return `<ram:IncludedSupplyChainTradeLineItem>
    <ram:AssociatedDocumentLineDocument>
      <ram:LineID>${line.id}</ram:LineID>
    </ram:AssociatedDocumentLineDocument>
    <ram:SpecifiedTradeProduct>
      <ram:Name>${escapeXml(String(line.description))}</ram:Name>
    </ram:SpecifiedTradeProduct>
    <ram:SpecifiedLineTradeAgreement>
      <ram:NetPriceProductTradePrice>
        <ram:ChargeAmount>${amt(line.unit_price_ht)}</ram:ChargeAmount>
      </ram:NetPriceProductTradePrice>
    </ram:SpecifiedLineTradeAgreement>
    <ram:SpecifiedLineTradeDelivery>
      <ram:BilledQuantity unitCode="C62">${line.quantity}</ram:BilledQuantity>
    </ram:SpecifiedLineTradeDelivery>
    <ram:SpecifiedLineTradeSettlement>
      <ram:ApplicableTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:CategoryCode>${line.tva_rate === 0 ? 'Z' : 'S'}</ram:CategoryCode>
        <ram:RateApplicablePercent>${line.tva_rate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementLineMonetarySummation>
        <ram:LineTotalAmount>${amt(line.total_ht)}</ram:LineTotalAmount>
      </ram:SpecifiedTradeSettlementLineMonetarySummation>
    </ram:SpecifiedLineTradeSettlement>
  </ram:IncludedSupplyChainTradeLineItem>`
}

function buildTaxXml(t: FacturxTvaTotal, _currency: string): string {
  return `<ram:ApplicableTradeTax>
    <ram:CalculatedAmount>${amt(t.montant_tva)}</ram:CalculatedAmount>
    <ram:TypeCode>VAT</ram:TypeCode>
    <ram:BasisAmount>${amt(t.base_ht)}</ram:BasisAmount>
    <ram:CategoryCode>${t.rate === 0 ? 'Z' : 'S'}</ram:CategoryCode>
    <ram:RateApplicablePercent>${t.rate}</ram:RateApplicablePercent>
  </ram:ApplicableTradeTax>`
}
