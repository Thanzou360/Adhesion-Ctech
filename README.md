# Plateforme d'adhésion — Club C-Tech

Site en ligne : **https://thanzou360.github.io/Adhesion-Ctech/**
Espace bureau : **https://thanzou360.github.io/Adhesion-Ctech/#bureau**

## Ce que fait la plateforme

**Pour le candidat**
- Dossier en 4 étapes : identité (avec e-mail obligatoire), **photo du visage obligatoire**, parcours, motivations.
- Choix **Membre du club** ou **Membre du bureau** (avec le poste visé). Pour le bureau, il doit accepter les engagements : rigueur, **contributions financières**, disponibilité.
- Niveau **Intermédiaire** ou **Avancé** : au moins un projet ou un lien (GitHub, portfolio…) est obligatoire.
- Après l'envoi : une référence `CT-XXXXX` et un e-mail de confirmation.
- **Suivre ma demande** avec son numéro WhatsApp + son e-mail (la référence est facultative).

**Pour le bureau**
- Un e-mail « Nouvelle demande d'adhésion » arrive chez chaque membre à chaque demande.
- Espace bureau : fiches avec photo, étiquette « Nouveau », vote **Pour / Réservé / Contre**.
- Résultat du vote à la majorité (plus de la moitié des membres), avec la liste de ceux qui n'ont pas voté.
- Décision (entretien, acceptée, non retenue) avec **e-mail automatique au candidat** et bouton **Prévenir sur WhatsApp**.
- Résumé à copier pour le groupe WhatsApp, mode clair / sombre.

## Où se trouve quoi

| Élément | Service | Ce qu'il contient |
|---|---|---|
| Site | GitHub Pages (ce dépôt) | `index.html`, `logo.png` |
| Base de données | Supabase | demandes, avis, photos, comptes du bureau |
| E-mails | EmailJS (compte gratuit, 200 envois / mois) | service Gmail + 1 modèle |

Réglages dans `index.html`, bloc `CONFIG` :
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` : le projet Supabase.
- `ALERTE_PRINCIPALE`, `ALERTE_COPIES` : qui reçoit l'alerte « nouvelle demande » (le premier en destinataire, les autres en copie cachée).
- `EMAILJS` : `SERVICE_ID`, `TEMPLATE_ID`, `PUBLIC_KEY`.
- `MODELES_EMAIL` (juste en dessous) : les textes des e-mails d'acceptation, d'entretien et de refus.

## Gestion courante

**Ajouter un membre du bureau**
1. Supabase > **Authentication > Users > Add user > Create new user** : son e-mail + un mot de passe, coche *Auto Confirm User*.
2. Supabase > **Table Editor > bureau > Insert row** : même e-mail, son nom, son poste.
3. Ajouter son e-mail dans `ALERTE_COPIES` de `index.html` pour qu'il reçoive les alertes.

**Retirer un membre** : supprimer sa ligne dans `bureau`, son compte dans *Users*, et son e-mail dans `ALERTE_COPIES`.

**Mot de passe oublié** : *Authentication > Users* > le membre > *Send password recovery* (ou recréer le compte).

## Modèle EmailJS (déjà configuré)
- Subject : `{{sujet}}`
- Content : `{{{message_html}}}` (dans le cadre C-TECH)
- To Email : `{{to_email}}` · Bcc : `{{bcc}}` · From Name : `Club C-Tech`
- Onglet Auto-Reply : désactivé

Chaque demande utilise 2 envois (alerte au bureau + confirmation au candidat), chaque décision 1 envoi. **Email History** dans EmailJS montre ce qui est parti.

## Base de données

- `supabase.sql` : le script complet (à lancer une fois sur un projet neuf, il peut être relancé sans risque).
- `sql/maj-2-type-et-suivi.sql` : mise à jour pour une base créée avant l'ajout du choix club/bureau et du suivi sans référence.

## Méthode avancée (facultative)
`supabase/functions/envoyer-email` est une fonction Supabase qui envoie les e-mails depuis Gmail côté serveur (plus sécurisée qu'EmailJS, mais plus longue à installer : mot de passe d'application Gmail + déploiement de la fonction). Elle n'est pas utilisée tant que `EMAILS_ACTIFS` vaut `false` et qu'EmailJS est configuré.

## Sécurité
- Un candidat peut déposer une demande mais jamais lire celles des autres.
- Les photos sont dans un stockage privé : seuls les membres de la table `bureau` les voient.
- Une seule demande par numéro WhatsApp.
- La clé publique EmailJS est visible dans le site : en cas d'abus, la régénérer dans EmailJS (*Account > General*) et la remplacer dans `index.html`.
