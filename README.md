# L'Atelier

Application de publication d'articles et de prise de commandes, avec une interface d'administration protégée. Stack : React, Vite, Express, Mongoose et MongoDB.

## Prérequis

- Node.js 20 ou plus récent
- MongoDB local démarré, ou une URI MongoDB Atlas

## Installation

À la racine du projet :

```bash
npm install
```

Copiez `.env.example` vers `.env`, puis définissez `MONGODB_URI`, `ADMIN_PASSWORD` et `JWT_SECRET`. Utilisez un mot de passe d'administration et une clé JWT uniques en production. Exemple de clé : une chaîne aléatoire longue générée par votre gestionnaire de mots de passe.

Pour MongoDB local, gardez l'URI fournie. Pour Atlas, remplacez-la par l'URI du cluster et autorisez l'adresse IP du serveur dans les règles réseau Atlas.

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/atelier_commandes
ADMIN_PASSWORD=un-mot-de-passe-local
JWT_SECRET=une-cle-secrete-longue-et-aleatoire
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

## Lancement

```bash
npm run dev
```

- Site : http://localhost:5173
- Administration : http://localhost:5173/admin
- API : http://localhost:4000/api

L'API attend MongoDB avant d'écouter. Le client utilise le proxy Vite `/api` en développement. Pour construire le frontend : `npm run build`.

## Hébergement en ligne

Le site public et l'administration sont servis par le frontend Vercel : les clients reçoivent uniquement `https://VOTRE-SITE.vercel.app/` ; l'administration est à `https://VOTRE-SITE.vercel.app/admin`. Le raccourci vers l'administration n'est pas affiché sur la boutique. L'accès admin reste protégé par `ADMIN_PASSWORD` côté API. Les clients commandent sans compte individuel.

Déploiement avec Vercel, Render et MongoDB Atlas :

1. Créez un cluster MongoDB Atlas sur https://www.mongodb.com/atlas/database. Créez un utilisateur de base de données et copiez l'URI de connexion ; remplacez `<password>` par le mot de passe DB et utilisez la base `atelier_commandes`. Pour Render, configurez l'accès réseau Atlas selon les règles recommandées par Atlas/Render ; n'utilisez pas les identifiants du compte Atlas comme utilisateur de base.
2. Poussez ce dépôt sur un dépôt GitHub privé si vous ne souhaitez pas publier le code source.
3. Sur https://dashboard.render.com/, créez un Blueprint depuis le dépôt. Render lit `render.yaml` et crée l'API. Dans les variables demandées, définissez `MONGODB_URI`, `ADMIN_PASSWORD` (choisissez un mot de passe fort, différent du mot de passe local) et `JWT_SECRET` (une clé aléatoire d'au moins 32 octets). Notez l'URL Render, par exemple `https://atelier-api.onrender.com`.
4. Sur https://vercel.com/new, importez le même dépôt. Le fichier `vercel.json` configure la compilation. Définissez la variable de build `VITE_API_URL` à `https://atelier-api.onrender.com/api` avec votre véritable URL Render, puis déployez. Vercel fournit l'URL de la boutique.
5. Dans le tableau de bord Render, définissez `CLIENT_ORIGIN` sur l'origine Vercel exacte, sans chemin (par exemple `https://atelier.vercel.app`), puis redéployez l'API. Dans Vercel, vérifiez `VITE_API_URL` et redéployez le frontend si vous l'avez modifiée.
6. Vérifiez `https://VOTRE-API.onrender.com/api/health`, puis ouvrez `https://VOTRE-SITE.vercel.app/`. Partagez cette dernière adresse avec les clients. Gardez `https://VOTRE-SITE.vercel.app/admin` pour l'administration uniquement.

Les valeurs `MONGODB_URI`, `ADMIN_PASSWORD` et `JWT_SECRET` se configurent uniquement dans les variables d'environnement Render ; ne les mettez jamais dans Vercel ou dans le dépôt. `VITE_API_URL` est une URL publique d'API, pas un secret. Avant la mise en ligne, remplacez le mot de passe local faible et envisagez une authentification admin plus robuste, des sauvegardes Atlas et un stockage d'images externe.

## API

- `GET /api/articles`, `GET /api/articles/:id` : consultation publique
- `POST /api/articles`, `PUT /api/articles/:id`, `DELETE /api/articles/:id` : gestion admin
- `POST /api/orders` : création d'une commande
- `POST /api/admin/login` : ouverture de session admin
- `GET /api/admin/orders`, `PATCH /api/admin/orders/:id` : consultation et mise à jour des commandes
- `GET /api/health` : état de l'API

Les routes protégées attendent `Authorization: Bearer <token>`. Chaque article possède un prix en DT (jusqu'à trois décimales) et un stock entier, modifiables depuis l'administration. La boutique affiche le prix et la disponibilité et bloque les articles épuisés. Le serveur calcule le sous-total depuis les prix MongoDB, ajoute 8 DT de livraison, réserve les quantités et refuse une demande supérieure au stock disponible. La commande conserve les prix unitaires et les totaux appliqués. Le client fournit prénom, nom, adresse et téléphone, puis confirme sa commande dans un récapitulatif.

Les images peuvent être des URL HTTP(S) ou des fichiers image base64. Les fichiers image sont limités à 2 Mo dans l'interface ; en production, préférez un stockage objet (S3, Cloudinary, etc.) à MongoDB. Les articles existants sans prix affichent « Prix à définir » et ne sont pas achetables tant que l'administrateur n'a pas renseigné leur prix. Modifiez-les depuis l'administration pour renseigner prix et stock.

## Sécurité et limites

Le mot de passe n'est jamais envoyé au frontend et le jeton de session expire après 8 heures. Configurez HTTPS, une origine CORS précise, des sauvegardes MongoDB et une politique de limitation de requêtes avant un déploiement public. Cette authentification fixe convient à un petit outil interne, pas à une gestion multi-administrateurs.
