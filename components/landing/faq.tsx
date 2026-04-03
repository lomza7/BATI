'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'Hellobat est-il vraiment gratuit ?',
    answer: 'Oui, le plan Starter est 100% gratuit et sans engagement. Il inclut 5 devis par mois et 2 chantiers actifs. Aucune carte bancaire n\'est requise pour commencer.',
  },
  {
    question: 'Puis-je importer mes donnees existantes ?',
    answer: 'Absolument. Hellobat permet l\'import de vos contacts, devis et factures depuis Excel, CSV ou depuis d\'autres logiciels de gestion. Notre equipe peut vous accompagner dans la migration.',
  },
  {
    question: 'Comment fonctionne le devis IA vocal ?',
    answer: 'Vous dictez la description du chantier sur votre telephone, ajoutez quelques photos, et l IA analyse tout pour proposer un chiffrage avec lignes de devis, quantites et prix. Vous relisez, ajustez si besoin, et envoyez. Ca fonctionne sur Chrome et Edge.',
  },
  {
    question: 'Comment fonctionnent les agents IA ?',
    answer: 'Les agents IA analysent vos donnees (demandes clients, historique de devis) pour generer automatiquement des reponses, devis et relances. Vous gardez toujours le controle et validez avant envoi.',
  },
  {
    question: 'Les paiements en ligne sont-ils securises ?',
    answer: 'Oui, nous utilisons Stripe, le leader mondial du paiement en ligne. Toutes les transactions sont chiffrees et conformes PCI DSS. Vos clients paient en toute securite.',
  },
  {
    question: 'Puis-je changer de plan a tout moment ?',
    answer: 'Oui, vous pouvez upgrader ou downgrader votre plan a tout moment. Le changement est immediat et la facturation est ajustee au prorata.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-12 sm:py-24 bg-[var(--landing-off)]">
      <div className="max-w-[800px] mx-auto px-6">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
            Questions <em className="italic text-[var(--landing-accent)]">frequentes</em>
          </h2>
          <p className="text-[var(--landing-muted)] text-lg">
            Tout ce que vous devez savoir pour bien demarrer.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--landing-border)] bg-white overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
              >
                <span className="text-sm font-semibold text-[var(--landing-text)] pr-4">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-[var(--landing-muted)] shrink-0 transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === i ? 'max-h-48' : 'max-h-0'
                }`}
              >
                <div className="px-6 pb-5 text-sm text-[var(--landing-muted)] leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
