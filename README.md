# API Test React

Application React pour tester une API avec authentification JWT.

## Fonctionnalités

- **Authentification JWT** : Login/logout avec stockage des tokens dans localStorage
- **Rafraîchissement automatique** des tokens expirés
- **Test des endpoints** :
  - `/api/ping` - Ping serveur (sans auth)
  - `/api/login` - Authentification
  - `/api/refresh` - Rafraîchissement du token
  - `/api/devices` - Liste des utilisateurs/appareils
  - `/api/categories` - Types de terrain
  - `/api/types-moraux` - Types moral
  - `/api/reperes` - Positions riverain
  - `/api/statuts-terrains` - Statuts terrain
  - `/api/territoires` - Territoire hiérarchique
  - `/api/cartes` - Fonds images MBTiles

## Installation

```bash
npm install
```

## Configuration

Modifiez le proxy dans `package.json` selon votre backend :

```json
"proxy": "http://localhost:5000"
```

Ou créez un fichier `.env` :

```
REACT_APP_API_URL=http://localhost:5000
```

## Démarrage

```bash
npm start
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

## Structure du projet

```
src/
├── ui/
│   ├── tokens.js      # Design tokens (couleurs, etc.)
│   ├── Btn.js         # Composant bouton
│   ├── Card.js        # Composant carte
│   └── index.js       # Exports UI
├── TestCom.js         # Composant principal de test API
├── App.js             # Composant racine
├── index.js           # Point d'entrée
└── index.css          # Styles globaux
```

## Utilisation

1. Cliquez sur **"Se connecter"** pour vous authentifier (login: admin, password: secret)
2. Utilisez les boutons pour tester les différents endpoints
3. Les réponses JSON s'affichent dans des blocs formatés
4. La session reste active après rechargement de la page

## Technologies utilisées

- React 18
- React Icons
- CSS-in-JS (inline styles)
