# Linaje — prompt y especificación para Claude Code

> «Linaje» es un nombre provisional. Este documento es a la vez el encargo y la especificación del juego.

## Ajustes rápidos

Edita esta tabla antes de lanzar el proyecto si quieres cambiar algo.

| Ajuste | Valor por defecto |
|---|---|
| Jugadores por partida | 2–6, humanos y bots (también se puede jugar solo contra bots) |
| Red | Red local (LAN): un ordenador anfitrión ejecuta el servidor y el resto juega desde el navegador |
| Duración de una partida | 30–40 minutos con los ajustes por defecto |
| Modo de trabajo | Autónomo: decide, documenta y sigue. Alternativa: «Presenta `docs/PLAN.md` y espera mi aprobación antes de programar» |
| Idiomas | Interfaz en español, con los textos centralizados para poder traducirlos. Código, identificadores y commits en inglés |

Las marcas **[EXTRA]** señalan algo deseable que no bloquea ningún hito.

---

## 0. Tu papel y cómo trabajar

Eres el desarrollador principal y codiseñador de este juego. Este documento fija la visión, las reglas y los criterios de aceptación; el detalle de implementación lo decides tú. Si algo es ambiguo o choca con la diversión, elige lo que mejor sirva a los pilares (§2), anótalo en `docs/DECISIONS.md` con una línea de justificación y sigue. Si se te ocurre algo que haría el juego claramente más divertido sin contradecir los pilares, añádelo y documéntalo igual. Detente a preguntarme solo ante decisiones difíciles de revertir que podrían ir razonablemente en direcciones muy distintas, y mientras esperas, avanza en otra tarea.

**Antes de escribir código** (si el modo de trabajo de la tabla lo pide, espera mi aprobación tras el paso 2):

1. Lee este documento completo y guárdalo sin cambios en `docs/SPEC.md` si no está ya en el repositorio.
2. Crea `docs/DESIGN.md` (el diseño consolidado con tus decisiones), `docs/PLAN.md` (los hitos de §12 desglosados en tareas), `CLAUDE.md` (comandos, convenciones y estructura del repositorio) y `PROGRESS.md` (estado vivo del proyecto).
3. Implementa hito a hito (§12). Un hito está terminado cuando cumple sus criterios, `test`, `typecheck` y `lint` están en verde, el proyecto se ejecuta, `PROGRESS.md` está al día y hay un commit. Al cerrarlo, anota en `PROGRESS.md` cómo probar lo nuevo en dos o tres pasos.

**Memoria entre sesiones.** El proyecto es largo y tu contexto se compactará o reiniciará. `PROGRESS.md` tiene que permitir retomar en frío: qué está hecho, qué está a medias, el siguiente paso concreto y los problemas conocidos. Al empezar cualquier sesión, lee `PROGRESS.md`, `docs/PLAN.md` y el `git log` reciente antes de tocar nada.

**Trabajo en paralelo.** Si trabajas con varios agentes a la vez (por ejemplo, en modo ultracode), el paralelismo tiene que ayudar, no estorbar:

- Los hitos son secuenciales: no empieces uno hasta cerrar el anterior.
- Dentro de cada hito, fija primero las interfaces (tipos de `protocol`, API pública de `sim`, esquemas de datos) y reparte después el trabajo en carriles independientes.
- Carriles naturales: genética y reproducción · ecología y terreno · IA de conducta · dibujo de criaturas · contenido (acciones, eventos, cuaderno) · red · bots y equilibrado.
- Dos agentes nunca editan los mismos archivos a la vez. Cada carril entrega con sus tests en verde; la integración y la verificación final las hace el agente principal.

**Profundidad antes que amplitud.** Es mejor una simulación sólida con quince acciones excelentes que treinta superficiales. Pero el objetivo final sí es la variedad completa.

---

## 1. Visión

Un juego de estrategia multijugador en red local sobre la selección natural. Cada jugador guía a una colonia de organismos —sus colonos— en su propia parcela. La evolución es de verdad: cada individuo tiene su genoma, nace, come, se reproduce, muta y muere, y la selección natural actúa sobre la población. El jugador no edita genes: transforma el entorno, las presiones y las costumbres de sus colonos, y la evolución responde… no siempre como esperaba.

Tras varias rondas de evolución aislada, las parcelas se conectan y los linajes de los jugadores se encuentran en un ecosistema compartido: compiten por recursos, se cazan, se contagian y se invaden.

La fantasía del jugador: *soy un naturalista que guía a una especie a ciegas; observo cómo se comporta, deduzco qué le está pasando y tomo decisiones arriesgadas.*

Frase guía: **realista en las causas, ágil en el ritmo.**

## 2. Pilares de diseño

En orden de prioridad: ante un conflicto, gana el de arriba.

1. **Divertido antes que exacto.** La biología real inspira las mecánicas y su lógica, pero cualquier detalle que vuelva el juego lento, opaco o frustrante se abstrae o se elimina.
2. **Observa, deduce, decide.** El jugador nunca ve estadísticas de su especie. Lo sabe todo por el aspecto, la conducta y las capacidades de sus colonos, y por su cuaderno de campo. El juego tiene que dar suficientes pistas visibles para que deducir sea posible y satisfactorio.
3. **Ningún rasgo es gratis.** Todo rasgo tiene un coste en energía, desarrollo o riesgo. No existe la especie perfecta, solo la adecuada para su entorno en ese momento.
4. **Incertidumbre con causa.** La misma decisión no garantiza el mismo resultado, porque depende de la variación genética disponible, del entorno y del azar. Pero todo resultado tiene una causa real que se entiende a posteriori y que se revela al final de la partida. Nada de tiradas de dados arbitrarias.
5. **Caer no es perder.** Una mala decisión o una catástrofe pueden hundir tu población, pero en la fase aislada nadie queda eliminado, y toda catástrofe abre oportunidades.
6. **Variedad que importa.** Muchas acciones, cada una con su propósito, su coste y su riesgo, y contextuales: lo que puedes hacer depende de tu terreno, de lo que tus colonos ya saben hacer y de lo que está pasando.
7. **Ritmo ágil.** Turnos simultáneos, nadie espera a nadie y en cada ronda ocurre algo visible.

## 3. Estructura de la partida

### Preparación

- El anfitrión crea la partida y ve en pantalla la URL (IP local y puerto) y un código QR para que los demás se unan desde el navegador.
- Ajustes: número de rondas, ronda del Gran Intercambio, tamaño de parcela, duración de las fases, número y estilo de los bots, y semilla opcional.
- Cada jugador recibe una parcela procedural: distinta en forma y biomas, pero equivalente en capacidad ecológica (capacidad de carga total ±10 %).
- **Elección de fundadores:** cada jugador ve tres poblaciones fundadoras aleatorias (su aspecto en movimiento y una frase sobre su conducta) y elige una. Las tres se generan con un presupuesto equivalente, así que ninguna es objetivamente mejor; cada una encaja mejor o peor en su parcela.

### Bucle de cada ronda

1. **Fase de decisión** (simultánea, unos 60 s; termina antes si todos confirman). La simulación está detenida. El jugador observa su parcela, inspecciona individuos, revisa los momentos clave de la ronda anterior, lee el cuaderno y gasta Influencia en acciones (§6).
2. **Fase de simulación** (unos 45 s de tiempo real). Una especie típica vive 8–15 generaciones por ronda, y un ciclo de estaciones dura más o menos una generación. Las especies de madurez lenta viven menos generaciones por ronda y evolucionan más despacio: es un compromiso real que el juego debe respetar. El servidor calcula la ronda entera a máxima velocidad y emite una grabación con un timelapse de toda la ronda, el tramo final a velocidad normal para observar conductas y los clips de los momentos clave. La grabación puede empezar a verse mientras se calcula.

### Fases de la partida

Por defecto 16 rondas; todo es configurable.

| Rondas | Fase | Qué ocurre |
|---|---|---|
| 1–8 | Fase aislada | Cada jugador en su parcela. Eventos naturales, invasores NPC y rumores sobre los rivales |
| 9–15 | Enfrentamiento | En la ronda 9 se abren corredores entre parcelas vecinas (§8). Migración, competencia, depredación y contagio entre linajes; puntuación cada ronda |
| 16 | Ronda final | Un evento global anunciado dos rondas antes (por ejemplo, una glaciación) y recuento final |

## 4. Simulación

La evolución tiene que sentirse natural: ningún cambio aparece de golpe en toda la población. Empieza en unos pocos individuos y se extiende, o no, según la ventaja que dé.

### 4.1 Mundo y parcelas

- Mapa 2D cenital. El terreno es una rejilla de celdas (orientativo: 96×96 por parcela) y los organismos se mueven de forma continua sobre ella.
- Cada celda tiene bioma (pradera, bosque, matorral, arena, roca, agua somera o profunda), humedad, temperatura, fertilidad, cobertura para esconderse y biomasa vegetal.
- Vegetación con crecimiento logístico por celda según humedad, temperatura, estación y fertilidad, y de varios tipos (pasto, arbusto con fruto, árbol, algas) para dietas distintas.
- Estaciones que cambian la temperatura y el crecimiento.
- Fauna de fondo NPC (insectos, pequeños herbívoros, peces) que sirve de presa y cierra la cadena trófica. Puede usar un modelo poblacional simplificado para abaratar el cálculo.
- Las parcelas se disponen en anillo o en rejilla para que cada una tenga dos o tres vecinas cuando se abran los corredores.

### 4.2 Organismos: genoma → fenotipo → conducta

- **Modelo basado en individuos.** Cada organismo tiene su genoma, edad, energía, salud, posición y una memoria corta. Nada se calcula «por especie».
- **Genoma diploide** con unos 40–80 loci de valor continuo. Hay rasgos poligénicos y loci pleiotrópicos (un locus de «crecimiento» aumenta el tamaño y retrasa la madurez). La pleiotropía hace que seleccionar un rasgo visible arrastre rasgos ocultos, como en los zorros domesticados de Beliáyev, que al seleccionarlos por mansedumbre acabaron con orejas caídas y manchas.
- **Alelos recesivos deletéreos** a baja frecuencia: inofensivos en poblaciones grandes, peligrosos tras un cuello de botella. La depresión endogámica tiene que emerger sola, sin reglas especiales.
- **Genes latentes:** loci neutros en las condiciones iniciales que derivan libremente y se vuelven útiles o perjudiciales si cambia el entorno (preadaptación). Por eso la misma presión da resultados distintos en partidas distintas.
- **Fenotipo** = genotipo + desarrollo (la nutrición en la infancia afecta al tamaño adulto) + aprendizaje durante la vida, si el cerebro lo permite.
- **Conducta con IA de utilidad.** Cada individuo puntúa las acciones posibles (comer, beber, huir, cazar, carroñear, cortejar, descansar, explorar, seguir al grupo, defender territorio, cuidar crías, esconderse, cavar, almacenar, migrar…) y elige la mejor. Las curvas dependen de rasgos genéticos (agresividad, miedo, sociabilidad, curiosidad…), del estado interno (hambre, sed, frío, cansancio) y de la costumbre activa (§6). Escalona las decisiones: cada individuo reevalúa cada pocos ticks, desfasado del resto.
- Nada de redes neuronales evolutivas en esta versión: convergen despacio y su conducta es ilegible para el jugador. Deja la arquitectura preparada para probarlas como experimento.

Rasgos iniciales (orientativos; amplíalos):

| Grupo | Rasgos | Cómo lo percibe el jugador |
|---|---|---|
| Morfología | Tamaño, forma corporal, patas (número y longitud), aletas, membranas de planeo, coraza, espinas, cola | A simple vista |
| Apariencia | Color base, patrón (manchas, rayas), llamativo ↔ críptico | A simple vista |
| Sentidos | Ojos (tamaño, visión nocturna), olfato, oído | Los ojos a simple vista; el resto, por la conducta |
| Fisiología | Tasa metabólica, tolerancia al frío y al calor, reservas de grasa, longevidad | Por la conducta y la supervivencia (buscan sombra, se apiñan con frío…) |
| Dieta | Eje herbívoro ↔ carnívoro, digestión de fibra, tolerancia a toxinas vegetales | Por lo que comen |
| Defensa química | Producción de toxinas, resistencia a toxinas | Depredadores que los evitan |
| Inmunidad | Resistencia a varias cepas de patógenos | Solo por los resultados: quién enferma |
| Conducta | Agresividad, miedo, sociabilidad, curiosidad, territorialidad, nocturnidad, cuidado parental | Por la conducta |
| Cognición | Tamaño cerebral: aprendizaje, memoria de lugares, cooperación | Conducta más sofisticada |
| Reproducción | Edad de madurez, tamaño de camada, inversión por cría, preferencias de pareja | Ritmo de nacimientos, cortejos |

### 4.3 Energía, ecología y compromisos

- Todo cuesta energía. El metabolismo basal escala con el tamaño (ley de Kleiber, ∝ masa^0,75) y con la tasa metabólica; moverse cuesta más cuanto más rápido y pesado; el cerebro, la coraza, las toxinas y la termorregulación tienen coste de mantenimiento; criar cuesta según la inversión por cría.
- Compromisos que deben existir:
  - Más tamaño: menos depredadores y más fuerza, pero más comida y madurez más lenta.
  - Más coraza: defensa, pero menos velocidad.
  - Más cerebro: aprendizaje y cooperación, pero mucha energía e infancia larga.
  - Colores llamativos: más éxito al cortejar, pero más visibilidad ante los depredadores, salvo si son tóxicos (aposematismo).
  - Camadas grandes: crecimiento rápido, pero crías frágiles.
- Causas de muerte: inanición, sed, depredación, frío, calor, enfermedad, vejez, combate, ahogamiento y toxinas. Regístralas: alimentan el cuaderno y la revelación final.
- La capacidad de carga emerge de los recursos, sin topes artificiales. Como salvaguarda de rendimiento, la transmisión de enfermedades crece con la densidad: es realista y frena las explosiones demográficas sin un corte seco.

### 4.4 Reproducción, herencia y mutación

- Reproducción sexual entre dos adultos cercanos con energía suficiente. La elección de pareja depende de rasgos visibles (selección sexual).
- Herencia mendeliana: un alelo de cada progenitor por locus.
- Mutación: probabilidad baja por locus, con un salto gaussiano pequeño. Muy de vez en cuando, una macromutación de efecto grande (la primera cría con membranas, un albino…) que sirve de fuente de sorpresas.
- Población orientativa: 20–40 fundadores; entre 300 y 1500 individuos por parcela en equilibrio.
- [EXTRA] Asexualidad facultativa: un rasgo que permite reproducirse sin pareja cuando no la hay; rápida, pero reduce la diversidad.

### 4.5 Capacidades emergentes

Las capacidades no se compran. Aparecen cuando la combinación de rasgos de un individuo supera ciertos umbrales, y se extienden si dan ventaja. La primera vez que un individuo muestra una capacidad se genera un momento clave; cuando se vuelve común, una entrada en el cuaderno. Algunas desbloquean acciones.

| Capacidad | Requiere (aprox.) | Lo que ve el jugador | Desbloquea |
|---|---|---|---|
| Nadar | Aletas + cuerpo alargado | Cruzan ríos, comen en el agua | Acciones en zonas de agua, corredores acuáticos |
| Trepar | Patas prensiles + poco peso | Suben a los árboles y duermen en ellos | Refugio arbóreo |
| Planear | Membranas + poco peso | Se lanzan desde rocas o árboles | Cruzar barreras |
| Excavar | Patas fuertes + territorialidad | Madrigueras | Refugio contra el clima y los depredadores |
| Caza en grupo | Sociabilidad + agresividad + cerebro | Rodean presas grandes | Presas grandes, costumbre «Cazar en grupo» |
| Manada | Sociabilidad + dieta herbívora | Se mueven juntos, con vigías | Defensa colectiva |
| Hibernación | Reservas de grasa + metabolismo bajo | Desaparecen en invierno | Resistir glaciaciones |
| Aposematismo | Toxinas + colores llamativos | Los depredadores los evitan | Defensa pasiva |
| Camuflaje | Color parecido al terreno + quietud | Cuesta verlos, también a ti | Emboscadas |
| Vida nocturna | Ojos grandes + nocturnidad | Activos de noche | Esquivar depredadores diurnos |
| Almacenar comida | Cerebro + territorialidad | Despensas | Resistir sequías |
| Migración estacional | Curiosidad + memoria espacial | Recorridos de temporada | Aprovechar varias zonas |

### 4.6 Especiación y linajes

- Si dos subpoblaciones de tu linaje quedan aisladas (por una barrera, la distancia o nichos distintos) durante suficientes generaciones, la divergencia genética puede impedir que se crucen: nace una especie nueva. Ambas siguen siendo tuyas; tu linaje es un clado que puede ramificarse.
- Tener varias especies diversifica el riesgo y abre estrategias (una rama depredadora y otra herbívora, por ejemplo), pero reparte tu atención y tus recursos.
- Cada especie recibe un nombre generado en pseudolatín que el jugador puede cambiar.
- El jugador ve la forma de su árbol filogenético (ramas y nombres), pero no sus datos hasta la revelación final.

## 5. Información oculta: qué ve el jugador

Regla de oro: **el cliente nunca recibe genomas ni atributos ocultos.** Solo recibe datos de representación (posición, orientación, estado de animación y parámetros visuales del fenotipo cuantizados) y observaciones narradas. Esto se garantiza en la arquitectura —el servidor filtra— y con un test que falla si cualquier mensaje al cliente contiene campos ocultos.

Lo que sí tiene el jugador:

- **Su parcela en directo:** criaturas dibujadas a partir de su fenotipo visible, con su movimiento y su conducta; nacimientos, muertes y cadáveres. No hay contadores: el tamaño de la población se intuye mirando, y el cuaderno lo describe con palabras («abundante», «escasa»).
- **Inspeccionar un individuo:** una ficha de campo cualitativa con su dibujo y descriptores («adulto, robusto, bien alimentado, cojea, suele ir solo»). Sin números.
- **Cuaderno de campo:** observaciones en lenguaje natural, cualitativas, comparativas y con causas probables. Ejemplos de tono:
  - «Las crías de esta temporada tienen las patas visiblemente más largas que sus abuelos.»
  - «Durante la sequía murieron sobre todo los más grandes.»
  - «He visto a tres de ellos rodear a un herbívoro enorme. Es la primera vez.»
  - «Las crías se parecen mucho entre sí. Me preocupa la falta de variedad.»

  Se generan a partir de cambios significativos en los rasgos medios, de las causas de muerte dominantes, de las capacidades nuevas y de los eventos, con varias plantillas por tipo para que no se repitan. Por defecto son vagas; con la acción Estudio de campo, más precisas y con tendencias. El jugador puede añadir notas propias y fijar observaciones.
- **Momentos clave:** la simulación detecta momentos notables (el primer individuo con una capacidad, una cacería, una muerte masiva, una especiación, una invasión, un cruce de corredor) y guarda un clip corto que se puede ver en la fase de decisión, con la cámara centrada.
- **Seguir a un individuo:** la cámara lo acompaña a lo largo de su vida.
- **Rumores del vecindario:** en la fase aislada, al final de cada ronda llega un rumor vago sobre cada parcela vecina, generado a partir de lo visible de su linaje («En la parcela de Ana se ha visto algo grande y con espinas»). Crea expectación y permite prepararse.
- **La revelación final:** al acabar la partida se muestra todo: el árbol filogenético completo con datos, la evolución de cada rasgo en el tiempo, las causas de muerte, los eventos y las decisiones de cada jugador con su efecto. Es la recompensa por haber jugado a ciegas y debe ser una de las pantallas más cuidadas.

Modo depuración: un overlay con todos los datos, solo detrás de un flag de desarrollo, para verificar y equilibrar. Nunca accesible en una partida normal.

## 6. Acciones del jugador

**Influencia.** Cada ronda el jugador recibe Influencia (orientativo: 4 puntos, acumulables hasta 6). Las acciones cuestan entre 1 y 3; las grandes apuestas, más. Cada acción tiene coste, alcance (zona, grupo o parcela), plazo (inmediato o varias rondas), reversibilidad y riesgo. La interfaz muestra estos atributos con palabras («Riesgo alto · Efecto lento · Irreversible»), nunca con probabilidades.

**Principio.** El jugador no edita genes: cambia el entorno, las presiones y las costumbres, y la selección hace el resto. Las acciones son contextuales y solo aparecen cuando tienen sentido (por ejemplo, «Colonizar el islote» requiere que sepan nadar o que haya un paso).

El catálogo es data-driven y, en la versión final, debe incluir al menos todo lo que sigue.

**Territorio**

| Acción | Efecto | Riesgo o matiz |
|---|---|---|
| Sembrar vegetación (pasto, arbusto con fruto, árbol, planta espinosa) | Cambia la comida disponible en una zona a medio plazo | Puede favorecer también a competidores |
| Quema controlada | Elimina la vegetación vieja; rebrote fértil una o dos rondas después | Con sequía o viento puede descontrolarse |
| Desviar agua o crear una charca | Nuevo recurso y nuevo hábitat acuático | Atrae fauna nueva y enfermedades |
| Levantar una barrera (seto, zanja) | Divide la parcela: aislamiento y posible especiación; defensa en el enfrentamiento | Fragmenta la población (endogamia) |
| Crear refugios (rocas, cuevas) | Protege del clima y de los depredadores | Relaja la selección: se adaptan menos |

**Población y selección**

| Acción | Efecto | Riesgo o matiz |
|---|---|---|
| Selección dirigida | Durante la ronda, favorece a los individuos con un rasgo visible («los de patas largas») | Arrastra rasgos ocultos correlacionados y reduce la diversidad |
| Fundar una colonia | Lleva un grupo pequeño a otra zona | Efecto fundador y deriva: impredecible |
| Unir poblaciones | Mezcla dos subpoblaciones | Más diversidad, pero puede romper adaptaciones locales |
| Alimentación suplementaria | Comida extra durante la ronda | Relaja la selección y crea dependencia |
| Introducir una presa | Nueva fuente de alimento (insectos, peces, pequeños herbívoros) | Abre nichos carnívoros; puede convertirse en plaga |
| Introducir un depredador nativo | Presión hacia la velocidad, el camuflaje o la defensa | Puede provocar un colapso |
| Introducir un simbionte | Microbiota o planta mutualista (por ejemplo, para digerir fibra) | El simbionte puede volverse parásito |
| Exposición controlada a un patógeno | Inmuniza frente a una cepa | Puede desatar una epidemia |

**Costumbres.** Cada ronda eliges una costumbre activa, sin coste. Empuja las preferencias de conducta, pero la genética decide si pueden cumplirla. Si una costumbre beneficiosa se mantiene varias rondas, la selección tiende a volverla innata (efecto Baldwin), lo que premia la constancia. Opciones: Explorar · Expandirse · Agruparse · Defender el territorio · Acumular reservas · Ocultarse · Cuidar de las crías · Migrar con las estaciones · Cazar en grupo (requiere la capacidad).

**Conocimiento**

| Acción | Efecto | Riesgo o matiz |
|---|---|---|
| Estudio de campo | El cuaderno de la ronda siguiente es más preciso y señala tendencias | — |
| Experimento aislado | Un grupo pequeño en un recinto con una condición elegida (frío, sin cierta comida, un depredador…); el resultado llega al cuaderno | Esos individuos no se cruzan con el resto durante la ronda y pueden morir |
| Observar una parcela vecina | La ves en directo durante la ronda, solo por su aspecto y su conducta, igual que la tuya | Más cara antes de que se abran los corredores |
| Inspeccionar, seguir y marcar individuos | Gratis | — |

**Grandes apuestas.** Caras, duran varias rondas y solo puede haber una activa. Transforman el entorno a gran escala para empujar una transición mayor, y su éxito depende de que haya variación útil en la población. Ejemplos: Reforestación masiva (hacia trepar y planear), Embalsar el valle (hacia la vida acuática), Desecación (hacia el ahorro de agua y la vida nocturna) y Megafauna (un gran herbívoro que abre nichos de depredador y carroñero).

**Enfrentamiento** (desde la apertura de corredores)

| Acción | Efecto | Riesgo o matiz |
|---|---|---|
| Abrir o cerrar un corredor | Controla por dónde se migra | Mantenerlo cerrado cuesta más cada ronda |
| Enviar colonizadores | Un grupo de tu linaje entra en una parcela vecina | Pueden volver con patógenos |
| Fortificar la frontera | Barreras naturales en la zona del corredor | También frena tu expansión |
| [EXTRA] Pacto simbiótico | Dos jugadores pactan un mutualismo: sus especies no se atacan y ambas obtienen un beneficio mientras dure | Romperlo tiene consecuencias |

La interfaz agrupa las acciones por categoría y solo muestra las disponibles: ninguna pantalla debe abrumar.

## 7. Eventos e invasores

- Un **director de eventos** los elige según la fase, el estado de cada parcela y el azar con semilla. Evita ensañarse con quien ya va último, sin garantías ciegas. Algunos eventos dan señales una o dos rondas antes («los inviernos son cada vez más largos») para que prepararse sea posible.
- Eventos (al menos 15 en la versión final), locales o globales: sequía, ola de frío, glaciación, ola de calor, inundación, tormenta, incendio natural, erupción volcánica, terremoto que cambia el curso de un río, epidemia, plaga de insectos, floración tóxica, enfermedad vegetal que hunde un tipo de planta, llegada de un mutualista, explosión de presas e impacto de meteorito (raro, tardío, extinción masiva).
- **Invasores NPC** con arquetipos: depredador ápice, competidor voraz (come lo mismo que tú y se reproduce más rápido), parásito, ingeniero del ecosistema (modifica el terreno) y generalista resistente. Son individuos que evolucionan como los tuyos. Cada arquetipo es fuerte pero tiene una debilidad propia (el depredador ápice se hunde si se queda sin presas; el competidor voraz agota los recursos y colapsa), para que adoptarlo no sea siempre lo mejor.
- **Relevo de linaje.** Si un invasor NPC domina tu parcela y tu linaje cae por debajo de una población mínima viable, eliges:
  - **Adoptar al invasor:** pasa a ser tu linaje. Conservas tu cuaderno, tus modificaciones del terreno y tu puntuación, y recibes Influencia extra esa ronda.
  - **Resistir:** sigues con el remanente de tu linaje, que entra en radiación adaptativa (§9).

## 8. El Gran Intercambio

- En la ronda configurada, un cambio geológico o climático abre corredores entre parcelas vecinas: un puente de tierra, un río que se seca, un descenso del nivel del mar. Es el equivalente del Gran Intercambio Biótico Americano.
- Cada parcela sigue siendo de su jugador (su entorno y sus acciones), pero los organismos pueden cruzar. Lo que haces en tu parcela afecta también a los migrantes que lleguen.
- La interacción entre jugadores es ecológica, no un combate por turnos: competencia por recursos, depredación, combate territorial, desplazamiento y contagio.
- **Patógenos endémicos:** cada linaje porta cepas con las que ha coevolucionado y a las que es en parte resistente. Al contactar con otro linaje las cepas pueden saltar, y una población sin defensas puede sufrir mucho. Es un arma y un riesgo para todos.
- **Carrera armamentística:** la evolución no se detiene, y la presión de los vecinos cambia lo que se selecciona.
- **Visibilidad:** siempre ves a tus individuos estén donde estén, con su entorno inmediato; la parcela ajena completa, solo con la acción Observar.
- **Puntuación de dominancia** al final de cada ronda de esta fase: territorio dominado (celdas donde tu linaje tiene la mayor parte de la biomasa animal), biomasa total, especies vivas de tu clado y posición trófica (bonificación si depredas sobre otros linajes). Se acumula. La clasificación es visible: es la puntuación de la partida, no una estadística de tu especie.

## 9. Victoria, derrota y remontada

- Gana quien tenga más puntuación de dominancia acumulada al terminar la última ronda. [EXTRA] Condiciones alternativas configurables: depredador ápice, mayor diversidad de especies, último linaje en pie.
- **Sin eliminación en la fase aislada.** Si tu linaje se extingue, sobrevive un remanente latente (huevos en diapausa o quistes, según su biología) que reaparece la ronda siguiente con una penalización fuerte: pocos individuos y poca diversidad. Se combina con el relevo de linaje (§7).
- **Radiación adaptativa.** Tras una caída fuerte (orientativo: más del 70 % de la población en una ronda), los supervivientes disponen durante dos rondas de más variación (aflora variación críptica y la mutación sube un poco) y de nichos vacíos. Tiene base real y es la principal mecánica de remontada.
- **En el enfrentamiento sí hay extinción.** Si tu linaje desaparece por completo, conservas tu puntuación acumulada y pasas a jugar como **Naturaleza**: con un pequeño presupuesto por ronda eliges eventos locales (sequía, plaga, invasor NPC) sobre las parcelas de los demás, más baratos contra el líder. Nadie se queda mirando.

## 10. Interfaz y sensación de juego

- Vista cenital 2D con estética naturalista y limpia, inspirada en la ilustración de un cuaderno de campo (tinta y acuarela suaves).
- **Criaturas procedurales** generadas a partir del fenotipo visible: tamaño, forma, patas, aletas, membranas, coraza, espinas, cola, ojos, color y patrón. Los individuos de una población se parecen sin ser idénticos, y el cambio de un rasgo bajo una presión sostenida debe notarse a simple vista en dos o tres rondas. Para rendir bien, genera la textura de cada criatura una vez (o por grupos de fenotipo) y anímala con transformaciones baratas.
- **Conducta legible:** andar y correr (la velocidad se nota), huir, acechar, comer, beber, dormir, cortejar, pelear, cuidar crías, cavar, nadar, trepar y planear. Iconos de estado opcionales y discretos que nunca revelen números.
- Anillo discreto del color del jugador bajo cada criatura, activable; imprescindible en el enfrentamiento.
- HUD mínimo: Influencia, ronda y fase, temporizador, cuaderno, acciones y momentos clave.
- Notificaciones jerarquizadas: lo grande se nota y lo pequeño no molesta.
- La fase de simulación avanza al mismo ritmo para todos; en la fase de decisión, los momentos clave se pueden volver a ver libremente. En partidas con un solo jugador humano, pausa y velocidad libres.
- Primera partida con pistas contextuales breves (qué es la Influencia, cómo leer el cuaderno, qué es un momento clave) y modo de partida rápida contra bots para aprender.
- Accesibilidad: colores de jugador aptos para daltónicos y ninguna información transmitida solo por color.
- Pensado para ordenador con ratón y teclado. [EXTRA] Que funcione en tableta. [EXTRA] Sonido ambiental y efectos.

## 11. Arquitectura técnica

Stack por defecto. Cámbialo solo por una razón de peso y regístrala en `docs/DECISIONS.md`.

- TypeScript estricto en todo; monorepo con pnpm workspaces; Node LTS.
- `packages/sim`: simulación pura y determinista, sin DOM ni red. Se ejecuta en Node (servidor, tests y equilibrado) y en worker threads.
- `packages/game`: reglas de la partida (rondas, fases, Influencia, acciones, eventos y puntuación) sobre `sim`. Independiente del transporte: un jugador puede ser un humano por red, un bot o un script de test.
- `packages/protocol`: tipos y serialización de los mensajes. Aquí vive la frontera de la información oculta.
- `packages/server`: Node y WebSocket (`ws`), servidor autoritativo. Sirve también el cliente compilado, así que los demás solo tienen que abrir una URL.
- `packages/client`: Vite y PixiJS (WebGL) para el mundo; interfaz en DOM con el framework ligero que prefieras.
- Tests con Vitest; Playwright para pruebas de extremo a extremo y capturas del cliente.

**Determinismo y rendimiento**

- Generador aleatorio con semilla (por ejemplo, `sfc32` o `xoshiro128**`) con flujos separados por subsistema. Prohibido `Math.random` en `sim` y `game`, con una regla de lint.
- Paso de tiempo fijo. Una partida se puede reproducir a partir de la semilla y las entradas de los jugadores, lo que sirve para repeticiones, depuración y tests.
- Organismos en estructura de arrays (typed arrays) y rejilla espacial para buscar vecinos.
- Cada parcela se simula en su propio worker. En el enfrentamiento siguen simulándose por separado y se intercambian los migrantes de los corredores en puntos de sincronización fijos, de forma determinista.
- Objetivos orientativos en un portátil de gama media, medidos con un benchmark: hasta 6 parcelas de unos 1500 organismos; el cálculo de una ronda en menos de 25 s; el cliente a 60 fps con 2000 criaturas visibles. Si no llegas, prioriza menos organismos con conducta rica antes que muchos organismos simples.

**Red (LAN)**

- El servidor es la autoridad: los clientes envían intenciones (acciones), nunca estado.
- Cada cliente recibe solo lo que su jugador puede ver (§5 y §8).
- Instantáneas binarias compactas con interpolación en el cliente.
- Reconexión: un jugador que se cae vuelve con su token y recupera la partida; si no vuelve, un bot puede ocupar su lugar (configurable).
- Lobby con nombres, colores, estado de «listo» y ajustes.
- El anfitrión arranca el servidor con un solo comando en Windows, macOS y Linux. El README explica qué hacer si el cortafuegos bloquea la conexión. [EXTRA] Ejecutable empaquetado que no requiera instalar Node.
- Nada en el protocolo debe dar por hecho que es una LAN: jugar por internet en el futuro tiene que ser cuestión de despliegue, no de reescritura.

**Contenido data-driven**

- Rasgos, acciones, costumbres, eventos, capacidades, arquetipos de invasores, plantillas del cuaderno y textos de la interfaz viven en archivos de datos con esquema validado. Añadir una acción es añadir una entrada de datos y registrar su función de efecto, sin tocar el núcleo.
- Todos los parámetros de equilibrio, en un único módulo de configuración comentado.

**Comandos**

- `pnpm dev`: servidor y cliente con recarga en caliente.
- `pnpm host`: compila, arranca el servidor para jugar en la LAN e imprime la URL.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- `pnpm sim:batch`: partidas headless entre bots con informe (§13), con parámetros para número de partidas, jugadores y estilos.
- `pnpm sim:bench`: benchmark de rendimiento.
- Un visor de partidas headless: cargar semilla + entradas y verla en el cliente.

## 12. Hitos y criterios de aceptación

Cada hito deja el proyecto ejecutable. No pases al siguiente sin cumplir los criterios del actual.

**H0 · Cimientos.** Monorepo, TypeScript estricto, lint (con la regla contra `Math.random`), Vitest, RNG con semilla, bucle de paso fijo, esqueleto del runner headless, `CLAUDE.md` y documentos.

- ✔ `test`, `typecheck` y `lint` en verde.
- ✔ Test de determinismo: misma semilla y mismas entradas → mismo hash de estado tras N ticks.

**H1 · Un ecosistema que evoluciona (headless).** Parcela, vegetación, fauna de fondo, organismos (genoma diploide → fenotipo → IA de utilidad), energía, reproducción, mutación y muerte.

- ✔ Experimentos de selección automatizados, sobre al menos 20 semillas y aprobados en el 80 % o más: (a) con depredadores rápidos, la velocidad media sube de forma significativa en 10 generaciones; (b) con frío sostenido, sube la tolerancia al frío; (c) sin presión, los rasgos derivan sin tendencia; (d) un cuello de botella reduce la diversidad y hace aflorar los recesivos deletéreos.
- ✔ La población se estabiliza sin topes artificiales. Ni NaN ni crecimiento de memoria en 50 generaciones.

**H2 · Verlo.** Cliente que dibuja una parcela en directo: terreno, vegetación, criaturas procedurales animadas según su conducta, cámara, seguir e inspeccionar individuos. Overlay de depuración solo en desarrollo.

- ✔ Capturas con Playwright de 3 semillas en las que las poblaciones se ven claramente distintas.
- ✔ Tras 30 generaciones de presión, la diferencia con la población inicial se aprecia a simple vista (capturas de antes y después).
- ✔ 60 fps con 2000 criaturas en un equipo de gama media; deja un benchmark del cliente para comprobarlo.

**H3 · Jugarlo (un jugador).** Bucle de rondas, Influencia, al menos 15 acciones de §6 y 6 costumbres, cuaderno de campo, momentos clave, al menos 10 eventos, capacidades emergentes, especiación, relevo de linaje y remanente latente.

- ✔ Una partida completa de un jugador se juega de principio a fin.
- ✔ Cada acción tiene un test que verifica su efecto sobre el entorno o la presión selectiva.
- ✔ Tests con escenarios controlados comprueban que el cuaderno dice cosas ciertas sobre lo que ocurre en la simulación.

**H4 · Multijugador en LAN.** Servidor autoritativo, lobby, turnos simultáneos con temporizador, parcelas en workers, filtrado de información y reconexión.

- ✔ Test de extremo a extremo: 3 clientes se unen, juegan 3 rondas y uno se reconecta a mitad.
- ✔ Test que falla si algún mensaje al cliente contiene datos ocultos.
- ✔ El README explica cómo probarlo con dos ordenadores en la misma red.

**H5 · El Gran Intercambio.** Corredores, migración entre parcelas, interacciones entre linajes, patógenos endémicos, acciones de enfrentamiento, puntuación, fin de partida y modo Naturaleza.

- ✔ Partida headless completa entre 4 bots sin errores.
- ✔ Los registros muestran desplazamientos y contagios entre linajes.

**H6 · Bots y equilibrio.** Bots con estilos (agresivo, prudente, diversificador, observador y aleatorio) que solo usan la información que tendría un jugador: las mismas observaciones que generan el cuaderno, en forma estructurada. Además, un bot «oráculo» con acceso total, solo para pruebas, como referencia. Partidas por lotes con informe y ajuste de parámetros hasta cumplir §13.

- ✔ `docs/BALANCE.md` con los resultados de al menos 200 partidas y el estado de cada métrica.

**H7 · Revelación y pulido.** Pantalla final (árbol filogenético, gráficas de rasgos, causas de muerte y decisiones), pistas para la primera partida, pulido visual y README para jugar en LAN. [EXTRA] Sonido. [EXTRA] Guardar y reanudar partidas.

- ✔ Alguien sin contexto puede montar una partida en LAN siguiendo el README.

## 13. Validar el diseño con partidas headless

La diversión no se puede testear directamente, pero estas métricas son buenos indicadores. Mídelas con `sim:batch` y ajusta hasta cumplirlas, o documenta por qué alguna no aplica.

| Métrica | Objetivo |
|---|---|
| Ninguna estrategia domina | Ningún estilo de bot gana más del 40 % de las partidas de 4 jugadores (el azar daría un 25 %) |
| El azar no lo decide todo | El bot aleatorio gana menos del 15 % |
| Observar compensa | El bot observador (usa el cuaderno y el estudio de campo) gana al menos 1,5 veces más que uno idéntico que decide sin mirar |
| La misma decisión no siempre funciona | Las acciones con riesgo tienen, según el contexto, una tasa de éxito de entre el 40 % y el 85 % (define «éxito» para cada una) |
| La evolución se nota | Una presión sostenida desplaza un rasgo visible al menos una desviación típica en 3 rondas o menos, en el 80 % de los casos o más |
| Caer no es perder | Tras perder el 70 % de la población o más, se recupera al menos la mitad en 3 rondas o menos, en el 60 % de los casos o más con un juego razonable |
| Remontar es posible | Quien tiene menos biomasa al abrirse los corredores gana al menos el 10 % de las partidas de 4 jugadores |
| Ninguna acción sobra | Todas las acciones aparecen alguna vez en partidas ganadoras; si una nunca aparece, rediséñala o elimínala |
| Algo pasa cada ronda | Cada jugador recibe al menos un momento clave o una observación nueva en el 90 % de las rondas o más |

## 14. Reglas de trabajo

- Calidad de producto, no de prototipo: código tipado, modular y con tests que signifiquen algo. Nada de stubs presentados como terminados; lo que quede a medias va a `PROGRESS.md`.
- Nunca ajustes un test para que pase ni dejes resultados escritos a mano. Si un experimento de selección falla, el problema está en la simulación o en sus parámetros.
- Abstrae solo lo necesario: no construyas sistemas genéricos que nada usa todavía, pero respeta las fronteras de §11 (simulación pura, reglas independientes del transporte, protocolo que filtra).
- Lee el código existente antes de decidir sobre él; no supongas.
- Comprueba visualmente lo que haces en el cliente (capturas con Playwright) y juega tú mismo partidas headless con el visor.
- Commits pequeños y descriptivos, y uno al cerrar cada hito.
- Anota cada decisión de diseño relevante en `docs/DECISIONS.md`: qué, por qué y qué alternativas descartaste.

## 15. Fuera de alcance en esta versión

Juego por internet, cuentas y emparejamiento; 3D; aplicaciones móviles nativas; editor de criaturas; monetización; redes neuronales evolutivas (solo como experimento detrás de un flag). Diseña sin cerrar la puerta al juego por internet ni a guardar partidas.
