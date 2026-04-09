'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowLeft, Rocket, Loader2, Check, PartyPopper } from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

interface Props {
  data: OnboardingData;
  onBack: () => void;
  onFinish: () => void;
  saving: boolean;
}

export function StepReady({ data, onBack, onFinish, saving }: Props) {
  const firstName = data.fullName.split(' ')[0] || 'vous';

  useEffect(() => {
    // Fire confetti when landing on the final step
    const duration = 1500;
    const end = Date.now() + duration;

    const fire = () => {
      confetti({
        particleCount: 3,
        startVelocity: 20,
        spread: 60,
        origin: { x: Math.random(), y: Math.random() * 0.3 + 0.1 },
        colors: ['#D35400', '#059669', '#2563eb', '#7c3aed'],
      });
      if (Date.now() < end) {
        requestAnimationFrame(fire);
      }
    };
    fire();

    // Initial burst
    confetti({
      particleCount: 80,
      spread: 80,
      origin: { y: 0.4 },
      colors: ['#D35400', '#059669', '#2563eb', '#7c3aed'],
    });
  }, []);

  // Build checklist based on what the user actually configured
  const checklist: { label: string; done: boolean }[] = [
    { label: 'Profil entreprise enregistré', done: !!data.companyName },
    { label: 'Identité visuelle configurée', done: !!data.logoUrl || !!data.primaryColor },
    {
      label: data.wantsHellobatSite
        ? 'Site web Hellobat en préparation'
        : data.hasExistingWebsite
        ? 'Site externe conservé'
        : 'Site web à configurer plus tard',
      done: data.hasExistingWebsite !== null,
    },
    { label: 'Rappels TVA & fiscalité activés', done: !!data.vatRegime },
    {
      label:
        data.hasEmployees && data.invitedEmployees.filter((e) => e.email).length > 0
          ? `${data.invitedEmployees.filter((e) => e.email).length} salarié(s) invité(s)`
          : data.wantsMaurice
          ? 'Maurice IA activé pour la compta'
          : 'Comptabilité configurée',
      done: data.hasAccountingSoftware !== null || data.hasEmployees !== null,
    },
    {
      label:
        data.serviceCategories.length > 0
          ? `${data.serviceCategories.length} catégorie(s) de prestations`
          : 'Prestations à ajouter plus tard',
      done: data.serviceCategories.length > 0,
    },
  ];

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"
        >
          <PartyPopper className="h-6 w-6 text-primary" />
        </motion.div>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-2xl font-bold text-foreground mt-3"
      >
        Bravo {firstName} !
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-sm text-muted-foreground mt-2"
      >
        Votre espace Hellobat est prêt. Voici ce qui a été configuré pour vous :
      </motion.p>

      <div className="mt-6 flex-1 space-y-2">
        {checklist.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 + i * 0.1, type: 'spring', stiffness: 300 }}
              className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                item.done ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </motion.div>
            <p className="text-sm text-foreground font-medium">{item.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          disabled={saving}
          className="h-11 px-5 rounded-xl border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 disabled:opacity-50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onFinish}
          disabled={saving}
          className="h-11 px-7 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Finalisation...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              Accéder à mon tableau de bord
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
