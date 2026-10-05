import { validate, type Schema } from './schema';
import { VISUAL_COUNT } from './visual';

/** Wire version; bump on incompatible changes. */
export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Server → client (JSON). Binary messages live in binary.ts.
// ---------------------------------------------------------------------------

export interface WelcomeMsg {
  t: 'welcome';
  protocol: number;
  clientId: string;
  token: string;
  /** True only when the server runs with LINAJE_DEBUG=1. */
  debug: boolean;
}

/** Layout of a parcel the client may draw. */
export interface ParcelMsg {
  t: 'parcel';
  parcel: number;
  width: number;
  height: number;
  /** World-space offset of the parcel (cells), for multi-parcel layouts. */
  ox: number;
  oy: number;
  /** Owner slot or 255 for none. */
  owner: number;
}

/** Drawing definitions of newly seen creatures: [id, species, owner, ...visual levels]. */
export interface CreaturesMsg {
  t: 'creatures';
  defs: number[][];
}

export interface SpeciesView {
  id: number;
  name: string;
  /** Owner slot (255 for NPC/wild species). */
  own: number;
  /** Parent species id, 0 for a root. */
  parent: number;
  extinct: boolean;
}

/** The shape of the phylogenetic tree and species names. Never any species statistics. */
export interface SpeciesMsg {
  t: 'species';
  list: SpeciesView[];
}

/** Qualitative field card of an individual: i18n keys, never numbers. */
export interface InspectMsg {
  t: 'inspect';
  id: number;
  found: boolean;
  species: number;
  descriptors: string[];
}

export interface ClockMsg {
  t: 'clock';
  tick: number;
  /** 0 spring, 1 summer, 2 autumn, 3 winter. */
  season: number;
  year: number;
  night: boolean;
  /** Playback speed in ticks per second (0 = paused). */
  speed: number;
}

export interface ErrorMsg {
  t: 'error';
  code: string;
  message: string;
}

export type ServerMessage =
  WelcomeMsg | ParcelMsg | CreaturesMsg | SpeciesMsg | InspectMsg | ClockMsg | ErrorMsg;

/** Development-only messages (LINAJE_DEBUG=1). Exempt from the whitelist, never sent otherwise. */
export interface DebugMsg {
  t: 'debug';
  kind: string;
  data: unknown;
}

const SERVER_SCHEMAS: Record<ServerMessage['t'], Schema> = {
  welcome: {
    object: {
      t: { literal: 'welcome' },
      protocol: 'integer',
      clientId: 'string',
      token: 'string',
      debug: 'boolean',
    },
  },
  parcel: {
    object: {
      t: { literal: 'parcel' },
      parcel: 'integer',
      width: 'integer',
      height: 'integer',
      ox: 'number',
      oy: 'number',
      owner: 'integer',
    },
  },
  creatures: {
    object: {
      t: { literal: 'creatures' },
      defs: { array: { array: 'integer', max: 3 + VISUAL_COUNT } },
    },
  },
  species: {
    object: {
      t: { literal: 'species' },
      list: {
        array: {
          object: {
            id: 'integer',
            name: 'string',
            own: 'integer',
            parent: 'integer',
            extinct: 'boolean',
          },
        },
      },
    },
  },
  inspect: {
    object: {
      t: { literal: 'inspect' },
      id: 'integer',
      found: 'boolean',
      species: 'integer',
      descriptors: { array: 'string', max: 16 },
    },
  },
  clock: {
    object: {
      t: { literal: 'clock' },
      tick: 'integer',
      season: 'integer',
      year: 'integer',
      night: 'boolean',
      speed: 'number',
    },
  },
  error: { object: { t: { literal: 'error' }, code: 'string', message: 'string' } },
};

/**
 * Throws unless `msg` is exactly an allowed server message. Every JSON message
 * the server sends goes through here.
 */
export function validateServerMessage(
  msg: unknown,
  opts: { debug?: boolean } = {},
): asserts msg is ServerMessage | DebugMsg {
  const t = (msg as { t?: unknown } | null)?.t;
  if (t === 'debug') {
    if (!opts.debug) throw new Error('debug message outside debug mode');
    return;
  }
  const schema = typeof t === 'string' ? SERVER_SCHEMAS[t as ServerMessage['t']] : undefined;
  if (!schema) throw new Error(`unknown server message ${String(t)}`);
  validate(msg, schema);
}

// ---------------------------------------------------------------------------
// Client → server (intentions only, never state).
// ---------------------------------------------------------------------------

export interface HelloMsg {
  t: 'hello';
  name: string;
  token?: string;
}

/** Development viewer: watch one parcel of a seed live. */
export interface SpectateMsg {
  t: 'spectate';
  seed: string;
  years: number;
  scenario: 'none' | 'predators' | 'cold';
}

export interface InspectRequestMsg {
  t: 'inspect';
  id: number;
}

export interface SpeedMsg {
  t: 'speed';
  speed: number;
}

export type ClientMessage = HelloMsg | SpectateMsg | InspectRequestMsg | SpeedMsg;

const CLIENT_SCHEMAS: Record<ClientMessage['t'], Schema> = {
  hello: {
    object: { t: { literal: 'hello' }, name: 'string', token: 'string' },
    optional: ['token'],
  },
  spectate: {
    object: {
      t: { literal: 'spectate' },
      seed: 'string',
      years: 'number',
      scenario: { enum: ['none', 'predators', 'cold'] },
    },
  },
  inspect: { object: { t: { literal: 'inspect' }, id: 'integer' } },
  speed: { object: { t: { literal: 'speed' }, speed: 'number' } },
};

/** Parses and validates a client message; returns null if invalid. */
export function parseClientMessage(text: string): ClientMessage | null {
  try {
    const msg = JSON.parse(text) as unknown;
    const t = (msg as { t?: unknown } | null)?.t;
    const schema = typeof t === 'string' ? CLIENT_SCHEMAS[t as ClientMessage['t']] : undefined;
    if (!schema) return null;
    validate(msg, schema);
    return msg as ClientMessage;
  } catch {
    return null;
  }
}

/**
 * Keys that must never appear in anything sent to a client before the final
 * reveal. Used by the end-to-end hidden-information test as a second line of
 * defence behind the whitelist.
 */
export const FORBIDDEN_KEYS: readonly string[] = [
  'genome',
  'alleles',
  'allele',
  'loci',
  'locus',
  'delet',
  'energy',
  'hydration',
  'health',
  'fatigue',
  'pheno',
  'phenotype',
  'derived',
  'traitMean',
  'traitSd',
  'diversity',
  'deleteriousLoad',
  'nightVision',
  'smell',
  'hearing',
  'metabolism',
  'coldTolerance',
  'heatTolerance',
  'fatReserves',
  'longevity',
  'waterEfficiency',
  'carnivory',
  'fiberDigestion',
  'plantToxinTolerance',
  'algaeDigestion',
  'toxinProduction',
  'toxinResistance',
  'immunityA',
  'immunityB',
  'immunityC',
  'immunityD',
  'aggression',
  'fear',
  'sociability',
  'curiosity',
  'territoriality',
  'nocturnality',
  'parentalCare',
  'brain',
  'growth',
  'litterSize',
  'investment',
  'prefConspicuous',
  'prefSize',
];

/** Recursively finds forbidden keys in a decoded JSON value. */
export function findForbiddenKeys(value: unknown, path = '$', out: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findForbiddenKeys(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.includes(k)) out.push(`${path}.${k}`);
      findForbiddenKeys(v, `${path}.${k}`, out);
    }
  }
  return out;
}
