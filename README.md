# 🚀 GeoDoc Mock Server Manager

Application React moderne pour tester et simuler l'API GeoDoc dans le cadre du projet TM Web.

## ✨ Fonctionnalités

### 🔧 GeoDoc Mock Server
- **Serveur Express** simulant l'API GeoDoc réelle
- **Gestion des utilisateurs** : Création, mise à jour des statuts (pending, active, inactive)
- **Transfert de dossiers** : Simulation complète du flux de transfert vers GeoDoc
- **Endpoints RESTful** pour tester les intégrations

### 🖥️ Interface de Management
- **Tableau de bord moderne** avec Tailwind CSS
- **Onglets organisés** :
  - 👥 **Utilisateurs** : Gestion des utilisateurs mock et leurs statuts
  - 📁 **Dossiers** : Visualisation des dossiers transférés
  - 📋 **Logs** : Suivi en temps réel des requêtes API
- **Indicateur de statut** du serveur (en ligne/hors ligne)
- **Auto-refresh** toutes les 5 secondes
- **Interface responsive** et professionnelle

## 📦 Installation

```bash
# Installation des dépendances
npm install
```

## ⚙️ Configuration

Le proxy est configuré pour pointer vers le serveur mock GeoDoc :

```json
"proxy": "http://localhost:8005"
```

**Variables d'environnement** (optionnel) :

```
REACT_APP_API_URL=http://localhost:8005
```

## 🚀 Démarrage

### 1. Démarrer le serveur mock GeoDoc

```bash
npm run server
```

Le serveur sera disponible sur [http://localhost:8005](http://localhost:8005)

### 2. Démarrer l'interface React

```bash
npm start
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

### 3. Utilisation avec tm_web

Dans tm_web, configurez l'URL GeoDoc :
```
VITE_GEODOC_API_URL=http://localhost:8005
```

## 📁 Structure du projet

```
teste_api_tm/
├── server.js                 # 🖥️ Serveur Express mock GeoDoc
├── public/
│   └── index.html           # Template HTML avec Tailwind CSS
├── src/
│   ├── App.js               # 🎯 Composant racine avec navigation
│   ├── GeoDocManager.js     # 🚀 Interface de management GeoDoc
│   ├── TestCom.js           # 🔧 Composant de test API (original)
│   ├── index.js             # Point d'entrée React
│   └── index.css            # Styles globaux
└── package.json
```

## 📖 Guide d'utilisation

### Gestion des utilisateurs GeoDoc

1. **Créer un utilisateur** : Depuis tm_web, utilisez la fonction "Lier avec GeoDoc"
2. **Modifier le statut** :
   - Sélectionnez un utilisateur dans la liste
   - Choisissez le nouveau statut (pending, active, inactive)
   - Pour `active`, entrez un GeoDoc ID
   - Cliquez sur "Mettre à jour le statut"
3. **Observer les changements** : Retournez dans tm_web pour voir le statut mis à jour

### Transfert de dossiers

1. **Dans tm_web** : Trouvez un dossier avec le statut "VALIDE"
2. **Cliquez sur "Transférer"** : Le dossier sera envoyé au serveur mock
3. **Dans GeoDoc Manager** : Consultez l'onglet "Dossiers Transférés" pour voir le dossier
4. **Vérifiez les logs** : Suivez les requêtes API en temps réel

### Endpoints API disponibles

**GeoDoc API** :
- `GET /api/tm_geodoc/me?email=<email>` - Vérifier le statut utilisateur
- `POST /api/tm_geodoc/register` - Enregistrer un utilisateur
- `POST /api/tm_geodoc/dossier/transfer` - Transférer un dossier

**Test Management** :
- `POST /api/test/set-status` - Changer le statut utilisateur
- `GET /api/test/users` - Lister les utilisateurs
- `GET /api/test/dossiers` - Lister les dossiers transférés
- `DELETE /api/test/users/:email` - Supprimer un utilisateur
- `DELETE /api/test/dossiers/:id` - Supprimer un dossier

## 🛠️ Technologies utilisées

- **React 18** - Bibliothèque UI
- **Tailwind CSS** - Framework CSS utilitaire (via CDN)
- **Font Awesome** - Icônes
- **Express.js** - Serveur backend mock
- **CORS** - Gestion des requêtes cross-origin

## 🎯 Scénarios de test

### Scénario 1 : Lier un utilisateur
1. Créer une liaison dans tm_web
2. Observer l'utilisateur dans GeoDoc Manager (statut: pending)
3. Changer le statut vers "active" avec GeoDoc ID
4. Vérifier dans tm_web que le statut est mis à jour

### Scénario 2 : Transférer un dossier
1. Valider un dossier dans tm_web
2. Cliquer sur "Transférer vers GeoDoc"
3. Vérifier dans GeoDoc Manager que le dossier apparaît
4. Consulter les logs pour voir les détails du transfert

### Scénario 3 : Tester les erreurs
1. Tentative de transfert sans dossier valide
2. Vérification des messages d'erreur dans les logs
3. Test de la récupération après erreur
