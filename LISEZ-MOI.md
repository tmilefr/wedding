# Site de mariage : mise en route

## Lancer en local
```
npm install
ADMIN_PASSWORD="un-mot-de-passe-solide" BASE_URL="http://localhost:3000" npm start
```
- Page des invités : `http://localhost:3000/i/<jeton>` (un lien unique par invité)
- Espace des mariés : `http://localhost:3000/admin` (identifiant `maries`, mot de passe = `ADMIN_PASSWORD`)

## À personnaliser (fichier `config.js`)
- Les prénoms des mariés (`couple`), actuellement « Prénom1 » et « Prénom2 ».
- **L'église** : le Word indiquait Saint-Dominique de Vieux-Thann, le formulaire de test la collégiale Saint-Thiébaut de Thann. Une seule est gardée dans le programme : vérifiez laquelle est la bonne.
- Programme, adresses, texte des couchages, idées de spécialités, options « Apporter ».

## Utilisation
1. Dans `/admin`, collez la liste des invités (une ligne par invité : `Nom ; e-mail`).
2. Récupérez les liens : bouton « Copier le lien », ou onglet **Liens invités** de l'export Excel pour un publipostage.
3. Pour les cartes : « Imprimer les cartes QR » (une carte par invité, un QR code personnel).
4. Suivez les réponses en direct. « Télécharger l'Excel » donne 6 onglets : Synthèse, Réponses (une ligne par invité), Participants (une ligne par personne), Couchages, Contributions (ce que chacun apporte), Liens invités.

Les invités peuvent modifier leurs réponses avec le même lien tant que vous ne le supprimez pas.

## Mise en ligne
Le site est un simple serveur Node.js. Hébergements possibles : un petit VPS, Render, Railway, Fly.io…
Variables d'environnement :
| Variable | Rôle |
|---|---|
| `BASE_URL` | Adresse publique du site (sert à fabriquer les liens et les QR codes) |
| `ADMIN_PASSWORD` | Mot de passe de l'espace des mariés (obligatoire) |
| `ADMIN_USER` | Identifiant (défaut : `maries`) |
| `DATA_DIR` | Dossier des données : doit être **persistant** sur l'hébergeur |
| `PORT` | Port (défaut : 3000) |

Utilisez toujours HTTPS (la plupart des hébergeurs le fournissent), car le mot de passe admin passe par l'authentification HTTP.

## Données
Tout est dans `data/db.json`, avec une sauvegarde automatique par jour (`db-AAAA-MM-JJ.bak.json`). Pensez à copier ce dossier de temps en temps.
