import React from 'react';

interface SafetyItem {
  id: string;
  badge: string;
  title: string;
  rule: string;
  rationale: string;
}

export const TrustSafetyGrid: React.FC = () => {
  const items: SafetyItem[] = [
    {
      id: '01',
      badge: 'NO PHONE NUMBERS',
      title: 'First Names Only',
      rule: 'Nobody on the platform ever sees your phone number, email address, or last name.',
      rationale: 'All coordination occurs via anonymous temporary session tokens that expire after 24 hours.',
    },
    {
      id: '02',
      badge: '4-DIGIT PIN',
      title: 'Curb Verification Handshake',
      rule: 'Every matched group shares a unique 4-digit code generated on their boarding passes.',
      rationale: 'Verify the code with your co-passengers at the pillar before anyone gets into the taxi.',
    },
    {
      id: '03',
      badge: 'PASSENGER PREFERENCE',
      title: 'Women-Only Group Option',
      rule: 'Filter to form ride corridors exclusively with female co-travellers on your arrival wave.',
      rationale: 'Self-declared option for peace of mind when traveling late at night out of Kempegowda.',
    },
    {
      id: '04',
      badge: '1-TAP SOS',
      title: 'Family WhatsApp Share',
      rule: 'Share an encrypted live trip summary to family members with cab registration and curb details.',
      rationale: 'Direct link allows family to track the booking status without downloading any app.',
    },
    {
      id: '05',
      badge: 'RAPID RESPONSE',
      title: 'Emergency 112 Hub',
      rule: 'A dedicated Call 112 trigger is present on every active screen from landing to final drop.',
      rationale: 'Instant one-tap direct connection to Karnataka Police airport highway patrol.',
    },
    {
      id: '06',
      badge: 'EPHEMERAL DATA',
      title: '24-Hour Self-Destruct',
      rule: 'All pickup logs, destinations, and drop coordinates are wiped from server memory within 24 hours.',
      rationale: 'Zero permanent location logging. Zero advertising trackers. Zero location resale.',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative rounded-2xl border border-ink-800 bg-ink-900/60 p-6 backdrop-blur transition-all duration-300 hover:border-green/40 hover:bg-ink-900 overflow-hidden"
        >
          {/* Subtle green indicator */}
          <div className="flex items-center justify-between pb-3 border-b border-ink-800">
            <span className="font-cockpit text-xs font-bold text-green tracking-wider uppercase flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green" />
              {item.badge}
            </span>
            <span className="font-cockpit text-xs text-secondary/60">#SEC-{item.id}</span>
          </div>

          <div className="pt-4 space-y-2">
            <h4 className="text-lg font-bold text-primary group-hover:text-green transition-colors">
              {item.title}
            </h4>
            <p className="text-secondary text-sm leading-relaxed">
              {item.rule}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-ink-800/60 font-cockpit text-xs text-secondary/70">
            {item.rationale}
          </div>
        </div>
      ))}
    </div>
  );
};
