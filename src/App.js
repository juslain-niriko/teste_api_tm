import React, { useState } from 'react';
import TestCom from './TestCom';
import GeoDocManager from './GeoDocManager';
import FiplofManager from './FiplofManager';

function App() {
  const [currentView, setCurrentView] = useState('geodoc');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-800">
                <i className="fas fa-flask text-blue-500 mr-2"></i>
                Test API TM Web
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentView('test')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentView === 'test'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <i className="fas fa-vial mr-2"></i>
                API Test
              </button>
              <button
                onClick={() => setCurrentView('geodoc')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentView === 'geodoc'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <i className="fas fa-rocket mr-2"></i>
                GeoDoc Manager
              </button>
              <button
                onClick={() => setCurrentView('fiplof')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentView === 'fiplof'
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <i className="fas fa-shield-alt mr-2"></i>
                Fiplof Manager
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {currentView === 'test' ? <TestCom /> : 
         currentView === 'fiplof' ? <FiplofManager /> : 
         <GeoDocManager />}
      </main>
    </div>
  );
}

export default App;
