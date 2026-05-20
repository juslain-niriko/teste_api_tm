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
 * Handler pour le transfert Fiplof (Payload JSON complexe)
 * Format attendu:
 * {
 *   version_schema: "1.0",
 *   source_systeme: "TopoManager",
 *   type_message: "BATCH_DEMANDE",
 *   commune: "Commune X",
 *   demandes: [...],
 *   total_demandes: N
 * }
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

    // Valider la structure du payload
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

    // Simuler une validation des demandes
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

    // Succès — stocker les dossiers reçus
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
    registered_at: new Date().toISOString()
});

// Generate mock JWT token
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
app.post('/api/Fiplof_tm/fiplof-info', handleFiplofTransfer);

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

// Fiplof registration endpoint (for initial Fiplof link from tm_web)
app.post('/api/Fiplof_tm/register', (req, res) => {
    const { username, password, name, system } = req.body;

    if (!username || !password) {
        return res.status(422).json({
            success: false,
            message: "Champs obligatoires manquants",
            errors: {
                username: !username ? ["Le nom d'utilisateur est requis"] : [],
                password: !password ? ["Le mot de passe est requis"] : []
            }
        });
    }

    // Check if user already exists in external Fiplof
    if (mockExternalFiplofUsers.has(username)) {
        const existingUser = mockExternalFiplofUsers.get(username);
        return res.status(200).json({
            success: true,
            message: "Compte Fiplof existant",
            data: {
                username: existingUser.username,
                statut: existingUser.statut
            }
        });
    }

    // Store in external Fiplof mock storage with password
    // Valeurs possibles pour status: PENDING, VALIDATED, REJECTED
    mockExternalFiplofUsers.set(username, {
        username: username,
        password: password,
        name: name,
        system: system,
        statut: "PENDING",
        status: "PENDING",
        registered_at: new Date().toISOString()
    });

    res.status(200).json({
        success: true,
        message: "Demande de compte en attente de validation",
        data: {
            username: username,
            statut: "PENDING"
        }
    });
});

// Fiplof /me endpoint with POST login/password (for checking Fiplof status)
// Expected: POST { login: "string", password: "string" }
// Response: { success: true, message: "Connexion réussie", data: { status: "PENDING" } }
// Valeurs possibles pour status: PENDING, VALIDATED, REJECTED
app.post('/api/Fiplof_tm/me', (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({
            success: false,
            message: "Login et mot de passe sont requis"
        });
    }

    const fiplofUser = mockExternalFiplofUsers.get(login);

    if (!fiplofUser) {
        return res.status(404).json({
            success: false,
            message: "Aucun compte trouvé pour cet utilisateur dans Fiplof."
        });
    }

    if (fiplofUser.password !== password) {
        return res.status(401).json({
            success: false,
            message: "Mot de passe Fiplof incorrect"
        });
    }

    // Valeurs possibles: PENDING, VALIDATED, REJECTED
    const finalStatus = fiplofUser.status || fiplofUser.statut || 'PENDING';

    res.status(200).json({
        success: true,
        message: "Connexion réussie",
        data: {
            status: finalStatus,
            access_token: `token_${login}_${Math.random().toString(36).substr(2, 9)}`,
            refresh_token: `refresh_${login}_${Math.random().toString(36).substr(2, 9)}`,
            expires_in: 3600
        }
    });
});

/**
 * Fiplof Login endpoint (Compatible avec routes/api.php de TopoManager)
 */
app.post('/api/Fiplof_tm/login', (req, res) => {
    const { email, login, password } = req.body;
    const identifier = email || login;

    if (!identifier || !password) {
        return res.status(400).json({
            success: false,
            message: "Email/Login et mot de passe sont requis"
        });
    }

    const fiplofUser = mockExternalFiplofUsers.get(identifier);

    if (!fiplofUser) {
        return res.status(404).json({
            success: false,
            message: "Aucun compte trouvé pour cet utilisateur dans Fiplof."
        });
    }

    if (fiplofUser.password !== password) {
        return res.status(401).json({
            success: false,
            message: "Mot de passe Fiplof incorrect"
        });
    }

    const finalStatus = fiplofUser.status || fiplofUser.statut || 'PENDING';

    res.status(200).json({
        success: true,
        message: "Connexion réussie",
        access_token: `token_${identifier}_${Math.random().toString(36).substr(2, 9)}`,
        refresh_token: `refresh_${identifier}_${Math.random().toString(36).substr(2, 9)}`,
        token_type: "Bearer",
        expires_in: 3600,
        data: {
            status: finalStatus
        }
    });
});

/**
 * Fiplof Refresh endpoint (Compatible avec routes/api.php de TopoManager)
 */
app.post('/api/fiplof_tm/refresh', (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({
            success: false,
            message: "Refresh token est obligatoire"
        });
    }

    res.status(200).json({
        success: true,
        access_token: `token_refreshed_${Math.random().toString(36).substr(2, 9)}`,
        refresh_token: refresh_token,
        token_type: "Bearer",
        expires_in: 3600
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
    console.log('Fiplof API endpoints (External Fiplof API simulation):');
    console.log('- POST /api/Fiplof_tm/register');
    console.log('- POST /api/Fiplof_tm/me  (Legacy - status check)');
    console.log('- POST /api/Fiplof_tm/login (NEW - standard login)');
    console.log('- POST /api/Fiplof_tm/refresh (NEW - token refresh)');
    console.log('');
    console.log('Fiplof TM internal endpoints:');
    console.log('- GET  /api/fiplof/me');
    console.log('- POST /api/fiplof/set-status');
    console.log('- POST /api/fiplof/link');
    console.log('- POST /api/fiplof/unlink');
    console.log('- POST /api/fiplof/sync-status');
    console.log('- GET  /api/fiplof/check-username/:username');
    console.log('- GET  /api/fiplof/accounts');
    console.log('- GET  /api/fiplof/accounts/:username');
    console.log('- POST /api/fiplof/transfer (NEW - Receive dossier payload)');
    console.log('');
    console.log('Test management endpoints:');
    console.log('  POST /api/test/set-status');
    console.log('  GET  /api/test/users');
    console.log('  DELETE /api/test/users/:email');
    console.log('  GET  /api/test/dossiers');
    console.log('  GET  /api/test/dossiers/:dossier_id');
    console.log('  DELETE /api/test/dossiers/:dossier_id');
    console.log('');
    console.log('NEW - External Fiplof Test endpoints (for simulating admin validation):');
    console.log('  GET    /api/test/external-fiplof-users');
    console.log('  POST   /api/test/external-fiplof-users/:username/set-status');
    console.log('         Body: { status: "VALIDATED" }');
    console.log('         Valeurs autorisées: PENDING, VALIDATED, REJECTED');
    console.log('  DELETE /api/test/external-fiplof-users/:username');
    console.log('');
    console.log('Test data:');
    console.log('  Users: admin_tm_web@mail.com (status: pending)');
    console.log('  Dossiers: None initially (use transfer endpoint to create)');
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
