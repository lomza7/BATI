export function Testimonials() {
  const testimonials = [
    {
      name: 'Thomas Renard',
      role: 'Plombier, Lyon',
      text: 'BatiFlow a transforme ma gestion quotidienne. Je passe moitie moins de temps sur l\'administratif et mes clients recoivent les devis en quelques minutes.',
      avatar: 'TR',
    },
    {
      name: 'Marie Leclerc',
      role: 'Electricienne, Bordeaux',
      text: 'Le module de prospection est incroyable. En 3 mois, j\'ai augmente mon taux de conversion de 40%. Le CRM est vraiment adapte aux artisans.',
      avatar: 'ML',
    },
    {
      name: 'David Moreau',
      role: 'Couvreur, Nantes',
      text: 'Les agents IA me font gagner un temps fou. L\'agent devis genere des propositions precises en 30 secondes. Mes clients sont impressionnes.',
      avatar: 'DM',
    },
  ];

  return (
    <section id="testimonials" className="py-24 bg-[var(--landing-white)]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
            Ils nous font <em className="italic text-[var(--landing-accent)]">confiance</em>
          </h2>
          <p className="text-[var(--landing-muted)] text-lg max-w-xl mx-auto">
            Decouvrez ce que les artisans pensent de BatiFlow au quotidien.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="p-8 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-off)]">
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className="text-amber-500 text-sm">&#9733;</span>
                ))}
              </div>
              <p className="text-sm text-[var(--landing-text)] leading-relaxed mb-6">&laquo; {t.text} &raquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--landing-stone)] flex items-center justify-center">
                  <span className="text-xs font-bold text-[var(--landing-muted)]">{t.avatar}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--landing-text)]">{t.name}</div>
                  <div className="text-xs text-[var(--landing-muted)]">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
