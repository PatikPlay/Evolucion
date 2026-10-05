# Registro de decisiones

Formato: **qué** · por qué · alternativas descartadas.

## Proceso

- **Modo autónomo.** La tabla de ajustes de la especificación lo fija por defecto; se documenta y se sigue sin esperar aprobación del plan.
- **Documentación en español; código, identificadores y commits en inglés.** Es lo que pide la especificación para la interfaz y el código; los documentos los lee el usuario.

## Stack

- **TypeScript 6.0.x**, no 7.0. typescript-eslint 8.x solo admite TypeScript < 6.1. · Alternativa: TS 7 (compilador nativo) sin lint tipado.
- **Sin `noUncheckedIndexedAccess`.** La simulación trabaja con typed arrays en bucles calientes; esa opción obligaría a comprobar `undefined` en cada acceso sin ganar seguridad real (los índices se validan por construcción). Sí: `strict`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals` y `noUnusedParameters`.
- **Paquetes consumidos desde el código fuente** (`exports` → `src/index.ts`) con resolución `Bundler`. Vite, Vitest y tsx lo entienden; para `pnpm host`, esbuild genera un único bundle de servidor y otro del worker. · Alternativa: compilar cada paquete con `tsc -b` (más lento y más frágil en un monorepo pequeño).
- **Preact** para la interfaz DOM: 4 kB, JSX conocido y señales sencillas. · Alternativas: Svelte (otro compilador en la cadena) y DOM a mano (demasiado código de interfaz).
- **Playwright 1.56.1**, la versión que corresponde al Chromium preinstalado en el entorno de desarrollo.

## Simulación

- **Año de 400 ticks y ronda de 4000.** Da unas 10 generaciones por ronda con madurez de 0,5 años y deja margen de rendimiento (6 M actualizaciones de organismo por ronda y parcela de 1500). · Alternativa: 1000 ticks por año (más fino, pero el doble de coste).
- **Noche de 20 ticks cada 40.** Un día real por tick no se vería nunca; un día por año haría la nocturnidad irrelevante.
- **Dos sexos.** Da selección sexual clara (elección de la hembra) y una base natural para el cortejo visible. · Alternativa: hermafroditas (más simple, pero la selección sexual queda difusa).
- **Fauna de fondo como campos de densidad**, no individuos. Lo permite la especificación y abarata el coste. Los depredadores e invasores NPC sí son individuos con genoma.
- **Loci no ligados.** El ligamiento añadiría realismo, pero no cambia nada que el jugador pueda percibir en una partida.
- **Canalización para la variación críptica.** Loci cuyo efecto visible se atenúa (×0,15) en condiciones normales y se libera en la radiación adaptativa. Base real: la liberación de variación críptica por estrés (Hsp90). · Alternativa: subir solo la mutación (no explica la variación «escondida» que pide la especificación).
- **Especiación por compatibilidad en loci de reconocimiento.** Es legible, barata y emerge del aislamiento. · Alternativa: distancia genética total (mezcla selección y deriva, y tarda demasiado en divergir).

## Partida y red

- **El visor re-simula en el servidor.** Así no dependemos de que V8 y otros motores calculen igual las funciones trascendentes. · Alternativa: simular en el navegador.
- **Lista blanca de claves por mensaje** como frontera de la información oculta, además de un test que busca claves prohibidas. Una lista negra sola deja pasar campos nuevos por descuido.
- **Disposición de parcelas en dos filas que recorren el anillo.** Las vecinas comparten un borde físico, así que los corredores se dibujan como pasos reales.
- **Preset `batch` para los lotes de equilibrado** (parcelas más pequeñas y rondas más cortas). 200 partidas con el preset normal son decenas de horas de CPU.

## Ajuste de la simulación (H1)

Cada cambio responde a un fallo medido, no a un número deseado.

- **Rebrote desde reservas subterráneas** (`rootStock`): el crecimiento logístico puro dejaba las celdas sobrepastoreadas sin recuperarse en toda la estación. Las plantas reales rebrotan desde raíces y bancos de semillas. · Alternativa: más productividad (no arreglaba el bloqueo local).
- **Normalización de parcelas por valor alimenticio** (pasto, ramoneo, fruto y poco dosel o algas), no por biomasa total. Los bosques sostienen mucha más fauna por su fruto, y la estimación antigua lo ignoraba. Queda una diferencia estructural de capacidad real entre parcelas (agua, disposición): se calibrará empíricamente al crear la partida (H3/H5).
- **Depredación ambiental de fondo** (rapaces y serpientes como campo, no individuos): sin ella, ser pequeño no tenía coste y la masa se desplomaba. Castiga lo pequeño, visible y descuidado; se mitiga con oído, miedo, grupo y velocidad.
- **Competencia por interferencia**: los individuos más pesados desplazan a los pequeños de los parches (jerarquía de dominancia). Sin ella la selección favorecía siempre el tamaño mínimo (ventaja r) y las poblaciones llegaban a ~4800. Con ella el tamaño responde a la densidad (selección r/K) y ya no hay tendencia universal.
- **Principio de Jarman–Bell** (los grandes digieren mejor la fibra) y velocidad ∝ m^0,1: equilibran el tamaño sin que la masa domine la velocidad (la longitud de patas es la principal fuente heredable de velocidad, que además es lo visible).
- **Dispersión natal con selección de hábitat**, sesgada hacia los machos, y **evitación de parientes** al elegir pareja; **localización de pareja a distancia** por olfato y llamadas. Sin ellas las colonias esquilmaban su zona, se aislaban o se volvían muy endogámicas.
- **Caza realista**: rastreo olfativo, acecho lento poco visible, sprint corto (más largo si el cazador es claramente más rápido: cazadores de carrera), la presa huye en cuanto ve la carga, captura casi segura si la alcanza (la defensa está en no ser alcanzada o en la coraza), elección de presas lentas, y **la carne vale ~2× la hierba**. Se corrigió además un fallo de utilidad: el cazador abandonaba el cadáver recién cazado para volver a cazar.
- **Fundadores con estructura de edades** (30 % juveniles): una cohorte de adultos de la misma edad envejecía a la vez y hundía la colonia en el año 2–3.

## Diseño de los experimentos de selección (H1)

- Parcela de laboratorio algo más rica (`targetProductivityPerCell` 9) para tener poblaciones medibles; tratamiento y control comparten semilla y se comparan entre sí.
- (a) Depredadores de carrera mantenidos al 10 % de la población de presas (presión sostenida). Éxito: velocidad ≥ 0,2 DE por encima del control.
- (b) Anomalía de −5 °C. Éxito: tolerancia efectiva al frío (−límite inferior de confort, que integra genes de tolerancia, pelaje, grasa y tamaño) ≥ 0,2 DE sobre el control. Una extinción cuenta como fallo.
- (c) Rasgos neutros sin pleiotropía ni condiciones activas: la media de sus cambios entre semillas no se distingue de cero (|t| < 2,1) y sí cambian.
- (d) Cuello de botella clásico de genética de la conservación: 6 supervivientes (3+3) de un refugio local, población ≤ 15 durante 3 años y 1 de recuperación. Éxito: diversidad < 0,85× y carga homocigota > 1,3× el control. Está cerca del umbral porque, con tan pocos fundadores, a veces la deriva purga los alelos deletéreos: también eso es biología real.
