import { z } from 'zod';

/**
 * Type de document reconnu par l'import IA.
 *
 * Un avoir (facture rectificative, art. 289 CGI) se scanne exactement comme
 * une facture et se retrouve donc dans le même flux d'import. Il doit
 * toutefois être identifié comme tel : ses montants sont négatifs en base et
 * il se rattache obligatoirement à la facture qu'il rectifie.
 */
export type InvoiceImportDocumentType = 'facture' | 'avoir';

export const invoiceImportItemSchema = z.object({
  client_name: z.string().default(''),
  client_address: z.string().default(''),
  client_city: z.string().default(''),
  client_postal_code: z.string().default(''),
  invoice_date: z.string().default(''),
  invoice_number: z.string().default(''),
  description: z.string().default(''),
  /**
   * 'avoir' quand le document lu est une facture rectificative / note de
   * crédit. Toute autre valeur retombe sur 'facture' : le modèle écrit
   * parfois « note de crédit » ou « rectificative » en clair, la
   * normalisation se charge de recoller les morceaux.
   */
  document_type: z.string().default('facture'),
  /**
   * Numéro de la facture rectifiée, tel qu'il figure sur l'avoir. Vide si le
   * document ne le mentionne pas — l'import refusera alors la ligne, la
   * référence à la facture initiale étant une mention légale obligatoire
   * (art. 242 nonies A ann. II CGI).
   */
  credited_invoice_number: z.string().default(''),
  /**
   * Pas de `.min(0)` : un avoir se lit avec des montants négatifs. La borne
   * à zéro rejetait l'avoir (parse en erreur) ou, sur les champs tolérants,
   * le ramenait silencieusement à 0 — l'artisan importait un avoir et
   * obtenait une facture à 0 €. Le signe est normalisé ensuite par
   * `normalizeInvoiceImportItem`, en fonction du type de document.
   */
  amount_ht: z.number().default(0),
  amount_ttc: z.number().default(0),
  tva_rate: z.number().min(0).max(30).default(20),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type InvoiceImportItem = z.infer<typeof invoiceImportItemSchema>;

/** Mots-clés qui désignent un avoir sur un document français. */
const CREDIT_NOTE_KEYWORDS = /avoir|note\s*de\s*cr[ée]dit|rectificative|credit\s*note/i;

/**
 * Normalise une ligne extraite par l'IA :
 *
 * - déduit le type de document (le modèle peut écrire « avoir », « note de
 *   crédit », « facture rectificative »… ou ne rien dire du tout alors qu'il
 *   a lu des montants négatifs) ;
 * - aligne le signe des montants sur ce type, pour que l'app ne manipule
 *   jamais un avoir positif ni une facture négative — les deux violeraient
 *   les contraintes de la table `invoices`.
 *
 * `tva_rate` reste positif : c'est un taux, pas un montant.
 */
export function normalizeInvoiceImportItem(item: InvoiceImportItem): InvoiceImportItem {
  const declaredType = (item.document_type || '').trim();
  const hasNegativeAmount = item.amount_ht < 0 || item.amount_ttc < 0;

  // On ne devine le type que sur le champ prévu pour ça et sur le signe des
  // montants. Chercher « avoir » dans la description serait piégeux : c'est
  // aussi un verbe très courant en français (« travaux à avoir lieu »…), et
  // un faux positif bloquerait l'import d'une facture normale.
  // Des montants négatifs, eux, suffisent à trancher : aucun document de
  // vente légitime n'est négatif s'il n'est pas un avoir.
  const isCreditNote = hasNegativeAmount || CREDIT_NOTE_KEYWORDS.test(declaredType);
  const documentType: InvoiceImportDocumentType = isCreditNote ? 'avoir' : 'facture';

  const sign = isCreditNote ? -1 : 1;

  return {
    ...item,
    document_type: documentType,
    credited_invoice_number: isCreditNote ? (item.credited_invoice_number || '').trim() : '',
    amount_ht: sign * Math.abs(item.amount_ht),
    amount_ttc: sign * Math.abs(item.amount_ttc),
  };
}

/**
 * L'élément importé est-il un avoir ? Le signe des montants fait foi autant
 * que le type déclaré : une ligne négative venue d'un client plus ancien (ou
 * d'un appel direct à l'API) doit être traitée comme un avoir, jamais insérée
 * telle quelle dans une facture — la contrainte
 * `invoices_non_avoir_positive_amounts` la rejetterait.
 */
export function isCreditNoteImportItem(
  item: { document_type?: string | null; amount_ttc?: number | null; amount_ht?: number | null },
): boolean {
  if ((item.document_type || '').trim().toLowerCase() === 'avoir') return true;
  return (item.amount_ttc || 0) < 0 || (item.amount_ht || 0) < 0;
}
