export function getTimeGreeting(hour: number): string {
  const period = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';
  return `Good ${period}, Highlander!`;
}

interface TextSmootherOptions {
  reducedMotion?: boolean;
  schedule?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

// Pace provider bursts across animation frames, speeding up when text queues up.
export function createTextSmoother(onText: (text: string) => void, options: TextSmootherOptions = {}) {
  const schedule = options.schedule ?? requestAnimationFrame;
  const cancelFrame = options.cancelFrame ?? cancelAnimationFrame;
  let pending: string[] = [];
  let displayed = '';
  let frame: number | null = null;
  let previousTime: number | null = null;
  let credit = 0;
  let cancelled = false;
  let waiters: Array<() => void> = [];

  function settled() {
    const callbacks = waiters;
    waiters = [];
    callbacks.forEach((resolve) => resolve());
  }

  function tick(time: number) {
    frame = null;
    if (cancelled) return;
    const elapsed = previousTime === null ? 16 : Math.min(64, Math.max(0, time - previousTime));
    previousTime = time;
    credit += elapsed * Math.max(75, pending.length / 0.18) / 1000;
    const count = Math.min(pending.length, Math.floor(credit));
    if (count > 0) {
      displayed += pending.splice(0, count).join('');
      credit -= count;
      onText(displayed);
    }
    if (pending.length) {
      frame = schedule(tick);
    } else {
      previousTime = null;
      credit = 0;
      settled();
    }
  }

  return {
    append(text: string) {
      if (cancelled || !text) return;
      if (options.reducedMotion) {
        displayed += text;
        onText(displayed);
        return;
      }
      pending.push(...Array.from(text));
      if (frame === null) frame = schedule(tick);
    },
    finish(): Promise<void> {
      return pending.length && !cancelled ? new Promise((resolve) => waiters.push(resolve)) : Promise.resolve();
    },
    cancel() {
      cancelled = true;
      if (frame !== null) cancelFrame(frame);
      frame = null;
      pending = [];
      settled();
    },
  };
}

export interface ClubLink {
  channel: string;
  label: string;
  description: string;
  url: string;
}

// Collect link cards from show_club_links results, ignoring malformed entries and unsafe URLs.
export function getClubLinks(toolsUsed: Array<{ name: string; result?: unknown }> = []): ClubLink[] {
  const links = new Map<string, ClubLink>();
  for (const tool of toolsUsed) {
    if (tool.name !== 'show_club_links') continue;
    const entries = (tool.result as { links?: unknown } | undefined)?.links;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const { channel, label, description, url } = (entry ?? {}) as Record<string, unknown>;
      if ([channel, label, description, url].every((value) => typeof value === 'string') && /^(https:\/\/|mailto:)/.test(url as string)) {
        links.set(channel as string, { channel, label, description, url } as ClubLink);
      }
    }
  }
  return [...links.values()];
}

export interface EboardCard {
  name: string;
  role: string;
  photo: string | null;
}

// Collect e-board cards from show_eboard results. Photos must be local files in public/eboardpics.
export function getEboardCards(toolsUsed: Array<{ name: string; result?: unknown }> = []): EboardCard[] {
  const cards = new Map<string, EboardCard>();
  for (const tool of toolsUsed) {
    if (tool.name !== 'show_eboard') continue;
    const entries = (tool.result as { members?: unknown } | undefined)?.members;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const { name, role, photo } = (entry ?? {}) as Record<string, unknown>;
      if (typeof name !== 'string' || typeof role !== 'string') continue;
      const safePhoto = typeof photo === 'string' && /^\/eboardpics\/[\w.-]+$/.test(photo) ? photo : null;
      cards.set(name, { name, role, photo: safePhoto });
    }
  }
  return [...cards.values()];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase();
}

type DisplayTools = Array<{ name: string; result?: unknown }>;

export function hasDisplayedCards(toolsUsed: DisplayTools = []): boolean {
  return getEboardCards(toolsUsed).length > 0 || getClubLinks(toolsUsed).length > 0;
}

// Copying a reply includes what its cards show, since the text no longer repeats it.
export function getCopyText(content: string, toolsUsed: DisplayTools = []): string {
  const cards = [
    ...getEboardCards(toolsUsed).map((member) => `${member.name} · ${member.role}`),
    ...getClubLinks(toolsUsed).map((link) => `${link.label}: ${link.url.replace(/^mailto:/, '')}`),
  ];
  return [content.trim(), cards.join('\n')].filter(Boolean).join('\n\n');
}
