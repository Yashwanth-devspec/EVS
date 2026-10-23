import React, { useState } from 'react';

export const OldVsEcoRideComparison: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ecoride' | 'solo'>('ecoride');

  return (
    <div className="w-full rounded-3xl border border-ink-800 bg-ink-900/60 p-6 sm:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-800 pb-5">
        <div>
          <span className="font-cockpit text-xs font-semibold text-amber tracking-wider">Midnight at Kempegowda Airport</span>
          <h3 className="mt-1 text-2xl font-bold text-primary">Two ways to leave the terminal</h3>
        </div>
        <div className="inline-flex rounded-full border border-ink-700 bg-ink-950 p-1 self-start sm:self-auto" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ecoride'}
            onClick={() => setActiveTab('ecoride')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'ecoride'
                ? 'bg-paper text-ink-950 shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            The EcoRide share
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'solo'}
            onClick={() => setActiveTab('solo')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'solo'
                ? 'bg-paper text-ink-950 shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Solo cab alone
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {activeTab === 'ecoride' ? (
          <>
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green" />
                <span className="font-cockpit text-xs font-semibold text-green tracking-wider">Smart shared ride</span>
              </div>
              <h4 className="text-xl sm:text-2xl font-bold text-primary">
                3 passengers heading to South Bangalore share 1 sedan
              </h4>
              <p className="text-secondary leading-relaxed text-sm sm:text-base">
                You land on the same wave, match in 2 minutes, meet at P3 App Cabs, and ride down Bellary Road together.
                One books in their normal Uber or Ola app, and the fare is automatically split to the rupee.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-2xl border border-ink-800 bg-ink-950/80 p-3.5">
                  <span className="block text-xs text-secondary">You pay</span>
                  <span className="font-cockpit text-xl sm:text-2xl font-bold text-green">Rs 580</span>
                </div>
                <div className="rounded-2xl border border-ink-800 bg-ink-950/80 p-3.5">
                  <span className="block text-xs text-secondary">You save</span>
                  <span className="font-cockpit text-xl sm:text-2xl font-bold text-green">Rs 1,030</span>
                </div>
                <div className="rounded-2xl border border-ink-800 bg-ink-950/80 p-3.5">
                  <span className="block text-xs text-secondary">Cabs on road</span>
                  <span className="font-cockpit text-xl sm:text-2xl font-bold text-primary">1 cab</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-ink-800 bg-ink-950 p-5 space-y-3">
              <div className="text-xs font-cockpit text-secondary">Route breakdown</div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-primary">Kempegowda T1/T2</span>
                  <span className="font-cockpit text-xs text-secondary">Pickup</span>
                </div>
                <div className="border-l-2 border-dashed border-amber/50 pl-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-secondary">Stop 1: Indiranagar 100ft Rd</span>
                    <span className="font-cockpit text-xs text-green">Meera (Rs 540)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary">Stop 2: Domlur Flyover</span>
                    <span className="font-cockpit text-xs text-green">Arjun (Rs 570)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-ink-800">
                  <span className="text-primary font-semibold">Stop 3: Jayanagar (You)</span>
                  <span className="font-cockpit text-xs font-bold text-green">Rs 580</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red" />
                <span className="font-cockpit text-xs font-semibold text-red tracking-wider">The status quo</span>
              </div>
              <h4 className="text-xl sm:text-2xl font-bold text-primary">
                3 passengers take 3 separate cabs on the exact same road
              </h4>
              <p className="text-secondary leading-relaxed text-sm sm:text-base">
                Each passenger pays the full airport toll, airport access fee, and full base fare alone.
                Three nearly identical cars drive bumper to bumper past Hebbal Flyover into town.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-2xl border border-ink-800 bg-ink-950/80 p-3.5">
                  <span className="block text-xs text-secondary">You pay</span>
                  <span className="font-cockpit text-xl sm:text-2xl font-bold text-red">Rs 1,620</span>
                </div>
                <div className="rounded-2xl border border-ink-800 bg-ink-950/80 p-3.5">
                  <span className="block text-xs text-secondary">Group total</span>
                  <span className="font-cockpit text-xl sm:text-2xl font-bold text-primary">Rs 4,860</span>
                </div>
                <div className="rounded-2xl border border-ink-800 bg-ink-950/80 p-3.5">
                  <span className="block text-xs text-secondary">Cabs on road</span>
                  <span className="font-cockpit text-xl sm:text-2xl font-bold text-red">3 cabs</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-ink-800 bg-ink-950 p-5 space-y-3">
              <div className="text-xs font-cockpit text-secondary">Single cab receipt</div>
              <div className="space-y-2 text-sm text-secondary">
                <div className="flex justify-between">
                  <span>Base fare + 44 km</span>
                  <span className="font-cockpit text-primary">Rs 1,244</span>
                </div>
                <div className="flex justify-between">
                  <span>Airport pickup access fee</span>
                  <span className="font-cockpit text-primary">Rs 250</span>
                </div>
                <div className="flex justify-between">
                  <span>Trumpet interchange toll</span>
                  <span className="font-cockpit text-primary">Rs 126</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-ink-800 font-semibold text-primary">
                  <span>Total you pay alone</span>
                  <span className="font-cockpit text-red">Rs 1,620</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
