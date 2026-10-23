import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

import { api } from './api';
import { usePath, navigate, searchParam } from './router';
import { AppHeader, BottomNav } from './components/Header';
import { LandingView } from './components/LandingView';
import { ImpactView } from './components/ImpactView';
import { HelpView } from './components/HelpView';
import { MethodologyView } from './components/MethodologyView';
import { AdminView } from './components/AdminView';
import { TripScreen } from './trip/TripScreen';
import { StartPrefill } from './trip/StartForm';
import { useTrip, TripController } from './trip/useTrip';
import { AutopilotProvider, useAutopilot } from './autopilot/AutopilotProvider';
import { AutopilotBar } from './autopilot/AutopilotBar';
import { DemoStage } from './demo/DemoStage';
import { PublicConfig } from './types';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000, refetchOnWindowFocus: true, retry: 1 } },
});

const EMBEDDED = searchParam('embed') === '1';

/** /j/<token>: someone on your flight sent you a link. It pre-fills the airport and landing time. */
const JoinRoute: React.FC<{ token: string; config: PublicConfig | null; controller: TripController }> = ({ token, config, controller }) => {
  const [prefill, setPrefill] = useState<StartPrefill | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api
      .readJoinLink(token)
      .then((d) => setPrefill({ scheduledArrival: d.scheduled_arrival, terminal: d.terminal, flightNo: d.flight_no }))
      .catch(() => setFailed(true));
  }, [token]);
  if (failed) {
    return (
      <div className="mx-auto max-w-md px-5 pt-28 text-center space-y-4" data-demo="join-expired">
        <h1 className="text-2xl font-bold">This invite link has expired</h1>
        <p className="text-secondary">Links last 24 hours. You can still look for a cab share yourself.</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/trip', { replace: true })}>
          Find a cab share
        </button>
      </div>
    );
  }
  if (!prefill) return <div className="pt-28 text-center text-secondary">Opening your invite…</div>;
  return <TripScreen key={token} config={config} prefill={prefill} controller={controller} />;
};

/** Trip, Impact and Help share one header, one bottom nav and one live trip. */
const AppChrome: React.FC<{ path: string; config: PublicConfig | null }> = ({ path, config }) => {
  const controller = useTrip();
  const { data: impact } = useQuery({ queryKey: ['impact'], queryFn: api.getImpactMetrics, refetchInterval: 15000 });
  const isTrip = path === '/trip' || path.startsWith('/j/');
  const needsYou = controller.trip?.state === 'invite_received';

  let page: React.ReactNode;
  if (path.startsWith('/j/')) page = <JoinRoute token={decodeURIComponent(path.slice(3))} config={config} controller={controller} />;
  else if (path === '/trip') page = <TripScreen config={config} controller={controller} />;
  else if (path === '/impact') page = <ImpactView impact={impact ?? null} onGoToMethodology={() => navigate('/methodology')} />;
  else page = <HelpView />;

  return (
    <div className="min-h-screen bg-ink-950 text-primary">
      <AppHeader path={path} trip={controller.trip} />
      <main id="main-content" className={isTrip ? '' : 'pt-14 pb-24 md:pb-10'}>
        {page}
      </main>
      <BottomNav path={path} tripNeedsYou={needsYou} />
    </div>
  );
};

function Routes() {
  const path = usePath();
  const { start, engine } = useAutopilot();
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.getConfig, staleTime: Infinity });
  const { data: impact } = useQuery({
    queryKey: ['impact'],
    queryFn: api.getImpactMetrics,
    enabled: path === '/',
    refetchInterval: 15000,
  });

  // /?watch=1 starts the walkthrough straight away
  useEffect(() => {
    if (path === '/' && searchParam('watch') === '1' && engine.state.status === 'idle') start('main');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (path === '/demo') return <DemoStage />;
  if (path === '/methodology')
    return (
      <div className="min-h-screen bg-ink-950 text-primary">
        <AppHeader path={path} trip={null} />
        <main className="pt-14">
          <MethodologyView config={config ?? null} />
        </main>
      </div>
    );
  if (path === '/admin')
    return (
      <div className="min-h-screen bg-ink-950 text-primary">
        <AppHeader path={path} trip={null} />
        <main className="pt-14">
          <AdminView onRefresh={() => queryClient.invalidateQueries()} />
        </main>
      </div>
    );
  if (path === '/trip' || path === '/impact' || path === '/help' || path.startsWith('/j/')) return <AppChrome path={path} config={config ?? null} />;
  return <LandingView config={config ?? null} impact={impact ?? null} onStart={() => navigate('/trip')} onWatch={() => start('main')} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AutopilotProvider embedded={EMBEDDED}>
        <div className="grain-overlay pointer-events-none" aria-hidden="true" />
        <Routes />
        {!EMBEDDED && <AutopilotBar />}
      </AutopilotProvider>
    </QueryClientProvider>
  );
}
