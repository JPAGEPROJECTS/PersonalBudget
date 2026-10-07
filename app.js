(() => {
  "use strict";

  // ---------- Utilidades ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (n) => (n < 0 ? "-$" : "$") + money.format(Math.abs(n || 0));
  const fmt0 = (n) => (n < 0 ? "-$" : "$") + Math.round(Math.abs(n || 0)).toLocaleString("en-US");
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  // Acepta "1,234.50", "$50", o expresiones simples como "505+270" (igual que en Excel)
  function parseNum(input) {
    const s = String(input ?? "").replace(/[$\s,]/g, "").replace(/^=/, "");
    if (s === "") return null;
    if (!/^[\d+\-*/.()]+$/.test(s)) return NaN;
    try {
      const v = Function(`"use strict";return (${s})`)();
      return Number.isFinite(v) ? round2(v) : NaN;
    } catch { return NaN; }
  }
  const parseDay = (v) => { const n = parseInt(v, 10); return n >= 1 && n <= 31 ? n : null; };

  // ---------- Fechas ----------
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const MES3 = MESES.map((m) => m.slice(0, 3).toLowerCase());
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const shortDate = (s) => { const d = parseISO(s); return `${d.getDate()} ${MES3[d.getMonth()]}`; };
  const longDate = (s) => shortDate(s) + (parseISO(s).getFullYear() !== today().getFullYear() ? " " + parseISO(s).getFullYear() : "");
  const monthYear = (d) => `${MES3[d.getMonth()]} ${d.getFullYear()}`;
  // Próxima fecha (desde hoy) en que cae un día del mes; ajusta en meses cortos
  function nextDayOfMonth(day) {
    const t = today();
    const at = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
    let d = at(t.getFullYear(), t.getMonth());
    if (d < t) d = at(t.getFullYear(), t.getMonth() + 1);
    return d;
  }
  const enDias = (n) => (n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`);

  // ---------- UI básica ----------
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  let pending = 0;
  async function busy(promise) {
    pending++; $("#loader").classList.remove("hidden");
    try { return await promise; }
    finally { if (--pending === 0) $("#loader").classList.add("hidden"); }
  }

  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("theme", next);
    window.dispatchEvent(new Event("themechange"));   // las gráficas leen los colores al dibujarse
  });

  // ---------- PWA ----------
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW", e));
  }
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); installEvt = e;
    $("#installBtn").classList.remove("hidden");
  });
  $("#installBtn").addEventListener("click", async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    installEvt = null; $("#installBtn").classList.add("hidden");
  });
  window.addEventListener("appinstalled", () => $("#installBtn").classList.add("hidden"));

  // ---------- Supabase ----------
  const cfg = window.APP_CONFIG || {};
  function showSetup(title, html) {
    $("#appView").classList.add("hidden");
    $("#bottomNav").classList.add("hidden");
    $("#setupView").classList.remove("hidden");
    $("#setupTitle").textContent = title;
    $("#setupMsg").innerHTML = html;
  }
  function showApp() {
    $("#setupView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    $("#bottomNav").classList.remove("hidden");
  }
  if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("TU-PROYECTO")) {
    showSetup("Configura Supabase", "Edita <b>config.js</b> con la URL y la clave pública de tu proyecto, y ejecuta <b>schema.sql</b> en el SQL Editor. Revisa el README.");
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- Estado ----------
  // Nombre de tabla -> clave en S
  const TABLES = { periodos: "periodos", gastos: "gastos", deudas: "deudas", deuda_cargos: "cargos", ingresos: "ingresos", metas: "metas", meta_movs: "metaMovs" };
  const S = {
    periodos: [], gastos: [], deudas: [], cargos: [], ingresos: [], metas: [], metaMovs: [],
    currentId: store.get("periodo"),
    tab: "periodo",
    hidePaid: store.get("hidePaid") === "1",
    range: +(store.get("range") ?? 6),
    offline: false,
  };
  const current = () => S.periodos.find((p) => p.id === S.currentId);
  const gastosDe = (pid) => S.gastos.filter((g) => g.periodo_id === pid).sort((a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at));
  const ingresosDe = (pid) => S.ingresos.filter((i) => i.periodo_id === pid).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byId = (key, id) => S[key].find((x) => x.id === id);

  function resumen(p) {
    const gs = gastosDe(p.id);
    const extra = round2(sum(ingresosDe(p.id), (i) => i.monto));
    const ingresos = round2(+p.salario + extra);
    const total = sum(gs, (g) => g.monto);
    const pagado = sum(gs.filter((g) => g.pagado), (g) => g.monto);
    return {
      gs, extra, ingresos, total: round2(total), pagado: round2(pagado), pendiente: round2(total - pagado),
      balance: round2(ingresos - pagado), finalBalance: round2(ingresos - total),
      ahorro: round2(sum(gs.filter((g) => g.pagado && g.meta_id), (g) => g.monto)),
      nPagados: gs.filter((g) => g.pagado).length,
    };
  }

  function saldoDeuda(d) {
    const cargos = sum(S.cargos.filter((c) => c.deuda_id === d.id), (c) => c.monto);
    const abonos = sum(S.gastos.filter((g) => g.deuda_id === d.id && g.pagado), (g) => g.monto);
    return round2(+d.saldo_inicial + cargos - abonos);
  }
  function saldoMeta(m) {
    const movs = sum(S.metaMovs.filter((x) => x.meta_id === m.id), (x) => x.monto);
    const aportes = sum(S.gastos.filter((g) => g.meta_id === m.id && g.pagado), (g) => g.monto);
    return round2(+m.saldo_inicial + movs + aportes);
  }

  // ---------- Categorías ----------
  const CATS = [
    ["vivienda", "🏠", "Vivienda"], ["servicios", "💡", "Servicios"], ["comida", "🛒", "Comida"],
    ["transporte", "🚗", "Transporte"], ["deudas", "💳", "Deudas"], ["salud", "🩺", "Salud"],
    ["educacion", "🎓", "Educación"], ["personal", "👕", "Personal"], ["ocio", "🎮", "Ocio"],
    ["familia", "👪", "Familia"], ["ahorro", "🐷", "Ahorro"], ["otros", "📦", "Otros"],
  ];
  const catInfo = (k) => CATS.find((c) => c[0] === k);
  const CAT_GUESS = [
    [/alquiler|renta|casa|hipoteca|condominio/i, "vivienda"],
    [/luz|electric|agua|internet|tel[eé]fono|cable|gas\b|celular plan|netflix|spotify|suscrip/i, "servicios"],
    [/super|comida|mercado|almuerzo|restaurante|caf[eé]/i, "comida"],
    [/transporte|gasolina|taxi|uber|bus|metro|peaje|carro|auto/i, "transporte"],
    [/tarjeta|pr[eé]stamo|prest|cr[eé]dito|deuda|cuota/i, "deudas"],
    [/m[eé]dic|farmacia|doctor|seguro|gym|gimnasio|dentista/i, "salud"],
    [/matr[ií]cula|curso|universidad|colegio|libro|escuela/i, "educacion"],
    [/ropa|zapato|pantal[oó]n|camisa|corte|barber/i, "personal"],
    [/ocio|juego|cine|salida|fiesta|viaje|bar\b/i, "ocio"],
    [/mam[aá]|pap[aá]|hermano|hijo|familia|abuel/i, "familia"],
    [/ahorro|fondo/i, "ahorro"],
  ];
  function guessCat(desc, g = {}) {
    if (g.meta_id) return "ahorro";
    if (g.deuda_id) return "deudas";
    return CAT_GUESS.find(([re]) => re.test(desc))?.[1] ?? null;
  }

  // ---------- Datos sin conexión ----------
  // Cada cambio se aplica al estado local, se guarda en el dispositivo y se envía
  // a Supabase en orden. Si no hay red, queda en cola hasta que vuelva.
  const CACHE_KEY = "pb_cache", QUEUE_KEY = "pb_queue";
  let queue = [];
  try { queue = JSON.parse(store.get(QUEUE_KEY) || "[]"); } catch { queue = []; }
  let flushing = false;

  function persist() {
    const snap = {};
    Object.values(TABLES).forEach((k) => (snap[k] = S[k]));
    store.set(CACHE_KEY, JSON.stringify(snap));
    store.set(QUEUE_KEY, JSON.stringify(queue));
    renderSync();
  }
  function enqueue(op) { queue.push(op); persist(); flush(); }

  const db = {
    insert(table, rows) {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: uuid(), created_at: new Date().toISOString(), ...r }));
      S[TABLES[table]].push(...list);
      enqueue({ t: table, op: "insert", rows: list });
      return Array.isArray(rows) ? list : list[0];
    },
    update(table, ids, patch) {
      ids = [].concat(ids);
      S[TABLES[table]].forEach((r) => { if (ids.includes(r.id)) Object.assign(r, patch); });
      enqueue({ t: table, op: "update", ids, patch });
    },
    remove(table, ids) {
      ids = [].concat(ids);
      S[TABLES[table]] = S[TABLES[table]].filter((r) => !ids.includes(r.id));
      enqueue({ t: table, op: "delete", ids });
    },
  };

  const isSchemaErr = (e) => ["42703", "42P01", "PGRST204", "PGRST205"].includes(e?.code);

  async function runOp(op) {
    const t = sb.from(op.t);
    if (op.op === "insert") return t.upsert(op.rows);          // upsert: reintentar es seguro
    if (op.op === "update") return t.update(op.patch).in("id", op.ids);
    return t.delete().in("id", op.ids);
  }

  async function flush() {
    if (flushing || !queue.length) return;
    flushing = true; renderSync();
    let dropped = false;
    try {
      while (queue.length) {
        let res;
        try { res = await busy(runOp(queue[0])); } catch (err) { res = { error: err, status: 0 }; }
        if (res.error) {
          if (!res.status) { S.offline = true; break; }          // sin red: se reintenta luego
          if (isSchemaErr(res.error)) { needsMigration(); break; }
          console.error(res.error, queue[0]);
          toast("No se pudo guardar un cambio: " + res.error.message);
          queue.shift(); dropped = true;
        } else {
          S.offline = false;
          queue.shift();
        }
        persist();
      }
    } finally { flushing = false; renderSync(); }
    if (dropped) loadRemote();                                  // vuelve a lo que tiene el servidor
  }

  function renderSync() {
    const el = $("#syncState");
    const n = queue.length;
    const off = S.offline || !navigator.onLine;
    let txt = "";
    if (off) txt = n ? `Sin conexión · ${n} sin guardar` : "Sin conexión";
    else if (n) txt = flushing ? "Guardando…" : `${n} sin guardar`;
    el.textContent = txt;
    el.classList.toggle("hidden", !txt);
    el.classList.toggle("off", off);
  }

  window.addEventListener("online", () => { S.offline = false; renderSync(); flush().then(loadRemote); });
  window.addEventListener("offline", renderSync);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) flush(); });
  setInterval(() => { if (queue.length) flush(); }, 30000);

  function needsMigration() {
    showSetup("Actualiza la base de datos",
      "Esta versión agrega categorías, vencimientos, ingresos extra, metas de ahorro y datos de tarjetas. " +
      "En Supabase abre <b>SQL Editor</b>, pega el contenido de <b>schema.sql</b> y ejecútalo; luego recarga esta página. " +
      "Tus datos se conservan.");
  }

  // ---------- Carga ----------
  async function fetchAll() {
    const get = (t, order) => {
      let req = sb.from(t).select("*");
      if (order) req = req.order(order);
      return req;
    };
    // Verifica que el esquema esté actualizado
    const probe = await sb.from("gastos").select("id,vence,categoria,fijo,meta_id").limit(1);
    if (probe.error) return { error: probe.error, status: probe.status };
    const results = await Promise.all([
      get("periodos"), get("gastos"), get("deudas", "created_at"), get("deuda_cargos", "created_at"),
      get("ingresos"), get("metas", "created_at"), get("meta_movs", "created_at"),
      sb.from("deudas").select("id,dia_pago,interes_frec").limit(1),
      sb.from("metas").select("id,rendimiento_pct,aporte_quincenal").limit(1),
    ]);
    const bad = results.find((r) => r.error);
    if (bad) return { error: bad.error, status: bad.status };
    const [periodos, gastos, deudas, cargos, ingresos, metas, metaMovs] = results.map((r) => r.data);
    return { data: { periodos, gastos, deudas, cargos, ingresos, metas, metaMovs } };
  }

  let hasData = false;
  async function loadRemote() {
    if (queue.length) return;                     // primero hay que enviar lo pendiente
    let res;
    try { res = await busy(fetchAll()); } catch (err) { res = { error: err, status: 0 }; }
    if (res.error) {
      if (isSchemaErr(res.error)) return needsMigration();
      console.error(res.error);
      if (!res.status) { S.offline = true; renderSync(); }
      if (!hasData) showSetup("No se pudo conectar", `Revisa <b>config.js</b>, tu conexión y que hayas ejecutado <b>schema.sql</b> en Supabase.<br><br><code>${esc(res.error.message)}</code>`);
      return;
    }
    if (queue.length) return;                     // hubo cambios mientras cargaba
    S.offline = false;
    Object.assign(S, res.data);
    hasData = true;
    persist(); showApp(); render();
  }

  async function loadAll() {
    try {
      const cached = JSON.parse(store.get(CACHE_KEY) || "null");
      if (cached?.periodos) { Object.assign(S, cached); hasData = true; showApp(); render(); }
    } catch { /* caché dañado */ }
    renderSync();
    await flush();
    await loadRemote();
  }

  // ---------- Render ----------
  function render() {
    S.periodos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (!current()) S.currentId = S.periodos[0]?.id ?? null;
    renderPeriodSelect();
    renderPeriodo();
    renderDeudas();
    renderMetas();
    if (S.tab === "reportes") renderReportes();
  }

  function renderPeriodSelect() {
    $("#periodSelect").innerHTML = S.periodos
      .map((p) => `<option value="${p.id}" ${p.id === S.currentId ? "selected" : ""}>${esc(p.nombre)}</option>`)
      .join("");
  }

  // Texto y nivel del vencimiento de un gasto
  function venceInfo(g) {
    if (!g.vence) return null;
    if (g.pagado) return { txt: "vence " + shortDate(g.vence), cls: "" };
    const n = daysBetween(today(), parseISO(g.vence));
    if (n < 0) return { txt: `vencido hace ${-n} día${n === -1 ? "" : "s"}`, cls: "neg", alert: true };
    if (n <= 3) return { txt: "vence " + enDias(n), cls: "warn", alert: true };
    return { txt: "vence " + shortDate(g.vence), cls: "" };
  }

  function deudaPagoInfo(d) {
    if (!d.dia_pago || saldoDeuda(d) <= 0) return null;
    const n = daysBetween(today(), nextDayOfMonth(d.dia_pago));
    return { n, txt: `pago ${enDias(n)}`, alert: n <= 5 };
  }

  function renderAlerts(p, gs) {
    const items = [];
    gs.forEach((g) => {
      const v = venceInfo(g);
      if (v?.alert) items.push({ cls: v.cls, html: `<b>${esc(g.descripcion)}</b> ${v.txt} · ${fmt(+g.monto)}` });
    });
    S.deudas.forEach((d) => {
      const pi = deudaPagoInfo(d);
      if (pi?.alert) items.push({ cls: pi.n <= 1 ? "neg" : "warn", html: `💳 <b>${esc(d.nombre)}</b>: ${pi.txt} (día ${d.dia_pago})${d.pago_minimo ? ` · mínimo ${fmt(+d.pago_minimo)}` : ""}` });
    });
    // Metas: solo en la quincena más reciente, si lo planeado no alcanza el ritmo necesario
    if (p.id === S.periodos[0]?.id) S.metas.forEach((m) => {
      const falta = round2(+m.objetivo - saldoMeta(m));
      if (falta <= 0) return;
      const nec = aporteNecesario(m);
      const meta = nec ?? (+m.aporte_quincenal || 0);
      const planeado = round2(sum(gs.filter((g) => g.meta_id === m.id), (g) => g.monto));
      if (meta <= 0 || planeado >= meta - 0.5) return;
      const add = round2(Math.min(meta - planeado, falta));
      items.push({
        cls: "info", icon: "🐷",
        html: `<b>${esc(m.nombre)}</b>: ${nec != null ? `para llegar al ${longDate(m.fecha_meta)} necesitas ${fmt(meta)} por quincena` : `tu aporte es de ${fmt(meta)}`}; ${planeado ? `tienes ${fmt(planeado)} planeado` : "no hay aporte en esta quincena"}.`,
        btn: `<button class="btn sm" type="button" data-action="add-aporte" data-meta="${m.id}" data-monto="${add}">+ ${fmt(add)}</button>`,
      });
    });
    const box = $("#alerts");
    box.classList.toggle("hidden", !items.length);
    box.innerHTML = items.map((a) => `<div class="alert ${a.cls}"><span aria-hidden="true">${a.icon ?? "⚠️"}</span><span class="alert-txt">${a.html}</span>${a.btn ?? ""}</div>`).join("");
  }

  function renderPeriodo() {
    const p = current();
    $("#emptyPeriods").classList.toggle("hidden", !!p);
    $("#periodContent").classList.toggle("hidden", !p);
    $(".period-bar").classList.toggle("hidden", !p);
    if (!p) return;
    store.set("periodo", p.id);

    const r = resumen(p);
    renderAlerts(p, r.gs);
    const bal = $("#balance");
    bal.textContent = fmt(r.balance);
    bal.className = "hero-amount " + (r.balance < 0 ? "neg" : "");
    $("#progressBar").style.width = (r.total > 0 ? Math.min(100, (r.pagado / r.total) * 100) : 0) + "%";
    $("#paidCount").textContent = `${r.nPagados} de ${r.gs.length} pagados`;
    $("#afterAll").textContent = r.pendiente > 0 ? `Si pagas todo: ${fmt(r.finalBalance)}` : "Todo pagado ✓";
    if (document.activeElement !== $("#salaryInput")) $("#salaryInput").value = fmt(+p.salario);
    $("#totalExtra").textContent = fmt(r.extra);
    $("#totalGastos").textContent = fmt(r.total);
    $("#totalPagado").textContent = fmt(r.pagado);
    $("#totalPendiente").textContent = fmt(r.pendiente);
    $("#totalAhorro").textContent = fmt(r.ahorro);

    $("#hidePaidBtn").setAttribute("aria-pressed", S.hidePaid);
    const lista = S.hidePaid ? r.gs.filter((g) => !g.pagado) : r.gs;
    $("#gastoList").innerHTML = lista.map((g) => {
      const cat = catInfo(g.categoria);
      const v = venceInfo(g);
      const deuda = g.deuda_id && byId("deudas", g.deuda_id);
      const meta = g.meta_id && byId("metas", g.meta_id);
      const bits = [
        g.pagado ? "Pagado" : "Pendiente",
        v && `<span class="${v.cls}">${v.txt}</span>`,
        g.fijo && `<span title="Fijo">📌 fijo</span>`,
        deuda && `<span class="badge">Abono ${esc(deuda.nombre)}</span>`,
        meta && `<span class="badge">Ahorro ${esc(meta.nombre)}</span>`,
      ].filter(Boolean);
      return `
      <li class="item ${g.pagado ? "paid" : ""}" data-id="${g.id}">
        <button class="toggle" type="button" data-act="toggle" aria-label="${g.pagado ? "Marcar como no pagado" : "Marcar como pagado"}">✓</button>
        <div class="body" data-act="edit">
          <div class="desc">${cat ? `<span class="cat" title="${cat[2]}">${cat[1]}</span> ` : ""}${esc(g.descripcion)}</div>
          <div class="meta">${bits.join(" · ")}</div>
        </div>
        <span class="amt" data-act="edit">${fmt(+g.monto)}</span>
      </li>`;
    }).join("");
    $("#noGastos").classList.toggle("hidden", lista.length > 0);
    if (!lista.length && r.gs.length) $("#noGastos").textContent = "Todo pagado 🎉";
    else $("#noGastos").innerHTML = "Sin gastos. Toca <b>+</b> para agregar.";

    const ings = ingresosDe(p.id);
    $("#ingresoList").innerHTML = ings.map((i) => `
      <li class="item slim" data-id="${i.id}">
        <div class="body"><div class="desc">${esc(i.descripcion)}</div></div>
        <span class="amt pos">+${fmt(+i.monto)}</span>
      </li>`).join("");
    $("#noIngresos").classList.toggle("hidden", ings.length > 0);
  }

  function renderDeudas() {
    const ds = S.deudas;
    $("#noDeudas").classList.toggle("hidden", ds.length > 0);
    const total = sum(ds, saldoDeuda);
    $("#deudaTotal").textContent = ds.length ? "Total: " + fmt(total) : "";

    const conLimite = ds.filter((d) => +d.limite > 0);
    const usoTotal = conLimite.length ? sum(conLimite, saldoDeuda) / sum(conLimite, (d) => d.limite) * 100 : null;
    $("#deudaSummary").classList.toggle("hidden", !ds.length);
    $("#deudaSummary").innerHTML = ds.length ? `
      <div class="stat"><span class="label">Deuda total</span><strong>${fmt(total)}</strong></div>
      <div class="stat"><span class="label">Uso del crédito</span><strong class="${usoCls(usoTotal)}">${usoTotal == null ? "—" : usoTotal.toFixed(0) + "%"}</strong>
        ${usoTotal != null ? `<span class="muted small">${usoTotal > 30 ? "⚠️ ideal: menos de 30%" : "✓ por debajo de 30%"}</span>` : ""}</div>` : "";

    const pName = (id) => byId("periodos", id)?.nombre ?? "";
    $("#deudaList").innerHTML = ds.map((d) => {
      const saldo = saldoDeuda(d);
      const movs = [
        ...S.cargos.filter((c) => c.deuda_id === d.id).map((c) => ({ t: c.created_at, label: c.nota || "Cargo", m: +c.monto, cargoId: c.id })),
        ...S.gastos.filter((g) => g.deuda_id === d.id && g.pagado).map((g) => ({ t: byId("periodos", g.periodo_id)?.fecha ?? g.created_at, label: "Abono · " + pName(g.periodo_id), m: -g.monto })),
      ].sort((a, b) => String(b.t).localeCompare(String(a.t)));
      const meta = d.meta != null ? +d.meta : null;
      // progreso hacia la meta, medido desde el saldo inicial
      const pct = meta != null && +d.saldo_inicial > meta
        ? Math.max(0, Math.min(100, ((+d.saldo_inicial - saldo) / (+d.saldo_inicial - meta)) * 100)) : null;
      const uso = +d.limite > 0 ? Math.max(0, (saldo / +d.limite) * 100) : null;
      const pi = deudaPagoInfo(d);
      const fechas = [
        d.dia_corte && `Corte: día ${d.dia_corte}`,
        d.dia_pago && `Pago: día ${d.dia_pago}${pi ? ` <b class="${pi.alert ? "warn" : ""}">(${pi.txt})</b>` : ""}`,
        d.pago_minimo && `Mínimo ${fmt(+d.pago_minimo)}`,
      ].filter(Boolean);
      return `
      <div class="card deuda" data-id="${d.id}">
        <div class="deuda-top">
          <h2>${esc(d.nombre)}</h2>
          <span class="deuda-saldo ${saldo <= 0 ? "pos" : ""}">${fmt(saldo)}</span>
        </div>
        ${uso != null ? `
        <div class="uso">
          <div class="hero-row small"><span>Uso del crédito <b class="${usoCls(uso)}">${uso.toFixed(0)}%</b>${uso > 30 ? " ⚠️" : ""}</span><span class="muted">Disponible ${fmt(+d.limite - saldo)} de ${fmt(+d.limite)}</span></div>
          <div class="progress uso-bar"><div class="${usoCls(uso)}" style="width:${Math.min(100, uso)}%"></div><span class="mark30" title="30%"></span></div>
        </div>` : ""}
        <div class="deuda-meta">
          ${fechas.map((f) => `<span>${f}</span>`).join("")}
          ${meta != null ? `<span>Meta: ${fmt(meta)} ${saldo <= meta ? "✓" : `(faltan ${fmt(saldo - meta)})`}</span>` : ""}
          ${+d.interes_pct ? `<span>Interés ${+d.interes_pct}% ${d.interes_frec === "quincenal" ? "quincenal" : "mensual"}</span>` : ""}
        </div>
        ${pct != null ? `<div class="progress meta"><div style="width:${pct}%"></div></div>` : ""}
        <div class="deuda-actions">
          ${+d.interes_pct ? `<button class="btn sm" type="button" data-act="interes">+ Interés ${+d.interes_pct}%</button>` : ""}
          <button class="btn sm" type="button" data-act="cargo">± Cargo</button>
          <button class="btn sm ghost" type="button" data-act="edit">Editar</button>
        </div>
        ${movs.length ? `<details><summary>Movimientos (${movs.length})</summary><div class="movs">
          ${movs.map((m) => `<div><span>${esc(m.label)}</span><span class="mov-amt"><span class="${m.m < 0 ? "pos" : "neg"}">${m.m < 0 ? "−" : "+"}${fmt(Math.abs(m.m))}</span>${m.cargoId ? `<button class="mov-del" type="button" data-act="del-cargo" data-cargo="${m.cargoId}" title="Eliminar cargo" aria-label="Eliminar cargo">✕</button>` : ""}</span></div>`).join("")}
        </div></details>` : ""}
      </div>`;
    }).join("");
    renderSim();
  }
  const usoCls = (u) => (u == null ? "" : u > 50 ? "neg" : u > 30 ? "warn" : "pos");

  // ---------- Simulador de deudas ----------
  // Tasa por quincena a partir del % y la frecuencia
  const tasaQ = (d) => {
    const r = (+d.interes_pct || 0) / 100;
    return d.interes_frec === "quincenal" ? r : Math.pow(1 + r, 0.5) - 1;
  };

  function simular(deudas, pago, estrategia) {
    const ds = deudas.map((d) => ({ id: d.id, nombre: d.nombre, saldo: saldoDeuda(d), rate: tasaQ(d), min: +d.pago_minimo || 0 }))
      .filter((d) => d.saldo > 0.005);
    const serie = [sum(ds, (d) => d.saldo)];
    const fin = {};
    let interes = 0, k = 0;
    while (ds.some((d) => d.saldo > 0.005) && k < 600) {
      k++;
      ds.forEach((d) => { if (d.saldo > 0) { const i = d.saldo * d.rate; d.saldo += i; interes += i; } });
      let disp = pago;
      ds.forEach((d) => { if (d.saldo > 0) { const p = Math.min(d.min, d.saldo, disp); d.saldo -= p; disp -= p; } });
      const orden = ds.filter((d) => d.saldo > 0.005).sort(estrategia === "avalancha"
        ? (a, b) => b.rate - a.rate || a.saldo - b.saldo
        : (a, b) => a.saldo - b.saldo || b.rate - a.rate);
      for (const d of orden) { if (disp <= 0) break; const p = Math.min(d.saldo, disp); d.saldo -= p; disp -= p; }
      ds.forEach((d) => { if (d.saldo <= 0.005 && !fin[d.id]) { d.saldo = 0; fin[d.id] = k; } });
      const tot = sum(ds, (d) => d.saldo);
      serie.push(tot);
      if (k > 2 && tot >= serie[k - 1] - 0.005) return { ok: false, serie };   // el pago no cubre el interés
    }
    const ok = !ds.some((d) => d.saldo > 0.005);
    return { ok, quincenas: k, interes: round2(interes), fin, serie };
  }
  const fechaEn = (q) => { const d = today(); d.setDate(d.getDate() + Math.round(q * 15.22)); return d; };

  function sugerirPago() {
    const p = current();
    const abonos = p ? sum(gastosDe(p.id).filter((g) => g.deuda_id), (g) => g.monto) : 0;
    return round2(abonos || sum(S.deudas, (d) => d.pago_minimo));
  }

  let simStrategy = "avalancha";
  function renderSim() {
    const activas = S.deudas.filter((d) => saldoDeuda(d) > 0);
    $("#simCard").classList.toggle("hidden", !activas.length);
    if (!activas.length) return;
    const input = $("#simPago");
    if (document.activeElement !== input && !input.dataset.touched) input.value = sugerirPago() || "";
    const pago = parseNum(input.value);
    const minTotal = sum(activas, (d) => d.pago_minimo);
    $("#simHint").textContent = "Por defecto, la suma de los abonos a deudas de esta quincena." +
      (minTotal ? ` Pagos mínimos: ${fmt(minTotal)}.` : "") +
      (activas.some((d) => !+d.interes_pct) ? " Las deudas sin interés % se simulan sin interés." : "");
    const out = $("#simResults");
    if (!pago || Number.isNaN(pago) || pago <= 0) { out.innerHTML = `<p class="muted">Escribe cuánto puedes pagar por quincena.</p>`; return; }
    if (pago < minTotal) { out.innerHTML = `<p class="warn">El pago no alcanza para cubrir los mínimos (${fmt(minTotal)}).</p>`; return; }

    const av = simular(activas, pago, "avalancha");
    const bn = simular(activas, pago, "bola");
    if (!av.ok && !bn.ok) { out.innerHTML = `<p class="neg">⚠️ Con ${fmt(pago)} por quincena la deuda no baja: el interés es mayor o igual al pago.</p>`; return; }

    const card = (key, title, sub, r, other) => {
      const better = r.ok && other.ok && r.interes < other.interes - 0.5;
      return `
      <button type="button" class="sim-opt ${simStrategy === key ? "sel" : ""}" data-strat="${key}" aria-pressed="${simStrategy === key}">
        <span class="sim-title"><i class="sw" style="background:var(${key === "avalancha" ? "--series-1" : "--series-2"})"></i>${title}</span>
        <span class="muted small">${sub}</span>
        ${r.ok ? `
        <strong>${r.quincenas} quincenas</strong>
        <span class="small">Libre ≈ ${monthYear(fechaEn(r.quincenas))}</span>
        <span class="small">Interés total: ${fmt(r.interes)}</span>
        ${better ? `<span class="small pos">✓ Ahorras ${fmt(other.interes - r.interes)}</span>` : ""}` : `<span class="neg small">No termina de pagarse</span>`}
      </button>`;
    };
    const sel = simStrategy === "avalancha" ? av : bn;
    const orden = sel.ok ? activas.map((d) => ({ d, q: sel.fin[d.id] })).sort((a, b) => a.q - b.q) : [];
    out.innerHTML = `
      <div class="sim-grid">
        ${card("avalancha", "Avalancha", "Primero la de mayor interés", av, bn)}
        ${card("bola", "Bola de nieve", "Primero la de menor saldo", bn, av)}
      </div>
      ${orden.length ? `<h3 class="sub">Orden de pago (${simStrategy === "avalancha" ? "avalancha" : "bola de nieve"})</h3>
      <ol class="sim-order">${orden.map(({ d, q }) => `<li><span>${esc(d.nombre)}</span><span class="muted">${q} quinc. · ${monthYear(fechaEn(q))}</span></li>`).join("")}</ol>` : ""}
      <h3 class="sub">Saldo total proyectado</h3>
      <div class="legend"><span><i style="background:var(--series-1)"></i>Avalancha</span><span><i style="background:var(--series-2)"></i>Bola de nieve</span></div>
      <div id="chartSim" class="chart"></div>`;
    const n = Math.max(av.serie.length, bn.serie.length);
    const pad = (s) => Array.from({ length: n }, (_, i) => s[i] ?? (i < s.length ? s[i] : (av.ok && bn.ok ? 0 : null)));
    lineChart($("#chartSim"), {
      labels: Array.from({ length: n }, (_, i) => (i === 0 ? "Hoy" : `Q${i} · ${monthYear(fechaEn(i))}`)),
      xTicks: (i) => (i === 0 ? "Hoy" : monthYear(fechaEn(i))),
      series: [
        { name: "Avalancha", color: "--series-1", values: pad(av.serie) },
        { name: "Bola de nieve", color: "--series-2", values: pad(bn.serie) },
      ],
    });
  }
  $("#simPago").addEventListener("input", (e) => { e.target.dataset.touched = "1"; clearTimeout(renderSim.t); renderSim.t = setTimeout(renderSim, 250); });
  $("#simResults").addEventListener("click", (e) => {
    const b = e.target.closest("[data-strat]");
    if (b) { simStrategy = b.dataset.strat; renderSim(); }
  });

  // ---------- Metas de ahorro ----------
  const tasaMetaQ = (m) => Math.pow(1 + (+m.rendimiento_pct || 0) / 100, 0.5) - 1;   // % mensual -> por quincena
  const quincenasHasta = (fecha) => Math.max(1, Math.ceil(daysBetween(today(), parseISO(fecha)) / 15.22));

  // Cuánto se aporta por quincena: el plan de la meta o, si no hay, el promedio
  // de los aportes pagados en las últimas 6 quincenas (desde el primero que hubo)
  function ritmoMeta(m) {
    if (+m.aporte_quincenal > 0) return { monto: +m.aporte_quincenal, fuente: "plan" };
    const ps = [...S.periodos].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-6);
    const porP = ps.map((p) => sum(S.gastos.filter((g) => g.periodo_id === p.id && g.meta_id === m.id && g.pagado), (g) => g.monto));
    const first = porP.findIndex((v) => v > 0);
    if (first < 0) return { monto: 0, fuente: "promedio" };
    const vals = porP.slice(first);
    return { monto: round2(sum(vals) / vals.length), fuente: "promedio" };
  }

  // Aporte necesario por quincena para llegar a la fecha (considera el rendimiento)
  function aporteNecesario(m) {
    if (!m.fecha_meta || daysBetween(today(), parseISO(m.fecha_meta)) < 0) return null;
    const falta = +m.objetivo - saldoMeta(m);
    if (falta <= 0) return 0;
    const n = quincenasHasta(m.fecha_meta), r = tasaMetaQ(m), saldo = saldoMeta(m);
    if (!r) return round2(falta / n);
    const crec = Math.pow(1 + r, n);
    return round2(Math.max(0, (+m.objetivo - saldo * crec) * r / (crec - 1)));
  }

  function proyectarMeta(m, aporte) {
    const r = tasaMetaQ(m), obj = +m.objetivo;
    let saldo = saldoMeta(m), k = 0;
    const serie = [round2(saldo)];
    while (saldo < obj - 0.005 && k < 600) {
      saldo = saldo * (1 + r) + aporte; k++;
      serie.push(round2(saldo));
      if (k > 2 && saldo <= serie[k - 1]) return { ok: false, serie };
    }
    return { ok: saldo >= obj - 0.005, quincenas: k, serie };
  }

  const metasAbiertas = new Set();     // proyecciones desplegadas (sobreviven al re-render)
  function renderMetas() {
    const ms = S.metas;
    $("#noMetas").classList.toggle("hidden", ms.length > 0);
    $("#metaTotal").textContent = ms.length ? "Ahorrado: " + fmt(sum(ms, saldoMeta)) : "";
    const pName = (id) => byId("periodos", id)?.nombre ?? "";
    $("#metaList").innerHTML = ms.map((m) => {
      const saldo = saldoMeta(m);
      const obj = +m.objetivo;
      const pct = obj > 0 ? Math.max(0, Math.min(100, (saldo / obj) * 100)) : 0;
      const falta = round2(obj - saldo);
      const ritmo = ritmoMeta(m);
      const nec = aporteNecesario(m);
      const lines = [];
      if (falta > 0) {
        if (ritmo.monto > 0 || +m.rendimiento_pct > 0) {
          const pr = proyectarMeta(m, ritmo.monto);
          const atrasado = pr.ok && m.fecha_meta && fechaEn(pr.quincenas) > parseISO(m.fecha_meta);
          lines.push(pr.ok
            ? `A este ritmo (${fmt(ritmo.monto)}/quinc.${ritmo.fuente === "promedio" ? ", promedio" : ""}) llegas en <b>${pr.quincenas} quincenas</b> ≈ ${monthYear(fechaEn(pr.quincenas))}${atrasado ? " <b class='warn'>⚠️ después de tu fecha</b>" : ""}`
            : `<span class="warn">A este ritmo no llegas a la meta</span>`);
        } else lines.push(`<span class="muted">Aún no hay aportes: define un aporte por quincena o vincula un gasto.</span>`);
        if (m.fecha_meta) {
          lines.push(nec == null
            ? `<span class="warn">La fecha (${longDate(m.fecha_meta)}) ya pasó</span>`
            : `Para el ${longDate(m.fecha_meta)}: aparta <b>${fmt(nec)}</b> por quincena (${quincenasHasta(m.fecha_meta)})`);
        }
      }
      const movs = [
        ...S.metaMovs.filter((x) => x.meta_id === m.id).map((x) => ({ t: x.created_at, label: x.nota || (x.monto < 0 ? "Retiro" : "Aporte"), m: +x.monto, movId: x.id })),
        ...S.gastos.filter((g) => g.meta_id === m.id && g.pagado).map((g) => ({ t: byId("periodos", g.periodo_id)?.fecha ?? g.created_at, label: "Aporte · " + pName(g.periodo_id), m: +g.monto })),
      ].sort((a, b) => String(b.t).localeCompare(String(a.t)));
      const rend = +m.rendimiento_pct;
      return `
      <div class="card deuda" data-id="${m.id}">
        <div class="deuda-top">
          <h2>${esc(m.nombre)}</h2>
          <span class="deuda-saldo">${fmt(saldo)}</span>
        </div>
        <div class="progress meta"><div style="width:${pct}%"></div></div>
        <div class="deuda-meta">
          <span>${pct.toFixed(0)}% de ${fmt(obj)}</span>
          <span>${falta > 0 ? `Faltan ${fmt(falta)}` : "<b class='pos'>¡Meta lograda! 🎉</b>"}</span>
          ${+m.aporte_quincenal > 0 ? `<span>Aporte ${fmt(+m.aporte_quincenal)}/quinc.</span>` : ""}
          ${rend ? `<span>Rendimiento ${rend}% mensual</span>` : ""}
        </div>
        ${lines.length ? `<div class="meta-plan">${lines.map((l) => `<span>${l}</span>`).join("")}</div>` : ""}
        <div class="deuda-actions">
          ${rend ? `<button class="btn sm" type="button" data-act="rend">+ Rendimiento ${rend}%</button>` : ""}
          <button class="btn sm" type="button" data-act="mov">± Aporte / retiro</button>
          <button class="btn sm ghost" type="button" data-act="edit">Editar</button>
        </div>
        ${falta > 0 && (ritmo.monto > 0 || rend > 0) ? `<details class="proj" data-meta="${m.id}" ${metasAbiertas.has(m.id) ? "open" : ""}><summary>Ver proyección</summary><div class="chart"></div></details>` : ""}
        ${movs.length ? `<details><summary>Movimientos (${movs.length})</summary><div class="movs">
          ${movs.map((x) => `<div><span>${esc(x.label)}</span><span class="mov-amt"><span class="${x.m < 0 ? "neg" : "pos"}">${x.m < 0 ? "−" : "+"}${fmt(Math.abs(x.m))}</span>${x.movId ? `<button class="mov-del" type="button" data-act="del-mov" data-mov="${x.movId}" title="Eliminar movimiento" aria-label="Eliminar movimiento">✕</button>` : ""}</span></div>`).join("")}
        </div></details>` : ""}
      </div>`;
    }).join("");
    $$("#metaList details.proj[open]").forEach(drawProyeccion);
  }

  function drawProyeccion(det) {
    const m = byId("metas", det.dataset.meta);
    if (!m) return;
    const pr = proyectarMeta(m, ritmoMeta(m).monto);
    lineChart($(".chart", det), {
      labels: pr.serie.map((_, i) => (i === 0 ? "Hoy" : `Q${i} · ${monthYear(fechaEn(i))}`)),
      xTicks: (i) => (i === 0 ? "Hoy" : monthYear(fechaEn(i))),
      series: [{ name: "Ahorro proyectado", color: "--series-1", values: pr.serie }],
      target: { value: +m.objetivo, label: "Meta " + fmt0(+m.objetivo) },
    });
  }
  // "toggle" no burbujea: se escucha en captura
  $("#metaList").addEventListener("toggle", (e) => {
    const det = e.target;
    if (!det.matches?.("details.proj")) return;
    if (det.open) { metasAbiertas.add(det.dataset.meta); drawProyeccion(det); }
    else metasAbiertas.delete(det.dataset.meta);
  }, true);

  // ---------- Gráficas (SVG propio, sin librerías) ----------
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const tip = $("#tooltip");
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.classList.remove("hidden");
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + "px";
    tip.style.top = Math.max(8, y - h - 12) + "px";
  }
  const hideTip = () => tip.classList.add("hidden");
  window.addEventListener("scroll", hideTip, { passive: true });

  // Tope del eje: 4 divisiones de un paso "redondo"
  function niceMax(v) {
    if (v <= 0) return 4;
    const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
    return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((m) => m >= raw) * 4;
  }
  // Marco común: eje Y con 4 divisiones y líneas guía
  function frame(el, max, h = 200) {
    const W = Math.max(260, el.clientWidth), H = h;
    const m = { l: 46, r: 10, t: 10, b: 24 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const top = niceMax(max);
    const y = (v) => m.t + ph - (v / top) * ph;
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const v = (top / 4) * i, yy = Math.round(y(v)) + 0.5;
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" stroke="${css(i ? "--grid" : "--axis")}" stroke-width="1"/>`;
      g += `<text x="${m.l - 6}" y="${yy + 4}" text-anchor="end" class="tick">${fmt0(v)}</text>`;
    }
    return { W, H, m, pw, ph, y, g };
  }
  const tickEvery = (n, pw, minPx = 64) => Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / minPx))));

  // Columnas agrupadas: valores >= 0
  function barChart(el, { labels, series, tipExtra }) {
    const n = labels.length;
    if (!n) { el.innerHTML = `<p class="muted small">Sin datos.</p>`; return; }
    const max = Math.max(...series.flatMap((s) => s.values));
    const F = frame(el, max);
    const band = F.pw / n, k = series.length;
    const bw = Math.max(3, Math.min(24, (band * 0.72 - 2 * (k - 1)) / k));
    const groupW = bw * k + 2 * (k - 1);
    const every = tickEvery(n, F.pw);
    let bars = "", hits = "", ticks = "";
    labels.forEach((lab, i) => {
      const x0 = F.m.l + band * i + (band - groupW) / 2;
      series.forEach((s, j) => {
        const v = s.values[i], x = x0 + j * (bw + 2), yTop = F.y(v), base = F.y(0);
        const h = base - yTop, r = Math.min(4, h, bw / 2);
        if (h > 0) bars += `<path fill="${css(s.color)}" d="M${x},${base}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + bw - r}Q${x + bw},${yTop} ${x + bw},${yTop + r}V${base}Z"/>`;
      });
      hits += `<rect class="hit" data-i="${i}" x="${F.m.l + band * i}" y="${F.m.t}" width="${band}" height="${F.ph}" fill="transparent"/>`;
      if (i % every === 0) ticks += `<text x="${F.m.l + band * i + band / 2}" y="${F.H - 6}" text-anchor="middle" class="tick">${esc(lab)}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${F.W} ${F.H}" width="100%" height="${F.H}" role="img" aria-label="${esc(series.map((s) => s.name).join(" y "))} por quincena">${F.g}${bars}${ticks}<rect class="hover-band" x="0" y="${F.m.t}" width="${band}" height="${F.ph}" fill="${css("--text")}" opacity="0"/>${hits}</svg>`;
    const hb = $(".hover-band", el);
    el.onpointermove = (e) => {
      const i = e.target.dataset?.i;
      if (i == null) { hideTip(); hb.setAttribute("opacity", 0); return; }
      hb.setAttribute("x", F.m.l + band * i); hb.setAttribute("opacity", 0.05);
      showTip(`<b>${esc(labels[i])}</b>${series.map((s) => `<div><i class="sw" style="background:var(${s.color})"></i>${esc(s.name)} <b>${fmt(s.values[i])}</b></div>`).join("")}${tipExtra ? tipExtra(i) : ""}`, e.clientX, e.clientY);
    };
    el.onpointerleave = () => { hideTip(); hb.setAttribute("opacity", 0); };
  }

  // Líneas con cruz al pasar; la primera serie lleva relleno suave si es la única
  // target: línea de referencia horizontal opcional { value, label }
  function lineChart(el, { labels, series, xTicks, target }) {
    const n = labels.length;
    if (n < 2) { el.innerHTML = `<p class="muted small">Se necesitan al menos dos quincenas.</p>`; return; }
    const max = Math.max(...series.flatMap((s) => s.values.filter((v) => v != null)), target?.value ?? 0);
    const F = frame(el, max);
    const x = (i) => F.m.l + (F.pw * i) / (n - 1);
    const ref = target ? `<line x1="${F.m.l}" x2="${F.W - F.m.r}" y1="${F.y(target.value)}" y2="${F.y(target.value)}" stroke="${css("--text")}" stroke-width="1" opacity=".45"/>
      <text x="${F.W - F.m.r}" y="${F.y(target.value) - 5}" text-anchor="end" class="tick ref">${esc(target.label)}</text>` : "";
    const every = tickEvery(n, F.pw, 80);
    let paths = "", ticks = "", dots = "";
    series.forEach((s) => {
      const pts = s.values.map((v, i) => (v == null ? null : [x(i), F.y(Math.max(0, v))])).filter(Boolean);
      const col = css(s.color);
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
      if (series.length === 1) paths += `<path d="${d}L${pts.at(-1)[0]},${F.y(0)}L${pts[0][0]},${F.y(0)}Z" fill="${col}" opacity=".1"/>`;
      paths += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      const last = pts.at(-1);
      dots += `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${col}" stroke="${css("--surface")}" stroke-width="2"/>`;
    });
    for (let i = 0; i < n; i += every) {
      const anchor = i === 0 ? "start" : "middle";
      ticks += `<text x="${x(i)}" y="${F.H - 6}" text-anchor="${anchor}" class="tick">${esc(xTicks ? xTicks(i) : labels[i])}</text>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${F.W} ${F.H}" width="100%" height="${F.H}" role="img" aria-label="${esc(series.map((s) => s.name).join(" y "))}">${F.g}${ref}${paths}${ticks}
      <line class="xhair" y1="${F.m.t}" y2="${F.m.t + F.ph}" stroke="${css("--muted")}" stroke-width="1" opacity="0"/>
      ${series.map((s) => `<circle class="hdot" r="4" fill="${css(s.color)}" stroke="${css("--surface")}" stroke-width="2" opacity="0"/>`).join("")}
      ${dots}<rect x="${F.m.l}" y="${F.m.t}" width="${F.pw}" height="${F.ph}" fill="transparent" class="hit-all"/></svg>`;
    const svg = $("svg", el), xh = $(".xhair", el), hd = $$(".hdot", el);
    el.onpointermove = (e) => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * F.W;
      if (px < F.m.l - 10 || px > F.W - F.m.r + 10) { el.onpointerleave(); return; }
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - F.m.l) / F.pw) * (n - 1))));
      xh.setAttribute("x1", x(i)); xh.setAttribute("x2", x(i)); xh.setAttribute("opacity", 0.6);
      series.forEach((s, j) => {
        const v = s.values[i];
        hd[j].setAttribute("opacity", v == null ? 0 : 1);
        if (v != null) { hd[j].setAttribute("cx", x(i)); hd[j].setAttribute("cy", F.y(Math.max(0, v))); }
      });
      showTip(`<b>${esc(labels[i])}</b>${series.map((s) => s.values[i] == null ? "" : `<div>${series.length > 1 ? `<i class="sw" style="background:var(${s.color})"></i>${esc(s.name)} ` : ""}<b>${fmt(s.values[i])}</b></div>`).join("")}`, e.clientX, rect.top + (F.m.t / F.H) * rect.height + 10);
    };
    el.onpointerleave = () => { hideTip(); xh.setAttribute("opacity", 0); hd.forEach((d) => d.setAttribute("opacity", 0)); };
  }

  // Barras horizontales (HTML): ranking por categoría
  function hbarChart(el, items) {
    const total = sum(items, (x) => x.value);
    if (!total) { el.innerHTML = `<p class="muted small">Sin gastos en este rango.</p>`; return; }
    const max = Math.max(...items.map((x) => x.value));
    el.innerHTML = `<div class="hbars">${items.map((x) => `
      <div class="hbar" data-tip="${esc(x.label)}: ${fmt(x.value)} (${((x.value / total) * 100).toFixed(0)}%)">
        <span class="hb-label">${x.icon} ${esc(x.label)}</span>
        <span class="hb-track"><span class="hb-fill" style="width:${(x.value / max) * 100}%"></span></span>
        <span class="hb-val">${fmt0(x.value)} <span class="muted">${((x.value / total) * 100).toFixed(0)}%</span></span>
      </div>`).join("")}</div>`;
    el.onpointermove = (e) => {
      const row = e.target.closest(".hbar");
      if (row) showTip(esc(row.dataset.tip), e.clientX, e.clientY); else hideTip();
    };
    el.onpointerleave = hideTip;
  }

  // ---------- Reportes ----------
  function renderReportes() {
    $$("#rangeSeg button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.range === S.range));
    const all = [...S.periodos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const ps = S.range ? all.slice(-S.range) : all;
    const rows = ps.map((p) => ({ p, r: resumen(p) }));
    const n = rows.length || 1;

    $("#historyTotals").innerHTML = `
      <div class="stat"><span class="label">Ingresos</span><strong>${fmt(sum(rows, (x) => x.r.ingresos))}</strong></div>
      <div class="stat"><span class="label">Pagado</span><strong>${fmt(sum(rows, (x) => x.r.pagado))}</strong></div>
      <div class="stat"><span class="label">Sobrante prom.</span><strong>${fmt(sum(rows, (x) => x.r.balance) / n)}</strong></div>`;

    barChart($("#chartFlujo"), {
      labels: rows.map((x) => shortDate(x.p.fecha)),
      series: [
        { name: "Ingresos", color: "--series-1", values: rows.map((x) => x.r.ingresos) },
        { name: "Gastos pagados", color: "--series-2", values: rows.map((x) => x.r.pagado) },
      ],
      tipExtra: (i) => `<div class="muted">Sobrante <b class="${rows[i].r.balance < 0 ? "neg" : ""}">${fmt(rows[i].r.balance)}</b></div>`,
    });

    // Saldo de todas las deudas al cierre de cada quincena
    const deudaEn = (fecha) => sum(S.deudas, (d) => {
      const cargos = sum(S.cargos.filter((c) => c.deuda_id === d.id && c.created_at.slice(0, 10) <= fecha), (c) => c.monto);
      const abonos = sum(S.gastos.filter((g) => g.deuda_id === d.id && g.pagado && (byId("periodos", g.periodo_id)?.fecha ?? "") <= fecha), (g) => g.monto);
      return +d.saldo_inicial + cargos - abonos;
    });
    if (S.deudas.length) {
      lineChart($("#chartDeuda"), {
        labels: rows.map((x) => x.p.nombre),
        xTicks: (i) => shortDate(rows[i].p.fecha),
        series: [{ name: "Deuda total", color: "--series-1", values: rows.map((x) => round2(deudaEn(x.p.fecha))) }],
      });
    } else $("#chartDeuda").innerHTML = `<p class="muted small">No tienes deudas registradas.</p>`;

    // Ahorro de todas las metas al cierre de cada quincena
    const ahorroEn = (fecha) => sum(S.metas, (m) => {
      const movs = sum(S.metaMovs.filter((x) => x.meta_id === m.id && x.created_at.slice(0, 10) <= fecha), (x) => x.monto);
      const aportes = sum(S.gastos.filter((g) => g.meta_id === m.id && g.pagado && (byId("periodos", g.periodo_id)?.fecha ?? "") <= fecha), (g) => g.monto);
      return +m.saldo_inicial + movs + aportes;
    });
    $("#ahorroCard").classList.toggle("hidden", !S.metas.length);
    if (S.metas.length) {
      lineChart($("#chartAhorro"), {
        labels: rows.map((x) => x.p.nombre),
        xTicks: (i) => shortDate(rows[i].p.fecha),
        series: [{ name: "Ahorro total", color: "--series-1", values: rows.map((x) => round2(ahorroEn(x.p.fecha))) }],
      });
    }

    const ids = new Set(ps.map((p) => p.id));
    const gs = S.gastos.filter((g) => ids.has(g.periodo_id) && +g.monto > 0);
    const porCat = {};
    gs.forEach((g) => { const k = catInfo(g.categoria) ? g.categoria : "_"; porCat[k] = (porCat[k] || 0) + +g.monto; });
    hbarChart($("#chartCats"), Object.entries(porCat)
      .map(([k, v]) => { const c = catInfo(k); return { label: c ? c[2] : "Sin categoría", icon: c ? c[1] : "❔", value: round2(v) }; })
      .sort((a, b) => b.value - a.value));

    const sinCat = S.gastos.filter((g) => !catInfo(g.categoria) && guessCat(g.descripcion, g));
    const ab = $("#autoCatBtn");
    ab.classList.toggle("hidden", !sinCat.length);
    ab.textContent = `🪄 Asignar categoría a ${sinCat.length} gasto(s) sin categoría`;

    $("#historyList").innerHTML = [...rows].reverse().map(({ p, r }) => {
      const pct = r.ingresos > 0 ? Math.min(100, (r.pagado / r.ingresos) * 100) : 0;
      return `
      <li class="item hist" data-id="${p.id}">
        <div class="body">
          <div class="hero-row"><span class="desc">${esc(p.nombre)}</span><b class="${r.balance < 0 ? "neg" : "pos"}">${fmt(r.balance)}</b></div>
          <div class="bar"><div style="width:${pct}%"></div></div>
          <div class="nums"><span>Ingresos ${fmt(r.ingresos)}</span><span>Pagado ${fmt(r.pagado)}</span><span>${r.nPagados}/${r.gs.length} gastos</span></div>
        </div>
      </li>`;
    }).join("");
  }

  $("#rangeSeg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-range]");
    if (!b) return;
    S.range = +b.dataset.range; store.set("range", S.range);
    renderReportes();
  });
  $("#autoCatBtn").addEventListener("click", () => {
    const grupos = {};
    S.gastos.forEach((g) => {
      if (catInfo(g.categoria)) return;
      const c = guessCat(g.descripcion, g);
      if (c) (grupos[c] ||= []).push(g.id);
    });
    const n = sum(Object.values(grupos), (ids) => ids.length);
    if (!n || !confirm(`Asignar categoría automáticamente a ${n} gasto(s)? Puedes cambiarlas después.`)) return;
    Object.entries(grupos).forEach(([cat, ids]) => db.update("gastos", ids, { categoria: cat }));
    render(); toast("Categorías asignadas");
  });

  let resizeT;
  const redrawCharts = () => {
    if (S.tab === "reportes") renderReportes();
    if (S.tab === "deudas") renderSim();
    if (S.tab === "ahorro") $$("#metaList details.proj[open]").forEach(drawProyeccion);
  };
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(redrawCharts, 150); });
  window.addEventListener("themechange", redrawCharts);

  // ---------- Navegación ----------
  function setTab(tab) {
    S.tab = tab;
    hideTip();
    $$(".tab").forEach((t) => t.classList.toggle("hidden", t.id !== "tab-" + tab));
    $$("#bottomNav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    window.scrollTo({ top: 0 });
    if (tab === "reportes") renderReportes();
    if (tab === "deudas") renderSim();
    if (tab === "ahorro") $$("#metaList details.proj[open]").forEach(drawProyeccion);
  }
  $("#bottomNav").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (b) setTab(b.dataset.tab);
  });

  $("#periodSelect").addEventListener("change", (e) => { S.currentId = e.target.value; renderPeriodo(); });
  $("#historyList").addEventListener("click", (e) => {
    const li = e.target.closest("[data-id]");
    if (!li) return;
    S.currentId = li.dataset.id;
    renderPeriodSelect(); renderPeriodo(); setTab("periodo");
  });
  $("#hidePaidBtn").addEventListener("click", () => {
    S.hidePaid = !S.hidePaid;
    store.set("hidePaid", S.hidePaid ? "1" : "0");
    renderPeriodo();
  });

  $("#fab").addEventListener("click", () => {
    if (S.tab === "deudas") return openDeuda();
    if (S.tab === "ahorro") return openMeta();
    if (S.tab === "reportes" || !current()) return openPeriod();
    openGasto();
  });

  // Menú de quincena
  const menu = $("#menuSheet");
  $("#periodMenuBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    menu.style.top = r.bottom + 6 + "px";
    menu.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) menu.classList.add("hidden");
    const a = e.target.closest("[data-action]");
    if (!a) return;
    menu.classList.add("hidden");
    if (a.dataset.action === "new-period") openPeriod();
    if (a.dataset.action === "edit-period") openPeriod(current());
    if (a.dataset.action === "mark-all") markAllPaid();
    if (a.dataset.action === "new-meta") openMeta();
    if (a.dataset.action === "add-aporte") {
      const m = byId("metas", a.dataset.meta);
      if (!m || !current()) return;
      db.insert("gastos", nuevoAporte(m, +a.dataset.monto, current().id, Math.max(0, ...gastosDe(current().id).map((g) => g.orden)) + 1));
      render(); toast(`Aporte a ${m.nombre} agregado`);
    }
  });

  // ---------- Salario ----------
  const salaryInput = $("#salaryInput");
  salaryInput.addEventListener("focus", () => { salaryInput.value = +current().salario || ""; salaryInput.select(); });
  salaryInput.addEventListener("keydown", (e) => { if (e.key === "Enter") salaryInput.blur(); });
  salaryInput.addEventListener("blur", () => {
    const p = current();
    const v = parseNum(salaryInput.value);
    if (v == null || Number.isNaN(v) || v === +p.salario) { renderPeriodo(); return; }
    db.update("periodos", p.id, { salario: v });
    render();
  });

  // ---------- Gastos ----------
  $("#gastoList").addEventListener("click", (e) => {
    const li = e.target.closest(".item");
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!li || !act) return;
    const g = byId("gastos", li.dataset.id);
    if (act === "edit") return openGasto(g);
    if (act === "toggle") { db.update("gastos", g.id, { pagado: !g.pagado }); render(); }
  });

  const gastoDialog = $("#gastoDialog");
  const gastoForm = $("#gastoForm");
  let editingGastoId = null;
  gastoForm.categoria.innerHTML = `<option value="">— Sin categoría —</option>` + CATS.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("");

  function openGasto(g = null) {
    editingGastoId = g?.id ?? null;
    $("#gastoTitle").textContent = g ? "Editar gasto" : "Nuevo gasto";
    $("#gastoDelete").classList.toggle("hidden", !g);
    gastoForm.vinculo.innerHTML = `<option value="">— Ninguno —</option>` +
      (S.deudas.length ? `<optgroup label="Abono a deuda">${S.deudas.map((d) => `<option value="d:${d.id}">💳 ${esc(d.nombre)}</option>`).join("")}</optgroup>` : "") +
      (S.metas.length ? `<optgroup label="Aporte a meta">${S.metas.map((m) => `<option value="m:${m.id}">🐷 ${esc(m.nombre)}</option>`).join("")}</optgroup>` : "");
    gastoForm.descripcion.value = g?.descripcion ?? "";
    gastoForm.monto.value = g ? +g.monto : "";
    gastoForm.vence.value = g?.vence ?? "";
    gastoForm.categoria.value = g?.categoria ?? "";
    gastoForm.vinculo.value = g?.deuda_id ? "d:" + g.deuda_id : g?.meta_id ? "m:" + g.meta_id : "";
    gastoForm.fijo.checked = g?.fijo ?? false;
    gastoForm.pagado.checked = g?.pagado ?? false;
    gastoDialog.showModal();
    if (!g) gastoForm.descripcion.focus();
  }

  // Sugerir deuda/meta y categoría según la descripción
  gastoForm.descripcion.addEventListener("change", () => {
    const desc = gastoForm.descripcion.value.trim().toLowerCase();
    if (!gastoForm.vinculo.value) {
      const d = S.deudas.find((x) => x.nombre.toLowerCase() === desc);
      const m = S.metas.find((x) => x.nombre.toLowerCase() === desc);
      if (d) gastoForm.vinculo.value = "d:" + d.id; else if (m) gastoForm.vinculo.value = "m:" + m.id;
    }
    if (!gastoForm.categoria.value) {
      const v = gastoForm.vinculo.value;
      gastoForm.categoria.value = guessCat(desc, { deuda_id: v.startsWith("d:"), meta_id: v.startsWith("m:") }) ?? "";
    }
  });
  gastoForm.vinculo.addEventListener("change", () => {
    const v = gastoForm.vinculo.value;
    if (!gastoForm.categoria.value || ["deudas", "ahorro"].includes(gastoForm.categoria.value)) {
      if (v.startsWith("d:")) gastoForm.categoria.value = "deudas";
      if (v.startsWith("m:")) gastoForm.categoria.value = "ahorro";
    }
  });

  gastoForm.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "ok") return;
    const monto = parseNum(gastoForm.monto.value) ?? 0;
    if (Number.isNaN(monto)) { e.preventDefault(); toast("Monto inválido"); return; }
    const v = gastoForm.vinculo.value;
    const row = {
      descripcion: gastoForm.descripcion.value.trim(),
      monto,
      pagado: gastoForm.pagado.checked,
      fijo: gastoForm.fijo.checked,
      vence: gastoForm.vence.value || null,
      categoria: gastoForm.categoria.value || null,
      deuda_id: v.startsWith("d:") ? v.slice(2) : null,
      meta_id: v.startsWith("m:") ? v.slice(2) : null,
    };
    if (editingGastoId && byId("gastos", editingGastoId)) {
      db.update("gastos", editingGastoId, row);
    } else {
      const orden = Math.max(0, ...gastosDe(S.currentId).map((g) => g.orden)) + 1;
      db.insert("gastos", { ...row, periodo_id: S.currentId, orden });
    }
    render();
  });

  $("#gastoDelete").addEventListener("click", () => {
    const g = byId("gastos", editingGastoId);
    if (!g || !confirm(`¿Eliminar "${g.descripcion}"?`)) return;
    db.remove("gastos", g.id);
    gastoDialog.close(); render();
  });

  const nuevoAporte = (m, monto, periodo_id, orden) => ({
    periodo_id, descripcion: m.nombre, monto: round2(monto), meta_id: m.id, deuda_id: null,
    categoria: "ahorro", fijo: false, vence: null, pagado: false, orden,
  });

  function markAllPaid() {
    const pend = gastosDe(S.currentId).filter((g) => !g.pagado);
    if (!pend.length) return toast("Ya está todo pagado");
    if (!confirm(`¿Marcar ${pend.length} gasto(s) como pagados?`)) return;
    db.update("gastos", pend.map((g) => g.id), { pagado: true });
    render();
  }

  // ---------- Ingresos extra ----------
  const ingresoDialog = $("#ingresoDialog");
  const ingresoForm = $("#ingresoForm");
  let editingIngresoId = null;
  function openIngreso(i = null) {
    editingIngresoId = i?.id ?? null;
    $("#ingresoTitle").textContent = i ? "Editar ingreso extra" : "Ingreso extra";
    $("#ingresoDelete").classList.toggle("hidden", !i);
    ingresoForm.descripcion.value = i?.descripcion ?? "";
    ingresoForm.monto.value = i ? +i.monto : "";
    ingresoDialog.showModal();
  }
  $("#addIngresoBtn").addEventListener("click", () => openIngreso());
  $("#ingresoList").addEventListener("click", (e) => {
    const li = e.target.closest("[data-id]");
    if (li) openIngreso(byId("ingresos", li.dataset.id));
  });
  ingresoForm.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "ok") return;
    const monto = parseNum(ingresoForm.monto.value);
    if (monto == null || Number.isNaN(monto)) { e.preventDefault(); toast("Monto inválido"); return; }
    const row = { descripcion: ingresoForm.descripcion.value.trim(), monto };
    if (editingIngresoId && byId("ingresos", editingIngresoId)) db.update("ingresos", editingIngresoId, row);
    else db.insert("ingresos", { ...row, periodo_id: S.currentId });
    render();
  });
  $("#ingresoDelete").addEventListener("click", () => {
    const i = byId("ingresos", editingIngresoId);
    if (!i || !confirm(`¿Eliminar "${i.descripcion}"?`)) return;
    db.remove("ingresos", i.id);
    ingresoDialog.close(); render();
  });

  // ---------- Quincenas ----------
  const periodDialog = $("#periodDialog");
  const periodForm = $("#periodForm");
  let editingPeriodId = null;

  function nextQuincena() {
    const last = S.periodos[0];
    let d;
    if (!last) {
      const t = new Date();
      d = t.getDate() <= 15 ? new Date(t.getFullYear(), t.getMonth(), 15) : new Date(t.getFullYear(), t.getMonth(), 30);
    } else {
      const [y, m, day] = last.fecha.split("-").map(Number);
      d = day < 20 ? new Date(y, m - 1, 30) : new Date(y, m, 15);
    }
    // Ajuste para febrero (o meses sin día 30)
    if (d.getDate() !== 15 && d.getDate() !== 30) d = new Date(d.getFullYear(), d.getMonth(), 0);
    return { fecha: iso(d), nombre: `${d.getDate()} de ${MESES[d.getMonth()]}` };
  }

  function openPeriod(p = null) {
    editingPeriodId = p?.id ?? null;
    $("#periodTitle").textContent = p ? "Editar quincena" : "Nueva quincena";
    $("#periodDelete").classList.toggle("hidden", !p);
    $(".copy-row").classList.toggle("hidden", !!p || !current());
    const sug = nextQuincena();
    periodForm.nombre.value = p?.nombre ?? sug.nombre;
    periodForm.fecha.value = p?.fecha ?? sug.fecha;
    periodForm.salario.value = p ? +p.salario : (current() ? +current().salario : "");
    periodForm.copiar.value = current() && gastosDe(current().id).some((g) => g.fijo) ? "fijos" : "todos";
    periodDialog.showModal();
  }

  periodForm.fecha.addEventListener("change", () => {
    if (editingPeriodId) return;
    const [, m, d] = periodForm.fecha.value.split("-").map(Number);
    if (m && d) periodForm.nombre.value = `${d} de ${MESES[m - 1]}`;
  });

  periodForm.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "ok") return;
    const salario = parseNum(periodForm.salario.value) ?? 0;
    if (Number.isNaN(salario)) { e.preventDefault(); toast("Salario inválido"); return; }
    const row = { nombre: periodForm.nombre.value.trim(), fecha: periodForm.fecha.value, salario };

    if (editingPeriodId && byId("periodos", editingPeriodId)) {
      db.update("periodos", editingPeriodId, row);
    } else {
      const src = current();
      const modo = periodForm.copiar.value;
      const copyFrom = src && modo !== "ninguno" ? gastosDe(src.id).filter((g) => modo === "todos" || g.fijo) : [];
      const ins = db.insert("periodos", row);
      if (copyFrom.length) {
        // Los vencimientos se corren lo mismo que la fecha de la quincena
        const delta = daysBetween(parseISO(src.fecha), parseISO(row.fecha));
        db.insert("gastos", copyFrom.map((g, i) => ({
          periodo_id: ins.id, descripcion: g.descripcion, monto: g.monto,
          deuda_id: g.deuda_id, meta_id: g.meta_id ?? null, categoria: g.categoria ?? null, fijo: !!g.fijo,
          vence: g.vence ? addDays(g.vence, delta) : null, pagado: false, orden: i + 1,
        })));
      }
      // Aporte planeado de cada meta (si no venía ya en los gastos copiados)
      const yaVinculadas = new Set(copyFrom.map((g) => g.meta_id).filter(Boolean));
      const aportes = S.metas
        .filter((m) => +m.aporte_quincenal > 0 && !yaVinculadas.has(m.id) && saldoMeta(m) < +m.objetivo)
        .map((m, i) => nuevoAporte(m, Math.min(+m.aporte_quincenal, round2(+m.objetivo - saldoMeta(m))), ins.id, copyFrom.length + i + 1));
      if (aportes.length) db.insert("gastos", aportes);
      S.currentId = ins.id;
      const n = copyFrom.length + aportes.length;
      toast(n ? `Quincena creada con ${n} gasto(s)${aportes.length ? ` (${aportes.length} aporte(s) a metas)` : ""}` : "Quincena creada");
    }
    render(); setTab("periodo");
  });

  $("#periodDelete").addEventListener("click", () => {
    const p = byId("periodos", editingPeriodId);
    if (!p || !confirm(`¿Eliminar la quincena "${p.nombre}" y todos sus gastos?`)) return;
    db.remove("periodos", p.id);
    // En el servidor se borran en cascada; aquí se quitan del estado local
    S.gastos = S.gastos.filter((g) => g.periodo_id !== p.id);
    S.ingresos = S.ingresos.filter((i) => i.periodo_id !== p.id);
    persist();
    S.currentId = S.periodos[0]?.id ?? null;
    periodDialog.close(); render();
  });

  // ---------- Deudas ----------
  const deudaDialog = $("#deudaDialog");
  const deudaForm = $("#deudaForm");
  let editingDeudaId = null;

  function openDeuda(d = null) {
    editingDeudaId = d?.id ?? null;
    $("#deudaTitle").textContent = d ? "Editar deuda" : "Nueva deuda";
    $("#deudaDelete").classList.toggle("hidden", !d);
    $("#deudaEditHint").classList.toggle("hidden", !d);
    deudaForm.querySelector("[name=saldo_inicial]").previousSibling.textContent = d ? "Saldo inicial" : "Saldo actual";
    deudaForm.nombre.value = d?.nombre ?? "";
    deudaForm.saldo_inicial.value = d ? +d.saldo_inicial : "";
    deudaForm.limite.value = d?.limite ?? "";
    deudaForm.meta.value = d?.meta ?? "";
    deudaForm.interes_pct.value = d ? +d.interes_pct || "" : "";
    deudaForm.interes_frec.value = d?.interes_frec ?? "mensual";
    deudaForm.dia_corte.value = d?.dia_corte ?? "";
    deudaForm.dia_pago.value = d?.dia_pago ?? "";
    deudaForm.pago_minimo.value = d?.pago_minimo ?? "";
    deudaDialog.showModal();
  }

  deudaForm.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "ok") return;
    const nums = ["saldo_inicial", "limite", "meta", "interes_pct", "pago_minimo"].map((k) => parseNum(deudaForm[k].value));
    if (nums.some(Number.isNaN)) { e.preventDefault(); toast("Revisa los montos"); return; }
    const [saldo_inicial, limite, meta, interes_pct, pago_minimo] = nums;
    const row = {
      nombre: deudaForm.nombre.value.trim(), saldo_inicial: saldo_inicial ?? 0, limite, meta, interes_pct: interes_pct ?? 0,
      interes_frec: deudaForm.interes_frec.value, pago_minimo,
      dia_corte: parseDay(deudaForm.dia_corte.value), dia_pago: parseDay(deudaForm.dia_pago.value),
    };
    if (editingDeudaId && byId("deudas", editingDeudaId)) db.update("deudas", editingDeudaId, row);
    else db.insert("deudas", row);
    render();
  });

  $("#deudaDelete").addEventListener("click", () => {
    const d = byId("deudas", editingDeudaId);
    if (!d || !confirm(`¿Eliminar la deuda "${d.nombre}"? Los gastos se conservan.`)) return;
    db.remove("deudas", d.id);
    S.cargos = S.cargos.filter((c) => c.deuda_id !== d.id);
    S.gastos.forEach((g) => { if (g.deuda_id === d.id) g.deuda_id = null; });
    persist();
    deudaDialog.close(); render();
  });

  // Diálogo de monto ± (cargos a deudas y movimientos de metas)
  const cargoDialog = $("#cargoDialog");
  const cargoForm = $("#cargoForm");
  let cargoTarget = null;   // { table, field, id }
  function openCargo(title, target, placeholder) {
    cargoTarget = target;
    $("#cargoTitle").textContent = title;
    cargoForm.reset();
    cargoForm.monto.placeholder = placeholder;
    cargoDialog.showModal();
  }

  $("#deudaList").addEventListener("click", (e) => {
    const card = e.target.closest(".deuda");
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!card || !act) return;
    const d = byId("deudas", card.dataset.id);
    if (act === "edit") return openDeuda(d);
    if (act === "cargo") openCargo("Cargo a " + d.nombre, { table: "deuda_cargos", field: "deuda_id", id: d.id }, "Positivo suma, negativo resta");
    if (act === "interes") {
      const monto = round2((saldoDeuda(d) * +d.interes_pct) / 100);
      if (monto <= 0) return toast("No hay saldo para aplicar interés");
      if (!confirm(`Aplicar ${+d.interes_pct}% de interés (${fmt(monto)}) a ${d.nombre}?`)) return;
      db.insert("deuda_cargos", { deuda_id: d.id, monto, nota: `Interés ${+d.interes_pct}%` });
      render(); toast("Interés aplicado");
    }
    if (act === "del-cargo") {
      const c = S.cargos.find((x) => x.id === e.target.closest("[data-cargo]").dataset.cargo);
      if (!c || !confirm(`¿Eliminar "${c.nota || "Cargo"}" (${fmt(+c.monto)}) de ${d.nombre}?`)) return;
      db.remove("deuda_cargos", c.id);
      render();
      toast("Cargo eliminado");
    }
  });

  cargoForm.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "ok") return;
    const monto = parseNum(cargoForm.monto.value);
    if (monto == null || Number.isNaN(monto) || monto === 0) { e.preventDefault(); toast("Monto inválido"); return; }
    const t = cargoTarget;
    db.insert(t.table, { [t.field]: t.id, monto, nota: cargoForm.nota.value.trim() || null });
    render();
  });

  // ---------- Metas ----------
  const metaDialog = $("#metaDialog");
  const metaForm = $("#metaForm");
  let editingMetaId = null;
  function openMeta(m = null) {
    editingMetaId = m?.id ?? null;
    $("#metaTitle").textContent = m ? "Editar meta" : "Nueva meta";
    $("#metaDelete").classList.toggle("hidden", !m);
    metaForm.nombre.value = m?.nombre ?? "";
    metaForm.objetivo.value = m ? +m.objetivo : "";
    metaForm.saldo_inicial.value = m ? +m.saldo_inicial || "" : "";
    metaForm.fecha_meta.value = m?.fecha_meta ?? "";
    metaForm.aporte_quincenal.value = m?.aporte_quincenal ?? "";
    metaForm.rendimiento_pct.value = m ? +m.rendimiento_pct || "" : "";
    metaDialog.showModal();
  }
  metaForm.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "ok") return;
    const [objetivo, ini, aporte, rend] = ["objetivo", "saldo_inicial", "aporte_quincenal", "rendimiento_pct"].map((k) => parseNum(metaForm[k].value));
    if (objetivo == null || [objetivo, ini, aporte, rend].some(Number.isNaN)) { e.preventDefault(); toast("Revisa los montos"); return; }
    const row = {
      nombre: metaForm.nombre.value.trim(), objetivo, saldo_inicial: ini ?? 0, fecha_meta: metaForm.fecha_meta.value || null,
      aporte_quincenal: aporte > 0 ? aporte : null, rendimiento_pct: rend ?? 0,
    };
    if (editingMetaId && byId("metas", editingMetaId)) db.update("metas", editingMetaId, row);
    else db.insert("metas", row);
    render();
  });
  $("#metaDelete").addEventListener("click", () => {
    const m = byId("metas", editingMetaId);
    if (!m || !confirm(`¿Eliminar la meta "${m.nombre}"? Los gastos se conservan.`)) return;
    db.remove("metas", m.id);
    S.metaMovs = S.metaMovs.filter((x) => x.meta_id !== m.id);
    S.gastos.forEach((g) => { if (g.meta_id === m.id) g.meta_id = null; });
    persist();
    metaDialog.close(); render();
  });
  $("#metaList").addEventListener("click", (e) => {
    const card = e.target.closest(".deuda");
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!card || !act) return;
    const m = byId("metas", card.dataset.id);
    if (act === "edit") return openMeta(m);
    if (act === "mov") openCargo("Movimiento en " + m.nombre, { table: "meta_movs", field: "meta_id", id: m.id }, "Positivo aporta, negativo retira");
    if (act === "rend") {
      const monto = round2((saldoMeta(m) * +m.rendimiento_pct) / 100);
      if (monto <= 0) return toast("No hay saldo para calcular rendimiento");
      if (!confirm(`Sumar ${+m.rendimiento_pct}% de rendimiento (${fmt(monto)}) a ${m.nombre}?`)) return;
      db.insert("meta_movs", { meta_id: m.id, monto, nota: `Rendimiento ${+m.rendimiento_pct}%` });
      render(); toast("Rendimiento sumado");
    }
    if (act === "del-mov") {
      const x = byId("metaMovs", e.target.closest("[data-mov]").dataset.mov);
      if (!x || !confirm(`¿Eliminar "${x.nota || (x.monto < 0 ? "Retiro" : "Aporte")}" (${fmt(+x.monto)}) de ${m.nombre}?`)) return;
      db.remove("meta_movs", x.id);
      render(); toast("Movimiento eliminado");
    }
  });

  // Cerrar diálogos tocando el fondo
  $$("dialog").forEach((dlg) => dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }));

  loadAll();
})();
