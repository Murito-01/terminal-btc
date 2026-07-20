import { useState, useEffect, useCallback } from 'react';
import Header from '../../components/Header/Header';
import ChartPanel from '../../components/Chart/ChartPanel';
import SignalPanel from '../../components/SignalPanel/SignalPanel';
import IndicatorPanel from '../../components/IndicatorPanel/IndicatorPanel';
import SignalHistory from '../../components/SignalHistory/SignalHistory';
import SettingsModal from '../../components/Settings/SettingsModal';
import { useSocket } from '../../hooks/useSocket';
import api from '../../lib/api';
import './Dashboard.css';

export default function DashboardPage() {
  const [currentSignal, setCurrentSignal] = useState(null);
  const [latestByTimeframe, setLatestByTimeframe] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [multiView, setMultiView] = useState(false);
  const [signalTrigger, setSignalTrigger] = useState(0);
  const { connected, latestSignal, liveState, nextUpdateAt } = useSocket();

  const fetchLatestSignals = useCallback(async () => {
    try {
      const [currentRes, latestRes] = await Promise.all([
        api.get('/signals/current'),
        api.get('/signals/latest'),
      ]);
      if (currentRes.data.signal) setCurrentSignal(currentRes.data.signal);
      setLatestByTimeframe(latestRes.data);
    } catch (err) {
      console.error('Failed to fetch signals:', err);
    }
  }, []);

  useEffect(() => {
    fetchLatestSignals();
  }, [fetchLatestSignals]);

  // Update when new signal arrives via WebSocket
  useEffect(() => {
    if (latestSignal) {
      setCurrentSignal(latestSignal);
      setSignalTrigger(prev => prev + 1);
      fetchLatestSignals();
    }
  }, [latestSignal, fetchLatestSignals]);

  return (
    <div className="app-layout">
      <Header
        connected={connected}
        onSettingsClick={() => setShowSettings(true)}
      />

      <main className="main-content dashboard-content">
        {/* New signal notification */}
        {latestSignal && (
          <div className="new-signal-toast" key={latestSignal.id}>
            <span className="toast-icon">📡</span>
            <span className="toast-msg">
              Sinyal baru diterima: <strong>{latestSignal.position_type}</strong> @ {latestSignal.timeframe}
            </span>
          </div>
        )}

        {/* Top controls */}
        <div className="dashboard-controls">
          <div className="dashboard-section-title">
            <span className="section-dot" />
            Dashboard Utama
          </div>
          <div className="dashboard-view-toggle">
            <button
              className={`view-btn ${!multiView ? 'view-btn--active' : ''}`}
              onClick={() => setMultiView(false)}
              id="single-view-btn"
            >
              ▣ Single Chart
            </button>
            <button
              className={`view-btn ${multiView ? 'view-btn--active' : ''}`}
              onClick={() => setMultiView(true)}
              id="multi-view-btn"
            >
              ⊞ Multi Timeframe
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div className="dashboard-layout">
          {/* Left: Chart + History stacked */}
          <div className="dashboard-chart-area">
            <ChartPanel multiView={multiView} />
            <div className="dashboard-history">
              <SignalHistory newSignalTrigger={signalTrigger} />
            </div>
          </div>

          {/* Right: Panels */}
          <div className="dashboard-side-panels">
            <SignalPanel
              signal={currentSignal}
              liveState={liveState}
              nextUpdateAt={nextUpdateAt}
              latestByTimeframe={latestByTimeframe}
            />
            <IndicatorPanel signal={currentSignal} liveState={liveState} />
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
