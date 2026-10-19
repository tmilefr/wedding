# Site de mariage : invitations, questionnaire et export Excel

Site sur mesure pour gérer les réponses des invités d'un mariage champêtre (samedi 27 août 2027, maison de Baeselbach). Chaque invité reçoit un **lien personnel** (par e-mail ou par QR code sur un carton) ; ses réponses sont automatiquement rattachées à son nom, et les mariés récupèrent tout dans un **fichier Excel**.

- Serveur Node.js + Express, sans base de données externe (un fichier JSON)
- Interface invités pensée d'abord pour le téléphone, design champêtre
- Espace des mariés protégé par mot de passe
- Envoi des invitations par e-mail, avec le QR code intégré au message

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Démarrage rapide](#démarrage-rapide)
3. [Utilisation pas à pas](#utilisation-pas-à-pas)
4. [Envoi des e-mails](#envoi-des-e-mails)
5. [Configuration](#configuration)
6. [Export Excel](#export-excel)
7. [Structure du projet](#structure-du-projet)
8. [API](#api)
9. [Données et sauvegardes](#données-et-sauvegardes)
10. [Sécurité](#sécurité)
11. [Mise en ligne](#mise-en-ligne)
12. [Dépannage](#dépannage)

---

## Fonctionnalités

### Côté invités (`/i/<jeton>`)
- Page d'accueil personnalisée (« Bonjour Famille Martin ! ») avec le programme du week-end.
- Formulaire en 6 étapes, **conditionnel** : si l'invité répond « Non », il passe directement à un petit mot.
- **Une fiche par personne** : prénom, nom, âge au jour du mariage, couchage sur place, régime ou allergies.
- Vendredi (préparation, repas du soir, ce que l'on apporte), samedi (spécialité régionale, avec des idées cliquables), dimanche et lundi (brunch, rangement, prolongation).
- Validation à chaque étape, récapitulatif avant l'envoi.
- Les réponses sont **modifiables** avec le même lien.

### Côté mariés (`/admin`)
- Chiffres clés : invitations, réponses, personnes présentes, couchages, repas du vendredi, brunch, lundi.
- Liste des invités : recherche, copie du lien, QR code, suppression.
- **Fiche détaillée par famille** (`Détail`) : personnes, régimes, week-end, message, lien, modification du nom ou de l'e-mail.
- **Écran d'envoi des invitations** (`Envoyer les invitations`) : ajout des invités, sélection, aperçu, envoi individuel ou groupé, rappels, suivi de ce qui a été envoyé.
- Cartes à imprimer avec un QR code par invité.
- Export Excel à 6 onglets.

---

## Démarrage rapide

Prérequis : Node.js 18 ou plus récent.

```bash
npm install
ADMIN_PASSWORD="un-mot-de-passe-solide" BASE_URL="http://localhost:3000" npm start
```

Sous Windows (PowerShell) :

```powershell
$env:ADMIN_PASSWORD="un-mot-de-passe-solide"; $env:BASE_URL="http://localhost:3000"; npm start
```

| Page | Adresse |
|---|---|
| Espace des mariés | `http://localhost:3000/admin` (identifiant `maries`, mot de passe = `ADMIN_PASSWORD`) |
| Écran d'envoi des invitations | `http://localhost:3000/admin/envois` |
| Page d'un invité | `http://localhost:3000/i/<jeton>` (le lien est donné dans l'espace des mariés) |

Avant de partager quoi que ce soit, ouvrez `config.js` et remplacez les prénoms (voir [Configuration](#configuration)).

---

## Utilisation pas à pas

1. **Personnalisez `config.js`** : prénoms, programme, adresses, textes.
2. **Ajoutez les invités** dans `/admin/envois` (panneau « Ajouter des invités ») : une ligne par invité (une personne, un couple ou une famille), au format `Nom ; e-mail`. L'e-mail est facultatif pour ceux qui recevront un carton avec QR code.
3. **Vérifiez le rendu** : ouvrez le lien d'un invité de test et parcourez le formulaire sur votre téléphone.
4. **Envoyez les invitations** depuis `/admin/envois` (voir ci-dessous), et/ou **imprimez les cartes** avec le bouton « Imprimer les cartes QR ».
5. **Suivez les réponses** dans `/admin`, ouvrez la fiche d'une famille avec « Détail », relancez ceux qui n'ont pas répondu.
6. **Téléchargez l'Excel** quand vous en avez besoin : il est recalculé à chaque téléchargement.

Les invités peuvent corriger leurs réponses tant que leur invité n'est pas supprimé.

---

## Envoi des e-mails

L'écran `/admin/envois` permet d'abord d'**ajouter des invités** (une ligne par invité, `Nom ; e-mail`), puis liste les invités avec, pour chacun : la réponse, l'état d'envoi (`Jamais envoyé`, `Envoyé le …`, `Échec`), un bouton **Aperçu** et un bouton **Envoyer** (ou **Renvoyer**).

- **Filtres** : Tous, Jamais envoyé, Sans réponse, Sans e-mail.
- **Envoi groupé** : cochez des invités (la case de l'en-tête sélectionne toute la vue), puis « Envoyer l'invitation » ou « Envoyer un rappel ». Une confirmation indique combien d'invités l'ont déjà reçue.
- **Rappel** : même e-mail avec un texte de relance et un autre objet (voir `config.js`).
- **Contenu de l'e-mail** : salutation personnelle, texte, bouton « Répondre à l'invitation », QR code personnel (image intégrée au message, donc affichée même par les messageries qui bloquent les images distantes), lien en clair, et une version texte brut.
- **E-mail test** : envoie un exemple (avec un lien factice) à l'adresse de votre choix pour vérifier la configuration.
- Les invités sans adresse valide ne peuvent pas être sélectionnés ; un lien « Ajouter une adresse e-mail » mène à leur fiche.
- Les envois sont espacés d'environ 250 ms pour ne pas saturer le serveur de messagerie.

### Mode simulation (par défaut)

Tant qu'aucun serveur SMTP n'est configuré, **aucun e-mail n'est réellement envoyé**. Un bandeau jaune l'indique sur l'écran, et chaque message est enregistré en HTML dans `data/outbox/`. Vous pouvez ainsi tout essayer sans risque.

### Activer l'envoi réel (SMTP)

Définissez ces variables d'environnement :

| Variable | Rôle | Exemple |
|---|---|---|
| `SMTP_HOST` | Serveur SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Port (défaut 587) | `587` |
| `SMTP_SECURE` | `true` pour le port 465, sinon `false` | `false` |
| `SMTP_USER` | Identifiant | `prenom@gmail.com` |
| `SMTP_PASS` | Mot de passe | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM` | Expéditeur affiché | `Prénom & Prénom <prenom@gmail.com>` |

Exemples de fournisseurs (les paramètres exacts sont à vérifier auprès du vôtre) :

- **Gmail** : `smtp.gmail.com`, port 587. Nécessite la validation en deux étapes et un **mot de passe d'application** (pas le mot de passe habituel). Les envois sont limités par jour.
- **Service d'envoi (Brevo, Mailjet, etc.)** : recommandé pour un grand nombre d'invités ; ils fournissent l'hôte, le port et les identifiants SMTP.
- **Votre hébergeur de messagerie (OVH, etc.)** : utilisez le serveur sortant indiqué dans votre espace client.

Conseils pour que les e-mails n'arrivent pas dans les indésirables :
- envoyez d'abord un **e-mail test** à vous-même et à une adresse d'un autre fournisseur ;
- utilisez une adresse expéditeur de votre propre domaine si possible (avec SPF/DKIM configurés chez votre hébergeur de domaine) ;
- envoyez par petits lots plutôt que d'un coup, et prévenez les invités qu'un e-mail arrive.

---

## Configuration

### `config.js` : le contenu du site

Aucune connaissance du code n'est nécessaire : modifiez les textes, enregistrez, puis relancez le serveur.

| Clé | Contenu |
|---|---|
| `couple` | Prénoms des mariés. **À remplacer** (actuellement `Prénom1` et `Prénom2`) |
| `dateLabel`, `dateShort` | Date affichée |
| `intro` | Phrase d'introduction du site |
| `venue` | Nom et adresse du lieu de la fête |
| `lodging` | Texte sur les couchages (draps, lits une place non déplaçables) |
| `program` | Programme du vendredi, du samedi, du dimanche et du lundi (heures, lieux, notes) |
| `specialtyIdeas` | Idées de spécialités proposées sous la question « spécialité régionale » |
| `mail` | Objets, textes, libellé du bouton et signature des e-mails (invitation et rappel) |
| `bringOptions` | Choix pour « Apporterez-vous quelque chose ? » |

> **À vérifier** : l'église. Le document Word indiquait l'église Saint-Dominique de Vieux-Thann, le formulaire de test la collégiale Saint-Thiébaut de Thann. Le programme de `config.js` utilise cette dernière : confirmez avec les mariés. Pensez aussi à remplacer `mail.signature`.

### Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `ADMIN_PASSWORD` | Mot de passe de l'espace des mariés. **À définir impérativement** | `changez-moi` |
| `ADMIN_USER` | Identifiant de l'espace des mariés | `maries` |
| `BASE_URL` | Adresse publique du site, utilisée pour fabriquer les liens et QR codes | `http://localhost:PORT` |
| `PORT` | Port d'écoute | `3000` |
| `DATA_DIR` | Dossier des données (doit être persistant en ligne) | `./data` |
| `SMTP_*` | Envoi des e-mails (voir plus haut) | non défini = simulation |

> **Important** : `BASE_URL` est inscrit dans chaque lien et chaque QR code au moment où ils sont générés. Définissez-la correctement (adresse finale, en `https://`) **avant** d'envoyer les invitations ou d'imprimer les cartons.

### Design

Les couleurs et polices sont des variables en tête de `public/style.css` (`--herbe`, `--foret`, `--coquelicot`, `--bleuet`, `--ble`). Les fleurs du bandeau sont un SVG intégré à `public/guest.html`.

---

## Export Excel

Le bouton « Télécharger l'Excel » (`/admin`) produit un fichier `.xlsx` de 6 onglets :

| Onglet | Contenu |
|---|---|
| **Synthèse** | Totaux : invitations, réponses, personnes, adultes et enfants, couchages, repas du vendredi, brunch, lundi, rangement |
| **Réponses** | Une ligne par invité (foyer) : statut, nombre de personnes, couchages, vendredi, ce qu'il apporte, spécialité, brunch, lundi, message, date d'envoi de l'invitation |
| **Participants** | Une ligne par personne : foyer, nom, prénom, âge, couchage, régime ou allergies |
| **Couchages** | Les personnes qui dorment sur place, avec une colonne « Lit attribué » à remplir |
| **Contributions** | Une ligne par plat ou boisson apporté, et par spécialité régionale |
| **Liens invités** | Nom, e-mail et lien personnel, pour un publipostage |

Les âges sont ceux du jour du mariage ; « adulte » signifie 18 ans ou plus.

---

## Structure du projet

```
mariage/
├── server.js            Serveur Express : API, stockage, e-mails, export Excel
├── config.js            Contenu du site (textes, programme, e-mails)
├── package.json
├── README.md
├── public/
│   ├── style.css            Style champêtre (site invités + espace des mariés)
│   ├── home.html            Page d'accueil publique (sans lien personnel)
│   ├── guest.html / guest.js    Formulaire invité (étapes, validation, envoi)
│   ├── admin.html / admin.js    Liste des invités et chiffres clés
│   ├── admin-guest.html / .js   Fiche détaillée d'une famille
│   └── admin-envois.html / .js  Écran d'envoi des invitations
└── data/                    Créé au premier lancement (ignoré par git)
    ├── db.json              Invités et réponses
    ├── db-AAAA-MM-JJ.bak.json   Sauvegarde quotidienne
    └── outbox/              E-mails enregistrés en mode simulation
```

---

## API

Les routes `/api/admin/*` et les pages `/admin*` exigent l'authentification HTTP Basic.

### Invités

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/invite/:jeton` | Nom de l'invité, sa réponse et le contenu du site |
| `POST` | `/api/invite/:jeton` | Enregistre ou met à jour la réponse (validée côté serveur) |

### Mariés

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/admin/guests` | Liste complète des invités, avec liens |
| `POST` | `/api/admin/guests` | Ajoute des invités (utilisé par l'écran d'envoi) : `{ "guests": [{ "name", "email" }] }` |
| `GET` | `/api/admin/guests/:id` | Détail d'un invité |
| `PATCH` | `/api/admin/guests/:id` | Modifie le nom ou l'e-mail |
| `DELETE` | `/api/admin/guests/:id` | Supprime l'invité et sa réponse |
| `GET` | `/api/admin/qr/:id.svg` | QR code de l'invité (SVG) |
| `GET` | `/api/admin/export.xlsx` | Export Excel |
| `GET` | `/api/admin/mail-status` | SMTP configuré ou mode simulation |
| `GET` | `/api/admin/mail-preview/:id?kind=invitation\|rappel` | Aperçu HTML de l'e-mail |
| `POST` | `/api/admin/send` | Envoie : `{ "ids": [...], "kind": "invitation" \| "rappel" }` |
| `POST` | `/api/admin/send-test` | E-mail test : `{ "to": "adresse" }` |

### Structure d'une réponse

```json
{
  "attending": true,
  "people": [{ "firstName": "Anne", "lastName": "Martin", "age": 42, "sleepsOnSite": true, "diet": "" }],
  "fridayPresent": true, "fridayPrep": true, "fridayDinner": true,
  "bring": ["salade", "dessert"], "bringOther": "pain",
  "regionalHas": true, "regionalDetail": "Cannelés",
  "brunch": true, "cleanup": false, "extendMonday": true,
  "comment": "Hâte d'y être !"
}
```

---

## Données et sauvegardes

- Tout est stocké dans `data/db.json` (invités, jetons, réponses, état des envois). C'est largement suffisant pour quelques centaines d'invités.
- Une **sauvegarde par jour** est créée automatiquement (`db-AAAA-MM-JJ.bak.json`). Copiez le dossier `data/` de temps en temps ailleurs, surtout avant la date limite de réponse.
- Les écritures sont atomiques (fichier temporaire puis renommage) pour éviter toute corruption.
- Supprimer un invité supprime définitivement sa réponse.

---

## Sécurité

- **Les liens personnels sont la clé d'accès** : le jeton (12 caractères aléatoires) n'est pas devinable, mais toute personne qui possède le lien peut voir et modifier la réponse. Demandez aux invités de ne pas le partager.
- Les pages invités ne sont pas indexées par les moteurs de recherche (`noindex`).
- L'espace des mariés est protégé par mot de passe (comparaison à temps constant). **Choisissez un mot de passe solide et utilisez HTTPS** en ligne, car l'authentification HTTP Basic transmet le mot de passe à chaque requête.
- Les données saisies par les invités sont validées et limitées en taille côté serveur, et affichées sans interprétation HTML.
- Les données personnelles (noms, âges, régimes alimentaires, allergies) restent sur votre serveur. Supprimez les données une fois le mariage passé.

---

## Mise en ligne

Le site est un simple serveur Node.js : il fonctionne sur un petit VPS, ou sur une plateforme comme Render, Railway ou Fly.io.

Points essentiels :

1. Définir `ADMIN_PASSWORD`, `BASE_URL` (adresse finale en `https://`) et, si besoin, les variables `SMTP_*`.
2. **Rendre `DATA_DIR` persistant** : sur de nombreuses plateformes le disque est effacé à chaque déploiement ; il faut alors attacher un volume ou un disque persistant et y pointer `DATA_DIR`. Sans cela, vous perdriez les réponses.
3. Activer HTTPS (fourni par la plupart des plateformes).
4. Lancer avec `npm start` (le serveur écoute sur `PORT`).

Exemple avec un VPS et `pm2` :

```bash
npm install --omit=dev
npm install -g pm2
ADMIN_PASSWORD="…" BASE_URL="https://mariage.exemple.fr" DATA_DIR=/var/lib/mariage pm2 start server.js --name mariage
pm2 save
```

Placez ensuite un reverse proxy (nginx, Caddy) devant pour le HTTPS.

---

## Dépannage

| Symptôme | Cause probable et solution |
|---|---|
| « Lien introuvable » chez l'invité | Lien incomplet ou invité supprimé. Recopiez le lien depuis `/admin` |
| Les liens et QR codes pointent vers `localhost` | `BASE_URL` n'était pas définie. Corrigez-la : les liens sont recalculés à l'affichage, mais **les QR codes déjà imprimés ou envoyés restent à refaire** |
| Bandeau « Mode simulation » | Aucun SMTP configuré. Renseignez les variables `SMTP_*` |
| Échec d'envoi : « Invalid login » ou « Authentication failed » | Identifiant ou mot de passe SMTP incorrect (avec Gmail : utilisez un mot de passe d'application) |
| Échec d'envoi : « ECONNREFUSED » ou « ETIMEDOUT » | Hôte ou port erroné, ou port sortant bloqué par l'hébergeur. Essayez 587 avec `SMTP_SECURE=false`, ou 465 avec `SMTP_SECURE=true` |
| E-mails reçus dans les indésirables | Voir les conseils de la section [Envoi des e-mails](#envoi-des-e-mails) |
| Le mot de passe admin est refusé | Vérifiez `ADMIN_USER` et `ADMIN_PASSWORD`, puis relancez le serveur après tout changement |
| Réponses perdues après un redéploiement | `DATA_DIR` n'est pas persistant (voir [Mise en ligne](#mise-en-ligne)). Restaurez une sauvegarde `db-*.bak.json` en la renommant `db.json` |
| Les polices ne s'affichent pas | Les polices viennent de Google Fonts : sans connexion, des polices de secours sont utilisées |

---

## Idées pour la suite

- Modifier la réponse d'une famille depuis l'espace des mariés (réponse reçue par téléphone).
- Date limite de réponse affichée sur le site et relances automatiques.
- Plan de table et attribution des lits à partir de l'onglet « Couchages ».
