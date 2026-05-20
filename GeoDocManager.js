/**
 * GeoDoc Manager - Utilitaire pour tester les appels GeoDoc
 * Simule login, refresh, et transfert de dossiers
 */

const API_BASE = 'http://localhost:8005';

class GeoDocManager {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
    }

    // Connexion
    async login(email, password) {
        console.log(`🔐 Login attempt for: ${email}`);
        
        const response = await fetch(`${API_BASE}/api/tm_geodoc/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            this.user = data.user;
            
            console.log('✅ Login successful');
            console.log('User:', this.user);
            console.log('Token expires in:', data.expires_in, 'seconds');
            
            return data;
        } else {
            console.log('❌ Login failed:', data.message);
            throw new Error(data.message || 'Login failed');
        }
    }

    // Rafraîchir le token
    async refresh() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        console.log('🔄 Refreshing token...');

        const response = await fetch(`${API_BASE}/api/tm_geodoc/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: this.refreshToken })
        });

        const data = await response.json();

        if (response.ok) {
            this.accessToken = data.access_token;
            console.log('✅ Token refreshed');
            return data.access_token;
        } else {
            console.log('❌ Refresh failed:', data.message);
            throw new Error(data.message || 'Refresh failed');
        }
    }

    // Transférer un dossier
    async transferDossier(dossierData) {
        if (!this.accessToken) {
            throw new Error('Not authenticated - call login() first');
        }

        console.log('📤 Transferring dossier...');

        const payload = {
            version: "1.2",
            source: "TopoManager",
            destination: "GeoDoc",
            timestamp: new Date().toISOString(),
            data: [dossierData]
        };

        const response = await fetch(`${API_BASE}/api/tm_geodoc/topo-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Transfer successful');
            console.log('Received count:', data.received_count);
            return data;
        } else {
            console.log('❌ Transfer failed:', data.message);
            throw new Error(data.message || 'Transfer failed');
        }
    }

    // Vérifier le statut d'un utilisateur
    async getUserStatus(email) {
        console.log(`👤 Checking status for: ${email}`);

        const response = await fetch(`${API_BASE}/api/tm_geodoc/me?email=${encodeURIComponent(email)}`);
        const data = await response.json();

        if (response.ok) {
            console.log('✅ Status retrieved:', data.data.status);
            return data;
        } else {
            console.log('❌ Status check failed:', data.message);
            throw new Error(data.message || 'Status check failed');
        }
    }

    // Lister les dossiers transférés
    async getTransferredDossiers() {
        console.log('📋 Fetching transferred dossiers...');

        const response = await fetch(`${API_BASE}/api/test/dossiers`);
        const data = await response.json();

        if (response.ok) {
            console.log(`✅ Found ${data.length} dossiers`);
            return data;
        } else {
            console.log('❌ Failed to fetch dossiers');
            throw new Error('Failed to fetch dossiers');
        }
    }

    // Afficher l'état actuel
    status() {
        console.log('\n📊 GeoDoc Manager Status:');
        console.log('─'.repeat(30));
        console.log('Authenticated:', !!this.accessToken);
        console.log('User:', this.user ? `${this.user.name} (${this.user.email})` : 'None');
        console.log('─'.repeat(30));
    }
}

// Exemple d'utilisation
async function demo() {
    const manager = new GeoDocManager();

    try {
        // 1. Login
        await manager.login('jean.dupont@example.com', 'password123');
        manager.status();

        // 2. Transférer un dossier exemple
        const exampleDossier = {
            dossier: {
                district: "District Test"
            },
            demandeurs: [
                {
                    principal: true,
                    type_demandeur: "physique",
                    titre_demandeur: "M",
                    nom_demandeur: "DUPONT",
                    prenom_demandeur: "Jean",
                    date_naissance: "1990-01-01",
                    lieu_naissance: "Antananarivo",
                    sexe: "M",
                    domiciliation: "Adresse test",
                    cin: "123456789012",
                    date_delivrance: "2010-01-01",
                    lieu_delivrance: "Antananarivo",
                    nom_pere: "PERE",
                    nom_mere: "MERE",
                    situation_familiale: "Célibataire",
                    regime_matrimoniale: "Séparation de biens",
                    occupation: "Développeur",
                    marie_a: null,
                    telephone: "+261123456789"
                }
            ],
            propriete: {
                lot: "",
                parcelle: "123",
                proprietaire: "MAHATOKY",
                propriete_mere: null,
                titre_mere: null,
                type_commune: "Commune SubUrbaine",
                commune: "Commune Test",
                fokontany: "Fokontany Test",
                contenance: 1000,
                charge: null,
                situation: "Centre ville",
                nature: "Terrain à bâtir",
                vocation: "Résidentiel",
                type_operation: "immatriculation",
                mode_acquisition: "Achat",
                type_date_acquisition: "Year",
                date_acquisition: "2024"
            }
        };

        await manager.transferDossier(exampleDossier);

        // 3. Vérifier les dossiers transférés
        const dossiers = await manager.getTransferredDossiers();
        console.log('\n📋 Transferred Dossiers:');
        dossiers.forEach((d, i) => {
            console.log(`${i + 1}. ${d.numero} - ${d.commune} (${d.geodoc_status})`);
        });

        // 4. Vérifier le statut
        await manager.getUserStatus('jean.dupont@example.com');

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

// Exporter pour utilisation dans Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GeoDocManager, demo };
}

// Instructions pour l'utilisation
console.log(`
🚀 GeoDocManager - Utilitaire de test pour l'API GeoDoc

Usage:
  const { GeoDocManager } = require('./GeoDocManager');
  const manager = new GeoDocManager();

  // Login
  await manager.login('email@example.com', 'password');

  // Transférer un dossier
  await manager.transferDossier(dossierData);

  // Lister les dossiers
  const dossiers = await manager.getTransferredDossiers();

  // Démonstration complète
  const { demo } = require('./GeoDocManager');
  await demo();

Endpoints disponibles:
  - POST /api/tm_geodoc/login
  - POST /api/tm_geodoc/refresh
  - GET /api/tm_geodoc/me
  - POST /api/tm_geodoc/topo-info
  - POST /api/tm_geodoc/dossier/transfer
  - GET /api/test/dossiers
  - GET /api/test/dossiers/:id
  - GET /api/ping
`);
