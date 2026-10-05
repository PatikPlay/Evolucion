# Linaje — diseño consolidado

Este documento concreta `docs/SPEC.md` con las decisiones del equipo de desarrollo. Donde no dice nada, manda la especificación. Las decisiones relevantes, con sus alternativas, están en `docs/DECISIONS.md`. Los números son valores iniciales: todos viven en el módulo de equilibrio (`packages/sim/src/config/balance.ts` y `packages/game/src/config/balance.ts`) y se ajustan en H6.

---

## 1. Arquitectura

```
packages/
  sim/       simulación pura y determinista (sin DOM, sin red, sin reloj)
  protocol/  tipos de los mensajes, codecs y la frontera de la información oculta
  game/      reglas de la partida sobre sim; produce vistas filtradas con tipos de protocol; bots
  server/    Node + ws; autoridad; workers por parcela; sirve el cliente compilado
  client/    Vite + PixiJS (mundo) + Preact (interfaz DOM)
```

Dependencias (sin ciclos):

```
sim ◄── game ◄── server
         │         │
protocol ◄┘◄───────┘◄── client (solo protocol)
```

- `protocol` no depende de nadie. Define **solo** lo que puede salir hacia un cliente. Cada mensaje servidor→cliente tiene un esquema estricto de lista blanca; el codec rechaza claves desconocidas. Ningún tipo de `protocol` tiene campos de genoma, energía, salud ni rasgos numéricos ocultos.
- `game` lee el estado oculto de `sim` y **proyecta** vistas por jugador (`projection/`), que son valores de tipos de `protocol`. También genera las observaciones estructuradas que alimentan el cuaderno y a los bots.
- Los bots viven en `game/src/bots` y reciben exactamente la misma vista proyectada que un humano (más las observaciones estructuradas que generan el cuaderno). El bot oráculo es la única excepción y está marcado como tal.
- `server` es transporte, temporizadores, conexiones y workers. No contiene reglas.
- `client` solo importa `protocol`. Es imposible que el bundle del cliente contenga código de `sim`.

### Ejecución de parcelas

`game` habla con las parcelas mediante la interfaz asíncrona `ParcelHost` (comandos → resultados). Hay dos implementaciones con el mismo código de simulación:

- `InProcessParcelHost`: tests, bots, lotes (`sim:batch`) y el visor.
- `WorkerParcelHost` (en `server`): un `worker_thread` por parcela.

Cada parcela se simula por separado. En el enfrentamiento la ronda se divide en **segmentos** de longitud fija (`SYNC_INTERVAL_TICKS`); al final de cada segmento cada parcela entrega sus emigrantes y `game` los reparte, en orden determinista (por parcela de origen y por id), a la parcela de destino, que los inserta al empezar el segmento siguiente. El resultado no depende de si las parcelas corren en hilos o en el mismo proceso.

## 2. Determinismo

- PRNG `sfc32` con semillas derivadas por hash (`cyrb128`) de una ruta: `seed / parcel / round / subsistema`. Flujos separados por subsistema (`terrain`, `genetics`, `behavior`, `ecology`, `events`, `founders`, `director`…), de modo que añadir una tirada en un subsistema no altera los demás.
- Paso fijo: todo se mide en **ticks**. Nada de `Math.random`, `Date.now` ni `performance.now` en `sim` y `game` (regla de lint).
- Orden de actualización fijo (índice de ranura). Las ranuras libres se reutilizan con una pila LIFO, que también es determinista.
- Una partida se reproduce a partir de `{semilla, ajustes, entradas por ronda}` (`MatchLog`). El visor re-simula en el servidor y emite la grabación; no hay simulación en el navegador, así que no dependemos de que dos motores JS calculen igual.
- Test H0: misma semilla + mismas entradas → mismo hash de estado tras N ticks; semilla distinta → hash distinto.

## 3. Escalas de tiempo

| Magnitud | Valor inicial |
|---|---|
| Tick | Unidad mínima de simulación |
| Año (ciclo de estaciones) | 400 ticks: primavera, verano, otoño e invierno de 100 ticks |
| Ronda | 10 años = 4000 ticks |
| Generación típica | ≈ 1 año (madurez 0,4–0,7 años; vida 2–5 años) → 8–15 generaciones por ronda |
| Reproducción «normal» | 20 ticks/s |
| Fase de simulación | ≈ 45 s: timelapse de los ticks 0–3700 en ≈ 30 s y los últimos 300 ticks a velocidad normal (15 s) |

Las especies de madurez lenta (grandes, de cerebro grande) tienen generaciones más largas y, por tanto, menos generaciones por ronda: el compromiso emerge sin reglas especiales.

## 4. Mundo

### 4.1 Parcela

- Rejilla de 96×96 celdas (configurable: 64, 96 o 128). Los organismos se mueven de forma continua en coordenadas de celda (`x`, `y` en `[0, 96)`).
- Generación procedural con ruido de valor fractal sembrado: elevación, humedad y una red de agua (un lago o una laguna y, con probabilidad, un río que baja por el gradiente de elevación).
- Biomas: pradera, bosque, matorral, arena, roca, agua somera y agua profunda. Por celda: bioma, elevación, humedad, temperatura base (por elevación), fertilidad, cobertura y biomasa vegetal por tipo.
- **Equivalencia ecológica:** tras generar, se estima la productividad anual total (suma de capacidades de cada tipo de planta ponderada por su valor nutritivo) y se escala la fertilidad para que todas las parcelas queden a ±3 % del objetivo (la especificación pide ±10 %). Test que lo comprueba.

### 4.2 Vegetación

Cuatro tipos con crecimiento logístico por celda: `dB = r·f(estación, T, humedad)·B·(1 − B/K)` más una pequeña siembra natural desde celdas vecinas para que nada se quede a cero para siempre.

| Tipo | Dónde | Comida | Matiz |
|---|---|---|---|
| Pasto | Pradera, matorral | Hojas: mucha fibra | Rebrota rápido |
| Arbusto con fruto | Matorral, borde de bosque | Fruto estacional (verano-otoño), algo tóxico | Las variedades espinosas protegen y pinchan |
| Árbol | Bosque | Hojas altas (fibra; se alcanzan trepando o con mucho tamaño) y frutos | Cobertura, refugio arbóreo |
| Algas | Agua somera y profunda | Blandas, nutritivas | Solo para nadadores o en la orilla |

El crecimiento se actualiza por bloques escalonados (cada celda cada 8 ticks) para abaratar el coste.

### 4.3 Clima y estaciones

Temperatura de celda = base del bioma + elevación + onda estacional + anomalía de eventos. Humedad con onda estacional suave. Noche y día: un ciclo diario de 8 ticks sería demasiado rápido para verse, así que la «noche» es una fase de 20 ticks cada 40 (5 noches por estación). La nocturnidad, la visión nocturna y los depredadores diurnos se apoyan en ella.

### 4.4 Fauna de fondo

Modelo poblacional por celda (no individual): densidad de insectos (ligada a pasto y arbustos), pequeños herbívoros (pasto y cobertura) y peces (agua). Crecimiento logístico ligado a la vegetación; los organismos que cazan presas pequeñas consumen de esa densidad. El cliente la dibuja como fauna ambiental (motas, siluetas pequeñas y peces) según la densidad, sin individuos persistentes. «Introducir una presa» y la plaga de insectos actúan sobre estos campos.

### 4.5 Modificaciones del terreno

Capa por celda: barrera (seto o zanja: impasable salvo para quien planea o, en la zanja, para quien excava o nada), refugio (rocas o cuevas), charca creada, quemado (rebrote fértil), siembra pendiente y zonas de experimento (recinto aislado).

## 5. Genética

### 5.1 Genoma

- **Diploide.** 72 loci de valor continuo (dos alelos `Float32` por locus, centrados en 0, rango útil ≈ ±2) + 24 loci bialélicos de **recesivos deletéreos** (dos máscaras de bits por individuo).
- **Mapa genético data-driven** (`sim/src/genetics/genome-map.ts`): cada locus contribuye a uno o varios rasgos con un peso. Tipos de locus:
  - *Aditivos específicos*: varios por rasgo (rasgos poligénicos).
  - *Pleiotrópicos*: `growth` (+tamaño, +edad de madurez), `neuralCrest` (−miedo, −agresividad, +manchas, +colas cortas: el «síndrome de domesticación» de Beliáyev), `metabolism` (+tasa metabólica, +velocidad, −longevidad), `pigment` (+coloración llamativa, +producción de toxinas), `bone` (+fuerza de patas, +coraza, −velocidad), `neural` (+cerebro, +curiosidad, +madurez tardía)…
  - *Latentes*: contribuyen a rasgos que solo importan en condiciones que al principio no se dan (eficiencia hídrica, digestión de algas, resistencia a ciertas cepas, tolerancia a toxinas de plantas que no hay, tolerancia a la sal). Son neutros, derivan, y si cambia el entorno ya hay variación (preadaptación).
  - *Crípticos*: su efecto sobre rasgos visibles se multiplica por un factor de canalización (0,15 en condiciones normales). Acumulan variación casi neutra que aflora (factor 1) durante la radiación adaptativa.
  - *Reconocimiento de pareja*: 6 loci neutros con mutación algo más alta. Determinan la compatibilidad reproductiva y permiten la especiación.
- **Expresión:** valor de locus = media de alelos (aditivo) o, en los loci con dominancia, `h·max + (1−h)·min`. Rasgo = `sigmoide(base + Σ pesos·valores)` reescalado al rango del rasgo.
- **Deletéreos:** cada locus deletéreo homocigoto resta viabilidad (salud máxima, fertilidad y supervivencia juvenil). Frecuencia inicial ≈ 5 % por locus: casi nunca se expresan en una población grande; tras un cuello de botella, la homocigosis sube sola. La depresión endogámica emerge sin reglas especiales.

### 5.2 Herencia y mutación

- Mendeliana: un alelo al azar de cada progenitor por locus (loci independientes; sin ligamiento en esta versión).
- Mutación: probabilidad 0,004 por alelo y nacimiento, salto gaussiano σ = 0,25. Los loci de reconocimiento mutan ×3. Los deletéreos: 0,0005 de 0→1.
- **Macromutación** (≈ 1 de cada 1500 nacimientos): un alelo salta ±1,8 en un locus de morfología o apariencia (aparecen aletas, membranas, albinismo…). Genera un momento clave si cruza un umbral visible.
- Radiación adaptativa: mutación ×2 y canalización desactivada durante dos rondas.

## 6. Fenotipo

Rasgos (todos en `[0, 1]` salvo indicación; la tabla completa con loci está en el código):

- **Morfología:** masa adulta (escala logarítmica, 0,3–40 «kg»), alargamiento, longitud de patas, número de patas (0, 2, 4 o 6 por umbrales), fuerza de patas, prensilidad, aletas, membranas, coraza, espinas, cola, pelaje (aislamiento).
- **Apariencia:** tono, luminosidad, llamatividad, manchas, rayas.
- **Sentidos:** tamaño de ojos, visión nocturna, olfato, oído.
- **Fisiología:** tasa metabólica (0,6–1,5), tolerancia al frío, tolerancia al calor, reservas de grasa, longevidad, eficiencia hídrica.
- **Dieta:** carnivoría, digestión de fibra, tolerancia a toxinas vegetales, digestión de algas (latente).
- **Defensa química:** producción de toxinas, resistencia a toxinas.
- **Inmunidad:** resistencia a 4 cepas.
- **Conducta:** agresividad, miedo, sociabilidad, curiosidad, territorialidad, nocturnidad, cuidado parental.
- **Cognición:** cerebro.
- **Reproducción:** edad de madurez (derivada), tamaño de camada (1–8), inversión por cría, preferencia por llamatividad, preferencia por tamaño.

**Derivados:** velocidad máxima (patas, número de patas, masa, coraza, metabolismo, aletas en tierra), fuerza (masa, patas, agresividad), alcance de percepción (ojos, olfato, oído, nocturnidad×noche), visibilidad (tamaño, llamatividad, contraste con el terreno, movimiento), coste de mantenimiento.

**Desarrollo:** la masa adulta real es `masa genética × (0,7 + 0,3·nutrición juvenil)`. Los juveniles crecen hasta la madurez. Las crías mal alimentadas son adultos pequeños, y eso se ve.

**Aprendizaje** (si el cerebro lo permite): memoria de lugares (último buen sitio de comida y de agua, refugio), aversión aprendida a presas tóxicas, y sensibilidad a la costumbre activa.

## 7. Energía

- Metabolismo basal por tick: `k_b · masa^0,75 · tasa · (1 + c_cerebro·cerebro + c_coraza·coraza + c_toxinas·toxinas + c_espinas·espinas + c_pelaje·pelaje·calor)`.
- Movimiento: `k_m · masa · (v/v_max)² · v_max` (correr es caro).
- Termorregulación: fuera de la zona de confort (determinada por las tolerancias y el pelaje) se paga energía y, si es extremo, salud. Refugios, madrigueras, cobertura y apiñarse (sociabilidad + vecinos cerca) lo atenúan.
- Reserva máxima: `masa · (2 + 6·grasa)`. Los grandes aguantan más sin comer (∝ masa^0,25).
- Sed: hidratación que baja con el calor y la actividad, atenuada por la eficiencia hídrica; se bebe junto al agua y algo se obtiene del fruto.
- Digestión: eficiencia por tipo de comida según carnivoría, fibra, toxinas y algas. Un herbívoro saca poco de la carne y un carnívoro, poco del pasto.
- **No hay topes de población.** La capacidad de carga emerge de la comida. Salvaguarda: la transmisión de enfermedades crece con la densidad local.

## 8. Conducta: IA de utilidad

Cada organismo reevalúa cada 6 ticks (desfasado por id). Percibe hasta 10 vecinos relevantes en su radio (rejilla espacial de 4×4 celdas) y una muestra de celdas para comida, agua y refugio. Puntúa:

comer (planta), beber, huir, cazar (organismos o fauna pequeña), carroñear, cortejar/aparearse, descansar, explorar, seguir al grupo, defender territorio, cuidar crías, esconderse, cavar, almacenar, migrar.

Cada utilidad es una curva de respuesta sobre estado (hambre, sed, frío, cansancio, salud), percepción (amenaza, presa, pareja) y rasgos (agresividad, miedo, sociabilidad, curiosidad…), multiplicada por la **costumbre** activa. La acción elegida se ejecuta con dirección hacia un objetivo (posición u organismo) entre evaluaciones. La huida interrumpe la espera si aparece una amenaza muy cercana.

**Costumbres y efecto Baldwin.** La costumbre activa empuja las utilidades. La medida en que un individuo la sigue depende de su plasticidad (cerebro) y de lo lejos que esté de su inclinación innata; ir contra la inclinación cuesta energía («estrés conductual»). Los que ya la llevan dentro la cumplen mejor y más barato, así que mantener una costumbre beneficiosa varias rondas selecciona la versión innata.

## 9. Interacciones

- **Depredación:** el cazador detecta (percepción contra visibilidad y camuflaje), acecha, persigue (velocidad y resistencia) y ataca. El éxito depende de la fuerza relativa, la coraza, las espinas, la defensa del grupo (manada con vigías) y el tamaño. Una presa tóxica envenena al atacante y genera aversión aprendida a su aspecto (tono y llamatividad) en los depredadores con memoria. Los depredadores NPC comparten una memoria de aversión por parcela: el **aposematismo** emerge.
- **Combate territorial** entre organismos del mismo sexo y especie o de linajes distintos (enfrentamiento): daño según fuerza, coraza y espinas.
- **Enfermedad:** cepas con transmisibilidad, virulencia y duración. Contagio por proximidad con probabilidad ∝ densidad local × (1 − resistencia). Inmunidad adquirida temporal al recuperarse. Cada linaje porta cepas endémicas propias, contra las que ha ido seleccionando resistencia.
- **Carroña:** los cadáveres dejan carne que se descompone.

## 10. Reproducción

Dos sexos. La hembra elige entre machos cercanos de su especie según su preferencia (llamatividad y tamaño) y la compatibilidad de reconocimiento. Ambos deben ser adultos y tener energía. Gestación de 20–60 ticks según la masa y la inversión; la camada nace junto a la madre. Coste para la madre: `camada × inversión × masa × k`. Las crías nacen con energía proporcional a la inversión. Con cuidado parental, la madre comparte energía y defiende a las crías.

## 11. Capacidades emergentes

Se evalúan por individuo al nacer a partir del fenotipo (umbrales en datos). Bits: nadar, trepar, planear, excavar, caza en grupo, manada, hibernación, aposematismo, camuflaje, vida nocturna, almacenar comida y migración estacional. Cada capacidad cambia lo que el organismo puede hacer (moverse por agua, subir a árboles, cruzar barreras, cavar madrigueras, rodear presas grandes…). Primera aparición → momento clave. Más del 25 % de la especie → entrada del cuaderno y, si procede, desbloqueo de acciones.

## 12. Especiación

Al final de cada ronda se muestrean hasta 300 individuos por especie del linaje y se construye un grafo de compatibilidad (distancia en los loci de reconocimiento por debajo del umbral). Si la especie se parte en componentes grandes (≥ 15 individuos y ≥ 10 %), la mayor conserva el id y las demás son especies nuevas con nombre pseudolatino. Barreras, distancia y nichos distintos (apareamiento entre vecinos) reducen el flujo génico y permiten que los loci de reconocimiento diverjan. Árbol filogenético registrado.

## 13. Registro y grabación

- **Estadísticas ocultas** por especie (cada 40 ticks): censo, medias y varianzas de rasgos, heterocigosis, homocigosis deletérea, causas de muerte, nacimientos, dieta, capacidades, clima. Alimentan el cuaderno, la puntuación, los bots oráculo y la revelación final.
- **Momentos clave:** detectores en la simulación (primera capacidad, cacería notable, caza en grupo, muerte masiva, especiación, invasión, cruce de corredor, macromutante, inicio de evento). Cada uno guarda un clip: el búfer circular de los últimos 60 ticks más los 60 siguientes, recortado a la región (radio de 16 celdas). Máximo 8 por ronda y parcela, priorizados.
- **Grabación de la ronda:** timelapse (un fotograma cada 25 ticks), tramo final (uno cada 2 ticks) y clips. Fotograma binario por criatura: id, x, y (u16), orientación (u8), animación (u8), banderas (u8). Las definiciones visuales de cada criatura se envían una vez.

## 14. Partida

### 14.1 Flujo

Lobby → elección de fundadores → rondas (decisión → simulación) → revelación final.

### 14.2 Influencia y acciones

4 de Influencia por ronda, acumulable hasta 6. Catálogo data-driven (`game/src/content/actions.ts`): id, categoría, coste, alcance, plazo, reversibilidad, riesgo, requisitos (capacidades, fase, terreno, otra apuesta activa) y parámetros (zona, tipo de planta, rasgo visible…). Cada acción registra una función de efecto que traduce la decisión en comandos para la simulación (`SimCommand`). La interfaz muestra los atributos con palabras.

### 14.3 Eventos y director

Catálogo data-driven con ≥ 15 eventos. El director usa su propio flujo aleatorio, la fase, el estado de cada parcela (sin castigar al último de forma desproporcionada) y avisos previos para los eventos grandes.

### 14.4 Invasores NPC

Especies NPC con arquetipo (depredador ápice, competidor voraz, parásito, ingeniero del ecosistema y generalista resistente). Son organismos con genoma que evolucionan igual. Debilidades: el ápice depende de las presas, el voraz agota y colapsa, el parásito necesita huéspedes, el ingeniero transforma el terreno también en su contra y el generalista no destaca en nada.

### 14.5 Caer no es perder

- **Remanente latente:** en la fase aislada, si el linaje se extingue, reaparece la ronda siguiente con 8 individuos de baja diversidad, a partir de genomas guardados de los últimos supervivientes.
- **Relevo de linaje:** si un invasor domina la parcela y el linaje cae por debajo de 12 individuos, el jugador elige entre adoptar al invasor o resistir.
- **Radiación adaptativa:** si en una ronda se pierde más del 70 % de la población, durante dos rondas sube la mutación y aflora la variación críptica.

### 14.6 Gran Intercambio

En la ronda configurada se abren corredores entre parcelas vecinas del anillo (de tierra o de agua, este último solo para nadadores o planeadores). Disposición de las parcelas en el plano: dos filas que recorren el anillo, de modo que las vecinas comparten un borde. Puntuación de dominancia por ronda: territorio (celdas donde tu linaje tiene la mayor biomasa animal), biomasa total, especies vivas de tu clado y depredación sobre otros linajes. Si tu linaje se extingue en el enfrentamiento, pasas a jugar como Naturaleza.

## 15. Información oculta

- El cliente recibe: terreno, fotogramas de representación, definiciones visuales cuantizadas a 16 niveles (solo rasgos visibles: morfología, color, patrón, ojos y pelaje), estados de animación, descriptores cualitativos al inspeccionar, el cuaderno, los momentos clave, la forma del árbol, la Influencia, la puntuación y los avisos.
- Nunca recibe: genomas, energía, salud, rasgos ocultos (toxinas, inmunidad, conducta, fisiología) ni estadísticas por especie, hasta la revelación final.
- Garantía: cada mensaje saliente pasa por un validador de lista blanca de `protocol`, y un test de extremo a extremo examina todos los mensajes de una partida buscando claves prohibidas.
- El overlay de depuración solo existe con el flag `LINAJE_DEBUG=1` en el servidor; sin él no se envía nada extra.

## 16. Red

- WebSocket. Control en JSON; grabaciones en binario. Compresión `permessage-deflate`.
- Reconexión con token (guardado en `localStorage`); si no vuelve en un plazo configurable, un bot ocupa su lugar.
- El protocolo no asume LAN: URL relativa, nada de descubrimiento por broadcast.

## 17. Cliente

- PixiJS 8 para el mundo y Preact para la interfaz.
- Estética de cuaderno de campo: papel de fondo, terreno en acuarela (texturas generadas con ruido y desenfoque) y criaturas con trazo de tinta.
- Criaturas procedurales: la textura de cada combinación de fenotipo visible cuantizado se genera una vez (tres fotogramas de patas) y se cachea. Se animan con transformaciones baratas (rebote, estiramiento, giro y tinte).
- Lectura de conducta: velocidad visible, poses por estado e iconos discretos opcionales.
- Accesibilidad: paleta de jugadores apta para daltónicos (Okabe–Ito) y anillo con patrón distinto por jugador (liso, discontinuo, punteado…), así que nada depende solo del color.

## 18. Bots

Estilos: agresivo, prudente, diversificador, observador, aleatorio, «a ciegas» (el observador sin mirar) y oráculo (acceso total; solo pruebas). Reciben la vista proyectada y las observaciones estructuradas. Política: puntúan las acciones disponibles según su estilo y lo que el cuaderno les dice.

## 19. Escala de los lotes

Para que 200 partidas quepan en un tiempo razonable, `sim:batch` usa por defecto el preset `batch` (parcelas de 64×64 y rondas de 6 años). Las métricas se miden con él y una muestra se repite con el preset normal para confirmar que las tendencias se mantienen. Está documentado en `docs/BALANCE.md`.
