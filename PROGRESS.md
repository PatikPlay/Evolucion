# Estado del proyecto

Documento vivo para retomar el trabajo en frío. Plan detallado en `docs/PLAN.md`; decisiones en `docs/DECISIONS.md`.

## Hitos

| Hito | Estado |
|---|---|
| H0 · Cimientos | ✅ Cerrado |
| H1 · Ecosistema headless | ✅ Cerrado |
| H2 · Verlo | ✅ Cerrado |
| H3 · Jugarlo (un jugador) | ⏳ Siguiente |
| H4 · Multijugador LAN | — |
| H5 · Gran Intercambio | — |
| H6 · Bots y equilibrio | — |
| H7 · Revelación y pulido | — |

## Hecho

### H0 · Cimientos
- Monorepo pnpm (`sim`, `protocol`, `game`, `server`, `client`), TypeScript 6 estricto, ESLint con reglas de determinismo y fronteras, Vitest con proyectos `fast` y `slow`.
- RNG `sfc32` con flujos con nombre, hash de estado, modelo de tiempo, runner headless.

**Cómo probarlo:** `pnpm install && pnpm test && pnpm lint && pnpm typecheck`.

### H1 · Un ecosistema que evoluciona (headless)
- Mundo: terreno procedural (biomas, lagos, río, estanques), clima estacional con noche, vegetación con rebrote desde reservas, fruto estacional, fauna de fondo como campos de densidad, depredación ambiental, carroña. Parcelas normalizadas por valor alimenticio.
- Organismos (estructura de arrays): genoma diploide de 71 loci (aditivos, pleiotrópicos, latentes, crípticos con canalización, de reconocimiento) + 64 loci recesivos deletéreos; fenotipo de 50 rasgos; desarrollo con nutrición juvenil; capacidades emergentes.
- Conducta con IA de utilidad (comer, beber, huir, cazar, forrajear, carroñear, cortejar, grupo, defender, cuidar crías, esconderse, cavar, almacenar, migrar, hibernar), costumbres con efecto Baldwin, dispersión natal con selección de hábitat, evitación de parientes.
- Reproducción sexual con elección de pareja, compatibilidad por reconocimiento + aspecto, gestación y camadas; depredación (acecho, persecución, captura, toxinas y aversión aprendida), combate, enfermedades por contacto.
- Estadísticas ocultas por especie, momentos clave (primera capacidad, macromutante, caza en grupo, muerte masiva).
- Experimentos de selección (`pnpm test:slow`, 20 semillas cada uno): (a) depredadores rápidos → velocidad, (b) frío → tolerancia, (c) deriva neutra sin tendencia, (d) cuello de botella → menos diversidad y afloramiento de recesivos. Todos ≥ 80 % (última ejecución: a 18/20, b 18/20, c y d aprobados). Estabilidad: 50 generaciones sin NaN, memoria acotada, población estabilizada.
- Benchmark: 10,1 s por ronda (4000 ticks) con 1500 organismos (objetivo < 25 s).

**Cómo probarlo:**
1. `pnpm sim:run --seed prueba --years 15` muestra el censo anual (población, masa, velocidad, causas de muerte, dieta).
2. `pnpm test:slow` ejecuta los experimentos de selección (≈ 15 min).
3. `pnpm sim:bench` mide el rendimiento.

Herramientas de afinado: `packages/sim/scripts/tune.sh <años> '<config json>'` y `packages/sim/scripts/experiment.sh <a|b|c|d> <semillas>`.

### H2 · Verlo
- `protocol`: definiciones visuales cuantizadas (18 parámetros visibles a 16 niveles), codec binario de fotogramas, terreno, vegetación y fauna; validador de lista blanca de mensajes y lista de claves prohibidas.
- `game/view`: proyección visual de cada criatura, banderas de estado visibles, ficha de campo cualitativa (claves i18n, sin números).
- Servidor de desarrollo (`pnpm dev`): sesión «en directo» de una parcela con escenarios (sin presión, depredadores, frío), velocidad variable, inspección; todo mensaje pasa por la lista blanca; overlay de depuración solo con `LINAJE_DEBUG=1`.
- Cliente PixiJS + Preact: terreno en acuarela, vegetación y fruto, fauna ambiental, criaturas procedurales (cabeza, patas, cola, aletas, membranas, coraza, espinas, pelaje, manchas, rayas, ojos) con caché acotada de texturas por plan corporal y color por tinte, animación según la conducta, interpolación entre fotogramas, cámara (arrastrar, rueda, flechas, `0`), seguir e inspeccionar con retrato.
- Simulación: reglas de Bergmann y Allen en el confort térmico (el pelaje, el tamaño y las extremidades son las palancas visibles del frío).
- Tests: información oculta por WebSocket (servidor real); Playwright (`pnpm test:e2e`) con capturas de 3 semillas (poblaciones claramente distintas), antes/después de 32 años de depredación (patas +3 niveles) y benchmark de 2000 criaturas (1,7 ms de CPU por fotograma; los fps de CI son de renderizado por software).

**Cómo probarlo:**
1. `pnpm dev` y abre `http://localhost:5173/?seed=prueba&years=3`: verás la parcela en directo; rueda para acercar, clic en una criatura para su ficha, «Seguir» para acompañarla.
2. `LINAJE_DEBUG=1 pnpm dev` y pulsa `d` en el visor: overlay con los datos ocultos (solo desarrollo).
3. `pnpm test:e2e` genera las capturas en `packages/client/screenshots/`.

## Siguiente paso concreto
H3: máquina de estados de la partida en `game` (fundadores → rondas de decisión y simulación), Influencia, catálogo data-driven de acciones con sus comandos de simulación, costumbres, cuaderno de campo con observaciones estructuradas, momentos clave con clips, director de eventos, invasores, relevo de linaje, remanente latente y radiación adaptativa; y en el cliente, la interfaz de una partida de un jugador.

## Problemas conocidos
- La capacidad real de las parcelas varía (≈ 450–2500 individuos en equilibrio según el mapa) aunque la productividad esté normalizada: hay que calibrar empíricamente al crear la partida (antes de H5).
- Algunas plantillas fundadoras aleatorias se extinguen en ciertas parcelas: equilibrar en H3/H6.
