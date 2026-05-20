const express = require('express');
const cors = require('cors');
const app = express();
const port = 8005;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data storage
let mockUsers = new Map();
let mockDossiers = new Map();
let mockFiplofAccounts = new Map(); // For TM internal linking after external registration
let mockExternalFiplofUsers = new Map(); // For simulating EXTERNAL Fiplof API (users registered via /api/Fiplof_tm/register)
let mockFiplofTokens = new Map(); // Map<token_value, { username, type, created_at, expires_at }>
let mockFiplofRetours = new Map(); // Map<code_parcelle, { id, code_parcelle, numero, type_numero, statut_retour, date_statut_retour, geom }>
let fiplofBatchIdCounter = 0;
let fiplofRetourIdCounter = 0;

function handleTopoInfo(req, res) {
    const authHeader = req.header('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({
            message: 'Token manquant ou invalide'
        });
    }

    const payload = req.body;

    if (!payload || !payload.version || !payload.data) {
        return res.status(422).json({
            message: 'Payload invalide',
            errors: {
                payload: ['version et data sont obligatoires']
            }
        });
    }

    // Store received dossiers in mockDossiers (like old /dossier/transfer)
    const receivedCount = Array.isArray(payload.data) ? payload.data.length : 0;
    
    if (receivedCount > 0) {
        payload.data.forEach((item, index) => {
            if (item.dossier && item.propriete) {
                const dossierId = `topo_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
                const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const transferDate = new Date().toISOString();
                
                mockDossiers.set(dossierId, {
                    dossier_id: dossierId,
                    numero: item.propriete.parcelle || `D${index + 1}`,
                    commune: item.propriete.commune || 'Non spécifiée',
                    agent_collecte: 'GeoDoc Transfer',
                    superficie: item.propriete.contenance || 0,
                    status: 'Transféré',
                    date_collecte: transferDate,
                    transfer_id: transferId,
                    transfer_date: transferDate,
                    geodoc_status: "transferred",
                    source_payload: item // Store full payload for debugging
                });
            }
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Topo info reçu avec succès',
        received_count: receivedCount,
    });
}

/**
 * Handler for POST /api/Fiplof_tm/fiplof-info
 * Ingestion d'un batch de demandes de parcelles avec validation complète.
 */
function handleFiplofInfo(req, res) {
    // 1. Authentification
    const authHeader = req.headers['authorization'];
    let currentUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        currentUser = verifyAccessToken(token);
    }
    if (!currentUser) {
        return res.status(401).json({ detail: "Token invalide ou expiré" });
    }

    // 2. Parse JSON (simulate JSON_ERROR on malformed)
    let payload;
    try {
        payload = req.body;
        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid JSON');
        }
    } catch (e) {
        return res.status(200).json({
            ok: false,
            statut: "JSON_ERROR",
            summary: {
                total: 0,
                valid: 0,
                errors: 1,
                details: [{ error: "JSON decode error: " + e.message }]
            }
        });
    }

    // 3. Validate batch structure
    if (!payload.demandes || !Array.isArray(payload.demandes) || payload.demandes.length === 0) {
        return res.status(200).json({
            ok: false,
            statut: "ERROR",
            summary: {
                total: 0,
                valid: 0,
                errors: 1,
                details: [{ index: 0, id_dmd: null, code_parcelle: null, errors: ["Le champ 'demandes' est requis et doit contenir au moins un élément"] }]
            }
        });
    }

    fiplofBatchIdCounter++;
    const batchId = fiplofBatchIdCounter;
    const demandes = payload.demandes;
    const total = demandes.length;
    const details = [];
    let validCount = 0;
    const processedCodes = new Set();

    demandes.forEach((item, index) => {
        const itemErrors = [];

        // Validate demande fields
        const demande = item.demande || {};
        if (!demande.id_dmd && demande.id_dmd !== 0) {
            itemErrors.push("id_dmd est obligatoire");
        }
        if (!demande.num_decision) {
            itemErrors.push("num_decision est obligatoire");
        }
        if (!demande.date_dmd) {
            itemErrors.push("date_dmd est obligatoire");
        }
        if (!demande.date_decision) {
            itemErrors.push("date_decision est obligatoire");
        }
        if (!demande.date_debut_aff) {
            itemErrors.push("date_debut_aff est obligatoire");
        }
        if (!demande.date_fin_aff) {
            itemErrors.push("date_fin_aff est obligatoire");
        }
        if (!demande.categorie || demande.categorie === "string") {
            itemErrors.push("categorie est obligatoire et ne peut pas être 'string'");
        }
        if (!demande.consistance || demande.consistance === "string") {
            itemErrors.push("consistance est obligatoire et ne peut pas être 'string'");
        }
        if (demande.duree_occupation === undefined || demande.duree_occupation === null) {
            itemErrors.push("duree_occupation est obligatoire");
        }
        if (!demande.origine || demande.origine === "string") {
            itemErrors.push("origine est obligatoire et ne peut pas être 'string'");
        }

        // Check display interval >= 15 days
        if (demande.date_debut_aff && demande.date_fin_aff) {
            const debut = new Date(demande.date_debut_aff);
            const fin = new Date(demande.date_fin_aff);
            if (!isNaN(debut) && !isNaN(fin)) {
                const days = (fin - debut) / (1000 * 60 * 60 * 24);
                if (days < 15) {
                    itemErrors.push("la durée d'affichage doit être au moins 15 jours");
                }
            }
        }

        // Validate parcelle
        const parcelle = item.parcelle || {};
        if (!parcelle.code_parcelle) {
            itemErrors.push("code_parcelle est obligatoire");
        } else if (processedCodes.has(parcelle.code_parcelle)) {
            itemErrors.push("code_parcelle '" + parcelle.code_parcelle + "' est dupliqué dans ce batch");
        } else {
            processedCodes.add(parcelle.code_parcelle);
        }

        // Validate geometry
        if (parcelle.geometry) {
            const geom = parcelle.geometry;
            if (geom.type !== 'Polygon' || !Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
                itemErrors.push("geometry doit être un Polygon valide");
            } else {
                const ring = geom.coordinates[0];
                if (!Array.isArray(ring) || ring.length < 3) {
                    itemErrors.push("Polygon doit avoir au moins 3 points");
                }
            }
        }

        // Validate localite
        const localite = item.localite || {};
        if (!localite.region) itemErrors.push("region est obligatoire dans localite");
        if (!localite.district) itemErrors.push("district est obligatoire dans localite");
        if (!localite.commune) itemErrors.push("commune est obligatoire dans localite");
        if (!localite.fokontany) itemErrors.push("fokontany est obligatoire dans localite");

        // Validate demandeurs
        const demandeurs = item.demandeurs || [];
        if (demandeurs.length === 0) {
            itemErrors.push("au moins 1 demandeur est requis");
        } else {
            const principals = demandeurs.filter(d => d.dmdr_principale === true);
            if (principals.length !== 1) {
                itemErrors.push("exactement 1 demandeur principal (dmdr_principale=true) est requis, trouvé " + principals.length);
            }
            demandeurs.forEach((d, di) => {
                const p = d.personne || {};
                if (!p.nom) itemErrors.push("demandeur #" + (di + 1) + ": nom est obligatoire");
                if (!p.sexe || !['M', 'F'].includes(p.sexe)) itemErrors.push("demandeur #" + (di + 1) + ": sexe doit être M ou F");
                if (!p.situation_matrimoniale) itemErrors.push("demandeur #" + (di + 1) + ": situation_matrimoniale est obligatoire");
                if (!p.adresse) itemErrors.push("demandeur #" + (di + 1) + ": adresse est obligatoire");
                // Validate photos base64
                if (p.photos && Array.isArray(p.photos)) {
                    p.photos.forEach((photo, pi) => {
                        if (photo.base64 && !photo.base64.startsWith('data:image/')) {
                            itemErrors.push("demandeur #" + (di + 1) + ": photo #" + (pi + 1) + " base64 doit commencer par data:image/");
                        }
                    });
                }
            });
        }

        // Validate RL
        const rl = item.rl || {};
        if (!rl.date_rl) {
            itemErrors.push("RL: date_rl est obligatoire");
        }
        const membres = rl.membres_crl || [];
        if (membres.length < 5) {
            itemErrors.push("RL: au moins 5 membres CRL sont requis, trouvé " + membres.length);
        } else {
            const requiredRoles = [
                "Ny Solotenan ny Kaominina",
                "Ny Solotenan ny Fokontany",
                "Ray aman-dReny 1",
                "Ray aman-dReny 2",
                "Ray aman-dReny 3"
            ];
            const presentRoles = membres.map(m => m.role);
            const missingRoles = requiredRoles.filter(r => !presentRoles.includes(r));
            if (missingRoles.length > 0) {
                itemErrors.push("RL: rôles CRL manquants: " + missingRoles.join(', '));
            }
        }

        // Validate voisins
        const voisins = item.voisins || [];
        if (voisins.length === 0) {
            itemErrors.push("au moins 1 voisin est obligatoire");
        }

        // Validate pieces photos
        const pieces = item.pieces || [];
        pieces.forEach((piece, pi) => {
            if (!piece.objet_piece) itemErrors.push("pièce #" + (pi + 1) + ": objet_piece est obligatoire");
            if (!piece.type_piece) itemErrors.push("pièce #" + (pi + 1) + ": type_piece est obligatoire");
            if (piece.photos && Array.isArray(piece.photos)) {
                piece.photos.forEach((photo, phi) => {
                    if (photo.base64 && !photo.base64.startsWith('data:image/')) {
                        itemErrors.push("pièce #" + (pi + 1) + ": photo #" + (phi + 1) + " base64 doit commencer par data:image/");
                    }
                });
            }
        });

        if (itemErrors.length === 0) {
            validCount++;
        }

        details.push({
            index: index,
            id_dmd: demande.id_dmd !== undefined ? demande.id_dmd : null,
            code_parcelle: parcelle.code_parcelle || null,
            errors: itemErrors
        });
    });

    // 4. Determine global status
    let statut;
    if (validCount === total) {
        statut = "DONE";
    } else if (validCount > 0) {
        statut = "PARTIAL_SUCCESS";
    } else {
        statut = "ERROR";
    }

    // 5. Store valid dossiers in mockDossiers
    demandes.forEach((item, index) => {
        if (details[index].errors.length === 0) {
            const parcelle = item.parcelle || {};
            const localite = item.localite || {};
            const dossierId = `fiplof_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
            const transferDate = new Date().toISOString();

            mockDossiers.set(dossierId, {
                dossier_id: dossierId,
                numero: parcelle.code_parcelle || `F${index + 1}`,
                commune: localite.commune || 'Non spécifiée',
                agent_collecte: 'Fiplof API',
                superficie: parcelle.contenance || 0,
                status: 'Transféré (Fiplof)',
                date_collecte: transferDate,
                transfer_id: `FIP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                transfer_date: transferDate,
                fiplof_status: 'transferred',
                batch_id: batchId,
                source_payload: item,
            });
        }
    });

    return res.status(200).json({
        id: batchId,
        statut: statut,
        summary: {
            total: total,
            valid: validCount,
            errors: total - validCount,
            details: details.filter(d => d.errors.length > 0)
        }
    });
}

/**
 * Handler for POST /api/fiplof/transfer (legacy simple transfer)
 */
function handleFiplofTransfer(req, res) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            statut: 'ERROR',
            message: 'Accès non autorisé : Token Fiplof manquant ou invalide.',
        });
    }

    const payload = req.body;

    if (!payload) {
        return res.status(422).json({
            statut: 'ERROR',
            message: 'Payload Fiplof invalide',
            summary: {
                details: [{ errors: ['Aucune donnée reçue'] }],
            },
        });
    }

    if (!payload.demandes || !Array.isArray(payload.demandes)) {
        return res.status(422).json({
            statut: 'ERROR',
            message: 'Payload Fiplof invalide (demandes manquantes ou mal formatées)',
            summary: {
                details: [{ errors: ["Le champ 'demandes' est requis et doit être un tableau"] }],
            },
        });
    }

    const errors = [];
    payload.demandes.forEach((item, index) => {
        if (!item.localite?.commune) {
            errors.push(`Demande #${index + 1} : commune manquante dans localite`);
        }
        if (!item.parcelle?.code_parcelle && !item.numero) {
            errors.push(`Demande #${index + 1} : code parcelle manquant`);
        }
    });

    if (errors.length > 0) {
        return res.status(422).json({
            statut: 'ERROR',
            message: 'Certaines demandes contiennent des erreurs de validation',
            summary: {
                details: [{ errors }],
            },
        });
    }

    const receivedCount = payload.demandes.length;

    payload.demandes.forEach((item, index) => {
        const dossierId = `fiplof_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
        const transferId = `FIP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const transferDate = new Date().toISOString();

        mockDossiers.set(dossierId, {
            dossier_id: dossierId,
            numero: item.parcelle?.code_parcelle || item.numero || `F${index + 1}`,
            commune: item.localite?.commune || 'Non spécifiée',
            agent_collecte: 'Fiplof Transfer',
            superficie: item.parcelle?.contenance || 0,
            status: 'Transféré (Fiplof)',
            date_collecte: transferDate,
            transfer_id: transferId,
            transfer_date: transferDate,
            fiplof_status: 'transferred',
            source_payload: item,
        });
    });

    return res.status(200).json({
        statut: 'OK',
        message: 'Transfert Fiplof reçu avec succès',
        received_count: receivedCount,
    });
}

// Initialize with test data
mockUsers.set('admin_tm_web@mail.com', {
    username: 'admin',
    email: 'admin_tm_web@mail.com',
    status: 'pending', // pending, active, inactive
    id: null
});

// Topo transfer endpoint (v1.2 payload) - used by tm_web useGeoDocTransfer
app.post('/api/tm_geodoc/topo-info', handleTopoInfo);

mockUsers.set('jean.dupont@example.com', {
    username: 'jean.dupont',
    email: 'jean.dupont@example.com',
    status: 'active', // pending, active, inactive
    id: '42'
});

mockUsers.set('admin@mail.com', {
    username: 'admin',
    email: 'admin@mail.com',
    status: 'active', // pending, active, inactive
    id: '1'
});

// Default external Fiplof users for testing
mockExternalFiplofUsers.set('fiplof_test@mail.com', {
    username: 'fiplof_test@mail.com',
    password: 'password123',
    name: 'Test Fiplof User',
    system: 'TopoManager',
    statut: "VALIDATED",
    status: "VALIDATED",
    actif: true,
    registered_at: new Date().toISOString(),
    last_login: null
});

// Seed default retour externe records for testing
const seedRetourData = [
    { code_parcelle: 'PARC001', numero: 'F001', type_numero: 'F' },
    { code_parcelle: 'PARC002', numero: 'K001', type_numero: 'K' },
    { code_parcelle: 'PARC003', numero: 'F002', type_numero: 'F' },
];
seedRetourData.forEach(r => {
    fiplofRetourIdCounter++;
    mockFiplofRetours.set(r.code_parcelle, {
        id: fiplofRetourIdCounter,
        code_parcelle: r.code_parcelle,
        numero: r.numero,
        type_numero: r.type_numero,
        statut_retour: 'VIEWED',
        date_statut_retour: new Date().toISOString(),
        geom: null,
    });
});

// Generate mock JWT token
function base64urlEncode(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateAccessToken(username) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: username,
        iat: now,
        exp: now + 600, // 10 minutes
        type: 'access'
    };
    const token = base64urlEncode(header) + '.' + base64urlEncode(payload) +
        '.mock_signature_' + Math.random().toString(36).substr(2, 9);
    mockFiplofTokens.set(token, { username, type: 'access', created_at: now, expires_at: now + 600 });
    return token;
}

function generateRefreshToken(username) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: username,
        iat: now,
        exp: now + 28800, // 8 hours
        type: 'refresh'
    };
    const token = base64urlEncode(header) + '.' + base64urlEncode(payload) +
        '.mock_signature_' + Math.random().toString(36).substr(2, 9);
    mockFiplofTokens.set(token, { username, type: 'refresh', created_at: now, expires_at: now + 28800 });
    return token;
}

function verifyAccessToken(token) {
    const record = mockFiplofTokens.get(token);
    if (!record) return null;
    if (record.type !== 'access') return null;
    if (Date.now() / 1000 > record.expires_at) {
        mockFiplofTokens.delete(token);
        return null;
    }
    return record.username;
}

// Legacy token generator for GeoDoc endpoints
function generateToken() {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
           Buffer.from(JSON.stringify({
               sub: Math.random().toString(36).substr(2, 9),
               iat: Math.floor(Date.now() / 1000),
               exp: Math.floor(Date.now() / 1000) + 3600
           })).toString('base64') +
           '.mock_signature_' + Math.random().toString(36).substr(2, 9);
}

// Login endpoint - returns Bearer token
app.post('/api/tm_geodoc/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email et mot de passe sont obligatoires",
            errors: {
                email: !email ? ["L'email est requis"] : [],
                password: !password ? ["Le mot de passe est requis"] : []
            }
        });
    }

    // Check if user exists
    const user = mockUsers.get(email);
    if (!user) {
        return res.status(401).json({
            message: "Email ou mot de passe incorrect"
        });
    }

    // Check if user is active
    if (user.status === 'pending') {
        return res.status(403).json({
            message: "Votre compte est en attente de validation par un administrateur"
        });
    }

    if (user.status === 'inactive') {
        return res.status(403).json({
            message: "Votre compte est désactivé. Contactez un administrateur."
        });
    }

    // Generate tokens
    const accessToken = generateToken();
    const refreshToken = generateToken();

    // Update user with tokens
    user.access_token = accessToken;
    user.refresh_token = refreshToken;
    res.status(200).json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: "3600",
        user: {
            id: user.id ? user.id.toString() : "0",
            name: user.username,
            email: user.email,
            role: "agent_collecte",
            id_district: "1"
        }
    });
});

// Refresh endpoint - returns new access token
app.post('/api/tm_geodoc/refresh', (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({
            message: "Refresh token est obligatoire",
            errors: {
                refresh_token: ["Le refresh token est requis"]
            }
        });
    }

    const accessToken = generateToken();

    return res.status(200).json({
        access_token: accessToken,
        refresh_token: refresh_token,
        token_type: "Bearer",
        expires_in: "3600",
    });
});

// Ping endpoint for Test API Mobile
app.get('/api/ping', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Le serveur est en ligne',
        server_time: new Date().toISOString(),
    });
});

// GeoDoc API endpoint
app.get('/api/tm_geodoc/me', (req, res) => {
    const email = req.query.email;
    
    if (!email) {
        return res.status(400).json({
            message: "Email parameter is required"
        });
    }
    
    const user = mockUsers.get(email);
    
    if (!user) {
        return res.status(404).json({
            message: "Aucun utilisateur trouvé avec cet email"
        });
    }
    
    // Return response based on user status
    let response;
    
    switch (user.status) {
        case 'pending':
            response = {
                message: "Votre demande de compte est en cours de validation par un administrateur.",
                data: {
                    username: user.username,
                    email: user.email,
                    status: "pending"
                }
            };
            break;
            
        case 'active':
            response = {
                message: "Utilisateur activé avec succès",
                data: {
                    id: user.id || 15,
                    username: user.username,
                    email: user.email,
                    status: "active"
                }
            };
            break;
            
        case 'inactive':
            response = {
                message: "Votre compte est désactivé. Contactez un administrateur.",
                data: {
                    username: user.username,
                    email: user.email,
                    status: "inactive"
                }
            };
            break;
            
        default:
            response = {
                message: "Statut inconnu",
                data: {
                    username: user.username,
                    email: user.email,
                    status: "unknown"
                }
            };
    }
    
    res.status(200).json(response);
});

// Registration endpoint (for initial GeoDoc link)
app.post('/api/tm_geodoc/register', (req, res) => {
    const { email, username, name, telephone, password } = req.body;
    
    if (!email || !username || !password) {
        return res.status(422).json({
            message: "Le mot de passe est obligatoire",
            errors: {
                password: ["Le mot de passe est obligatoire"]
            }
        });
    }
    
    // Generate a real GeoDoc user ID (simule le comportement réel de l'API GeoDoc)
    const geodocId = `GD_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Check if user already exists
    if (mockUsers.has(email)) {
        return res.status(200).json({
            message: "Demande de compte Topo envoyée avec succès. En attente de validation par un administrateur.",
            data: {
                id: geodocId,
                username: username,
                email: email,
                telephone: telephone || '',
                status: "pending"
            }
        });
    }
    
    // Create new user
    mockUsers.set(email, {
        username: username,
        email: email,
        status: 'pending',
        id: geodocId
    });
    
    res.status(200).json({
        message: "Demande de compte Topo envoyée avec succès. En attente de validation par un administrateur.",
        data: {
            id: geodocId,
            username: username,
            email: email,
            telephone: telephone || '',
            status: "pending"
        }
    });
});

// Dossier transfer endpoint (legacy route) now behaves like /api/tm_geodoc/topo-info
app.post('/api/tm_geodoc/dossier/transfer', handleTopoInfo);

// Management endpoints for testing
app.post('/api/test/set-status', (req, res) => {
    const { email, status, id } = req.body;
    
    if (!mockUsers.has(email)) {
        return res.status(404).json({ message: "User not found" });
    }
    
    const user = mockUsers.get(email);
    user.status = status;
    if (id) user.id = id;
    
    res.json({ 
        message: `Status updated to ${status}`,
        user: user
    });
});

app.get('/api/test/users', (req, res) => {
    const users = Array.from(mockUsers.entries()).map(([email, user]) => ({
        email,
        ...user
    }));
    
    res.json(users);
});

// Dossier test endpoints
app.get('/api/test/dossiers', (req, res) => {
    const dossiers = Array.from(mockDossiers.entries()).map(([dossier_id, dossier]) => ({
        dossier_id,
        ...dossier
    }));
    
    res.json(dossiers);
});

app.get('/api/test/dossiers/:dossier_id', (req, res) => {
    const dossier_id = req.params.dossier_id;
    
    if (!mockDossiers.has(dossier_id)) {
        return res.status(404).json({ message: "Dossier not found" });
    }
    
    const dossier = mockDossiers.get(dossier_id);
    res.json(dossier);
});

app.delete('/api/test/dossiers/:dossier_id', (req, res) => {
    const dossier_id = req.params.dossier_id;
    
    if (mockDossiers.delete(dossier_id)) {
        res.json({ message: "Dossier deleted" });
    } else {
        res.status(404).json({ message: "Dossier not found" });
    }
});

app.delete('/api/test/users/:email', (req, res) => {
    const email = req.params.email;
    
    if (mockUsers.delete(email)) {
        res.json({ message: "User deleted" });
    } else {
        res.status(404).json({ message: "User not found" });
    }
});

app.post('/api/fiplof/transfer', handleFiplofTransfer);
app.post('/api/Fiplof_tm/fiplof-info', handleFiplofInfo);

// Fiplof API endpoints
// Fiplof /me endpoint - returns current fiplof status
app.get('/api/fiplof/me', (req, res) => {
    const email = req.query.email;

    if (!email) {
        return res.status(400).json({
            message: "Email parameter is required"
        });
    }

    const user = mockUsers.get(email);

    if (!user) {
        return res.status(404).json({
            message: "Aucun utilisateur trouvé avec cet email"
        });
    }

    const fiplofStatus = user.fiplof_status || 'none';

    res.status(200).json({
        message: fiplofStatus !== 'none'
            ? `Statut Fiplof: ${fiplofStatus}`
            : "Aucun statut Fiplof défini",
        data: {
            username: user.username,
            email: user.email,
            fiplof_status: fiplofStatus,
            fiplof_username: user.fiplof_username || null
        }
    });
});

// Set Fiplof status (without username)
app.post('/api/fiplof/set-status', (req, res) => {
    const { user_id, fiplof_status } = req.body;

    console.log('Fiplof set-status request:', { user_id, fiplof_status });

    if (!user_id || !fiplof_status) {
        return res.status(422).json({
            message: "Champs obligatoires manquants",
            errors: {
                user_id: !user_id ? ["L'ID utilisateur est requis"] : [],
                fiplof_status: !fiplof_status ? ["Le statut Fiplof est requis"] : []
            }
        });
    }

    let targetUser = null;
    let targetUserEmail = null;

    for (const [email, user] of mockUsers.entries()) {
        if (user.id === user_id.toString()) {
            targetUser = user;
            targetUserEmail = email;
            break;
        }
    }

    if (!targetUser) {
        return res.status(404).json({
            message: "Utilisateur non trouvé"
        });
    }

    const previousStatus = targetUser.fiplof_status || null;
    targetUser.fiplof_status = fiplof_status;

    res.status(200).json({
        message: "Statut Fiplof mis à jour avec succès",
        data: {
            user_id: user_id,
            email: targetUserEmail,
            username: targetUser.username,
            fiplof_status: fiplof_status,
            previous_status: previousStatus
        }
    });
});

// ===================== Spec-compliant Fiplof External API Endpoints =====================

// POST /api/Fiplof_tm/register — Création d'une demande de compte API (statut initial PENDING)
app.post('/api/Fiplof_tm/register', (req, res) => {
    const { username, password, name, system } = req.body;

    // Validation
    if (!username || typeof username !== 'string' || username.length < 3 || username.length > 100) {
        return res.status(422).json({
            success: false,
            message: "Validation error",
            data: { error: "username must be 3-100 characters" }
        });
    }
    if (!password || typeof password !== 'string' || password.length < 6 || password.length > 72) {
        return res.status(422).json({
            success: false,
            message: "Validation error",
            data: { error: "password must be 6-72 characters" }
        });
    }

    // Check if user already exists
    if (mockExternalFiplofUsers.has(username)) {
        return res.status(200).json({
            success: true,
            message: "Demande de compte en attente de validation",
            data: { error: "login existe déjà" }
        });
    }

    // Create new pending account
    mockExternalFiplofUsers.set(username, {
        username: username,
        password: password,
        name: name || '',
        system: system || '',
        statut: "PENDING",
        status: "PENDING",
        actif: false,
        registered_at: new Date().toISOString(),
        last_login: null
    });

    return res.status(201).json({
        success: true,
        message: "Demande de compte en attente de validation",
        data: {
            username: username,
            statut: "PENDING"
        }
    });
});

// POST /api/Fiplof_tm/login — Authentification et obtention des tokens JWT
app.post('/api/Fiplof_tm/login', (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({
            success: false,
            message: "Login et mot de passe sont requis",
            data: { error: "invalid credentials" }
        });
    }

    const fiplofUser = mockExternalFiplofUsers.get(login);

    if (!fiplofUser || fiplofUser.password !== password) {
        return res.status(200).json({
            success: true,
            message: "Connexion réussie",
            data: { error: "invalid credentials" }
        });
    }

    const userStatus = fiplofUser.status || fiplofUser.statut || 'PENDING';

    if (userStatus === 'PENDING') {
        return res.status(200).json({
            success: true,
            message: "Connexion réussie",
            data: { error: "compte non validé" }
        });
    }

    if (userStatus === 'REJECTED') {
        return res.status(200).json({
            success: true,
            message: "Connexion réussie",
            data: { error: "compte désactivé" }
        });
    }

    // Generate tokens
    const accessToken = generateAccessToken(login);
    const refreshToken = generateRefreshToken(login);

    fiplofUser.last_login = new Date().toISOString();
    fiplofUser.access_token = accessToken;
    fiplofUser.refresh_token = refreshToken;

    return res.status(200).json({
        success: true,
        message: "Connexion réussie",
        data: {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: "bearer",
            access_expires_in: 600,
            refresh_expires_in: 28800
        }
    });
});

// POST /api/Fiplof_tm/me — Retourne les informations de l'utilisateur authentifié
app.post('/api/Fiplof_tm/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    let currentUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        currentUser = verifyAccessToken(token);
    }

    if (!currentUser) {
        return res.status(401).json({ detail: "Token invalide ou expiré" });
    }

    const fiplofUser = mockExternalFiplofUsers.get(currentUser);
    if (!fiplofUser) {
        return res.status(401).json({ detail: "Token invalide ou expiré" });
    }

    const userStatus = fiplofUser.status || fiplofUser.statut || 'PENDING';
    const isActive = userStatus === 'VALIDATED';

    return res.status(200).json({
        success: true,
        message: "Utilisateur connecté",
        data: {
            login: currentUser,
            statut: userStatus,
            actif: isActive
        }
    });
});

// POST /api/Fiplof_tm/refresh — Rafraîchit l'access_token avec le refresh_token
app.post('/api/Fiplof_tm/refresh', (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(200).json({
            success: true,
            message: "Token rafraîchi",
            data: { error: "refresh token invalide" }
        });
    }

    const record = mockFiplofTokens.get(refresh_token);
    if (!record || record.type !== 'refresh') {
        return res.status(200).json({
            success: true,
            message: "Token rafraîchi",
            data: { error: "refresh token invalide" }
        });
    }

    if (Date.now() / 1000 > record.expires_at) {
        mockFiplofTokens.delete(refresh_token);
        return res.status(200).json({
            success: true,
            message: "Token rafraîchi",
            data: { error: "refresh token invalide" }
        });
    }

    const newAccessToken = generateAccessToken(record.username);
    const remainingRefreshExpiry = Math.round(record.expires_at - Date.now() / 1000);

    return res.status(200).json({
        success: true,
        message: "Token rafraîchi",
        data: {
            access_token: newAccessToken,
            refresh_token: refresh_token,
            token_type: "bearer",
            access_expires_in: 600,
            refresh_expires_in: remainingRefreshExpiry
        }
    });
});

// GET /api/Fiplof_tm/returned — Récupère les retours externes non marqués RETURNED
app.get('/api/Fiplof_tm/returned', (req, res) => {
    const authHeader = req.headers['authorization'];
    let currentUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        currentUser = verifyAccessToken(token);
    }

    if (!currentUser) {
        return res.status(401).json({ detail: "Token invalide ou expiré" });
    }

    const retours = Array.from(mockFiplofRetours.values())
        .filter(r => r.statut_retour !== 'RETURNED');

    return res.status(200).json(retours);
});

// PUT /api/Fiplof_tm/:retour_code_parcelle/statut — Met à jour le statut d'un retour
app.put('/api/Fiplof_tm/:retour_code_parcelle/statut', (req, res) => {
    const authHeader = req.headers['authorization'];
    let currentUser = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        currentUser = verifyAccessToken(token);
    }

    if (!currentUser) {
        return res.status(401).json({ detail: "Token invalide ou expiré" });
    }

    const { retour_code_parcelle } = req.params;
    const { statut } = req.query;

    const validStatuses = ['RETURNED', 'VIEWED', ''];
    if (!validStatuses.includes(statut)) {
        return res.status(400).json({
            detail: "Statut invalide. Statuts valides: ['RETURNED', 'VIEWED', '']"
        });
    }

    if (!mockFiplofRetours.has(retour_code_parcelle)) {
        return res.status(404).json({
            detail: `Retour externe avec code_parcelle ${retour_code_parcelle} non trouvé`
        });
    }

    const retour = mockFiplofRetours.get(retour_code_parcelle);
    retour.statut_retour = statut || null;
    retour.date_statut_retour = new Date().toISOString();

    return res.status(200).json({
        id: retour.id,
        code_parcelle: retour.code_parcelle,
        numero: retour.numero,
        type_numero: retour.type_numero,
        statut_retour: retour.statut_retour,
        date_statut_retour: retour.date_statut_retour,
        geom: retour.geom
    });
});

// Link Fiplof account to user
app.post('/api/fiplof/link', (req, res) => {
    const { user_id, fiplof_username, fiplof_status } = req.body;
    
    if (!user_id || !fiplof_username || !fiplof_status) {
        return res.status(422).json({
            message: "Champs obligatoires manquants",
            errors: {
                user_id: !user_id ? ["L'ID utilisateur est requis"] : [],
                fiplof_username: !fiplof_username ? ["Le nom d'utilisateur Fiplof est requis"] : [],
                fiplof_status: !fiplof_status ? ["Le statut Fiplof est requis"] : []
            }
        });
    }
    
    // Check if fiplof_username is already used by another user
    for (const [email, user] of mockUsers.entries()) {
        if (user.fiplof_username === fiplof_username && user.id !== user_id.toString()) {
            return res.status(422).json({
                message: "Ce nom d'utilisateur Fiplof est déjà utilisé",
                errors: {
                    fiplof_username: ["Ce nom d'utilisateur Fiplof est déjà lié à un autre compte"]
                }
            });
        }
    }
    
    // Find the user by ID
    let targetUser = null;
    let targetUserEmail = null;
    
    for (const [email, user] of mockUsers.entries()) {
        if (user.id === user_id.toString()) {
            targetUser = user;
            targetUserEmail = email;
            break;
        }
    }
    
    if (!targetUser) {
        return res.status(404).json({
            message: "Utilisateur non trouvé"
        });
    }
    
    // Store previous values for audit
    const previousValues = {
        fiplof_username: targetUser.fiplof_username || null,
        fiplof_status: targetUser.fiplof_status || null
    };
    
    // Update user with Fiplof info
    targetUser.fiplof_username = fiplof_username;
    targetUser.fiplof_status = fiplof_status;
    
    // Store in Fiplof accounts map for easy management
    mockFiplofAccounts.set(fiplof_username, {
        user_id: user_id,
        email: targetUserEmail,
        username: targetUser.username,
        fiplof_username: fiplof_username,
        fiplof_status: fiplof_status,
        linked_at: new Date().toISOString()
    });

    res.status(200).json({
        message: "Compte Fiplof lié avec succès",
        data: {
            user_id: user_id,
            email: targetUserEmail,
            username: targetUser.username,
            fiplof_username: fiplof_username,
            fiplof_status: fiplof_status,
            previous_values: previousValues
        }
    });
});

// Unlink Fiplof account from user
app.post('/api/fiplof/unlink', (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(422).json({
            message: "L'ID utilisateur est requis",
            errors: {
                user_id: ["L'ID utilisateur est requis"]
            }
        });
    }
    
    // Find the user by ID
    let targetUser = null;
    let targetUserEmail = null;
    
    for (const [email, user] of mockUsers.entries()) {
        if (user.id === user_id.toString()) {
            targetUser = user;
            targetUserEmail = email;
            break;
        }
    }
    
    if (!targetUser) {
        return res.status(404).json({
            message: "Utilisateur non trouvé"
        });
    }
    
    // Store previous values for audit
    const previousValues = {
        fiplof_username: targetUser.fiplof_username || null,
        fiplof_status: targetUser.fiplof_status || null
    };
    
    // Remove from Fiplof accounts map
    if (targetUser.fiplof_username) {
        mockFiplofAccounts.delete(targetUser.fiplof_username);
    }
    
    // Remove Fiplof info from user
    const fiplofUsername = targetUser.fiplof_username;
    delete targetUser.fiplof_username;
    delete targetUser.fiplof_status;
    
    console.log(`Fiplof account unlinked: ${fiplofUsername} -> ${targetUserEmail}`);
    
    res.status(200).json({
        message: "Compte Fiplof délié avec succès",
        data: {
            user_id: user_id,
            email: targetUserEmail,
            username: targetUser.username,
            previous_values: previousValues
        }
    });
});

// Sync Fiplof status
app.post('/api/fiplof/sync-status', (req, res) => {
    const { user_id, fiplof_username, fiplof_status } = req.body;
    
    console.log('Fiplof sync status request:', { user_id, fiplof_username, fiplof_status });
    
    if (!user_id || !fiplof_username || !fiplof_status) {
        return res.status(422).json({
            message: "Champs obligatoires manquants",
            errors: {
                user_id: !user_id ? ["L'ID utilisateur est requis"] : [],
                fiplof_username: !fiplof_username ? ["Le nom d'utilisateur Fiplof est requis"] : [],
                fiplof_status: !fiplof_status ? ["Le statut Fiplof est requis"] : []
            }
        });
    }
    
    // Find the user by ID
    let targetUser = null;
    let targetUserEmail = null;
    
    for (const [email, user] of mockUsers.entries()) {
        if (user.id === user_id.toString()) {
            targetUser = user;
            targetUserEmail = email;
            break;
        }
    }
    
    if (!targetUser) {
        return res.status(404).json({
            message: "Utilisateur non trouvé"
        });
    }
    
    // Store previous values for audit
    const previousStatus = targetUser.fiplof_status || null;
    
    // Update user's Fiplof status
    targetUser.fiplof_status = fiplof_status;
    
    // Update in Fiplof accounts map
    if (mockFiplofAccounts.has(fiplof_username)) {
        const fiplofAccount = mockFiplofAccounts.get(fiplof_username);
        fiplofAccount.fiplof_status = fiplof_status;
        fiplofAccount.synced_at = new Date().toISOString();
    }
    
    console.log(`Fiplof status synced: ${fiplof_username} -> ${fiplof_status} for ${targetUserEmail}`);
    
    res.status(200).json({
        message: "Statut Fiplof synchronisé avec succès",
        data: {
            user_id: user_id,
            email: targetUserEmail,
            username: targetUser.username,
            fiplof_username: fiplof_username,
            fiplof_status: fiplof_status,
            previous_status: previousStatus
        }
    });
});

// Check Fiplof username uniqueness
app.get('/api/fiplof/check-username/:username', (req, res) => {
    const { username } = req.params;
    const { exclude_user_id } = req.query;
    
    console.log('Fiplof username check:', { username, exclude_user_id });
    
    if (!username) {
        return res.status(400).json({
            message: "Le nom d'utilisateur est requis"
        });
    }
    
    // Check if username is already used
    let isAvailable = true;
    let existingUser = null;
    
    for (const [email, user] of mockUsers.entries()) {
        if (user.fiplof_username === username) {
            if (!exclude_user_id || user.id !== exclude_user_id.toString()) {
                isAvailable = false;
                existingUser = {
                    user_id: user.id,
                    email: email,
                    username: user.username
                };
                break;
            }
        }
    }
    
    res.status(200).json({
        available: isAvailable,
        username: username,
        existing_user: existingUser
    });
});

// Get all Fiplof accounts
app.get('/api/fiplof/accounts', (req, res) => {
    const accounts = Array.from(mockFiplofAccounts.entries()).map(([username, account]) => ({
        fiplof_username: username,
        ...account
    }));
    
    res.status(200).json({
        message: "Comptes Fiplof récupérés avec succès",
        data: accounts,
        count: accounts.length
    });
});

// Get Fiplof account by username
app.get('/api/fiplof/accounts/:username', (req, res) => {
    const { username } = req.params;
    
    if (!mockFiplofAccounts.has(username)) {
        return res.status(404).json({
            message: "Compte Fiplof non trouvé"
        });
    }
    
    const account = mockFiplofAccounts.get(username);
    
    res.status(200).json({
        message: "Compte Fiplof récupéré avec succès",
        data: {
            fiplof_username: username,
            ...account
        }
    });
});

// ============ External Fiplof User Management Endpoints (for testing) ============

// Get all external Fiplof registered users
app.get('/api/test/external-fiplof-users', (req, res) => {
    const users = Array.from(mockExternalFiplofUsers.entries()).map(([username, user]) => ({
        username,
        ...user,
        password: '***HIDDEN***'
    }));
    
    res.json({
        count: users.length,
        data: users
    });
});

// Set external Fiplof user status (simulate admin validation in Fiplof)
// POST /api/test/external-fiplof-users/:username/set-status
// Body: { status: "VALIDATED" }
// Valeurs autorisées: PENDING, VALIDATED, REJECTED
app.post('/api/test/external-fiplof-users/:username/set-status', (req, res) => {
    const { username } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['PENDING', 'VALIDATED', 'REJECTED'];

    console.log(`Setting external Fiplof status for ${username}: status=${status}`);

    if (!mockExternalFiplofUsers.has(username)) {
        return res.status(404).json({
            success: false,
            message: `Fiplof user ${username} not found`
        });
    }

    if (status && !allowedStatuses.includes(status)) {
        return res.status(422).json({
            success: false,
            message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}`
        });
    }

    const fiplofUser = mockExternalFiplofUsers.get(username);
    const previousStatus = fiplofUser.status;

    if (status !== undefined) {
        fiplofUser.status = status;
        fiplofUser.statut = status;
    }

    mockExternalFiplofUsers.set(username, fiplofUser);

    console.log(`Fiplof user ${username} updated: status=${fiplofUser.status}`);

    res.json({
        success: true,
        message: `Fiplof user ${username} status updated`,
        data: {
            username: fiplofUser.username,
            status: fiplofUser.status,
            previous_status: previousStatus
        }
    });
});

// Delete external Fiplof user (for testing)
app.delete('/api/test/external-fiplof-users/:username', (req, res) => {
    const { username } = req.params;
    
    if (mockExternalFiplofUsers.delete(username)) {
        res.json({ 
            success: true,
            message: `External Fiplof user ${username} deleted` 
        });
    } else {
        res.status(404).json({ 
            success: false,
            message: `External Fiplof user ${username} not found` 
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`🚀 GeoDoc Mock Server running on http://localhost:${port}`);
    console.log('');
    console.log('📖 API Documentation: API.md');
    console.log('');
    console.log('Available endpoints:');
    console.log('- GET /api/ping');
    console.log('- POST /api/tm_geodoc/login');
    console.log('- GET /api/tm_geodoc/me');
    console.log('- POST /api/tm_geodoc/register');
    console.log('- POST /api/tm_geodoc/refresh');
    console.log('- POST /api/tm_geodoc/topo-info');
    console.log('- POST /api/tm_geodoc/dossier/transfer');
    console.log('');
    console.log('Fiplof API endpoints (spécification complète):');
    console.log('- POST /api/Fiplof_tm/register     (Création de compte avec statut PENDING)');
    console.log('- POST /api/Fiplof_tm/login        (Authentification → JWT access+refresh)');
    console.log('- POST /api/Fiplof_tm/me           (Infos utilisateur via Bearer token)');
    console.log('- POST /api/Fiplof_tm/refresh      (Rafraîchir access_token)');
    console.log('- POST /api/Fiplof_tm/fiplof-info  (Batch validation DONE/PARTIAL/ERROR)');
    console.log('- GET  /api/Fiplof_tm/returned     (Retours externes non marqués RETURNED)');
    console.log('- PUT  /api/Fiplof_tm/:code/statut (Màj statut retour ?statut=RETURNED|VIEWED|"")');
    console.log('');
    console.log('Fiplof TM internal endpoints (ancienne compatibilité):');
    console.log('- GET  /api/fiplof/me');
    console.log('- POST /api/fiplof/set-status');
    console.log('- POST /api/fiplof/link');
    console.log('- POST /api/fiplof/unlink');
    console.log('- POST /api/fiplof/sync-status');
    console.log('- GET  /api/fiplof/check-username/:username');
    console.log('- GET  /api/fiplof/accounts');
    console.log('- GET  /api/fiplof/accounts/:username');
    console.log('- POST /api/fiplof/transfer (Legacy simple transfer)');
    console.log('');
    console.log('Test management endpoints:');
    console.log('  POST /api/test/set-status');
    console.log('  GET  /api/test/users');
    console.log('  DELETE /api/test/users/:email');
    console.log('  GET  /api/test/dossiers');
    console.log('  GET  /api/test/dossiers/:dossier_id');
    console.log('  DELETE /api/test/dossiers/:dossier_id');
    console.log('');
    console.log('External Fiplof Test endpoints (validation admin simulée):');
    console.log('  GET    /api/test/external-fiplof-users');
    console.log('  POST   /api/test/external-fiplof-users/:username/set-status');
    console.log('         Body: { status: "VALIDATED" }');
    console.log('         Valeurs autorisées: PENDING, VALIDATED, REJECTED');
    console.log('  DELETE /api/test/external-fiplof-users/:username');
    console.log('');
    console.log('Retour externe seed data (3 parcelles de test):');
    console.log('  PARC001 (F001), PARC002 (K001), PARC003 (F002)');
    console.log('');
    console.log('Test data:');
    console.log('  Users: admin_tm_web@mail.com (status: pending)');
    console.log('  Fiplof default: fiplof_test@mail.com / password123 (VALIDATED)');
    console.log('  Dossiers: None initially (use fiplof-info to create)');
    console.log('');
    console.log('Fiplof Test Workflow:');
    console.log('  1. tm_web: Cliquez sur "Lier Fiplof"');
    console.log('     → POST /api/Fiplof_tm/register → crée utilisateur avec statut PENDING');
    console.log('  2. FiplofManager: Changez le statut en "VALIDATED"');
    console.log('     Ou utilisez curl:');
    console.log('     curl -X POST http://localhost:8005/api/test/external-fiplof-users/USERNAME/set-status');
    console.log('          -H "Content-Type: application/json"');
    console.log('          -d \'{ "status": "VALIDATED" }\'');
    console.log('  3. tm_web: Cliquez sur "Vérifier" → saisissez le mot de passe');
    console.log('     → POST /api/Fiplof_tm/me with body: { login: "...", password: "..." }');
    console.log('     → Retourne: { success: true, data: { status: "VALIDATED" } }');
});

module.exports = app;
