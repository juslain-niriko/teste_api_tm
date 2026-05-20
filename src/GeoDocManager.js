import React, { useState, useEffect } from 'react';
import { FiZap, FiUsers, FiRefreshCw, FiCheck, FiFolder, FiEye, FiTrash2, FiX, FiSettings } from 'react-icons/fi';

const API_BASE = 'http://localhost:8005/api';

function GeoDocManager() {
  const [users, setUsers] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [geodocId, setGeodocId] = useState('15');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [successMessage, setSuccessMessage] = useState('');
  const [viewingPayload, setViewingPayload] = useState(null);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = () => {
    fetchUsers();
    fetchDossiers();
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/test/users`);
      const data = await response.json();
      setUsers(data || []);
      setServerStatus('online');
    } catch (error) {
      setServerStatus('offline');
    }
  };

  const fetchDossiers = async () => {
    try {
      const response = await fetch(`${API_BASE}/test/dossiers`);
      const data = await response.json();
      // Filtrer pour ne garder que les dossiers GeoDoc
      const geodocDossiers = data.filter(d => d.geodoc_status === 'transferred');
      setDossiers(geodocDossiers);
    } catch (error) {
      console.error('Error fetching dossiers:', error);
    }
  };

  const deleteDossier = async (id) => {
    if (!window.confirm('Supprimer ce dossier reçu ?')) return;
    try {
      await fetch(`${API_BASE}/test/dossiers/${id}`, { method: 'DELETE' });
      fetchDossiers();
    } catch (error) {
      console.error('Error deleting dossier:', error);
    }
  };

  const setUserStatus = async () => {
    if (!selectedUser) return;

    setLoading(true);
    setSuccessMessage('');
    try {
      const response = await fetch(`${API_BASE}/test/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedUser,
          status: selectedStatus,
          id: selectedStatus === 'active' ? parseInt(geodocId) : null
        })
      });

      const result = await response.json();
      setSuccessMessage(`Statut mis à jour pour ${selectedUser}`);
      await fetchUsers();
      setSelectedUser('');
    } catch (error) {
      console.error('Error setting status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    let colors = {};
    switch (status) {
      case 'active': colors = { bg: 'bg-green-100', text: 'text-green-800' }; break;
      case 'pending': colors = { bg: 'bg-yellow-100', text: 'text-yellow-800' }; break;
      case 'inactive': colors = { bg: 'bg-red-100', text: 'text-red-800' }; break;
      default: colors = { bg: 'bg-gray-100', text: 'text-gray-800' };
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FiZap className="text-blue-600 text-2xl mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">GeoDoc Manager</h1>
              <p className="text-gray-600">Gestion des comptes et dossiers GeoDoc</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              serverStatus === 'online'
                ? 'bg-green-50 border-green-200 text-green-700'
                : serverStatus === 'offline'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                serverStatus === 'online'
                  ? 'bg-green-500 animate-pulse'
                  : serverStatus === 'offline'
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
              }`} />
              <span className="font-medium">
                {serverStatus === 'online' ? 'Serveur en ligne' : serverStatus === 'offline' ? 'Serveur hors ligne' : 'Vérification...'}
              </span>
            </div>
            <button
              onClick={fetchAll}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <FiRefreshCw />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Grid for Users and Status Control */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Status Control */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FiSettings className="text-blue-600 mr-2" />
            Contrôle des Statuts
          </h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Utilisateur
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionner un utilisateur</option>
                {users.map(user => (
                  <option key={user.email} value={user.email}>
                    {user.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nouveau statut
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="pending">pending (⏳)</option>
                <option value="active">active (✅)</option>
                <option value="inactive">inactive (❌)</option>
              </select>
            </div>

            {selectedStatus === 'active' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GeoDoc ID
                </label>
                <input
                  type="number"
                  value={geodocId}
                  onChange={(e) => setGeodocId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <button
            onClick={setUserStatus}
            disabled={loading || !selectedUser}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-all ${
              loading || !selectedUser
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
            }`}
          >
            {loading ? 'Mise à jour...' : 'Appliquer'}
          </button>
        </div>

        {/* Users List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <FiUsers className="text-blue-600 mr-2" />
              Utilisateurs TM ({users.length})
            </h2>
          </div>

          <div className="overflow-y-auto max-h-[350px]">
            {users.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Aucun utilisateur.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">GeoDoc ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(user => (
                    <tr key={user.email} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{user.email}</td>
                      <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
                      <td className="px-6 py-4 font-mono text-gray-600">{user.id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Dossiers Section */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border-t-4 border-purple-500">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-purple-50">
          <h2 className="text-lg font-semibold text-purple-800 flex items-center">
            <FiFolder className="mr-2" />
            Dossiers reçus via GeoDoc Transfer ({dossiers.length})
          </h2>
        </div>

        {dossiers.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FiFolder className="mx-auto text-5xl mb-4 opacity-20" />
            <p className="text-lg">Aucun dossier reçu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Numéro</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Commune</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Superficie</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Transfer ID</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dossiers.map(dossier => (
                  <tr key={dossier.dossier_id} className="hover:bg-purple-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{dossier.numero}</td>
                    <td className="px-6 py-4 text-gray-600">{dossier.commune}</td>
                    <td className="px-6 py-4 text-gray-600 font-mono">{dossier.superficie} m²</td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">{dossier.transfer_id}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(dossier.transfer_date).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button 
                        onClick={() => setViewingPayload(dossier.source_payload)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Voir le JSON"
                      >
                        <FiEye size={18} />
                      </button>
                      <button 
                        onClick={() => deleteDossier(dossier.dossier_id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Supprimer"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payload Viewer Modal */}
      {viewingPayload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 text-green-400 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-800 rounded-t-lg">
              <h3 className="text-lg font-mono font-bold text-white flex items-center gap-2">
                <FiFolder className="text-blue-400" />
                GeoDoc Payload (JSON)
              </h3>
              <button 
                onClick={() => setViewingPayload(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto font-mono text-sm">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(viewingPayload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GeoDocManager;
