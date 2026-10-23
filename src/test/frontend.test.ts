/**
 * src/test/frontend.test.ts — Vitest suite.
 * Tests:
 * 1. IST time formatting (Asia/Kolkata), 23:45 IST -> 11:45 pm, tomorrow day indicator.
 * 2. Chart aggregation renders at most 4 nodes.
 * 3. Best match selection rule (within min(userMaxWait, 30 min), fallback with longer wait).
 * 4. Money formatting (whole rupees only, Indian grouping, nearest 10 rounding with "about").
 * 5. Outlook wave sorting (chronological, soonest first).
 */
import { describe, it, expect } from 'vitest';
import { formatINR, formatTime, formatDateTime, formatMinutes, formatKm } from '../utils';
import { aggregateChartNodes, findBestMatch, parseWaveMinutes } from '../lib/options';
import { MatchGroup } from '../types';

describe('IST Time Formatting (Asia/Kolkata)', () => {
  it('displays 23:45 IST as 11:45 pm', () => {
    // 18:15 UTC corresponds exactly to 23:45 IST (18:15 + 05:30)
    const utcTime = '2026-10-22T18:15:00Z';
    const formatted = formatTime(utcTime, { baseDate: '2026-10-22T12:00:00Z' });
    expect(formatted).toBe('11:45 pm');
  });

  it('shows "tomorrow" when time is on the next calendar day in IST', () => {
    // Reference: 22:30 IST on Oct 22 (17:00 UTC)
    // Target: 00:15 IST on Oct 23 (18:45 UTC)
    const baseTime = '2026-10-22T17:00:00Z';
    const targetTime = '2026-10-22T18:45:00Z';
    const formatted = formatTime(targetTime, { baseDate: baseTime });
    expect(formatted).toBe('tomorrow 12:15 am');
  });

  it('formats date and time in IST cleanly without developer timezone strings', () => {
    const utcTime = '2026-10-22T04:30:00Z'; // 10:00 am IST
    const formatted = formatTime(utcTime);
    expect(formatted).toMatch(/10:00\s*am/);
  });
});

describe('Money Rounding and Indian Grouping', () => {
  it('formats whole rupees only with Indian number grouping', () => {
    expect(formatINR(1480)).toBe('Rs 1,480');
    expect(formatINR(520)).toBe('Rs 520');
    expect(formatINR(150000)).toBe('Rs 1,50,000');
    expect(formatINR(0)).toBe('Rs 0');
  });

  it('rounds estimates to the nearest 10 with "about" in front and no decimals', () => {
    expect(formatINR(832, true)).toBe('about Rs 830');
    expect(formatINR(828, true)).toBe('about Rs 830');
    expect(formatINR(835, true)).toBe('about Rs 840');
    expect(formatINR(1496, true)).toBe('about Rs 1,500');
    expect(formatINR(504, true)).toBe('about Rs 500');
  });

  it('formats kilometres and minutes cleanly', () => {
    expect(formatKm(44.25)).toBe('44.3 km');
    expect(formatMinutes(15)).toBe('15 min');
    expect(formatMinutes(75)).toBe('1 hr 15 min');
    expect(formatMinutes(120)).toBe('2 hr');
  });
});

describe('Wait-vs-Save Chart Aggregation (At Most 4 Nodes)', () => {
  const createMockGroup = (id: string, wait: number, save: number): MatchGroup => ({
    id,
    depart_time: '2026-10-22T19:00:00Z',
    cab_type: 'sedan',
    cab_name: 'Uber Go',
    members: [
      {
        request_id: 'req_1',
        first_name: 'Asha',
        party_size: 1,
        zone: 'Jayanagar',
        dest_label: 'Jayanagar',
        shared_km_to_drop: 42,
        fare_share_est: 500,
        solo_fare_est: 1480,
        saving_inr: save,
        saving_pct: 66,
      },
    ],
    shared_km: 44,
    km_saved: 40,
    fare_total_est: 900,
    tier: wait <= 15 ? 'NOW' : wait <= 30 ? 'SOON' : 'LATER',
    viewer_extra_wait_min: wait,
    viewer_saving_inr: save,
    viewer_saving_pct: 65,
    viewer_fare_inr: 500,
  }) as unknown as MatchGroup;

  it('renders at most 4 nodes regardless of how many raw groups exist', () => {
    const rawOptions: MatchGroup[] = [
      createMockGroup('1', 5, 300),
      createMockGroup('2', 10, 450), // Best in Leave soon (0-15m)
      createMockGroup('3', 12, 400),
      createMockGroup('4', 18, 550),
      createMockGroup('5', 25, 750), // Best in A little later (16-30m)
      createMockGroup('6', 30, 700),
      createMockGroup('7', 35, 800),
      createMockGroup('8', 45, 950), // Best in Wait to save more (31-60m)
      createMockGroup('9', 55, 900),
    ];

    const nodes = aggregateChartNodes(rawOptions);
    expect(nodes.length).toBeLessThanOrEqual(4);
    expect(nodes.length).toBe(4);

    // Node 0: Solo baseline
    expect(nodes[0].isBaseline).toBe(true);
    expect(nodes[0].waitMin).toBe(0);
    expect(nodes[0].savingInr).toBe(0);

    // Node 1: Leave soon best (10m, 450)
    expect(nodes[1].waitMin).toBe(10);
    expect(nodes[1].savingInr).toBe(450);

    // Node 2: A little later best (25m, 750)
    expect(nodes[2].waitMin).toBe(25);
    expect(nodes[2].savingInr).toBe(750);

    // Node 3: Wait more best (45m, 950)
    expect(nodes[3].waitMin).toBe(45);
    expect(nodes[3].savingInr).toBe(950);
    expect(nodes[3].isBest).toBe(true);
  });

  it('renders fewer than 4 nodes when some tiers have no options', () => {
    const rawOptions: MatchGroup[] = [
      createMockGroup('1', 8, 350), // Only Leave soon
    ];
    const nodes = aggregateChartNodes(rawOptions);
    expect(nodes.length).toBe(2); // Baseline + Leave soon
  });
});

describe('Best Match Selection Rule', () => {
  const createMockGroup = (id: string, wait: number, save: number): MatchGroup => ({
    id,
    depart_time: '2026-10-22T19:00:00Z',
    cab_type: 'sedan',
    cab_name: 'Uber Go',
    members: [],
    shared_km: 44,
    km_saved: 40,
    fare_total_est: 900,
    tier: 'SOON',
    viewer_extra_wait_min: wait,
    viewer_saving_inr: save,
    viewer_saving_pct: 60,
    viewer_fare_inr: 500,
  }) as unknown as MatchGroup;

  it('picks highest saving within the smaller of user max wait and 30 minutes', () => {
    const options = [
      createMockGroup('opt_10m', 10, 400),
      createMockGroup('opt_20m', 20, 650),
      createMockGroup('opt_28m', 28, 800),
      createMockGroup('opt_45m', 45, 1100),
    ];

    // User max wait = 30m -> threshold = min(30, 30) = 30m. Best match: 28m (save 800)
    const result1 = findBestMatch(options, 30);
    expect(result1.best?.id).toBe('opt_28m');
    expect(result1.needsLongerWait).toBe(false);

    // User max wait = 15m -> threshold = min(15, 30) = 15m. Best match: 10m (save 400)
    const result2 = findBestMatch(options, 15);
    expect(result2.best?.id).toBe('opt_10m');
    expect(result2.needsLongerWait).toBe(false);
  });

  it('falls back to best option from any tier when none qualifies within 30 min and flags longer wait', () => {
    const options = [
      createMockGroup('opt_40m', 40, 700),
      createMockGroup('opt_50m', 50, 950),
    ];

    const result = findBestMatch(options, 20);
    expect(result.best?.id).toBe('opt_50m');
    expect(result.needsLongerWait).toBe(true);
  });
});

describe('Arrival Schedule Sorting', () => {
  it('parses wave times to minutes correctly and sorts chronologically', () => {
    const waves = [
      '11:45 pm – 12:00 am',
      '6:30 – 6:45 pm',
      '12:00 am – 12:15 am',
      '7:15 – 7:30 am',
    ];

    const sorted = [...waves].sort((a, b) => parseWaveMinutes(a) - parseWaveMinutes(b));

    expect(sorted[0]).toBe('12:00 am – 12:15 am');
    expect(sorted[1]).toBe('7:15 – 7:30 am');
    expect(sorted[2]).toBe('6:30 – 6:45 pm');
    expect(sorted[3]).toBe('11:45 pm – 12:00 am');
  });
});
