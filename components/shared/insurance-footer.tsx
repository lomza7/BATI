import { Shield } from 'lucide-react';

export interface InsuranceInfo {
  insurance_company?: string | null;
  insurance_address?: string | null;
  insurance_coverage_zone?: string | null;
  insurance_contract_number?: string | null;
  insurance_warranty_type?: string | null;
}

interface Props {
  insurance: InsuranceInfo | null | undefined;
}

/**
 * Mandatory insurance block displayed on quotes and invoices.
 * Renders nothing if no insurance information has been filled in by the artisan.
 */
export function InsuranceFooter({ insurance }: Props) {
  if (!insurance) return null;

  const {
    insurance_company,
    insurance_address,
    insurance_coverage_zone,
    insurance_contract_number,
    insurance_warranty_type,
  } = insurance;

  const hasAny = !!(
    insurance_company ||
    insurance_address ||
    insurance_coverage_zone ||
    insurance_contract_number ||
    insurance_warranty_type
  );
  if (!hasAny) return null;

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-[#e5e1da]/70">
      <div className="flex items-start gap-2">
        <Shield className="h-3.5 w-3.5 text-[#6b6560]/70 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b6560]">
            Assurance professionnelle
          </p>
          <div className="mt-1 text-[11px] text-[#6b6560]/80 leading-relaxed space-y-0.5">
            {insurance_warranty_type && (
              <p className="font-medium text-[#6b6560]">{insurance_warranty_type}</p>
            )}
            {insurance_company && (
              <p>
                Assureur&nbsp;: {insurance_company}
                {insurance_address ? ` — ${insurance_address}` : ''}
              </p>
            )}
            {insurance_contract_number && (
              <p>Contrat n°&nbsp;{insurance_contract_number}</p>
            )}
            {insurance_coverage_zone && (
              <p>Zone couverte&nbsp;: {insurance_coverage_zone}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
