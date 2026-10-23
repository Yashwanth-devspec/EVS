/**
 * src/lib/options.ts — Pure helpers for choosing and grouping ride options.
 * Kept free of React so they can be unit tested and shared by the Trip sheet.
 */
import { MatchGroup } from '../types';

/**
 * Best match rule:
 * Highest saving whose extra wait is within the smaller of the user's max wait and 30 minutes.
 * If none qualifies, show the best option from any tier and say it needs a longer wait.
 */
export function findBestMatch(
  options: MatchGroup[],
  userMaxWait: number = 30
): { best: MatchGroup | null; needsLongerWait: boolean } {
  if (!options || options.length === 0) {
    return { best: null, needsLongerWait: false };
  }
  const threshold = Math.min(userMaxWait || 30, 30);
  const eligible = options.filter((o) => o.viewer_extra_wait_min <= threshold);

  if (eligible.length > 0) {
    const best = eligible.reduce((prev, curr) => {
      if (curr.viewer_saving_inr > prev.viewer_saving_inr) return curr;
      if (
        curr.viewer_saving_inr === prev.viewer_saving_inr &&
        curr.viewer_extra_wait_min < prev.viewer_extra_wait_min
      ) {
        return curr;
      }
      return prev;
    });
    return { best, needsLongerWait: false };
  }

  // Fallback: pick highest saving from any tier
  const bestAny = options.reduce((prev, curr) => {
    if (curr.viewer_saving_inr > prev.viewer_saving_inr) return curr;
    if (
      curr.viewer_saving_inr === prev.viewer_saving_inr &&
      curr.viewer_extra_wait_min < prev.viewer_extra_wait_min
    ) {
      return curr;
    }
    return prev;
  });
  return { best: bestAny, needsLongerWait: true };
}

export interface ChartNode {
  id: string;
  tierLabel: string;
  waitMin: number;
  savingInr: number;
  isBaseline: boolean;
  isBest: boolean;
  originalIndex?: number;
  membersCount?: number;
}

export function aggregateChartNodes(options: MatchGroup[]): ChartNode[] {
  const nodes: ChartNode[] = [
    {
      id: 'solo-baseline',
      tierLabel: 'Solo baseline',
      waitMin: 0,
      savingInr: 0,
      isBaseline: true,
      isBest: false,
      membersCount: 1,
    },
  ];

  // Helper to pick best (highest saving, then lowest wait)
  const pickBest = (opts: { opt: MatchGroup; originalIndex: number }[]) => {
    if (opts.length === 0) return null;
    return opts.reduce((prev, curr) => {
      if (curr.opt.viewer_saving_inr > prev.opt.viewer_saving_inr) return curr;
      if (
        curr.opt.viewer_saving_inr === prev.opt.viewer_saving_inr &&
        curr.opt.viewer_extra_wait_min < prev.opt.viewer_extra_wait_min
      ) {
        return curr;
      }
      return prev;
    });
  };

  const indexed = options.map((opt, originalIndex) => ({ opt, originalIndex }));

  const leaveSoon = pickBest(indexed.filter((x) => x.opt.viewer_extra_wait_min <= 15));
  const littleLater = pickBest(
    indexed.filter((x) => x.opt.viewer_extra_wait_min > 15 && x.opt.viewer_extra_wait_min <= 30)
  );
  const waitMore = pickBest(
    indexed.filter((x) => x.opt.viewer_extra_wait_min > 30 && x.opt.viewer_extra_wait_min <= 60)
  );

  if (leaveSoon) {
    nodes.push({
      id: 'leave-soon',
      tierLabel: 'Leave soon',
      waitMin: leaveSoon.opt.viewer_extra_wait_min,
      savingInr: leaveSoon.opt.viewer_saving_inr,
      isBaseline: false,
      isBest: false,
      originalIndex: leaveSoon.originalIndex,
      membersCount: leaveSoon.opt.members.length,
    });
  }

  if (littleLater) {
    nodes.push({
      id: 'little-later',
      tierLabel: 'A little later',
      waitMin: littleLater.opt.viewer_extra_wait_min,
      savingInr: littleLater.opt.viewer_saving_inr,
      isBaseline: false,
      isBest: false,
      originalIndex: littleLater.originalIndex,
      membersCount: littleLater.opt.members.length,
    });
  }

  if (waitMore) {
    nodes.push({
      id: 'wait-more',
      tierLabel: 'Wait to save more',
      waitMin: waitMore.opt.viewer_extra_wait_min,
      savingInr: waitMore.opt.viewer_saving_inr,
      isBaseline: false,
      isBest: false,
      originalIndex: waitMore.originalIndex,
      membersCount: waitMore.opt.members.length,
    });
  }

  // Find the single best non-baseline node (highest saving)
  const nonBaselines = nodes.filter((n) => !n.isBaseline);
  if (nonBaselines.length > 0) {
    let bestNode = nonBaselines[0];
    for (const n of nonBaselines) {
      if (n.savingInr > bestNode.savingInr) {
        bestNode = n;
      }
    }
    bestNode.isBest = true;
  }

  return nodes;
}

/** Groups "other options" under the same three wait bands the chart used. */
export function waitBandLabel(waitMin: number): string {
  if (waitMin <= 15) return 'Leave soon';
  if (waitMin <= 30) return 'A little later';
  return 'Wait to save more';
}

export function parseWaveMinutes(label: string): number {
  const clean = label.toLowerCase();
  const matches = [...clean.matchAll(/(\d{1,2}):(\d{2})\s*(am|pm)?/g)];
  if (matches.length === 0) return 0;

  const first = matches[0];
  let h = parseInt(first[1], 10);
  const m = parseInt(first[2], 10);

  let meridiem = first[3];
  if (!meridiem) {
    if (matches.length > 1 && matches[1][3]) {
      meridiem = matches[1][3];
    } else if (clean.includes('pm')) {
      meridiem = 'pm';
    } else if (clean.includes('am')) {
      meridiem = 'am';
    }
  }

  if (meridiem === 'pm' && h < 12) h += 12;
  if (meridiem === 'am' && h === 12) h = 0;
  return h * 60 + m;
}
