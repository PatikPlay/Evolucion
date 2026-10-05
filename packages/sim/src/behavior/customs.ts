import { T } from '../genetics/traits';
import { Act } from './actions';

/** Collective customs a player sets each round. They bias behaviour; genetics decides how well it is followed. */
export const enum Custom {
  None = 0,
  Explore,
  Expand,
  Group,
  Defend,
  Hoard,
  Hide,
  CareYoung,
  Migrate,
  PackHunt,
}

export const CUSTOM_KEYS = ['none', 'explore', 'expand', 'group', 'defend', 'hoard', 'hide', 'careYoung', 'migrate', 'packHunt'] as const;

export interface CustomDef {
  readonly key: (typeof CUSTOM_KEYS)[number];
  /** Utility multipliers at full plasticity. */
  readonly boost: ReadonlyArray<readonly [Act, number]>;
  /** Innate traits that make the custom natural (Baldwin effect); [trait, sign]. */
  readonly innate: ReadonlyArray<readonly [T, 1 | -1]>;
}

export const CUSTOMS: readonly CustomDef[] = [
  { key: 'none', boost: [], innate: [] },
  { key: 'explore', boost: [[Act.Explore, 3]], innate: [[T.Curiosity, 1]] },
  { key: 'expand', boost: [[Act.Explore, 2.2]], innate: [[T.Curiosity, 1], [T.Territoriality, -1]] },
  { key: 'group', boost: [[Act.FollowGroup, 2.6]], innate: [[T.Sociability, 1]] },
  { key: 'defend', boost: [[Act.Defend, 2.5]], innate: [[T.Territoriality, 1], [T.Aggression, 1]] },
  { key: 'hoard', boost: [[Act.Graze, 1.3], [Act.Store, 2]], innate: [[T.FatReserves, 1]] },
  { key: 'hide', boost: [[Act.Hide, 2.6], [Act.Flee, 1.2]], innate: [[T.Fear, 1]] },
  { key: 'careYoung', boost: [[Act.CareYoung, 2.6]], innate: [[T.ParentalCare, 1]] },
  { key: 'migrate', boost: [[Act.Migrate, 3]], innate: [[T.Curiosity, 1]] },
  { key: 'packHunt', boost: [[Act.Hunt, 1.6], [Act.FollowGroup, 1.4]], innate: [[T.Sociability, 1], [T.Aggression, 1]] },
];
