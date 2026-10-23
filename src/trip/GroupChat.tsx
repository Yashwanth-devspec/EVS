import React, { useState, useRef, useEffect } from 'react';
import { GroupView, GroupMessage } from '../types';
import { formatTime } from '../utils';
import { IconMessage, IconSend, IconChevron, IconLock } from './icons';

interface GroupChatProps {
  group: GroupView;
  onSendMessage: (text: string) => Promise<unknown>;
}

const QUICK_CHIPS = [
  'At baggage carousel',
  'Collecting luggage',
  'Walking to P3 App Cabs',
  'Near Pillar 3',
  'Wearing dark jacket',
  'Flight slightly delayed',
];

export const GroupChat: React.FC<GroupChatProps> = ({ group, onSendMessage }) => {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages: GroupMessage[] = group.messages ?? [];
  const coPassengers = group.members.filter((m) => !m.is_you);

  // Auto-scroll to latest message when messages change or panel expands
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, open]);

  const handleSend = async (msgText: string) => {
    const clean = msgText.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await onSendMessage(clean);
      setText('');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 overflow-hidden shadow-ticket transition-all">
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-ink-850 transition-colors"
        aria-expanded={open}
        aria-label="Toggle co-passenger airport coordination chat"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-ink-800 text-green border border-ink-700">
            <IconMessage size={18} />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green text-[10px] font-bold text-ink-950 tabular-nums">
                {messages.length}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary">Co-passenger coordination</span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-ink-700 bg-ink-800 text-secondary">
                {coPassengers.map((m) => m.first_name).join(', ') || 'Ride group'}
              </span>
            </div>
            <div className="text-xs text-secondary flex items-center gap-1.5 mt-0.5">
              <IconLock size={11} className="text-secondary/70" />
              <span>In-app only · Zero phone numbers shared</span>
            </div>
          </div>
        </div>
        <IconChevron up={open} />
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-ink-800 p-4 space-y-3.5">
          {/* Quick status chips */}
          <div>
            <div className="text-xs text-secondary font-medium mb-1.5">Quick status updates</div>
            <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Quick coordination messages">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={sending}
                  onClick={() => handleSend(chip)}
                  className="rounded-lg border border-ink-750 bg-ink-800/80 px-2.5 py-1 text-xs text-secondary hover:text-primary hover:border-ink-600 hover:bg-ink-750 transition-colors active:scale-95 disabled:opacity-50 text-left"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Messages feed */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Co-passenger messages"
            className="max-h-48 min-h-[96px] overflow-y-auto space-y-2 rounded-xl border border-ink-800/70 bg-ink-950/60 p-3"
          >
            {messages.length === 0 ? (
              <div className="flex h-20 items-center justify-center text-center text-xs text-secondary leading-relaxed px-4">
                No messages yet. Send a quick update to coordinate meeting at {group.pickup_point || 'P3 App Cabs'}.
              </div>
            ) : (
              messages.map((m) => {
                const isYou = m.is_you;
                const timeStr = m.timestamp ? formatTime(m.timestamp) : '';
                return (
                  <div key={m.id} className={`flex flex-col ${isYou ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 text-[11px] text-secondary mb-0.5 px-1">
                      <span className="font-medium text-ink-300">{isYou ? 'You' : m.sender_name}</span>
                      {timeStr && <span className="text-ink-500">· {timeStr}</span>}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug break-words ${
                        isYou
                          ? 'bg-green/15 text-primary border border-green/30 rounded-br-sm'
                          : 'bg-ink-800 text-primary border border-ink-700 rounded-bl-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(text);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={text}
              maxLength={200}
              disabled={sending}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message your co-passengers…"
              className="flex-1 rounded-xl border border-ink-750 bg-ink-950 px-3 py-2 text-sm text-primary placeholder-secondary/60 focus:border-green focus:outline-none focus:ring-1 focus:ring-green disabled:opacity-50"
              aria-label="Message text"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green text-ink-950 font-bold hover:bg-green-light active:scale-95 disabled:opacity-40 disabled:hover:bg-green transition-all"
              aria-label="Send message"
            >
              <IconSend size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
