# CLAUDE.md

Guía para trabajar en este repositorio. **Al empezar cualquier sesión:** lee `PROGRESS.md`, `docs/PLAN.md` y `git log --oneline -20` antes de tocar nada. La especificación original está en `docs/SPEC.md` (no se edita); el diseño consolidado, en `docs/DESIGN.md`; las decisiones, en `docs/DECISIONS.md`.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm install` | Instala dependencias (Node ≥ 22.12, pnpm 10) |
| `pnpm test` | Tests rápidos (proyecto `fast` de Vitest) |
| `pnpm test:slow` | Experimentos largos (`*.slow.test.ts`): selección natural, estabilidad |
| `pnpm typecheck` | `tsc` en todos los paquetes |
| `pnpm lint` | ESLint (incluye las reglas de determinismo y las fronteras entre paquetes) |
| `pnpm dev` | Servidor (tsx watch, puerto 8787) y cliente (Vite, puerto 5173) con recarga en caliente |
| `pnpm host` | Compila cliente y servidor y arranca la partida en la LAN |
| `pnpm sim:run --seed s --ticks n` | Runner headless de una parcela |
| `pnpm sim:bench` | Benchmark de la simulación |
| `pnpm sim:batch` | Partidas headless entre bots con informe |
| `pnpm test:e2e` | Playwright (cliente y extremo a extremo) |

Para ejecutar un solo test: `pnpm vitest run packages/sim/test/rng.test.ts`.

## Estructura

```
packages/sim       Simulación pura y determinista. Sin DOM, sin Node, sin reloj. No depende de nadie.
packages/protocol  Tipos de mensajes al cliente y codecs. Frontera de la información oculta. No depende de nadie.
packages/game      Reglas de la partida, proyección de vistas por jugador, cuaderno, bots. Depende de sim y protocol.
packages/server    Node + ws, autoridad, workers por parcela. Sirve el cliente compilado.
packages/client    Vite + PixiJS + Preact. Solo importa protocol.
docs/              SPEC (intocable), DESIGN, PLAN, DECISIONS, BALANCE
```

Los paquetes se consumen desde el código fuente (`exports` → `src/index.ts`); no hay paso de compilación entre ellos.

## Convenciones

- TypeScript estricto. Código, identificadores, comentarios y commits en inglés; textos de interfaz en español, centralizados en `packages/client/src/i18n/` y en los datos de contenido de `game`.
- **Determinismo:** en `sim` y `game` está prohibido `Math.random`, `Date.now`, `performance.now` y los temporizadores (lo impone el lint). Toda aleatoriedad sale de `Rng` con un flujo con nombre por subsistema (`rng.fork('genetics')`).
- **Información oculta:** nada que salga hacia un cliente puede contener genomas, energía, salud, rasgos ocultos ni estadísticas por especie hasta la revelación final. Todo mensaje saliente se valida contra las listas blancas de `protocol`.
- Parámetros de equilibrio: solo en los módulos `config/balance.ts` de `sim` y `game`, comentados.
- Contenido data-driven (rasgos, acciones, eventos, capacidades, plantillas del cuaderno): añadir algo es añadir una entrada de datos y registrar su función de efecto.
- Hot loops de `sim`: typed arrays, sin asignaciones de memoria por tick, sin closures por organismo.
- Tests con Vitest en `packages/*/test`. Los experimentos estadísticos largos van en `*.slow.test.ts`. Nunca se ajusta un test para que pase: si un experimento falla, el problema está en la simulación o en sus parámetros.
- Commits pequeños y descriptivos; uno al cerrar cada hito. Cada decisión de diseño relevante, en `docs/DECISIONS.md`.
- Al cerrar un hito: criterios cumplidos, `test` + `typecheck` + `lint` en verde, `PROGRESS.md` al día (con cómo probar lo nuevo en dos o tres pasos), commit.
