'use client';

import { useState } from 'react';
import { Mail, Inbox, Send, Star, Archive, Sparkles, Search, Plus, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  preview: string;
  date: string;
  read: boolean;
  starred: boolean;
  folder: 'inbox' | 'sent' | 'starred';
}

const DEMO_EMAILS: EmailMessage[] = [
  { id: '1', from: 'Jean Dupont', subject: 'Devis renovation cuisine', preview: 'Bonjour, suite a notre echange telephonique, je souhaite obtenir un devis pour la renovation...', date: 'Aujourd\'hui', read: false, starred: true, folder: 'inbox' },
  { id: '2', from: 'Marie Martin', subject: 'Re: Avancement chantier SdB', preview: 'Merci pour les photos d\'avancement. Le carrelage est superbe ! Quand pensez-vous...', date: 'Hier', read: true, starred: false, folder: 'inbox' },
  { id: '3', from: 'Leroy Merlin Pro', subject: 'Votre commande #LM-4582 est prete', preview: 'Bonjour, votre commande de materiaux est disponible en retrait au depot de...', date: 'Hier', read: true, starred: false, folder: 'inbox' },
  { id: '4', from: 'Pierre Bernard', subject: 'Demande de devis terrasse bois', preview: 'Monsieur, nous avons un projet de terrasse en bois composite de 35m2. Pourriez-vous...', date: '25 Mar', read: true, starred: true, folder: 'inbox' },
  { id: '5', from: 'Assurance MAF', subject: 'Renouvellement garantie decennale', preview: 'Votre contrat de garantie decennale arrive a echeance le 15 avril. Merci de...', date: '24 Mar', read: true, starred: false, folder: 'inbox' },
];

export default function MailPage() {
  const [folder, setFolder] = useState<'inbox' | 'sent' | 'starred'>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);

  const emails = DEMO_EMAILS.filter(e => {
    if (folder === 'starred') return e.starred;
    return e.folder === folder;
  }).filter(e =>
    e.subject.toLowerCase().includes(search.toLowerCase()) ||
    e.from.toLowerCase().includes(search.toLowerCase())
  );

  const folders = [
    { id: 'inbox' as const, label: 'Boite de reception', icon: Inbox, count: DEMO_EMAILS.filter(e => !e.read).length },
    { id: 'sent' as const, label: 'Envoyes', icon: Send, count: 0 },
    { id: 'starred' as const, label: 'Favoris', icon: Star, count: DEMO_EMAILS.filter(e => e.starred).length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Boite mail" description="Gerez vos emails depuis BatiFlow">
        <Button onClick={() => setComposing(true)} className="gap-2"><Plus className="h-4 w-4" /> Nouveau message</Button>
      </PageHeader>

      <div className="flex flex-col sm:grid sm:grid-cols-12 gap-4 min-h-[400px] sm:min-h-[600px]">
        <div className="sm:col-span-3 rounded-xl border border-border bg-card p-2 sm:p-3">
          <div className="flex sm:flex-col gap-1 overflow-x-auto">
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => { setFolder(f.id); setSelectedEmail(null); }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                folder === f.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <span className="flex items-center gap-2"><f.icon className="h-4 w-4" />{f.label}</span>
              {f.count > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{f.count}</span>}
            </button>
          ))}
          </div>
          <div className="hidden sm:block border-t border-border pt-3 mt-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Sparkles className="h-5 w-5 text-primary mx-auto" />
              <p className="mt-2 text-xs font-medium text-foreground">IA Email</p>
              <p className="text-[10px] text-muted-foreground">Brouillons IA, resumes, reponses intelligentes</p>
            </div>
          </div>
        </div>

        <div className="sm:col-span-9 rounded-xl border border-border bg-card overflow-hidden">
          {composing ? (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Nouveau message</h3>
                <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>Annuler</Button>
              </div>
              <div><Input placeholder="A : email@client.com" /></div>
              <div><Input placeholder="Objet" /></div>
              <textarea className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Votre message..." />
              <div className="flex items-center justify-between">
                <Button variant="outline" className="gap-2"><Sparkles className="h-4 w-4" /> Generer avec l&apos;IA</Button>
                <Button className="gap-2"><Send className="h-4 w-4" /> Envoyer</Button>
              </div>
            </div>
          ) : selectedEmail ? (
            <div className="p-6">
              <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)} className="mb-4 gap-1">
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedEmail.subject}</h2>
                  <p className="text-sm text-muted-foreground mt-1">De : {selectedEmail.from}</p>
                </div>
                <span className="text-xs text-muted-foreground">{selectedEmail.date}</span>
              </div>
              <div className="mt-6 text-sm text-foreground leading-relaxed">
                <p>{selectedEmail.preview}</p>
                <p className="mt-4">Cordialement,<br />{selectedEmail.from}</p>
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Repondre</Button>
                <Button variant="outline" className="gap-2"><Sparkles className="h-4 w-4" /> Reponse IA</Button>
                <Button variant="outline" className="gap-2"><Archive className="h-4 w-4" /> Archiver</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Rechercher dans les mails..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                </div>
              </div>
              {emails.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Aucun email</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {emails.map(email => (
                    <button
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30',
                        !email.read && 'bg-primary/5'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={cn('text-sm truncate', !email.read ? 'font-semibold text-foreground' : 'text-foreground')}>{email.from}</p>
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{email.date}</span>
                        </div>
                        <p className={cn('text-sm truncate', !email.read ? 'font-medium text-foreground' : 'text-muted-foreground')}>{email.subject}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{email.preview}</p>
                      </div>
                      {email.starred && <Star className="h-4 w-4 text-amber-400 fill-amber-400 flex-shrink-0 mt-1" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
