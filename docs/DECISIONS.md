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
