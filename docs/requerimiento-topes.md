# Requerimiento: Topes por categoría en cada quincena

**Estado:** implementado (v17) · **Fecha:** 20 de octubre de 2026 (revisado el 28 de octubre de 2026)

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
  - En una quincena que **no** está en curso no se muestran los días ni el ritmo. La barra, el color y *"Te quedan / Te pasaste"* sí se muestran: en una que ya cerró, como resumen de cómo terminó; en una futura, con lo que ya tiene planeado. El botón **+** sigue disponible en las dos (para gastos atrasados o adelantados).
- **RF-06a.** La quincena se identifica por su fecha de cobro (el 15 o el 30), y termina el día de la siguiente fecha de cobro. Es la misma regla que se usa para crear quincenas: si la fecha es antes del 20, termina el 30 de ese mes (o el último día si el mes no tiene 30); si no, el 15 del mes siguiente.
  - La quincena **en curso** es la quincena en la que estamos hoy: la que cumple `fecha ≤ hoy < fin`. Hay como mucho una.
  - **No** es la más reciente ni la que está seleccionada en pantalla. Es normal crear quincenas con meses de anticipación, así que la más reciente casi siempre es una futura.
  - Si no existe una quincena que cubra hoy (por ejemplo, porque falta crear la de hoy entre otras ya creadas), no hay quincena en curso: no se muestran días, ritmo ni avisos.
- **RF-07.** Cada tope tiene un botón **+** que abre el formulario de gasto con esa categoría elegida y *Pagado* marcado, para anotar un gasto en segundos.

### 3.3 Avisos
- **RF-08.** Los avisos son solo de la quincena **en curso** (RF-06a), nunca de quincenas futuras o pasadas. Siguen la misma regla que el color de la barra (RF-06): amarillo cuando pct ≥ 80 % y ≤ 100 %, y rojo con el monto excedido cuando pct > 100 %. Si hay varios topes, sale un aviso por cada uno, y el rojo va primero.
  - Los avisos se ven en la pestaña *Quincena* aunque esté seleccionada otra quincena (por ejemplo, una futura). En ese caso indican de cuál son (*"Quincena del 15 de octubre: Ocio al 85 %"*), y al tocarlos se pasa a la quincena en curso.

### 3.4 Balance
- **RF-09.** *"Si pagas todo"* aparta lo que queda de los topes: `ingresos − total de gastos − reservaTopes`, donde `reservaTopes = Σ max(0, queda)` de cada tope. "Total de gastos" ya incluye los pendientes, así que lo comprometido no se cuenta dos veces. Un tope excedido aporta 0 a la reserva (no resta más; el exceso ya está en el total de gastos).
  - El texto cambia a *"Si pagas todo y gastas tus topes: $X"* solo cuando reservaTopes > 0. Si no, queda como hoy.
  - Para que no confunda que el número baje, debajo se muestra el desglose en letra pequeña: *"$300.00 − $100.00 apartados para topes"*. El primer número es ingresos − total de gastos y el segundo, reservaTopes.
  - El *Balance restante* no cambia (sigue siendo ingresos − pagado).

### 3.5 Quincena nueva
- **RF-10.** Al crear una quincena, los topes se copian de la quincena **en curso** (RF-06a), aunque la nueva se cree varios meses después de ella. Si no hay quincena en curso, se copian de la última que ya empezó (la de fecha más reciente ≤ hoy); si tampoco hay, la nueva queda sin topes. Lo que sobró **no** pasa a la siguiente.
  - Cambiar los topes de la quincena en curso no cambia los de las quincenas futuras ya creadas: cada quincena guarda sus propios topes.

### 3.6 Reportes
- **RF-11.** Gráfica **Topes vs. usado**: por quincena, la suma de los topes y la suma de lo **usado** (gastado + comprometido, RF-05) en esas categorías, igual que en la barra. El detalle por categoría aparece al pasar el cursor o tocar. Solo se muestra si alguna quincena del rango tiene topes.
- **RF-12.** En el historial, cada quincena con topes muestra `Topes: usado / tope`, en rojo si usado > tope.

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
| Quincena en curso | `quincenaEnCurso()` devuelve la quincena con `fecha ≤ hoy < finQuincena(fecha)`, o `null`. La usan el ritmo (RF-06), los avisos (RF-08) y la copia de topes (RF-10). No se usa `S.periodos[0]`, que es la más reciente y puede ser futura. |
| Interfaz | Panel `#topesPanel` en `index.html`, diálogo `#topeDialog`; `openGasto(null, preset)` acepta categoría y pagado. |
| Esquema | `alter table public.periodos add column if not exists topes jsonb not null default '{}'::jsonb;` y verificación en `fetchAll()`. |
| Versión | `CACHE` y `?v=` pasan de 16 a 17. |

## 6. Fuera de alcance (posibles mejoras)
- Tope como **porcentaje** de los ingresos de la quincena.
- **Arrastrar** lo que sobró a la quincena siguiente.
- Topes para varias categorías juntas (p. ej. "Ocio + Comida").
- Fechas de cobro distintas del 15 y el 30 (p. ej. cobrar los viernes cada dos semanas). Hoy toda la app asume el 15 y el 30.
- Contar en el tope gastos sin categoría que parezcan de esa categoría.

## 7. Criterios de aceptación
1. Con un tope de Ocio de $80 y gastos de ocio pagados por $35, la sección muestra `$35.00 de $80.00`, la barra al 44 % y *"Te quedan $45.00"*.
2. Agregar un gasto de ocio pendiente de $30 pone la barra al 81 % (amarilla, $35 sólido + $30 tenue), el texto sigue diciendo `$35.00 de $80.00`, dice *"Te quedan $15.00"* y, si es la quincena en curso, aparece el aviso del 80 %.
3. Con $95 de ocio (pagado o pendiente), la barra se ve roja y llena, dice *"Te pasaste $15.00"*, en vez del ritmo dice *"Sin margen hasta el …"* y el aviso es rojo. Con exactamente $80 la barra es amarilla y dice *"Te quedan $0.00"*.
4. Con ingresos de $1,000, gastos por $700 y un tope de Comida de $150 con $50 usados, *"Si pagas todo y gastas tus topes"* muestra $200.00 y el desglose *"$300.00 − $100.00 apartados para topes"*. Con todos los topes usados o excedidos, el texto vuelve a *"Si pagas todo"* y coincide con ingresos − total.
5. El 21 de una quincena del 15, con $45 que quedan, se muestra *"9 días → ~$5/día"* (del 21 al 29); con $41, *"9 días → ~$4/día"*.
6. Al guardar un tope de $0 o vacío, el diálogo no lo guarda y pide un monto.
7. Una quincena ya cerrada muestra la barra y *"Te quedan / Te pasaste"*, pero no los días ni el ritmo.
8. Un gasto de $20 en *Personal* o sin categoría con la descripción "cine" no cambia el tope de Ocio.
9. Al crear una quincena nueva, aparece con los topes de la quincena en curso y sin nada usado.
10. Hoy es 28 de octubre, la quincena en curso es la del 15 de octubre (Ocio $80) y ya existen quincenas creadas hasta el 15 de enero (Ocio $60). Entonces:
    - la quincena del 30 de enero se crea con Ocio $80;
    - con la del 15 de enero seleccionada, el aviso de Ocio que se muestra es el de la quincena del 15 de octubre;
    - la del 15 de enero no muestra días ni ritmo.
11. Sin conexión se puede crear, cambiar y quitar un tope; los cambios se envían al volver la red.
12. En *Reportes* aparece la gráfica *Topes vs. usado*, que cuenta los pendientes igual que la barra, y el dato `usado / tope` en el historial.
