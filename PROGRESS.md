# Estado del proyecto

Documento vivo para retomar el trabajo en frío. Plan detallado en `docs/PLAN.md`.

## Hitos

| Hito | Estado |
|---|---|
| H0 · Cimientos | ✅ Cerrado |
| H1 · Ecosistema headless | ⏳ Siguiente |
| H2 · Verlo | — |
| H3 · Jugarlo (un jugador) | — |
| H4 · Multijugador LAN | — |
| H5 · Gran Intercambio | — |
| H6 · Bots y equilibrio | — |
| H7 · Revelación y pulido | — |

## Hecho

### H0 · Cimientos
- Monorepo pnpm con `sim`, `protocol`, `game`, `server` y `client`. TypeScript 6 estricto; ESLint con reglas de determinismo y de fronteras entre paquetes; Vitest con proyectos `fast` y `slow`.
- `sim`: RNG `sfc32` con flujos con nombre (`Rng.fork`), hash de estado FNV-1a, modelo de tiempo (año de 400 ticks, estaciones, noche) y esqueleto `ParcelSim` de paso fijo.
- Runner headless `pnpm sim:run`.
- Tests: distribución y reproducibilidad del RNG; determinismo (misma semilla → mismo hash; semilla distinta → hash distinto).

**Cómo probarlo:** `pnpm install && pnpm test && pnpm lint && pnpm typecheck`; después `pnpm sim:run --seed prueba --ticks 4000` dos veces: el hash coincide.

## En curso

Nada a medias.

## Siguiente paso concreto

H1: sustituir los caminantes de `packages/sim/src/parcel.ts` por el ecosistema real. Orden: terreno → vegetación y clima → almacén de organismos y rejilla espacial → genética y fenotipo → energía y muerte → conducta → reproducción → interacciones → estadísticas → experimentos de selección.

## Problemas conocidos

Ninguno.
