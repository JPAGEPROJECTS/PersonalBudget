# Presupuesto Quincenal

Versión web del `presupuesto.xlsx`: solo HTML, CSS y JS, con datos en Supabase. No necesita servidor; se puede abrir en GitHub Pages, Netlify, Vercel, Cloudflare Pages o cualquier hosting estático.

## Qué hace (igual que el Excel, más ágil)

| Excel | Web |
|---|---|
| Una hoja por quincena | Selector de quincena + **Nueva quincena** que copia los gastos de la actual (sin marcar como pagados) |
| Salario quincenal (C4) | Se edita tocando la tarjeta *Salario* (acepta `505+270`) |
| ✅ Sí / ❌ No | Círculo para marcar como pagado con un toque |
| Total gastos / Total pagado / Balance restante | Se calculan en vivo, junto con *Pendiente* y *Si pagas todo* |
| Columna "Monto debt" con fórmulas `*1.02 - C7` | Pestaña **Deudas**: saldo = saldo inicial + cargos − abonos pagados. Botón **+ Interés %**, límite de crédito con disponible, y meta (p. ej. "reducir a 1000") |
| — | **Historial** con el resumen de cada quincena |
| — | Modo oscuro (botón ☀️/🌙, se recuerda en el dispositivo) |

Un gasto vinculado a una deuda (campo *Abono a deuda*) reduce el saldo de esa deuda solo cuando está marcado como pagado.

## Configuración (una vez)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: pega el contenido de `schema.sql` y ejecútalo. Se puede volver a ejecutar sin problema, y también actualiza la versión anterior que tenía login.
3. **Project Settings → API**: copia la *Project URL* y la clave pública (*anon* / *publishable*) en `config.js`.
4. (Opcional) Importar los datos del Excel: ejecuta `seed.sql` en el SQL Editor **una sola vez**, porque si lo repites se duplican los datos.
5. Abre `index.html`.

> **Sin login:** cualquier persona que tenga la URL de la página (o la de Supabase junto con la clave pública) puede ver y modificar los datos. No compartas el enlace.

## Abrirla en el celular

Publícala en un hosting estático, por ejemplo GitHub Pages (sube la carpeta a un repo y activa *Settings → Pages*). En el celular: menú del navegador → **Agregar a pantalla de inicio**.

Para probar en tu PC sin publicar, basta con abrir `index.html` con doble clic.

## Archivos

- `index.html`: estructura y diálogos
- `styles.css`: diseño responsive y los temas claro/oscuro
- `app.js`: lógica, cálculos y conexión con Supabase
- `config.js`: credenciales de Supabase
- `schema.sql`: tablas y políticas de seguridad
- `seed.sql`: datos importados de `presupuesto.xlsx`
