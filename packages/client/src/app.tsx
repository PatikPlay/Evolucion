import { useEffect, useRef, useState } from 'preact/hooks';
import { ANIM_KEYS, type InspectMsg, type SpeciesView } from '@linaje/protocol';
import { Connection } from './net/connection';
import { WorldView } from './world/stage';
import { Store, useStore } from './state/store';
import { t } from './i18n/es';
import { CreaturePortrait } from './ui/CreaturePortrait';

interface AppState {
  connected: boolean;
  debug: boolean;
  showDebug: boolean;
  loading: boolean;
  ready: boolean;
  tick: number;
  season: number;
  year: number;
  night: boolean;
  speed: number;
  species: SpeciesView[];
  selected: number | null;
  following: boolean;
  card: InspectMsg | null;
  debugSpecies: unknown;
  debugOrganism: unknown;
  creatures: number;
  fps: number;
}

const params = new URLSearchParams(location.search);

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const [store] = useState(
    () =>
      new Store<AppState>({
        connected: false,
        debug: false,
        showDebug: params.get('debug') === '1',
        loading: false,
        ready: false,
        tick: 0,
        season: 0,
        year: 0,
        night: false,
        speed: 20,
        species: [],
        selected: null,
        following: false,
        card: null,
        debugSpecies: null,
        debugOrganism: null,
        creatures: 0,
        fps: 60,
      }),
  );
  const [world] = useState(() => new WorldView());
  const [conn, setConn] = useState<Connection | null>(null);
  const s = useStore(store, (x) => x);

  useEffect(() => {
    let alive = true;
    void world.init(host.current as HTMLDivElement).then(() => {
      if (!alive) return;
      const c = new Connection({
        onStatus: (connected) => store.set({ connected }),
        onMessage: (m) => {
          switch (m.t) {
            case 'welcome':
              store.set({ debug: m.debug });
              if (params.get('seed')) {
                store.set({ loading: true });
                c.send({
                  t: 'spectate',
                  seed: params.get('seed') as string,
                  years: Number(params.get('years') ?? 2),
                  scenario: (params.get('scenario') as 'none' | 'predators' | 'cold') ?? 'none',
                });
              }
              break;
            case 'clock':
              world.setNight(m.night);
              store.set({
                tick: m.tick,
                season: m.season,
                year: m.year,
                night: m.night,
                speed: m.speed,
              });
              break;
            case 'creatures':
              world.creatures.setDefs(m.defs);
              break;
            case 'species':
              store.set({ species: m.list });
              break;
            case 'inspect':
              store.set({ card: m });
              break;
            case 'debug':
              if (m.kind === 'species') store.set({ debugSpecies: m.data });
              else store.set({ debugOrganism: m.data });
              break;
            default:
              break;
          }
        },
        onFrame: (f) => {
          world.onFrame(f);
          if (!store.get().ready && world.creatures.count > 0) {
            store.set({ ready: true, loading: false });
            document.body.dataset.ready = '1';
          }
        },
        onTerrain: (tg) => world.setTerrain(tg),
        onVegetation: (v) => world.setVegetation(v),
        onFauna: (f) => world.setFauna(f),
      });
      c.connect();
      setConn(c);
      // Test hook: only visible data the client already has.
      (window as unknown as { __linaje: unknown }).__linaje = {
        focusPopulation: (zoom = 4) => {
          const pts = world.creatures.allPositions();
          if (pts.length === 0) return;
          // Densest neighbourhood: the creature with most others nearby.
          let best = pts[0] as { x: number; y: number };
          let bestN = -1;
          for (const p of pts.slice(0, 300)) {
            const n = pts.filter((q) => Math.abs(q.x - p.x) < 6 && Math.abs(q.y - p.y) < 6).length;
            if (n > bestN) {
              bestN = n;
              best = p;
            }
          }
          world.lookAt(best.x, best.y, zoom);
        },
        visualMeans: () => world.creatures.visualMeans(),
      };
      world.onPick = (id) => {
        store.set({ selected: id, following: false, card: null, debugOrganism: null });
        world.follow(null);
        if (id !== null) c.send({ t: 'inspect', id });
      };
    });
    const iv = setInterval(
      () => store.set({ creatures: world.creatures.count, fps: Math.round(world.fps) }),
      500,
    );
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'd' && store.get().debug) store.set({ showDebug: !store.get().showDebug });
    };
    window.addEventListener('keydown', key);
    return () => {
      alive = false;
      clearInterval(iv);
      window.removeEventListener('keydown', key);
    };
  }, []);

  // Keep the field card fresh while it is open.
  useEffect(() => {
    if (s.selected === null || !conn) return;
    const iv = setInterval(() => conn.send({ t: 'inspect', id: s.selected as number }), 1500);
    return () => clearInterval(iv);
  }, [s.selected, conn]);

  const def = s.selected !== null ? world.creatures.defOf(s.selected) : null;
  const anim = s.selected !== null ? world.creatures.animOf(s.selected) : null;
  const speciesName = (id: number) => s.species.find((x) => x.id === id)?.name ?? '';

  return (
    <div class="app">
      <div class="world" ref={host} />
      <Viewer conn={conn} store={store} />
      <div class="clock" data-testid="clock">
        <strong>{t.seasons[s.season]}</strong> · {t.year} {s.year + 1} · {s.night ? t.night : t.day}
      </div>
      {!s.connected && <div class="toast">{t.errors.disconnected}</div>}
      {s.loading && <div class="toast">{t.viewer.loading}</div>}
      {s.selected !== null && (
        <aside class="card" data-testid="inspect-card">
          <h3>{t.inspect.title}</h3>
          {def && <CreaturePortrait def={def} />}
          {s.card && s.card.found ? (
            <>
              <p class="species">
                <em>{speciesName(s.card.species)}</em>
              </p>
              <p>
                {s.card.descriptors.map((d) => t.descriptors[d] ?? d).join(', ')}
                {anim !== null && `; ${t.anim[ANIM_KEYS[anim] ?? 'rest']}`}.
              </p>
            </>
          ) : s.card ? (
            <p>{t.inspect.gone}</p>
          ) : null}
          <div class="row">
            <button
              onClick={() => {
                const f = !s.following;
                store.set({ following: f });
                world.follow(f ? s.selected : null);
              }}
            >
              {s.following ? t.inspect.unfollow : t.inspect.follow}
            </button>
            <button
              onClick={() => {
                store.set({ selected: null, card: null, following: false });
                world.select(null);
                world.follow(null);
              }}
            >
              {t.inspect.close}
            </button>
          </div>
          {s.debug && s.showDebug && s.debugOrganism !== null && (
            <pre class="debug">{JSON.stringify(s.debugOrganism, null, 1)}</pre>
          )}
        </aside>
      )}
      {s.debug && s.showDebug && (
        <div class="debug-overlay" data-testid="debug-overlay">
          <strong>{t.debug.title}</strong> · fps {s.fps} · {s.creatures} criaturas
          <pre>{JSON.stringify(s.debugSpecies, null, 1)}</pre>
        </div>
      )}
    </div>
  );
}

function Viewer({ conn, store }: { conn: Connection | null; store: Store<AppState> }) {
  const [seed, setSeed] = useState(params.get('seed') ?? 'linaje');
  const [years, setYears] = useState(Number(params.get('years') ?? 2));
  const [scenario, setScenario] = useState<'none' | 'predators' | 'cold'>(
    (params.get('scenario') as 'none') ?? 'none',
  );
  const speed = useStore(store, (x) => x.speed);
  if (params.get('hideui') === '1') return null;
  return (
    <div class="viewer">
      <strong>{t.viewer.title}</strong>
      <label>
        {t.viewer.seed}{' '}
        <input value={seed} onInput={(e) => setSeed((e.target as HTMLInputElement).value)} />
      </label>
      <label>
        {t.viewer.years}{' '}
        <input
          type="number"
          min={0}
          max={60}
          value={years}
          onInput={(e) => setYears(Number((e.target as HTMLInputElement).value))}
        />
      </label>
      <label>
        {t.viewer.scenario}{' '}
        <select
          value={scenario}
          onChange={(e) => setScenario((e.target as HTMLSelectElement).value as 'none')}
        >
          {(['none', 'predators', 'cold'] as const).map((k) => (
            <option value={k}>{t.viewer.scenarios[k]}</option>
          ))}
        </select>
      </label>
      <button
        onClick={() => {
          store.set({ loading: true, ready: false, selected: null, card: null });
          conn?.send({ t: 'spectate', seed, years, scenario });
        }}
      >
        {t.viewer.start}
      </button>
      <div class="row">
        {t.viewer.speed}:
        {[0, 20, 80, 320].map((v) => (
          <button
            class={speed === v ? 'on' : ''}
            onClick={() => conn?.send({ t: 'speed', speed: v })}
          >
            {v === 0 ? t.viewer.pause : `×${v / 20}`}
          </button>
        ))}
      </div>
    </div>
  );
}
