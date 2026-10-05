# Estado del proyecto

Documento vivo para retomar el trabajo en frío. Plan detallado en `docs/PLAN.md`; decisiones en `docs/DECISIONS.md`.

## Hitos

| Hito | Estado |
|---|---|
| H0 · Cimientos | ✅ Cerrado |
| H1 · Ecosistema headless | ✅ Cerrado |
| H2 · Verlo | ⏳ En curso |
| H3 · Jugarlo (un jugador) | — |
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

## En curso: H2 · Verlo
- Hecho: `protocol` (tipos visuales cuantizados, codec binario de fotogramas, terreno, vegetación y fauna; validador de lista blanca de mensajes), `game/view` (proyección visual, fichas cualitativas), servidor de desarrollo (`pnpm dev`) con sesión «en directo», cliente Pixi + Preact (terreno en acuarela, vegetación, fauna ambiental, criaturas procedurales con caché de texturas, animación según conducta, cámara, seguir, inspeccionar, overlay de depuración con `LINAJE_DEBUG=1`), test de información oculta por WebSocket.
- Playwright (`pnpm test:e2e`): las capturas de 3 semillas pasan (poblaciones claramente distintas).
- Pendiente: el cambio visible tras 30 generaciones de frío es pequeño (pelaje +1 nivel); el benchmark de 2000 criaturas genera demasiadas texturas distintas.

## Siguiente paso concreto
1. Reglas de Allen y Bergmann en el confort térmico (extremidades cortas y pelaje como palancas visibles del frío) y comprobar la captura antes/después.
2. Benchmark del cliente con poblaciones realistas (especies con variación individual) y límite de caché de texturas.
3. Cerrar H2 y empezar H3.

## Problemas conocidos
- La capacidad real de las parcelas varía (≈ 450–2500 individuos en equilibrio según el mapa) aunque la productividad esté normalizada: hay que calibrar empíricamente al crear la partida (antes de H5).
- Algunas plantillas fundadoras aleatorias se extinguen en ciertas parcelas: equilibrar en H3/H6.
