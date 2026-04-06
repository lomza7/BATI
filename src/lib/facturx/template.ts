/**
 * Factur-X EN16931 (CII — Cross Industry Invoice) XML generator
 * TypeCode 380 = Facture commerciale
 * TypeCode 381 = Avoir (note de crédit)
 * Profil: EN16931 (COMFORT level)
 */

export interface FacturxParty {
  name: string
  siret: string | null
  tva_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country_code: string
}

export interface FacturxLine {
  id: string
  description: string
  quantity: number
  unit_code: string // UN/ECE unit code, e.g. C62 (piece), MTK (m²), HUR (hour)
  unit_price_ht: number
  tva_rate: number
  total_ht: number
}

export interface FacturxInput {
  type_code: '380' | '381' // 380=facture, 381=avoir
  reference: string
  issue_date: string // ISO date YYYY-MM-DD
  due_date: string | null
  currency_code: string // EUR
  seller: FacturxParty
  buyer: FacturxParty
  lines: FacturxLine[]
  total_ht: number
  total_tva: number
  total_ttc: number
  discount_amount: number
  is_auto_entrepreneur: boolean
  payment_terms: string | null
  buyer_order_ref: string | null // devis reference
}

/** Map common unit strings to UN/ECE unit codes */
function toUnitCode(unit: string): string {
  const map: Record<string, string> = {
    u: 'C62',
    pce: 'C62',
    m2: 'MTK',
    'm²': 'MTK',
    ml: 'MTR',
    h: 'HUR',
    j: 'DAY',
    kg: 'KGM',
    t: 'TNE',
    l: 'LTR',
    forfait: 'LS',
  }
  return map[unit.toLowerCase()] ?? 'C62'
}

/** Format date YYYYMMDD for CII */
function ciiDate(iso: string): string {
  return iso.replace(/-/g, '').substring(0, 8)
}

/** Format number with 2 decimal places */
function n(value: number): string {
  return value.toFixed(2)
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function partyBlock(party: FacturxParty, tag: 'SellerTradeParty' | 'BuyerTradeParty'): string {
  const siretBlock = party.siret
    ? `<ram:GlobalID schemeID="0002">${escapeXml(party.siret)}</ram:GlobalID>`
    : ''
  const tvaBlock = party.tva_number
    ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(party.tva_number)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
    : ''
  const addressBlock = `
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escapeXml(party.postal_code ?? '')}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(party.address ?? '')}</ram:LineOne>
          <ram:CityName>${escapeXml(party.city ?? '')}</ram:CityName>
          <ram:CountryID>${escapeXml(party.country_code)}</ram:CountryID>
        </ram:PostalTradeAddress>`

  return `<ram:${tag}>
        <ram:Name>${escapeXml(party.name)}</ram:Name>
        ${siretBlock}${addressBlock}${tvaBlock}
      </ram:${tag}>`
}

export function generateFacturxXml(input: FacturxInput): string {
  const { seller, buyer, lines, is_auto_entrepreneur } = input

  // Compute TVA summary by rate
  const tvaMap = new Map<number, { base: number; amount: number }>()
  for (const line of lines) {
    const rate = is_auto_entrepreneur ? 0 : line.tva_rate
    const existing = tvaMap.get(rate) ?? { base: 0, amount: 0 }
    const base = line.total_ht
    const amount = base * (rate / 100)
    tvaMap.set(rate, { base: existing.base + base, amount: existing.amount + amount })
  }

  const tvaSummary = Array.from(tvaMap.entries()).map(([rate, { base, amount }]) => {
    const typeCode = rate === 0 ? 'E' : 'S' // E=exempt, S=standard
    const exemptReason = rate === 0 && is_auto_entrepreneur ? 'AAM' : undefined
    const exemptReasonBlock = exemptReason
      ? `<ram:ExemptionReasonCode>${exemptReason}</ram:ExemptionReasonCode>
              <ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>`
      : ''
    return `<ram:ApplicableHeaderTradeSettlementHeaderMonetarySummation>
        </ram:ApplicableHeaderTradeSettlementHeaderMonetarySummation>
        <ram:ApplicableTradeTax>
          <ram:CalculatedAmount>${n(amount)}</ram:CalculatedAmount>
          <ram:TypeCode>VAT</ram:TypeCode>
          ${exemptReasonBlock}
          <ram:BasisAmount>${n(base)}</ram:BasisAmount>
          <ram:CategoryCode>${typeCode}</ram:CategoryCode>
          <ram:RateApplicablePercent>${n(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>`
  })

  const linesXml = lines.map((line, idx) => {
    const rate = is_auto_entrepreneur ? 0 : line.tva_rate
    const categoryCode = rate === 0 ? 'E' : 'S'
    return `<ram:IncludedSupplyChainTradeLineItem>
          <ram:AssociatedDocumentLineDocument>
            <ram:LineID>${idx + 1}</ram:LineID>
          </ram:AssociatedDocumentLineDocument>
          <ram:SpecifiedTradeProduct>
            <ram:Name>${escapeXml(line.description)}</ram:Name>
          </ram:SpecifiedTradeProduct>
          <ram:SpecifiedLineTradeAgreement>
            <ram:NetPriceProductTradePrice>
              <ram:ChargeAmount>${n(line.unit_price_ht)}</ram:ChargeAmount>
            </ram:NetPriceProductTradePrice>
          </ram:SpecifiedLineTradeAgreement>
          <ram:SpecifiedLineTradeDelivery>
            <ram:BilledQuantity unitCode="${escapeXml(toUnitCode(line.unit_code))}">${n(line.quantity)}</ram:BilledQuantity>
          </ram:SpecifiedLineTradeDelivery>
          <ram:SpecifiedLineTradeSettlement>
            <ram:ApplicableTradeTax>
              <ram:TypeCode>VAT</ram:TypeCode>
              <ram:CategoryCode>${categoryCode}</ram:CategoryCode>
              <ram:RateApplicablePercent>${n(rate)}</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>
            <ram:SpecifiedTradeSettlementLineMonetarySummation>
              <ram:LineTotalAmount>${n(line.total_ht)}</ram:LineTotalAmount>
            </ram:SpecifiedTradeSettlementLineMonetarySummation>
          </ram:SpecifiedLineTradeSettlement>
        </ram:IncludedSupplyChainTradeLineItem>`
  })

  const dueDateBlock = input.due_date
    ? `<ram:DueDateDateTime>
              <udt:DateTimeString format="102">${ciiDate(input.due_date)}</udt:DateTimeString>
            </ram:DueDateDateTime>`
    : ''

  const paymentTermsBlock = input.payment_terms
    ? `<ram:SpecifiedTradePaymentTerms>
            <ram:Description>${escapeXml(input.payment_terms)}</ram:Description>
            ${dueDateBlock}
          </ram:SpecifiedTradePaymentTerms>`
    : ''

  const orderRefBlock = input.buyer_order_ref
    ? `<ram:BuyerOrderReferencedDocument>
          <ram:IssuerAssignedID>${escapeXml(input.buyer_order_ref)}</ram:IssuerAssignedID>
        </ram:BuyerOrderReferencedDocument>`
    : ''

  const discountBlock =
    input.discount_amount > 0
      ? `<ram:SpecifiedTradeAllowanceCharge>
            <ram:ChargeIndicator>
              <udt:Indicator>false</udt:Indicator>
            </ram:ChargeIndicator>
            <ram:ActualAmount>${n(input.discount_amount)}</ram:ActualAmount>
            <ram:ReasonCode>95</ram:ReasonCode>
            <ram:Reason>Remise commerciale</ram:Reason>
          </ram:SpecifiedTradeAllowanceCharge>`
      : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(input.reference)}</ram:ID>
    <ram:TypeCode>${input.type_code}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${ciiDate(input.issue_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    ${linesXml.join('\n    ')}

    <ram:ApplicableHeaderTradeAgreement>
      ${partyBlock(seller, 'SellerTradeParty')}
      ${partyBlock(buyer, 'BuyerTradeParty')}
      ${orderRefBlock}
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${escapeXml(input.currency_code)}</ram:InvoiceCurrencyCode>
      ${tvaSummary.join('\n      ')}
      ${discountBlock}
      ${paymentTermsBlock}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${n(input.total_ht + input.discount_amount)}</ram:LineTotalAmount>
        <ram:AllowanceTotalAmount>${n(input.discount_amount)}</ram:AllowanceTotalAmount>
        <ram:TaxBasisTotalAmount>${n(input.total_ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${escapeXml(input.currency_code)}">${n(input.total_tva)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${n(input.total_ttc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${n(input.total_ttc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`
}
