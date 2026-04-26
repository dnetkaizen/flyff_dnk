# Arquitectura de Trabajo — IAs en Flyff Universe Helper
**Documento para:** Claude Sonnet, Claude Opus, ULTRON_NK, DeepSeek, GLM y cualquier IA futura  
**Mantenido por:** DNK (dnetkaizen@gmail.com)  
**Última actualización:** 2026-04-26

---

## LEER ANTES DE TOCAR CUALQUIER ARCHIVO

Este proyecto usa **Git Flow simplificado**. Antes de escribir una sola línea de código o documentación, crea tu rama. Nunca trabajes directo en `main` o `develop`.

---

## Estructura de ramas

```
main
│   └── Producción. Solo código probado en el juego real.
│       NADIE escribe directo aquí. Solo merges aprobados por DNK.
│
develop
│   └── Integración. Aquí llegan todos los merges antes de ir a main.
│       Se revisa que todo compile y no haya conflictos.
│
feature/[nombre]          → nuevas funcionalidades
fix/[nombre]              → corrección de bugs
docs/[nombre]             → documentación únicamente
session/[ia]-[fecha]      → sesión completa de una IA (exploración, debug, investigación)
refactor/[nombre]         → refactors sin cambiar funcionalidad
```

---

## Convención de nombres

```bash
feature/mob-filter            # filtrar mobs por categoría
feature/pet-food-loop         # loop de recolección de alimento
feature/auto-buff             # sistema de buffs automático
feature/item-pickup           # recoger ítems del suelo

fix/webgl-canvas-context      # bug específico
fix/load-event-timing         # bug específico

docs/canvas-events            # investigación de eventos
docs/handoff                  # handoff entre IAs
docs/ia-workflow              # este archivo

session/sonnet-20260426       # sesión de Claude Sonnet, 26 abril 2026
session/opus-20260427         # sesión de Opus
session/ultron-20260428       # sesión de ULTRON_NK
session/deepseek-20260429     # sesión de DeepSeek

refactor/detection-engine     # refactor del sistema de detección
```

---

## Flujo de trabajo — paso a paso

### Como IA trabajando en una feature

```bash
# 1. Siempre partir desde develop actualizado
git checkout develop
git pull origin develop

# 2. Crear tu rama
git checkout -b feature/nombre-descriptivo
# o para sesión completa:
git checkout -b session/[tu-nombre]-[fecha-YYYYMMDD]

# 3. Trabajar, commitear frecuentemente
git add src/utils/imageDetection.ts
git commit -m "feat(detection): agregar filtro de pixeles blancos en template matching"

# 4. Cuando termines, push
git push origin feature/nombre-descriptivo

# 5. Notificar a DNK para que haga el merge a develop
```

### Como IA trabajando solo en documentación

```bash
git checkout develop
git checkout -b docs/[tema]
# escribir documentación
git add documentation_dnk/
git commit -m "docs: [descripción]"
git push origin docs/[tema]
```

---

## Formato de commit messages

Seguimos **Conventional Commits**:

```
tipo(scope): descripción corta en español o inglés

tipos válidos:
  feat     → nueva funcionalidad
  fix      → corrección de bug
  docs     → solo documentación
  refactor → cambio de código sin nueva funcionalidad ni fix
  test     → agregar o modificar tests
  chore    → cambios de configuración, build, etc.

scope (opcional):
  detection   → sistema de template matching
  radar       → sistema de radar de cursor
  inputs      → inyección de mouse/teclado
  ui          → interfaz del panel
  debug       → panel de debug
  build       → webpack, manifests
  docs        → documentación

ejemplos:
  feat(radar): agregar filtro de mobs por color de nombre
  fix(inputs): corregir bug de evento load en document_end
  docs(detection): documentar flujo de canvas WebGL
  refactor(ui): extraer debugLog a clase separada
```

---

## Reglas de protección

| Rama | Regla |
|---|---|
| `main` | SOLO DNK puede mergear. Requiere que compile y funcione en juego. |
| `develop` | IAs pueden mergear sus ramas aquí con PR. |
| `feature/*` | Cada IA es dueña de su rama. |
| `session/*` | Rama temporal. Se elimina después del merge. |

---

## Lo que NUNCA debes hacer

```bash
# ❌ NUNCA
git push origin main           # push directo a main
git push --force               # force push en cualquier rama compartida
git commit -m "fix"            # mensaje vago
git add .                      # agregar todo sin revisar (puede incluir .env, secrets)
git rebase -i origin/main      # reescribir historia de ramas compartidas

# ✅ SIEMPRE
git add src/archivo-especifico.ts   # agregar archivos específicos
git commit -m "feat(scope): descripción clara"
git push origin mi-rama-propia
```

---

## Estado actual del proyecto (2026-04-26)

```
main
├── 04f348b Initial commit
├── 84853fd feat: template matching, debug panel, WebGL fixes (Sonnet + Opus)
├── 18afb55 docs: documentation_dnk (ULTRON_NK)
└── 5c7efd2 docs: canvas events research (Sonnet)

develop     ← creada hoy, espejo de main
└── docs/ia-workflow  ← esta rama (en progreso)

Tags:
  v0.1.0      → versión base
  opus-code   → marca sesión de Opus
  ultron-docs → marca sesión de ULTRON_NK
```

---

## Handoff entre IAs — Protocolo

Cuando termines tu sesión:

1. **Commitear todo** — no dejar trabajo sin commitear
2. **Actualizar** `documentation_dnk/handoff_completo.md` con:
   - Qué hiciste
   - Qué funciona / qué no
   - Qué queda pendiente con instrucciones exactas
3. **Crear tag** con tu nombre y fecha:
   ```bash
   git tag [ia]-[fecha]   # ejemplo: sonnet-20260426
   git push origin --tags
   ```
4. **Push de tu rama** para que la siguiente IA la vea

---

## Archivos críticos — no borrar ni renombrar sin avisar a DNK

| Archivo | Por qué es crítico |
|---|---|
| `src/utils/monster_template_b64.ts` | Imagen embebida, si se borra el template matching falla |
| `src/utils/inputs.ts` | Fix del bug load event, crítico para mouse handlers |
| `src/utils/imageDetection.ts` | Todo el sistema de detección |
| `src/flyff.ts` | App principal, 1800+ líneas |
| `documentation_dnk/handoff_completo.md` | Contexto acumulado de todas las sesiones |

---

## Contexto rápido del proyecto

- **Juego:** Flyff Universe (universe.flyff.com/play) — WebGL + Emscripten/WASM
- **Extensión:** Chrome MV3 / Firefox MV2
- **Build:** `npm run build-chrome` → `dist/chrome/`
- **El juego sobreescribe** el objeto `chrome` global — no usar `chrome.runtime.getURL`
- **Canvas usa WebGL** — no se puede `getContext('2d')` directo, hay que copiar a canvas temporal
- **JSEvents** es el hub de eventos de Emscripten — el punto de interceptación correcto
- **Cursor `curattack`** = mob bajo el cursor, `curitem` = ítem en suelo (ver `canvas_events_research.md`)

---

## Contacto

**DNK** — dnetkaizen@gmail.com  
Repositorio: `C:\Users\SIEMENS\Documents\flyff_fwc_bot\flyff-universe-helper`
