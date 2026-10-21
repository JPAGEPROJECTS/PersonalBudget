# Requerimiento: Topes por categoría en cada quincena

**Estado:** implementado (v15) · **Fecha:** 20 de octubre de 2026

## 1. Problema

Quincy controla bien lo que se planea (alquiler, tarjetas, metas), pero no lo que se gasta sin planear: salidas, comida fuera, ropa. Ese gasto variable es donde más se escapa el dinero, y hoy no hay forma de ponerle un límite ni de saber cuánto queda disponible a mitad de quincena.

## 2. Objetivo

Que cada quincena pueda tener un **tope** (monto máximo) por categoría de gasto, empezando por 🎮 **Ocio**, y que la app muestre en todo momento cuánto se ha gastado, cuánto queda y a qué ritmo diario se puede gastar.

Se hace por categoría (no solo ocio) para que el mismo control sirva para Comida, Personal, etc., sin rehacer nada.

## 3. Alcance

### 3.1 Definir topes
- **RF-01.** En la pestaña *Quincena* hay una sección **Topes** con el botón **+ Tope**.
- **RF-02.** Un tope tiene: categoría (de la lista de categorías de gastos, excepto *Deudas* y *Ahorro*, que son pagos planeados) y monto. El monto acepta expresiones como `50+30`, igual que el salario.
- **RF-03.** Solo puede haber un tope por categoría en cada quincena. Tocar un tope lo abre para cambiar el monto o quitarlo.
- **RF-04.** Si la quincena no tiene topes, la sección muestra una invitación: *"Ponle un tope a tu ocio"*, con el botón que abre el diálogo con *Ocio* ya elegido.

### 3.2 Seguimiento
- **RF-05.** Lo **gastado** en una categoría es la suma de los gastos de la quincena con esa categoría marcados como pagados. Lo **comprometido** es la suma de los pendientes de esa categoría.
- **RF-06.** Cada tope muestra:
  - `gastado de tope` y una barra con lo gastado (color sólido) y lo comprometido (color tenue);
  - el color de la barra: normal por debajo de 80 %, amarillo desde 80 %, rojo al pasarse;
  - *"Te quedan $X"* o *"Te pasaste $X"*;
  - si la quincena está en curso, los días que faltan para la siguiente quincena y el ritmo diario: *"9 días → ~$5/día"*.
- **RF-07.** Cada tope tiene un botón **+** que abre el formulario de gasto con esa categoría elegida y *Pagado* marcado, para anotar un gasto en segundos.

### 3.3 Avisos
- **RF-08.** En la quincena más reciente, cuando lo gastado + comprometido llega al 80 % del tope, aparece un aviso amarillo; al pasarse, un aviso rojo con el monto excedido.

### 3.4 Balance
- **RF-09.** *"Si pagas todo"* aparta lo que queda de los topes: `ingresos − total de gastos − Σ max(0, tope − gastos de la categoría)`. El texto lo indica: *"Si pagas todo y gastas tus topes: $X"*. El *Balance restante* no cambia (sigue siendo ingresos − pagado).

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
| Cálculo | `topesDe(p)` devuelve por categoría `{ tope, gastado, comprometido, usado, queda, pct }`; `resumen(p)` agrega `reservaTopes` y la usa en `finalBalance`. |
| Fin de quincena | `finQuincena(fecha)`: si el día es < 20 termina el 30 (o el último día del mes); si no, el 15 del mes siguiente. Es la misma regla de `nextQuincena`. |
| Interfaz | Panel `#topesPanel` en `index.html`, diálogo `#topeDialog`; `openGasto(null, preset)` acepta categoría y pagado. |
| Esquema | `alter table public.periodos add column if not exists topes jsonb not null default '{}'::jsonb;` y verificación en `fetchAll()`. |
| Versión | `CACHE` y `?v=` pasan de 14 a 15. |

## 6. Fuera de alcance (posibles mejoras)
- Tope como **porcentaje** de los ingresos de la quincena.
- **Arrastrar** lo que sobró a la quincena siguiente.
- Topes para varias categorías juntas (p. ej. "Ocio + Comida").

## 7. Criterios de aceptación
1. Con un tope de Ocio de $80 y gastos de ocio pagados por $35, la sección muestra `$35.00 de $80.00`, la barra al 44 % y *"Te quedan $45.00"*.
2. Agregar un gasto de ocio pendiente de $30 pone la barra al 81 % (amarilla) y en la quincena más reciente aparece el aviso del 80 %.
3. Con $95 de ocio, la barra se ve roja, dice *"Te pasaste $15.00"* y el aviso es rojo.
4. *"Si pagas todo"* baja exactamente lo que queda de los topes; con todos los topes usados o excedidos coincide con ingresos − total.
5. Al crear una quincena nueva, aparece con los mismos topes y lo gastado en $0.
6. Sin conexión se puede crear, cambiar y quitar un tope; los cambios se envían al volver la red.
7. En *Reportes* aparece la gráfica *Topes vs. gastado* y el dato en el historial.
