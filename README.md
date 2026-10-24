# Plateforme d'adhésion — Club C-Tech

Un site en une seule page avec trois parties :

- **Adhérer** : le candidat remplit un dossier en 4 étapes (identité, photo de son visage obligatoire, parcours, motivations). Il reçoit une référence du type `CT-7F3K2`.
- **Suivre ma demande** : avec sa référence et son numéro WhatsApp, le candidat voit si sa demande est en attente, en entretien, acceptée ou non retenue.
- **Espace bureau** : réservé aux membres du bureau. Chaque demande s'affiche avec la photo, les motivations, le parcours. Chaque membre donne son avis (pour, réservé, contre), le bureau prend la décision, et un bouton copie un résumé complet à coller dans le groupe WhatsApp.
- **Alerte au bureau** : dès qu'une demande est déposée, chaque membre du bureau reçoit un e-mail avec la photo, le parcours et la motivation du candidat, et un bouton « Voir le dossier et voter ».
- **Réponses par e-mail** : quand le bureau enregistre une décision (acceptée, entretien, non retenue), un e-mail part automatiquement au candidat depuis la boîte Gmail du club. Le texte est pré-rempli et modifiable. Le candidat reçoit aussi un e-mail « demande bien reçue » avec sa référence.
- **Mode clair / sombre** : le site suit le réglage du téléphone, et un bouton en haut à droite permet de changer.

Les photos et les dossiers ne sont visibles que par les comptes du bureau.

Tant que Supabase n'est pas configuré, le site tourne en **mode démo** (les demandes restent dans le navigateur).

---

## Mise en ligne (≈ 15 minutes)

### 1. Créer le projet Supabase
1. Va sur supabase.com, crée un projet gratuit (tu peux aussi réutiliser celui du hackathon).
2. Ouvre **SQL Editor > New query**, colle tout le contenu de `supabase.sql`, clique **Run**.

### 2. Créer les comptes du bureau
Chaque membre du bureau a besoin de deux choses : **un compte** pour se connecter à l'espace bureau, et **sa place dans la liste du bureau** pour avoir le droit de voir les demandes, voter et recevoir les e-mails « nouvelle demande ». Pas besoin de numéro de téléphone.

**a. Le compte (la clé pour entrer)** — à faire pour chaque membre
1. **Authentication > Users > Add user > Create new user**.
2. *Email address* : la vraie adresse e-mail du membre (c'est là qu'il recevra les nouvelles demandes).
3. *Password* : choisis un mot de passe pour lui (au moins 6 caractères).
4. Coche **Auto Confirm User**, puis **Create user**.
5. Envoie-lui en privé son e-mail et son mot de passe : c'est ce qu'il tapera sur la page `#bureau`.

**b. La liste du bureau (la permission)**
1. **Table Editor > bureau > Insert > Insert row**.
2. `email` : exactement la même adresse que le compte. `nom` : son nom. `poste` : Président, Secrétaire général…
3. **Save**. Recommence pour chaque membre.

Pourquoi deux étapes ? Le compte prouve qui se connecte ; la liste dit qui a le droit. Si un jour quelqu'un réussit à se créer un compte, il ne verra rien tant qu'il n'est pas dans la liste. Pour retirer un membre, supprime sa ligne dans `bureau` (et son compte dans *Users*).

Mot de passe oublié : dans *Authentication > Users*, clique sur le membre > **Send password recovery**, ou supprime et recrée son compte.

Conseillé : **Authentication > Sign In / Providers**, désactive « Allow new users to sign up ».

### 3. Brancher le site
1. **Project Settings > API** : copie la **Project URL** et la clé **anon public**.
2. Dans `index.html`, cherche le bloc `CONFIG` et colle-les :
   ```js
   const CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi...",
     BUCKET: "adhesions"
   };
   ```
   La clé anon peut être publique : ce sont les règles de sécurité du script SQL qui protègent les données.

### 4. Activer les e-mails (≈ 10 minutes)
Les e-mails partent depuis une adresse Gmail du club (ex. `ctech.officiel@gmail.com`).

**a. Créer un mot de passe d'application Gmail**
1. Connecte-toi au compte Gmail du club, va sur myaccount.google.com > **Sécurité**.
2. Active la **validation en deux étapes** si ce n'est pas déjà fait.
3. Cherche **Mots de passe des applications**, crée-en un nommé « C-Tech adhésion ».
4. Google affiche 16 lettres : copie-les (sans les espaces). Ce n'est pas le mot de passe normal du compte.

**b. Déployer la fonction dans Supabase** (sans rien installer)
1. Supabase > **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Nom de la fonction : `envoyer-email` (exactement).
3. Remplace le code proposé par tout le contenu de `supabase/functions/envoyer-email/index.ts`, puis **Deploy**.
4. Dans les réglages de la fonction, **désactive « Verify JWT »** : la fonction vérifie elle-même que l'envoi vient d'un membre du bureau.

**c. Ajouter les secrets** : Edge Functions > **Secrets** > ajoute :

| Nom | Valeur |
|---|---|
| `GMAIL_USER` | l'adresse Gmail du club |
| `GMAIL_APP_PASSWORD` | les 16 lettres de l'étape a |
| `EXPEDITEUR_NOM` | `Club C-Tech` |
| `SITE_URL` | l'adresse du site, ex. `https://thanzou360.github.io/adhesion-ctech` (sans `/` à la fin) |
| `REPONDRE_A` | facultatif : l'adresse qui reçoit les réponses des candidats |

**d. Allumer l'envoi sur le site** : dans `index.html`, bloc `CONFIG`, mets `EMAILS_ACTIFS: true`.

Pour tester, dépose une demande avec ta propre adresse : tu dois recevoir l'accusé de réception (regarde aussi les spams), et chaque membre de la table `bureau` doit recevoir l'e-mail « Nouvelle demande d'adhésion ». Puis accepte-la dans l'espace bureau : l'e-mail de bienvenue doit arriver.

Bon à savoir :
- Gmail permet environ 500 e-mails par jour, largement assez pour le club.
- Le destinataire est toujours l'e-mail enregistré dans la demande : personne ne peut utiliser le site pour écrire à quelqu'un d'autre, et le mot de passe Gmail ne quitte jamais Supabase.
- Les modèles de messages se modifient dans `index.html`, bloc `MODELES_EMAIL`.

### 5. Publier sur GitHub Pages
1. Crée un dépôt (ex. `Thanzou360/adhesion-ctech`) et ajoute `index.html` **et `logo.png`** (le logo affiché dans les e-mails).
2. **Settings > Pages** : Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Le site sera sur `https://thanzou360.github.io/adhesion-ctech/`.
   - Lien à partager aux candidats : l'adresse du site.
   - Lien pour le bureau : la même adresse suivie de `#bureau`.

---

## Ce que la sécurité garantit
- Un candidat peut **déposer** une demande, jamais lire celles des autres ni modifier la sienne.
- Une seule demande par numéro WhatsApp.
- Le stockage des photos est privé ; le bureau les voit via des liens temporaires (1 heure).
- Le suivi ne renvoie que le prénom, le statut et la date, et seulement si la référence **et** le numéro correspondent.
- Un champ piège invisible bloque les robots les plus simples.

## Si un e-mail ne part pas
L'espace bureau affiche le message d'erreur et la décision reste enregistrée. Vérifie dans l'ordre :
1. `EMAILS_ACTIFS: true` dans `index.html`.
2. La fonction s'appelle bien `envoyer-email` et « Verify JWT » est désactivé.
3. `GMAIL_APP_PASSWORD` est un mot de passe d'application (16 lettres), pas le mot de passe du compte.
4. Supabase > Edge Functions > `envoyer-email` > **Logs** montre l'erreur exacte.

## Idées pour la suite
- Export des membres acceptés vers un tableur.
- Carte de membre numérique générée à l'acceptation.
