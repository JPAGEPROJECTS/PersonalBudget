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
| — | **Reportes**: gráficas de ingresos vs. gastos pagados, saldo total de deudas y gastos por categoría, más el historial de cada quincena |
| — | Modo oscuro (botón ☀️/🌙, se recuerda en el dispositivo) |

Un gasto vinculado a una deuda (campo *Abono a deuda / aporte a meta*) reduce el saldo de esa deuda solo cuando está marcado como pagado. Si lo vinculas a una meta, suma a tu ahorro.

### Gastos
- **Categoría** (se sugiere sola según la descripción) y **fecha de vencimiento**: arriba de la quincena aparecen avisos de lo vencido o lo que vence en ≤ 3 días.
- **Repetir**: un gasto puede repetirse 📌 *cada quincena* o 📅 *cada mes, en la misma quincena* (p. ej. el alquiler solo en la del 15). Al crear una quincena puedes copiar *solo los fijos*, *todos* o *ninguno*; los mensuales se toman de la quincena del mismo tipo del mes anterior. Los vencimientos se corren a la nueva fecha.
- **Ingresos extra** (bonos, ventas) por quincena; se suman al salario en el balance.
- En *Reportes*, el botón 🪄 asigna categoría a los gastos viejos que no tienen.

### Deudas
- **Día de corte, día de pago y pago mínimo**, con aviso cuando el pago está a ≤ 5 días.
- **Uso del crédito** (saldo ÷ límite) por tarjeta y en total, con marca en 30 %.
- **Plan de pago por deuda**: define un *pago planeado por abono* y/o una *fecha para terminar*. Cada tarjeta muestra cuándo terminas y cuánto pagarías para llegar a tu fecha; en *📅 Plan de pagos y escenarios* compara tu plan, el de tu fecha, pagar 50 % más y solo el mínimo (fin, abonos e interés total), con la tabla abono por abono (pago, interés y saldo). **Respeta cada cuánto abonas**: si el abono fijo de la deuda está marcado *cada mes* (o en tus últimas quincenas solo abonas en la del 15 o solo en la del 30), el plan abona una vez al mes en esa quincena y el interés de la otra se suma al siguiente abono; si no, abona cada quincena. **Los abonos que ya pusiste en tus quincenas (aunque no estén pagados, y aunque varíen) se usan tal cual** (📝 en la tabla); el pago planeado o el del escenario solo se usa en las quincenas siguientes, y la fecha meta calcula cuánto pagar después de lo ya puesto. *Usar como mi plan* guarda el pago elegido, y cada quincena nueva incluye el abono automáticamente (respetando ese patrón). El pago mínimo se toma como mensual.
- **Te deben**: dinero que prestaste, por persona. Sube con *+ Le presté* o con un gasto vinculado al préstamo, y baja con *✓ Me devolvió* o con un ingreso extra marcado como devolución. Cada préstamo guarda la **fecha en que prestaste** y la **fecha en que debe pagarte**: avisa cuando faltan ≤ 3 días o ya está atrasado, y muestra los **días sin abonar** (con aviso desde 30 días si no hay fecha acordada).
- **Plan para salir de deudas**: con lo que pagas por quincena compara *avalancha* (primero la de mayor interés) y *bola de nieve* (primero la de menor saldo): cuántas quincenas tardas, cuánto interés pagas, en qué orden se liquidan y una gráfica del saldo proyectado. El interés puede ser mensual o quincenal.

### Ahorro
Funciona como las deudas, pero al revés: el saldo **sube** con cada aporte.
- **Fondo de emergencia sugerido**: calcula tu gasto fijo mensual (o el promedio, si no marcaste fijos) y propone 3 o 6 meses como objetivo; con un toque crea la meta o ajusta la existente, y muestra cuántos meses cubres.
- **Metas** con objetivo, saldo inicial y fecha opcional, con barra de avance.
- **Aporte planeado**: se agrega solo como gasto (vinculado a la meta) en cada quincena nueva que le toque; cuenta como ahorro al marcarlo pagado.
- **Plan de aportes por meta** (igual que el de deudas): la tarjeta dice cuándo llegas y, si la meta tiene fecha, cuánto apartar. En *📅 Plan de aportes y escenarios* compara tu plan, el de tu fecha, aportar 50 % más y aportar la mitad (fecha, aportes y rendimiento), con gráfica y tabla aporte por aporte (aporte, rendimiento y ahorrado). Respeta si aportas **cada quincena o una vez al mes** (gasto fijo marcado *cada mes* o tus últimas quincenas), usa tal cual los aportes que ya pusiste en tus quincenas y suma el rendimiento cada quincena. *Usar como mi plan* guarda el aporte elegido.
- **Rendimiento % mensual** (cuentas que pagan interés) con botón *+ Rendimiento*, y aportes/retiros manuales que se pueden eliminar con ✕.
- En la quincena aparece un aviso 🐷 cuando lo planeado no alcanza para ir al día, con un botón para agregar el aporte que falta.
- En *Reportes*, gráfica del **ahorro total** por quincena.

### App instalable y sin conexión
- Se instala como app (ícono propio, pantalla completa). En Chrome/Edge aparece el botón ⬇️ arriba.
- **Funciona sin internet**: los datos se guardan en el dispositivo y los cambios que hagas sin conexión se envían solos cuando vuelve la red (arriba se ve *"Sin conexión · N sin guardar"*).

## Configuración (una vez)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: pega el contenido de `schema.sql` y ejecútalo. Se puede volver a ejecutar sin problema y actualiza las versiones anteriores sin perder datos (si la app dice *"Actualiza la base de datos"*, es esto).
3. **Project Settings → API**: copia la *Project URL* y la clave pública (*anon* / *publishable*) en `config.js`.
4. (Opcional) Importar los datos del Excel: ejecuta `seed.sql` en el SQL Editor **una sola vez**, porque si lo repites se duplican los datos.
5. Abre `index.html`.

> **Sin login:** cualquier persona que tenga la URL de la página (o la de Supabase junto con la clave pública) puede ver y modificar los datos. No compartas el enlace.

## Abrirla en el celular

Publícala en un hosting estático, por ejemplo GitHub Pages (sube la carpeta a un repo y activa *Settings → Pages*). En el celular: menú del navegador → **Agregar a pantalla de inicio**.

Para probar en tu PC sin publicar, basta con abrir `index.html` con doble clic (así no se instala ni funciona sin conexión: eso requiere `https`, que GitHub Pages ya da).

Al publicar una versión nueva, sube el número de `CACHE` en `sw.js` y el `?v=` de `styles.css`, `app.js` y `config.js` en `index.html` (y en `sw.js`), para que navegadores y celulares descarguen los archivos nuevos en lugar de usar los guardados.

## Archivos

- `index.html`: estructura y diálogos
- `styles.css`: diseño responsive y los temas claro/oscuro
- `app.js`: lógica, cálculos y conexión con Supabase
- `config.js`: credenciales de Supabase
- `manifest.webmanifest`, `sw.js`, `icons/`: app instalable y modo sin conexión
- `schema.sql`: tablas y políticas de seguridad
- `seed.sql`: datos importados de `presupuesto.xlsx`
