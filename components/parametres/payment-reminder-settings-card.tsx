'use client';

import { useEffect, useState } from 'react';
import { Bell, ChevronDown, Loader2, RotateCcw, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';

interface ReminderSettings {
  reminders_enabled: boolean;
  r1_enabled: boolean;
  r1_delay_days: number;
  r1_subject: string;
  r1_body: string;
  r2_enabled: boolean;
  r2_delay_days: number;
  r2_subject: string;
  r2_body: string;
  r3_enabled: boolean;
  r3_delay_days: number;
  r3_subject: string;
  r3_body: string;
}

const DEFAULTS: ReminderSettings = {
  reminders_enabled: false,
  r1_enabled: true,
  r1_delay_days: 7,
  r1_subject: 'Rappel : Facture {numero} en attente de règlement',
  r1_body: `Bonjour {client},

Nous espérons que tout se passe bien sur le chantier. Nous nous permettons de vous rappeler que la facture {numero} d'un montant de {montant}, arrivée à échéance le {echeance}, reste en attente de règlement.

Vous pouvez la consulter et la régler via le lien ci-dessous.

Nous restons à votre disposition pour toute question.

Cordialement,
{artisan}`,
  r2_enabled: true,
  r2_delay_days: 14,
  r2_subject: 'Relance : Facture {numero} impayée',
  r2_body: `Bonjour {client},

Sauf erreur de notre part, votre facture {numero} d'un montant de {montant}, dont l'échéance était fixée au {echeance}, reste impayée à ce jour.

Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.

Cordialement,
{artisan}`,
  r3_enabled: true,
  r3_delay_days: 30,
  r3_subject: 'Dernier rappel : Facture {numero} — action requise',
  r3_body: `Bonjour {client},

Malgré nos précédentes relances, nous n'avons toujours pas reçu votre règlement pour la facture {numero} d'un montant de {montant} (échéance : {echeance}).

Sans réponse de votre part sous 8 jours, nous serons contraints d'envisager des mesures complémentaires pour le recouvrement de cette créance.

Merci de votre compréhension.

Cordialement,
{artisan}`,
};

const LEVELS = [
  { key: 1, label: 'Relance 1 — Rappel amical', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  { key: 2, label: 'Relance 2 — Relance ferme', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  { key: 3, label: 'Relance 3 — Dernier rappel', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
] as const;

export function PaymentReminderSettingsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULTS);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('payment_reminder_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setSettings({
          reminders_enabled: data.reminders_enabled ?? false,
          r1_enabled: data.r1_enabled ?? true,
          r1_delay_days: data.r1_delay_days ?? 7,
          r1_subject: data.r1_subject ?? DEFAULTS.r1_subject,
          r1_body: data.r1_body ?? DEFAULTS.r1_body,
          r2_enabled: data.r2_enabled ?? true,
          r2_delay_days: data.r2_delay_days ?? 14,
          r2_subject: data.r2_subject ?? DEFAULTS.r2_subject,
          r2_body: data.r2_body ?? DEFAULTS.r2_body,
          r3_enabled: data.r3_enabled ?? true,
          r3_delay_days: data.r3_delay_days ?? 30,
          r3_subject: data.r3_subject ?? DEFAULTS.r3_subject,
          r3_body: data.r3_body ?? DEFAULTS.r3_body,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('payment_reminder_settings')
      .upsert({
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Paramètres de relance enregistrés' });
    }
  }

  function resetLevel(level: 1 | 2 | 3) {
    const prefix = `r${level}_` as const;
    setSettings((prev) => ({
      ...prev,
      [`${prefix}enabled`]: DEFAULTS[`${prefix}enabled` as keyof ReminderSettings],
      [`${prefix}delay_days`]: DEFAULTS[`${prefix}delay_days` as keyof ReminderSettings],
      [`${prefix}subject`]: DEFAULTS[`${prefix}subject` as keyof ReminderSettings],
      [`${prefix}body`]: DEFAULTS[`${prefix}body` as keyof ReminderSettings],
    }));
  }

  function updateField(field: keyof ReminderSettings, value: string | number | boolean) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#d35400]/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-[#d35400]" />
            </div>
            <div>
              <CardTitle className="text-base">Relances automatiques</CardTitle>
              <CardDescription>
                Envoyez des rappels par email en cas de facture impayée
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={settings.reminders_enabled}
            onCheckedChange={(v) => updateField('reminders_enabled', v)}
          />
        </div>
      </CardHeader>

      {settings.reminders_enabled && (
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Variables disponibles dans les templates :{' '}
              <code className="text-[11px] bg-muted px-1 py-0.5 rounded">{'{client}'}</code>{' '}
              <code className="text-[11px] bg-muted px-1 py-0.5 rounded">{'{numero}'}</code>{' '}
              <code className="text-[11px] bg-muted px-1 py-0.5 rounded">{'{montant}'}</code>{' '}
              <code className="text-[11px] bg-muted px-1 py-0.5 rounded">{'{echeance}'}</code>{' '}
              <code className="text-[11px] bg-muted px-1 py-0.5 rounded">{'{artisan}'}</code>
            </p>
          </div>

          {LEVELS.map((level) => {
            const prefix = `r${level.key}_` as 'r1_' | 'r2_' | 'r3_';
            const enabled = settings[`${prefix}enabled` as keyof ReminderSettings] as boolean;
            const delayDays = settings[`${prefix}delay_days` as keyof ReminderSettings] as number;
            const subject = settings[`${prefix}subject` as keyof ReminderSettings] as string;
            const body = settings[`${prefix}body` as keyof ReminderSettings] as string;
            const isExpanded = expandedLevel === level.key;

            return (
              <div key={level.key} className={`rounded-xl border ${enabled ? level.borderColor : 'border-border'} ${enabled ? level.bgColor : 'bg-muted/20'} transition-colors`}>
                <button
                  type="button"
                  onClick={() => setExpandedLevel(isExpanded ? null : level.key)}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => {
                        updateField(`${prefix}enabled` as keyof ReminderSettings, v);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="text-left">
                      <p className={`text-sm font-medium ${enabled ? level.color : 'text-muted-foreground'}`}>
                        {level.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        J+{delayDays} après échéance
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && enabled && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">Délai après échéance</label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={delayDays}
                          onChange={(e) => updateField(`${prefix}delay_days` as keyof ReminderSettings, Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                          className="w-20 h-9"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground">Objet de l&apos;email</label>
                      <Input
                        value={subject}
                        onChange={(e) => updateField(`${prefix}subject` as keyof ReminderSettings, e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground">Corps du message</label>
                      <Textarea
                        value={body}
                        onChange={(e) => updateField(`${prefix}body` as keyof ReminderSettings, e.target.value)}
                        rows={8}
                        className="mt-1 text-sm"
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetLevel(level.key as 1 | 2 | 3)}
                      className="gap-1.5 text-xs text-muted-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Réinitialiser ce template
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
