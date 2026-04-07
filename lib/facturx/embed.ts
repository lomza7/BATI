/**
 * Embed Factur-X XML into a PDF to produce a PDF/A-3b compliant document.
 *
 * pdf-lib supports file attachments. We embed the XML with the required
 * Factur-X attachment parameters:
 *   - filename: factur-x.xml
 *   - mimeType: application/xml
 *   - AFRelationship: Alternative (required by Factur-X spec)
 *
 * Note: Full PDF/A-3b compliance also requires XMP metadata and an output
 * intent color profile. We add the required XMP properties here.
 */

import { PDFDocument, AFRelationship } from 'pdf-lib'

const FACTURX_FILENAME = 'factur-x.xml'

/**
 * Embeds a Factur-X XML string into an existing PDF byte array.
 * Returns new PDF bytes with the embedded XML attachment.
 */
export async function embedFacturxInPdf(pdfBytes: Uint8Array, xmlContent: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)

  const xmlBytes = new TextEncoder().encode(xmlContent)

  // Attach the XML file
  await pdfDoc.attach(xmlBytes, FACTURX_FILENAME, {
    mimeType: 'application/xml',
    description: 'Factur-X EN16931 invoice data',
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Alternative,
  })

  // Set XMP metadata for PDF/A-3b conformance
  const xmpMetadata = buildXmpMetadata(pdfDoc)
  pdfDoc.setSubject('Facture électronique conforme Factur-X EN16931')
  pdfDoc.setKeywords(['Factur-X', 'EN16931', 'facture', 'électronique'])

  // Embed XMP as document metadata
  const xmpBytes = new TextEncoder().encode(xmpMetadata)
  const metadataStream = pdfDoc.context.stream(xmpBytes, {
    Type: 'Metadata',
    Subtype: 'XML',
  })
  const metadataStreamRef = pdfDoc.context.register(metadataStream)
  pdfDoc.catalog.set(pdfDoc.context.obj('Metadata'), metadataStreamRef)

  return pdfDoc.save()
}

function buildXmpMetadata(pdfDoc: PDFDocument): string {
  const title = pdfDoc.getTitle() ?? 'Facture'
  const author = pdfDoc.getAuthor() ?? 'Hellobat'
  const now = new Date().toISOString()

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
        xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
        xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <!-- PDF/A-3b conformance -->
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <!-- Document info -->
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${escapeXml(author)}</rdf:li></rdf:Seq></dc:creator>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <!-- Factur-X specific -->
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
      <fx:Version>1.0</fx:Version>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
