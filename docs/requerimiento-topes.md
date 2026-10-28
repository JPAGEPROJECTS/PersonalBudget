# Requerimiento: Topes por categoría en cada quincena

**Estado:** pendiente. Solo existen la columna en `schema.sql` y los datos de ejemplo en `demo.sql`; la interfaz y el cálculo están por hacer · **Fecha:** 20 de octubre de 2026 (revisado el 28 de octubre de 2026)

## 1. Problema

Quincy controla bien lo que se planea (alquiler, tarjetas, metas), pero no lo que se gasta sin planear: salidas, comida fuera, ropa. Ese gasto variable es donde más se escapa el dinero, y hoy no hay forma de ponerle un límite ni de saber cuánto queda disponible a mitad de quincena.

## 2. Objetivo

Que cada quincena pueda tener un **tope** (monto máximo) por categoría de gasto, empezando por 🎮 **Ocio**, y que la app muestre en todo momento cuánto se ha gastado, cuánto queda y a qué ritmo diario se puede gastar.

Se hace por categoría (no solo ocio) para que el mismo control sirva para Comida, Personal, etc., sin rehacer nada.

## 3. Alcance

### 3.1 Definir topes
- **RF-01.** En la pestaña *Quincena* hay una sección **Topes** con el botón **+ Tope**.
- **RF-02.** Un tope tiene: categoría (de la lista de categorías de gastos, excepto *Deudas* y *Ahorro*, que son pagos planeados) y monto. El monto acepta expresiones como `50+30`, igual que el salario, y debe ser mayor que $0: con $0 o vacío, el diálogo no guarda y pide un monto. Para dejar de controlar una categoría se quita el tope; no se pone en $0.
- **RF-03.** Solo puede haber un tope por categoría en cada quincena. Tocar un tope lo abre para cambiar el monto o quitarlo.
- **RF-04.** Si la quincena no tiene topes, la sección muestra una invitación: *"Ponle un tope a tu ocio"*, con el botón que abre el diálogo con *Ocio* ya elegido.

### 3.2 Seguimiento
- **RF-05.** Para cada categoría con tope se calculan:
  - **gastado**: suma de los gastos de la quincena con esa categoría marcados como pagados;
  - **comprometido**: suma de los gastos pendientes de esa categoría;
  - **usado** = gastado + comprometido;
  - **queda** = tope − usado (negativo si te pasaste);
  - **pct** = usado ÷ tope × 100.

  Solo cuentan los gastos cuya categoría es exactamente la del tope. Los gastos sin categoría o de otra categoría no cuentan, aunque por su descripción parezcan de ocio. Por eso el formulario de gasto sigue sugiriendo la categoría a partir de la descripción, como hoy.
- **RF-06.** Cada tope muestra:
  - `gastado de tope` (el texto muestra solo lo pagado) y una barra con lo gastado (color sólido) y lo comprometido (color tenue). La barra se corta al 100 %;
  - el color de la barra, según **pct** (o sea, contando lo comprometido): normal por debajo de 80 %, amarillo desde 80 % hasta 100 %, rojo por encima de 100 %. Llegar justo al tope es amarillo, no rojo;
  - *"Te quedan $X"* si queda ≥ 0, o *"Te pasaste $X"* si queda < 0. Las dos usan **queda**, así que los pendientes ya cuentan como gastados;
  - si la quincena está en curso, los días que faltan y el ritmo diario. **Días** son los que van desde hoy (incluido) hasta el día anterior al fin de la quincena (ver RF-06a). **Ritmo** = queda ÷ días, redondeado **hacia abajo** a dólares enteros, para que seguirlo nunca te haga pasarte del tope: con $41 y 9 días ($4.56) dice *"9 días → ~$4/día"*. Si queda ≤ 0, en vez del ritmo dice *"Sin margen hasta el {fecha de fin}"*. Si queda > 0 pero el ritmo es menor de $1, se muestra con centavos, también redondeados hacia abajo (*"~$0.50/día"*).
  - En una quincena que **no** está en curso (ya cerró o todavía no empieza) no se muestran los días ni el ritmo. La barra, el color y *"Te quedan / Te pasaste"* sí se muestran, como resumen de cómo terminó. Para anotar gastos atrasados, el botón **+** sigue disponible.
- **RF-06a.** La quincena se identifica por su fecha de cobro (el 15 o el 30), y termina el día de la siguiente fecha de cobro. Es la misma regla que se usa para crear quincenas: si la fecha es antes del 20, termina el 30 de ese mes (o el último día si el mes no tiene 30); si no, el 15 del mes siguiente. Una quincena está **en curso** si hoy cae entre su fecha y el día anterior a su fin.
- **RF-07.** Cada tope tiene un botón **+** que abre el formulario de gasto con esa categoría elegida y *Pagado* marcado, para anotar un gasto en segundos.

### 3.3 Avisos
- **RF-08.** En la quincena más reciente, el aviso sigue la misma regla que el color de la barra (RF-06): amarillo cuando pct ≥ 80 % y ≤ 100 %, y rojo con el monto excedido cuando pct > 100 %. Si hay varios topes, sale un aviso por cada uno, y el rojo va primero.

### 3.4 Balance
- **RF-09.** *"Si pagas todo"* aparta lo que queda de los topes: `ingresos − total de gastos − reservaTopes`, donde `reservaTopes = Σ max(0, queda)` de cada tope. "Total de gastos" ya incluye los pendientes, así que lo comprometido no se cuenta dos veces. Un tope excedido aporta 0 a la reserva (no resta más; el exceso ya está en el total de gastos).
  - El texto cambia a *"Si pagas todo y gastas tus topes: $X"* solo cuando reservaTopes > 0. Si no, queda como hoy.
  - Para que no confunda que el número baje, debajo se muestra el desglose en letra pequeña: *"$300.00 − $100.00 apartados para topes"*. El primer número es ingresos − total de gastos y el segundo, reservaTopes.
  - El *Balance restante* no cambia (sigue siendo ingresos − pagado).

### 3.5 Quincena nueva
- **RF-10.** Al crear una quincena, los topes se copian de la quincena actual. Lo que sobró **no** pasa a la siguiente.

### 3.6 Reportes
- **RF-11.** Gráfica **Topes vs. gastado**: por quincena, la suma de los topes y la suma de lo gastado en esas categorías; el detalle por categoría aparece al pasar el cursor o tocar. Solo se muestra si alguna quincena del rango tiene topes.
- **RF-12.** En el historial, cada quincena con topes muestra `Topes: gastado / tope` (en rojo si se pasó).

## 4. Requerimientos no funcionales
- **RNF-01.** Funciona sin conexión, con la misma cola de cambios que el resto de la app.
- **RNF-02.** Respeta el modo claro/oscuro y el diseño de escritorio (panel en la columna izquierda) y móvil.
- **RNF-03.** Migración sin pérdida de datos: `schema.sql` se puede volver a ejecutar. Si falta la columna, la app pide *"Actualiza la base de datos"*.

## 5. Diseño técnico

| Parte | Decisión |
|---|---|
| Datos | Columna `periodos.topes jsonb not null default '{}'`, con la forma `{"ocio": 80, "comida": 120}`. Se eligió JSON en la quincena en vez de una tabla aparte: los topes son pocos, siempre se leen junto con su quincena, se copian con ella y heredan sus permisos (RLS) sin cambios. |
| Cálculo | `topesDe(p)` devuelve por categoría `{ tope, gastado, comprometido, usado, queda, pct }` con las fórmulas de RF-05; `resumen(p)` agrega `reservaTopes = Σ max(0, queda)` y la usa en `finalBalance`. Los montos se redondean con `round2`. |
| Fin de quincena | `finQuincena(fecha)` devuelve la fecha de la siguiente quincena (RF-06a): si el día es < 20, el 30 (o el último día del mes); si no, el 15 del mes siguiente. Es la misma regla de `nextQuincena`, que conviene extraer a una función compartida. `diasRestantes = finQuincena(p.fecha) − hoy` (en días, sin contar el día de fin). |
| Interfaz | Panel `#topesPanel` en `index.html`, diálogo `#topeDialog`; `openGasto(null, preset)` acepta categoría y pagado. |
| Esquema | `alter table public.periodos add column if not exists topes jsonb not null default '{}'::jsonb;` y verificación en `fetchAll()`. |
| Versión | `CACHE` y `?v=` suben a la siguiente versión al implementarlo (hoy están en 16). |

## 6. Fuera de alcance (posibles mejoras)
- Tope como **porcentaje** de los ingresos de la quincena.
- **Arrastrar** lo que sobró a la quincena siguiente.
- Topes para varias categorías juntas (p. ej. "Ocio + Comida").
- Fechas de cobro distintas del 15 y el 30 (p. ej. cobrar los viernes cada dos semanas). Hoy toda la app asume el 15 y el 30.
- Contar en el tope gastos sin categoría que parezcan de esa categoría.

## 7. Criterios de aceptación
1. Con un tope de Ocio de $80 y gastos de ocio pagados por $35, la sección muestra `$35.00 de $80.00`, la barra al 44 % y *"Te quedan $45.00"*.
2. Agregar un gasto de ocio pendiente de $30 pone la barra al 81 % (amarilla, $35 sólido + $30 tenue), el texto sigue diciendo `$35.00 de $80.00`, dice *"Te quedan $15.00"* y en la quincena más reciente aparece el aviso del 80 %.
3. Con $95 de ocio (pagado o pendiente), la barra se ve roja y llena, dice *"Te pasaste $15.00"*, en vez del ritmo dice *"Sin margen hasta el …"* y el aviso es rojo. Con exactamente $80 la barra es amarilla y dice *"Te quedan $0.00"*.
4. Con ingresos de $1,000, gastos por $700 y un tope de Comida de $150 con $50 usados, *"Si pagas todo y gastas tus topes"* muestra $200.00 y el desglose *"$300.00 − $100.00 apartados para topes"*. Con todos los topes usados o excedidos, el texto vuelve a *"Si pagas todo"* y coincide con ingresos − total.
5. El 21 de una quincena del 15, con $45 que quedan, se muestra *"9 días → ~$5/día"* (del 21 al 29); con $41, *"9 días → ~$4/día"*.
6. Al guardar un tope de $0 o vacío, el diálogo no lo guarda y pide un monto.
7. Una quincena ya cerrada muestra la barra y *"Te quedan / Te pasaste"*, pero no los días ni el ritmo.
8. Un gasto de $20 en *Personal* o sin categoría con la descripción "cine" no cambia el tope de Ocio.
9. Al crear una quincena nueva, aparece con los mismos topes y lo gastado en $0.
10. Sin conexión se puede crear, cambiar y quitar un tope; los cambios se envían al volver la red.
11. En *Reportes* aparece la gráfica *Topes vs. gastado* y el dato en el historial.
