# Process de Code Review — Hellobat

Ce document définit les pratiques et conventions de code review pour le projet Hellobat.
L'objectif est d'assurer la qualité du code, la sécurité et la maintenabilité de la plateforme SaaS
destinée aux artisans du bâtiment en France.

---

## Principes généraux

- **Bienveillance** : les commentaires portent sur le code, jamais sur la personne. Critiquer
  une implémentation, pas son auteur.
- **Constructivité** : tout commentaire bloquant doit proposer une alternative ou une piste
  de résolution. Un commentaire sans suggestion n'est pas bloquant par défaut.
- **Précision** : être explicite sur le niveau d'importance d'un commentaire. Utiliser les
  préfixes `[bloquant]`, `[suggestion]`, `[question]`, `[nit]` pour clarifier l'intention.
- **Rapidité** : la première revue doit être effectuée **en moins de 24 h en semaine**. Au-delà,
  le reviewer notifie l'auteur de son délai estimé. Ne pas laisser une PR sans réponse.
- **Contexte** : l'auteur est responsable de fournir suffisamment de contexte dans la description
  de la PR (problème résolu, décisions prises, captures d'écran si pertinentes).

---

## Checklist reviewer

Avant de soumettre votre revue, vérifiez chacune des catégories suivantes.

### Fonctionnel

- [ ] La PR résout bien le problème décrit et couvre les cas limites évidents.
- [ ] Les cas d'erreur sont gérés (états de chargement, erreurs réseau, données manquantes).
- [ ] Les fonctionnalités métier sont correctes du point de vue d'un artisan utilisateur.
- [ ] Aucune régression visible sur les flux existants.

### Qualité du code (TypeScript strict)

- [ ] Aucun usage de `any` — la règle ESLint `@typescript-eslint/no-explicit-any: error` doit passer.
- [ ] Les types sont précis et expressifs ; pas d'assertion `as` abusive.
- [ ] Les variables et fonctions inutilisées sont absentes (sauf préfixe `_` autorisé).
- [ ] La couverture de tests est >= 80 % sur les lignes, fonctions, branches et statements.
- [ ] Les tests unitaires couvrent les chemins nominaux et les cas d'erreur.
- [ ] Le code est lisible : nommage clair, fonctions courtes, absence de logique imbriquée
  inutilement complexe.
- [ ] Pas de code mort ou commenté laissé en place.

### Sécurité

- [ ] Aucun secret (clé API, token, mot de passe) n'est commité dans le code ou les fichiers
  de configuration.
- [ ] Les inputs utilisateurs sont validés côté serveur (avec Zod ou équivalent).
- [ ] Les routes API vérifient l'authentification et les autorisations via Supabase RLS.
- [ ] Les données affichées côté client sont échappées (Next.js gère cela par défaut, mais
  attention aux `dangerouslySetInnerHTML`).
- [ ] Les appels Stripe et Claude API passent uniquement par des Server Actions ou Route Handlers,
  jamais depuis le client.

### Performance

- [ ] Pas de re-renders inutiles : les composants React sont mémoïsés si nécessaire (`memo`,
  `useCallback`, `useMemo`).
- [ ] Les requêtes Supabase sont optimisées : sélection des colonnes nécessaires uniquement,
  pas de N+1.
- [ ] Les images utilisent le composant `next/image` avec les dimensions définies.
- [ ] Les imports sont optimisés : pas d'import de bibliothèques entières quand un import
  partiel suffit.
- [ ] Les Server Components sont utilisés par défaut ; `'use client'` est justifié.

### UX / Accessibilité

- [ ] Les composants interactifs sont accessibles au clavier.
- [ ] Les images ont un attribut `alt` pertinent.
- [ ] Les formulaires ont des labels associés à leurs champs.
- [ ] Les messages d'erreur sont clairs et en français, adaptés au contexte artisan.
- [ ] Les états de chargement sont gérés visuellement (skeleton, spinner).

---

## Critères de merge

Une PR peut être mergée uniquement si **toutes** les conditions suivantes sont réunies :

1. **Tous les checks CI passent** : lint, typecheck, tests unitaires (coverage >= 80 %),
   tests E2E.
2. **Au moins 1 approbation** d'un membre de l'équipe (hors auteur).
3. **Aucun commentaire bloquant non résolu** : les commentaires `[bloquant]` doivent être
   marqués comme résolus par le reviewer qui les a posés.
4. **La branch est à jour avec `develop`** : rebaser ou merger `develop` dans la branch
   avant le merge final pour éviter les conflits.

---

## Conventions de commits

Le projet suit la spécification [Conventional Commits](https://www.conventionalcommits.org/).
Le format attendu est :

```
<type>(<scope optionnel>): <description courte en français ou anglais>

[corps optionnel]

[footer optionnel: BREAKING CHANGE, Closes #xxx]
```

### Types autorisés

| Type       | Usage                                                                 |
|------------|-----------------------------------------------------------------------|
| `feat`     | Nouvelle fonctionnalité visible par l'utilisateur                     |
| `fix`      | Correction d'un bug                                                   |
| `chore`    | Tâche de maintenance (dépendances, config, scripts)                   |
| `docs`     | Modification de documentation uniquement                              |
| `test`     | Ajout ou modification de tests sans changement fonctionnel            |
| `refactor` | Refactoring sans ajout de fonctionnalité ni correction de bug         |
| `style`    | Changements de formatage, espaces, points-virgules (pas de logique)   |
| `perf`     | Amélioration de performance                                           |

### Exemples

```
feat(devis): ajouter la génération de PDF pour les devis
fix(auth): corriger la redirection après connexion Supabase
chore: mettre à jour les dépendances vers Next.js 14.2
test(stripe): ajouter les tests unitaires du webhook de paiement
```

---

## Labels PR

Appliquer les labels suivants selon le contexte de la PR :

| Label            | Description                                                              |
|------------------|--------------------------------------------------------------------------|
| `breaking-change`| La PR introduit un changement non rétrocompatible (API, schéma BDD...)   |
| `needs-review`   | La PR est prête et attend une revue                                      |
| `wip`            | Work In Progress — ne pas merger, ouverte pour discussion anticipée      |
| `hotfix`         | Correction urgente destinée à être mergée directement sur `main`         |

---

## Tailles recommandées

- **Idéalement < 400 lignes de diff** (ajouts + suppressions).
- Au-delà de 400 lignes, envisager de diviser la PR en plusieurs PR plus petites et
  indépendantes (feature flags si nécessaire pour livrer partiellement).
- Les PRs volumineuses ralentissent la review et augmentent le risque d'erreurs non détectées.
- Exception acceptée : migrations de base de données ou refactorings mécaniques et prévisibles.

---

## ADR-003 — Rappel des décisions d'architecture

Conformément à l'ADR-003 du projet Hellobat, les points suivants sont **non négociables** et
constituent des critères de refus de merge :

- **TypeScript strict** : le mode `strict: true` est activé dans `tsconfig.json`. Tout code
  soumis doit compiler sans erreur en mode strict. L'usage de `any` est interdit (règle ESLint
  en `error`).
- **Coverage 80 % minimum** : les seuils de couverture sont appliqués automatiquement par Vitest
  lors du job CI `test-unit`. Une PR qui fait passer la couverture en dessous du seuil est
  bloquée.
- **Code review obligatoire avant merge sur `develop`** : aucun merge direct sur `develop` ou
  `main` n'est autorisé, même pour de petites corrections. Toute modification passe par une PR
  avec au moins une approbation.

Ces règles s'appliquent sans exception. En cas de désaccord sur leur pertinence dans un cas
précis, ouvrir une discussion dans l'ADR correspondant avant de contourner la règle.
