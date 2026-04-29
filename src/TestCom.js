import React, { useState, useEffect } from 'react';
import { FiLogIn, FiLogOut, FiRefreshCw, FiUsers, FiMap, FiAlertCircle, FiDownload, FiImage, FiSend } from 'react-icons/fi';
import tokens from './ui/tokens';
import Btn from './ui/Btn';
import Card from './ui/Card';
import JsonDisplay from './ui/JsonDisplay';
import ApiSection from './ui/ApiSection';
import StatCard from './ui/StatCard';

const TestCom = () => {
    const [token, setToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [users, setUsers] = useState([]);
    const [typeTerrain, setTypeTerrain] = useState([]);
    const [typeMoral, setTypeMoral] = useState([]);
    const [positionRiverain, setPositionRiverain] = useState([]);
    const [statutTerrain, setStatutTerrain] = useState([]);
    const [ping, setPing] = useState(null);
    const [singleTerritoire, setSingleTerritoire] = useState(null);
    const [fondImages, setFondImages] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    const [usersResponse, setUsersResponse] = useState(null);
    const [jsonInput, setJsonInput] = useState('');
    const [postResponse, setPostResponse] = useState(null);
    const [postLoading, setPostLoading] = useState(false);
    const [personnesInput, setPersonnesInput] = useState('');
    const [personnesResponse, setPersonnesResponse] = useState(null);
    const [personnesLoading, setPersonnesLoading] = useState(false);
    const [dossiersStatuts, setDossiersStatuts] = useState([]);
    const [agentCollecteId, setAgentCollecteId] = useState('');
    const [sinceDate, setSinceDate] = useState('');

    useEffect(() => {
        const savedToken = localStorage.getItem('access_token');
        const savedRefresh = localStorage.getItem('refresh_token');

        if (savedToken && savedRefresh) {
            setToken(savedToken);
            setRefreshToken(savedRefresh);
        }
    }, []);

    const fetchWithAuth = async (url, options = {}, currentToken = token, currentRefresh = refreshToken) => {
        let response = await fetch(url, {
            ...options,
            headers: {
                'Accept': 'application/json',
                ...options.headers,
                Authorization: `Bearer ${currentToken}`,
            }
        });

        if (response.status === 401 && currentRefresh) {
            console.log("Token expiré → refresh...");

            const refreshResponse = await fetch('/api/refresh', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentRefresh}` 
                }
            });

            const refreshData = await refreshResponse.json();

            if (refreshResponse.ok) {
                setToken(refreshData.access_token);
                localStorage.setItem('access_token', refreshData.access_token);

                return fetch(url, {
                    ...options,
                    headers: {
                        'Accept': 'application/json',
                        ...options.headers,
                        Authorization: `Bearer ${refreshData.access_token}`,
                    }
                });
            } else {
                handleLogout();
                throw new Error("Session expirée");
            }
        }

        return response;
    };

    const handleLogin = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: "admin",
                    password: "Adm1N@TM"
                })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);

                setToken(data.access_token);
                setRefreshToken(data.refresh_token);
            } else {
                setError(data.error || "Erreur login");
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setRefreshToken(null);
        setUsers([]);
        setTypeTerrain([]);
        setTypeMoral([]);
        setPositionRiverain([]);
        setStatutTerrain([]);
        setSingleTerritoire(null);
        setFondImages([]);
        setDossiersStatuts([]);
        setAgentCollecteId('');
        setSinceDate('');

        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');

        console.log("Déconnecté");
    };

    const fetchUsers = async (t = token, r = refreshToken, device_id = deviceId) => {
        try {
            const url = device_id 
                ? `/api/devices?device_id=${device_id}` 
                : '/api/devices';
            const response = await fetchWithAuth(url, {}, t, r);
            const data = await response.json();
            if (response.ok) {
                setUsers(data.data || []);
                setUsersResponse(data);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchTypeTerrain = async (t = token, r = refreshToken) => {
        try {
            const response = await fetchWithAuth('/api/categories', {}, t, r);
            const data = await response.json();
            if (response.ok) setTypeTerrain(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchTypeMoral = async (t = token, r = refreshToken) => {
        try {
            const response = await fetchWithAuth('/api/types-moraux', {}, t, r);
            const data = await response.json();
            if (response.ok) setTypeMoral(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchPositionRiverain = async (t = token, r = refreshToken) => {
        try {
            const response = await fetchWithAuth('/api/reperes', {}, t, r);
            const data = await response.json();
            if (response.ok) setPositionRiverain(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchStatutTerrain = async (t = token, r = refreshToken) => {
        try {
            const response = await fetchWithAuth('/api/statuts-terrains', {}, t, r);
            const data = await response.json();
            if (response.ok) setStatutTerrain(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchDossiersStatuts = async (t = token, r = refreshToken) => {
        try {
            const params = new URLSearchParams();
            if (agentCollecteId) params.append('agent_collecte_id', agentCollecteId);
            if (sinceDate) params.append('since', sinceDate);
            
            const url = params.toString() ? `/api/dossiers/statuts?${params.toString()}` : '/api/dossiers/statuts';
            const response = await fetchWithAuth(url, {}, t, r);
            const data = await response.json();
            if (response.ok) setDossiersStatuts(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchPing = async () => {
        try {
            const response = await fetch('/api/ping', {
                headers: {
                    'Accept': 'application/json',
                }
            });
            const data = await response.json();
            if (response.ok) setPing(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchSingleTerritoire = async (t = token, r = refreshToken) => {
        try {
            const response = await fetchWithAuth('/api/territoires', {}, t, r);
            const data = await response.json();
            if (response.ok) setSingleTerritoire(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchFondImages = async (t = token, r = refreshToken) => {
        try {
            const response = await fetchWithAuth('/api/cartes', {}, t, r);
            const data = await response.json();
            if (response.ok) {
                setFondImages(data);
            } else {
                setError('Erreur lors de la récupération des fonds images');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const sendPostRequest = async () => {
        if (!jsonInput.trim()) {
            setError('Veuillez entrer des données JSON');
            return;
        }

        let parsedData;
        try {
            parsedData = JSON.parse(jsonInput);
        } catch (err) {
            setError('JSON invalide: ' + err.message);
            return;
        }

        setPostLoading(true);
        setError('');

        try {
            const response = await fetchWithAuth('/api/dossiers/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(parsedData)
            });

            const data = await response.json();
            
            if (response.ok) {
                setPostResponse(data);
            } else {
                setError(data.error || 'Erreur lors de l\'envoi POST');
                setPostResponse(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setPostLoading(false);
        }
    };

    const sendPersonnesPostRequest = async () => {
        if (!personnesInput.trim()) {
            setError('Veuillez entrer des données JSON pour personnes');
            return;
        }

        let parsedData;
        try {
            parsedData = JSON.parse(personnesInput);
        } catch (err) {
            setError('JSON invalide: ' + err.message);
            return;
        }

        setPersonnesLoading(true);
        setError('');

        try {
            const response = await fetchWithAuth('/api/personnes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(parsedData)
            });

            const data = await response.json();
            
            if (response.ok) {
                setPersonnesResponse(data);
            } else {
                setError(data.error || 'Erreur lors de l\'envoi POST personnes');
                setPersonnesResponse(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setPersonnesLoading(false);
        }
    };

    return (
        <div style={{ 
            padding: '40px', 
            background: tokens.bg,
            minHeight: '100vh',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <Card style={{ 
                maxWidth: '1200px', 
                margin: '0 auto',
                padding: '32px',
                boxShadow: tokens.shadowMd
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ 
                        color: tokens.text,
                        fontSize: '28px',
                        fontWeight: '700',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px'
                    }}>
                        <FiMap size={32} style={{ color: tokens.primary }} />
                        Test API Mobile JWT
                    </h1>
                    <p style={{ 
                        color: tokens.textMuted,
                        fontSize: '14px',
                        margin: 0
                    }}>
                        Test du système d'authentification avec rafraîchissement automatique
                    </p>
                </div>

                {/* Ping Section - Available without authentication */}
                <div style={{ marginBottom: '32px' }}>
                    <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        justifyContent: 'center',
                        marginBottom: '24px',
                        flexWrap: 'wrap'
                    }}>
                        <Btn
                            onClick={() => fetchPing()}
                            variant="success"
                            size="md"
                        >
                            <FiRefreshCw size={16} />
                            Ping Serveur
                        </Btn>
                    </div>

                    {ping && (
                        <JsonDisplay
                            title="Ping Serveur"
                            icon={<FiRefreshCw size={20} />}
                            data={ping}
                            color="success"
                            maxHeight="200px"
                        />
                    )}
                </div>

                {error && (
                    <div style={{
                        background: tokens.dangerBg,
                        border: `1px solid ${tokens.danger}33`,
                        borderRadius: tokens.radius,
                        padding: '16px',
                        marginBottom: '24px',
                        color: tokens.danger,
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <FiAlertCircle size={18} style={{ flexShrink: 0 }} />
                        <div>
                            <strong>Erreur:</strong> {error}
                        </div>
                    </div>
                )}

                {users.length > 0 && (
                    <ApiSection
                        title="Utilisateurs"
                        icon={<FiUsers size={20} />}
                        count={users.length}
                        data={users}
                        renderItem={(user) => (
                            <div style={{
                                padding: '12px',
                                background: tokens.surfaceAlt,
                                borderRadius: tokens.radius,
                                fontSize: '14px',
                                color: tokens.text,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span><strong>{user.nom} {user.prenom}</strong></span>
                                <span style={{
                                    fontSize: '12px',
                                    color: tokens.textMuted,
                                    background: tokens.primaryBg,
                                    padding: '2px 8px',
                                    borderRadius: '8px'
                                }}>
                                    ID: {user.id}
                                </span>
                            </div>
                        )}
                    />
                )}

                {!token ? (
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <Btn
                            onClick={handleLogin}
                            disabled={loading}
                            variant="primary"
                            size="lg"
                            style={{
                                padding: '12px 24px',
                                fontSize: '16px',
                                gap: '8px'
                            }}
                        >
                            {loading ? (
                                <>
                                    <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                                    Connexion...
                                </>
                            ) : (
                                <>
                                    <FiLogIn size={18} />
                                    Se connecter
                                </>
                            )}
                        </Btn>
                    </div>
                ) : (
                    <>
                    <div style={{ marginBottom: '32px' }}>
                        {/* Section Types de terrain */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <Btn
                                    onClick={() => fetchTypeTerrain()}
                                    variant="secondary"
                                    size="md"
                                >
                                    <FiRefreshCw size={16} />
                                    Types de terrain
                                </Btn>
                            </div>
                            {typeTerrain && (
                                <JsonDisplay
                                    title="Catégories de terrain"
                                    icon={<FiMap size={20} />}
                                    data={typeTerrain}
                                    color="primary"
                                />
                            )}
                        </div>

                        {/* Section Types moral */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <Btn
                                    onClick={() => fetchTypeMoral()}
                                    variant="secondary"
                                    size="md"
                                >
                                    <FiRefreshCw size={16} />
                                    Types moral
                                </Btn>
                            </div>
                            {typeMoral && (
                                <JsonDisplay
                                    title="Types moral"
                                    icon={<FiMap size={20} />}
                                    data={typeMoral}
                                    color="warning"
                                />
                            )}
                        </div>

                        {/* Section Positions riverain */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <Btn
                                    onClick={() => fetchPositionRiverain()}
                                    variant="secondary"
                                    size="md"
                                >
                                    <FiRefreshCw size={16} />
                                    Positions riverain
                                </Btn>
                            </div>
                            {positionRiverain && (
                                <JsonDisplay
                                    title="Positions riverain"
                                    icon={<FiMap size={20} />}
                                    data={positionRiverain}
                                    color="info"
                                />
                            )}
                        </div>

                        {/* Section Statuts terrain */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <Btn
                                    onClick={() => fetchStatutTerrain()}
                                    variant="secondary"
                                    size="md"
                                >
                                    <FiRefreshCw size={16} />
                                    Statuts terrain
                                </Btn>
                            </div>
                            {statutTerrain && (
                                <JsonDisplay
                                    title="Statuts terrain"
                                    icon={<FiMap size={20} />}
                                    data={statutTerrain}
                                    color="danger"
                                />
                            )}
                        </div>

                        {/* Section Dossiers Statuts */}
                        <div style={{ marginBottom: '24px' }}>
                            {/* Parameters Input Section */}
                            <div style={{ 
                                background: tokens.surface,
                                border: `1px solid ${tokens.border}`,
                                borderRadius: tokens.radius,
                                padding: '16px',
                                marginBottom: '16px'
                            }}>
                                <h3 style={{ 
                                    color: tokens.text,
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    margin: '0 0 12px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <FiMap size={16} />
                                    Paramètres Dossiers Statuts
                                </h3>
                                <div style={{ 
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center',
                                    flexWrap: 'wrap'
                                }}>
                                    <input
                                        type="text"
                                        placeholder="Agent Collecte ID (ex: 123)"
                                        value={agentCollecteId}
                                        onChange={(e) => setAgentCollecteId(e.target.value)}
                                        style={{
                                            flex: 1,
                                            minWidth: '150px',
                                            padding: '8px 12px',
                                            border: `1px solid ${tokens.border}`,
                                            borderRadius: tokens.radius,
                                            fontSize: '14px',
                                            background: tokens.bg,
                                            color: tokens.text
                                        }}
                                    />
                                    <input
                                        type="date"
                                        placeholder="Date depuis (YYYY-MM-DD)"
                                        value={sinceDate}
                                        onChange={(e) => setSinceDate(e.target.value)}
                                        style={{
                                            flex: 1,
                                            minWidth: '150px',
                                            padding: '8px 12px',
                                            border: `1px solid ${tokens.border}`,
                                            borderRadius: tokens.radius,
                                            fontSize: '14px',
                                            background: tokens.bg,
                                            color: tokens.text
                                        }}
                                    />
                                    <Btn
                                        onClick={() => fetchDossiersStatuts()}
                                        variant="secondary"
                                        size="md"
                                    >
                                        <FiRefreshCw size={16} />
                                        Dossiers Statuts
                                    </Btn>
                                </div>
                            </div>
                            {dossiersStatuts && (
                                <JsonDisplay
                                    title="Dossiers Statuts"
                                    icon={<FiMap size={20} />}
                                    data={dossiersStatuts}
                                    color="warning"
                                />
                            )}
                        </div>

                        {/* Section Territoire hiérarchique */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <Btn
                                    onClick={() => fetchSingleTerritoire()}
                                    variant="secondary"
                                    size="md"
                                >
                                    <FiMap size={16} />
                                    Territoire hiérarchique
                                </Btn>
                            </div>
                            {singleTerritoire && (
                                <JsonDisplay
                                    title="Territoire hiérarchique"
                                    icon={<FiMap size={20} />}
                                    data={singleTerritoire}
                                    color="info"
                                />
                            )}
                        </div>

                        {/* Section Fonds Images */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <Btn
                                    onClick={() => fetchFondImages()}
                                    variant="secondary"
                                    size="md"
                                >
                                    <FiImage size={16} />
                                    Fonds Images
                                </Btn>
                            </div>
                            {fondImages.length > 0 && (
                                <ApiSection
                                    title="Fonds Images MBTiles"
                                    icon={<FiImage size={20} />}
                                    count={fondImages.length}
                                    data={fondImages}
                                    renderItem={(fond) => (
                                        <div style={{
                                            padding: '16px',
                                            background: tokens.surfaceAlt,
                                            borderRadius: tokens.radius,
                                            fontSize: '14px',
                                            color: tokens.text,
                                            border: `1px solid ${tokens.border}`,
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = tokens.shadowSm;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}>
                                            <div style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                marginBottom: '8px'
                                            }}>
                                                <strong style={{ color: tokens.primary }}>{fond.nom}</strong>
                                                <span style={{
                                                    fontSize: '11px',
                                                    color: tokens.textMuted,
                                                    background: tokens.surface,
                                                    padding: '2px 6px',
                                                    borderRadius: '4px'
                                                }}>
                                                    ID: {fond.id}
                                                </span>
                                            </div>
                                            <div style={{ 
                                                fontSize: '12px', 
                                                color: tokens.textMuted,
                                                marginBottom: '8px',
                                                fontFamily: 'monospace',
                                                wordBreak: 'break-all'
                                            }}>
                                                {fond.url}
                                            </div>
                                            <div style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center'
                                            }}>
                                                <div style={{ fontSize: '12px', color: tokens.textMuted }}>
                                                    <span style={{ 
                                                        color: fond.file_info?.exists ? tokens.success : tokens.danger,
                                                        fontWeight: '600'
                                                    }}>
                                                        {fond.file_info?.exists ? '✓' : '✗'}
                                                    </span>
                                                    {' '}{fond.file_info?.size_human || 'Inconnue'}
                                                </div>
                                                {fond.file_info?.exists && (
                                                    <a
                                                        href={fond.file_info?.download_url}
                                                        download
                                                        style={{
                                                            background: tokens.primary,
                                                            color: 'white',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            textDecoration: 'none',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = tokens.primaryHover;
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = tokens.primary;
                                                        }}
                                                    >
                                                        <FiDownload size={12} />
                                                        Télécharger
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    maxHeight="300px"
                                />
                            )}
                        </div>

                        {/* Actions communes */}
                        <div style={{ 
                            display: 'flex', 
                            gap: '12px', 
                            justifyContent: 'center',
                            marginBottom: '24px',
                            flexWrap: 'wrap'
                        }}>
                            <Btn
                                onClick={handleLogout}
                                variant="danger"
                                size="md"
                            >
                                <FiLogOut size={16} />
                                Déconnexion
                            </Btn>
                        </div>

                        {/* Device ID Input Section */}
                        <div style={{ 
                            background: tokens.surface,
                            border: `1px solid ${tokens.border}`,
                            borderRadius: tokens.radius,
                            padding: '16px',
                            marginBottom: '24px'
                        }}>
                            <h3 style={{ 
                                color: tokens.text,
                                fontSize: '14px',
                                fontWeight: '600',
                                margin: '0 0 12px 0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <FiUsers size={16} />
                                Recherche par Device ID
                            </h3>
                            <div style={{ 
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'center'
                            }}>
                                <input
                                    type="text"
                                    placeholder="Entrez un device_id"
                                    value={deviceId}
                                    onChange={(e) => setDeviceId(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        border: `1px solid ${tokens.border}`,
                                        borderRadius: tokens.radius,
                                        fontSize: '14px',
                                        background: tokens.bg,
                                        color: tokens.text
                                    }}
                                />
                                <Btn
                                    onClick={() => fetchUsers()}
                                    variant="secondary"
                                    size="md"
                                >
                                    <FiRefreshCw size={16} />
                                    Utilisateurs
                                </Btn>
                            </div>
                        </div>

                        {/* POST JSON Section */}
                        <div style={{ 
                            background: tokens.surface,
                            border: `1px solid ${tokens.border}`,
                            borderRadius: tokens.radius,
                            padding: '16px',
                            marginBottom: '24px'
                        }}>
                            <h3 style={{ 
                                color: tokens.text,
                                fontSize: '14px',
                                fontWeight: '600',
                                margin: '0 0 12px 0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <FiSend size={16} />
                                Envoyer JSON en POST
                            </h3>
                            <div style={{ 
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <textarea
                                    placeholder="Entrez vos données JSON ici..."
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '120px',
                                        padding: '12px',
                                        border: `1px solid ${tokens.border}`,
                                        borderRadius: tokens.radius,
                                        fontSize: '14px',
                                        background: tokens.bg,
                                        color: tokens.text,
                                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                        resize: 'vertical',
                                        lineHeight: '1.5'
                                    }}
                                />
                                <div style={{ 
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '8px'
                                }}>
                                    <Btn
                                        onClick={() => setJsonInput('')}
                                        variant="secondary"
                                        size="sm"
                                    >
                                        Effacer
                                    </Btn>
                                    <Btn
                                        onClick={sendPostRequest}
                                        disabled={postLoading || !jsonInput.trim()}
                                        variant="primary"
                                        size="sm"
                                    >
                                        {postLoading ? (
                                            <>
                                                <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                                                Envoi...
                                            </>
                                        ) : (
                                            <>
                                                <FiSend size={14} />
                                                Envoyer POST
                                            </>
                                        )}
                                    </Btn>
                                </div>
                            </div>
                        </div>

                        {postResponse && (
                            <JsonDisplay
                                title="Réponse POST"
                                icon={<FiSend size={20} />}
                                data={postResponse}
                                color="primary"
                            />
                        )}

                        {/* Personnes POST Section */}
                        <div style={{ 
                            background: tokens.surface,
                            border: `1px solid ${tokens.border}`,
                            borderRadius: tokens.radius,
                            padding: '16px',
                            marginBottom: '24px'
                        }}>
                            <h3 style={{ 
                                color: tokens.text,
                                fontSize: '14px',
                                fontWeight: '600',
                                margin: '0 0 12px 0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <FiSend size={16} />
                                Envoyer JSON en POST - Personnes
                            </h3>
                            <div style={{ 
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <textarea
                                    placeholder="Entrez vos données JSON pour personnes ici..."
                                    value={personnesInput}
                                    onChange={(e) => setPersonnesInput(e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '120px',
                                        padding: '12px',
                                        border: `1px solid ${tokens.border}`,
                                        borderRadius: tokens.radius,
                                        fontSize: '14px',
                                        background: tokens.bg,
                                        color: tokens.text,
                                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                        resize: 'vertical',
                                        lineHeight: '1.5'
                                    }}
                                />
                                <div style={{ 
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '8px'
                                }}>
                                    <Btn
                                        onClick={() => setPersonnesInput('')}
                                        variant="secondary"
                                        size="sm"
                                    >
                                        Effacer
                                    </Btn>
                                    <Btn
                                        onClick={sendPersonnesPostRequest}
                                        disabled={personnesLoading || !personnesInput.trim()}
                                        variant="primary"
                                        size="sm"
                                    >
                                        {personnesLoading ? (
                                            <>
                                                <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                                                Envoi...
                                            </>
                                        ) : (
                                            <>
                                                <FiSend size={14} />
                                                Envoyer Personnes
                                            </>
                                        )}
                                    </Btn>
                                </div>
                            </div>
                        </div>

                        {personnesResponse && (
                            <JsonDisplay
                                title="Réponse POST Personnes"
                                icon={<FiSend size={20} />}
                                data={personnesResponse}
                                color="success"
                            />
                        )}

                        {usersResponse && (
                            <JsonDisplay
                                title="Utilisateurs API Response"
                                icon={<FiUsers size={20} />}
                                data={usersResponse}
                                color="success"
                            />
                        )}

                        <div style={{ 
                            background: tokens.primaryBg,
                            border: `1px solid ${tokens.primary}33`,
                            borderRadius: tokens.radius,
                            padding: '16px',
                            marginBottom: '24px'
                        }}>
                            <h3 style={{ 
                                color: tokens.primary,
                                fontSize: '14px',
                                fontWeight: '600',
                                margin: '0 0 12px 0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <FiAlertCircle size={16} />
                                Session active
                            </h3>
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: '12px',
                                color: tokens.textMuted
                            }}>
                                <span style={{ 
                                    background: tokens.success,
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: '600'
                                }}>
                                    AUTHENTIFIÉ
                                </span>
                                <span>Token JWT valide</span>
                            </div>
                            <div style={{ 
                                wordBreak: 'break-all',
                                fontSize: '10px',
                                color: tokens.textMuted,
                                fontFamily: 'monospace',
                                background: tokens.surface,
                                padding: '8px',
                                borderRadius: tokens.radius,
                                border: `1px solid ${tokens.border}`,
                                marginTop: '8px',
                                maxHeight: '60px',
                                overflowY: 'auto'
                            }}>
                                {token?.substring(0, 100)}...
                            </div>
                        </div>
                    </div>
                    </>
                )}
            </Card>
        </div>
    );
};

export default TestCom;
