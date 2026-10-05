import { T } from '../genetics/traits';

/** A pathogen strain. Resistance comes from one of the four immunity traits. */
export interface Strain {
  readonly id: number;
  readonly key: string;
  /** Immunity trait that confers resistance. */
  readonly resistance: T;
  /** Infection probability per contact check with a fully susceptible neighbour. */
  readonly transmissibility: number;
  /** Health lost per tick by a fully susceptible host. */
  readonly virulence: number;
  /** Ticks until recovery. */
  readonly duration: number;
  /** Lineage this strain co-evolved with (endemic), or -1. */
  readonly endemicTo: number;
}

/** Strains are indexed by id; `infection` stores id + 1 (0 = healthy). Max 16 (immune bitmask). */
export class StrainRegistry {
  readonly list: Strain[] = [];

  add(s: Omit<Strain, 'id'>): Strain {
    if (this.list.length >= 16) throw new Error('Too many strains');
    const strain: Strain = { ...s, id: this.list.length };
    this.list.push(strain);
    return strain;
  }

  byKey(key: string): Strain | undefined {
    return this.list.find((s) => s.key === key);
  }

  get(id: number): Strain | undefined {
    return this.list[id];
  }
}

/** The mild endemic strain every parcel starts with: density-dependent regulation. */
export const ENDEMIC_STRAIN: Omit<Strain, 'id'> = {
  key: 'endemic',
  resistance: T.ImmunityA,
  transmissibility: 0.06,
  virulence: 0.0035,
  duration: 60,
  endemicTo: -1,
};

/** Strain archetypes used by events and actions. */
export const STRAIN_ARCHETYPES: Readonly<Record<string, Omit<Strain, 'id' | 'key' | 'endemicTo'>>> =
  {
    fever: { resistance: T.ImmunityB, transmissibility: 0.18, virulence: 0.01, duration: 50 },
    wasting: { resistance: T.ImmunityC, transmissibility: 0.1, virulence: 0.006, duration: 120 },
    plague: { resistance: T.ImmunityD, transmissibility: 0.25, virulence: 0.016, duration: 40 },
    mild: { resistance: T.ImmunityB, transmissibility: 0.2, virulence: 0.002, duration: 40 },
  };
