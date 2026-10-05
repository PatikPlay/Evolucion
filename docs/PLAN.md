# Plan de trabajo

Los hitos son secuenciales. Cada uno se cierra cuando cumple sus criterios (§12 de la especificación), `pnpm test`, `pnpm typecheck` y `pnpm lint` están en verde, el proyecto se ejecuta, `PROGRESS.md` está al día y hay un commit de cierre.

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

## H0 · Cimientos

- [x] Monorepo pnpm (`packages/{sim,protocol,game,server,client}`), TypeScript estricto, `tsconfig` base.
- [x] ESLint (flat config, typescript-eslint) con reglas contra `Math.random`, `Date.now` y `performance.now` en `sim` y `game`.
- [x] Vitest con proyectos por paquete; separación entre tests rápidos (`pnpm test`) y experimentos lentos (`pnpm test:slow`).
- [x] RNG `sfc32` + `cyrb128`, flujos con nombre, tests de distribución y reproducibilidad.
- [x] Bucle de paso fijo (`Simulation.step()`), hash de estado (FNV-1a sobre los typed arrays).
- [x] Esqueleto del runner headless (`pnpm sim:run --seed --ticks`).
- [x] Test de determinismo (misma semilla → mismo hash; semilla distinta → hash distinto).
- [x] `CLAUDE.md`, `PROGRESS.md`, `docs/DECISIONS.md`.

## H1 · Un ecosistema que evoluciona (headless)

Interfaces primero: `sim` expone `createParcel(spec)`, `ParcelSim.step()`, `applyCommand()`, `stats`, `serialize()`.

- [x] Terreno procedural (ruido, biomas, agua, río) + normalización de capacidad (±10 %).
- [x] Vegetación logística (4 tipos), estaciones, clima por celda y noche.
- [x] Fauna de fondo (campos de densidad).
- [x] Almacén de organismos SoA con ranuras libres, rejilla espacial.
- [x] Genoma diploide, mapa genético (pleiotropía, latentes, crípticos, reconocimiento), deletéreos, mutación y macromutación.
- [x] Fenotipo y desarrollo; rasgos derivados.
- [x] Energía, sed, temperatura, salud, envejecimiento y causas de muerte.
- [x] IA de utilidad: percepción, acciones básicas (comer, beber, huir, cazar, carroñear, cortejar, descansar, explorar, grupo, esconderse) y movimiento.
- [x] Reproducción sexual, gestación, camadas, cuidado parental.
- [x] Depredación, combate, carroña, toxinas, aposematismo.
- [x] Enfermedades (cepas, contagio por densidad, inmunidad).
- [x] Generador de fundadores con presupuesto y plantillas NPC (depredador rápido para los experimentos).
- [x] Estadísticas ocultas por especie y registro de causas de muerte.
- [x] Experimentos de selección (a)–(d) sobre 20 semillas, ≥ 80 % aprobados.
- [x] Estabilidad: sin NaN ni crecimiento de memoria en 50 generaciones; población estable sin topes.
- [x] `pnpm sim:bench` con el objetivo de < 25 s por ronda y parcela de 1500.

## H2 · Verlo

- [x] Grabación en `sim`: fotogramas, definiciones visuales cuantizadas, estados de animación, búfer circular.
- [x] `protocol`: tipos de terreno, fotogramas y definiciones visuales; codec binario.
- [x] Servidor mínimo de desarrollo que simula una parcela y emite en directo.
- [x] Cliente: terreno en acuarela, vegetación, fauna ambiental, criaturas procedurales con caché de texturas y animación por estado.
- [x] Cámara (arrastrar, zoom), seguir e inspeccionar (ficha cualitativa).
- [x] Overlay de depuración solo con `LINAJE_DEBUG=1`.
- [x] Playwright: capturas de 3 semillas distintas; antes y después de 30 generaciones de presión.
- [x] Benchmark del cliente con 2000 criaturas (fps).

## H3 · Jugarlo (un jugador)

- [ ] `game`: máquina de estados de la partida (fundadores, rondas, fases), Influencia, `MatchLog`.
- [ ] Catálogo de acciones data-driven, ≥ 15 acciones con su efecto y su test.
- [ ] ≥ 6 costumbres con efecto Baldwin.
- [ ] Observaciones estructuradas → cuaderno (plantillas variadas, precisión según Estudio de campo, notas propias, fijar).
- [ ] Momentos clave con clips.
- [ ] Director de eventos y ≥ 10 eventos.
- [ ] Capacidades emergentes y desbloqueos.
- [ ] Especiación, nombres pseudolatinos, árbol.
- [ ] Invasores NPC, relevo de linaje, remanente latente y radiación adaptativa.
- [ ] Cliente: HUD, panel de acciones, cuaderno, momentos, elección de fundadores, partida de un jugador completa.
- [ ] Tests de veracidad del cuaderno con escenarios controlados.

## H4 · Multijugador en LAN

- [ ] Servidor autoritativo con lobby (nombres, colores, listo, ajustes, bots), QR y URL.
- [ ] Turnos simultáneos con temporizador; fin anticipado si todos confirman.
- [ ] `WorkerParcelHost` (un worker por parcela) con resultados idénticos al proceso único.
- [ ] Filtrado por jugador + validador de lista blanca + test de claves prohibidas.
- [ ] Reconexión con token; bot de reemplazo configurable.
- [ ] E2E con Playwright: 3 clientes, 3 rondas, una reconexión.
- [ ] README: probar con dos ordenadores.

## H5 · El Gran Intercambio

- [ ] Disposición en anillo, corredores (tierra y agua), segmentos de sincronización y migración determinista.
- [ ] Visibilidad de individuos propios fuera de la parcela.
- [ ] Interacciones entre linajes (competencia, depredación, combate) y patógenos endémicos.
- [ ] Acciones de enfrentamiento (abrir o cerrar corredor, enviar colonizadores, fortificar).
- [ ] Puntuación de dominancia, fin de partida, modo Naturaleza.
- [ ] Partida headless de 4 bots completa; registros de desplazamientos y contagios.

## H6 · Bots y equilibrio

- [ ] Bots con estilos (agresivo, prudente, diversificador, observador, aleatorio, a ciegas) y oráculo.
- [ ] `pnpm sim:batch` en paralelo con informe JSON y Markdown.
- [ ] Ajuste de parámetros hasta cumplir §13; `docs/BALANCE.md` con ≥ 200 partidas.

## H7 · Revelación y pulido

- [ ] Pantalla final: árbol filogenético con datos, gráficas de rasgos, causas de muerte, eventos y decisiones con su efecto.
- [ ] Pistas de primera partida y partida rápida contra bots.
- [ ] Pulido visual y notificaciones jerarquizadas.
- [ ] README completo para jugar en LAN (incluido el cortafuegos).
- [ ] [EXTRA] Sonido, guardar y reanudar, tableta, ejecutable empaquetado.
