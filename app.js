(() => {
  "use strict";

  // ---------- Utilidades ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (n) => (n < 0 ? "-$" : "$") + money.format(Math.abs(n || 0));
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };

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

  // ---------- Tema ----------
  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("theme", next);
  });

  // ---------- Supabase ----------
  const cfg = window.APP_CONFIG || {};
  function showSetup(title, html) {
    $("#appView").classList.add("hidden");
    $("#bottomNav").classList.add("hidden");
    $("#setupView").classList.remove("hidden");
    $("#setupTitle").textContent = title;
    $("#setupMsg").innerHTML = html;
  }
  if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("TU-PROYECTO")) {
    showSetup("Configura Supabase", "Edita <b>config.js</b> con la URL y la clave pública de tu proyecto, y ejecuta <b>schema.sql</b> en el SQL Editor. Revisa el README.");
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function q(promise) {
    const { data, error } = await busy(promise);
    if (error) { console.error(error); toast("Error: " + error.message); throw error; }
    return data;
  }

  // ---------- Estado ----------
  const S = {
    periodos: [], gastos: [], deudas: [], cargos: [],
    currentId: store.get("periodo"),
    tab: "periodo",
    hidePaid: store.get("hidePaid") === "1",
  };
  const current = () => S.periodos.find((p) => p.id === S.currentId);
  const gastosDe = (pid) => S.gastos.filter((g) => g.periodo_id === pid).sort((a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at));

  function resumen(p) {
    const gs = gastosDe(p.id);
    const total = gs.reduce((s, g) => s + +g.monto, 0);
    const pagado = gs.filter((g) => g.pagado).reduce((s, g) => s + +g.monto, 0);
    return {
      gs, total: round2(total), pagado: round2(pagado), pendiente: round2(total - pagado),
      balance: round2(+p.salario - pagado), finalBalance: round2(+p.salario - total),
      nPagados: gs.filter((g) => g.pagado).length,
    };
  }

  function saldoDeuda(d) {
    const cargos = S.cargos.filter((c) => c.deuda_id === d.id).reduce((s, c) => s + +c.monto, 0);
    const abonos = S.gastos.filter((g) => g.deuda_id === d.id && g.pagado).reduce((s, g) => s + +g.monto, 0);
    return round2(+d.saldo_inicial + cargos - abonos);
  }

  // ---------- Carga inicial ----------
  async function loadAll() {
    let periodos, gastos, deudas, cargos;
    try {
      [periodos, gastos, deudas, cargos] = await Promise.all([
        q(sb.from("periodos").select("*").order("fecha", { ascending: false })),
        q(sb.from("gastos").select("*")),
        q(sb.from("deudas").select("*").order("created_at")),
        q(sb.from("deuda_cargos").select("*").order("created_at")),
      ]);
    } catch (err) {
      showSetup("No se pudo conectar", `Revisa <b>config.js</b> y que hayas ejecutado <b>schema.sql</b> en Supabase.<br><br><code>${esc(err.message)}</code>`);
      return;
    }
    $("#appView").classList.remove("hidden");
    $("#bottomNav").classList.remove("hidden");
    periodos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    Object.assign(S, { periodos, gastos, deudas, cargos });
    if (!current()) S.currentId = periodos[0]?.id ?? null;
    render();
  }

  // ---------- Render ----------
  function render() {
    renderPeriodSelect();
    renderPeriodo();
    renderDeudas();
    renderHistorial();
  }

  function renderPeriodSelect() {
    $("#periodSelect").innerHTML = S.periodos
      .map((p) => `<option value="${p.id}" ${p.id === S.currentId ? "selected" : ""}>${esc(p.nombre)}</option>`)
      .join("");
  }

  function renderPeriodo() {
    const p = current();
    $("#emptyPeriods").classList.toggle("hidden", !!p);
    $("#periodContent").classList.toggle("hidden", !p);
    $(".period-bar").classList.toggle("hidden", !p);
    if (!p) return;
    store.set("periodo", p.id);

    const r = resumen(p);
    const bal = $("#balance");
    bal.textContent = fmt(r.balance);
    bal.className = "hero-amount " + (r.balance < 0 ? "neg" : "");
    $("#progressBar").style.width = (r.total > 0 ? Math.min(100, (r.pagado / r.total) * 100) : 0) + "%";
    $("#paidCount").textContent = `${r.nPagados} de ${r.gs.length} pagados`;
    $("#afterAll").textContent = r.pendiente > 0 ? `Si pagas todo: ${fmt(r.finalBalance)}` : "Todo pagado ✓";
    if (document.activeElement !== $("#salaryInput")) $("#salaryInput").value = fmt(+p.salario);
    $("#totalGastos").textContent = fmt(r.total);
    $("#totalPagado").textContent = fmt(r.pagado);
    $("#totalPendiente").textContent = fmt(r.pendiente);

    const hb = $("#hidePaidBtn");
    hb.setAttribute("aria-pressed", S.hidePaid);
    const lista = S.hidePaid ? r.gs.filter((g) => !g.pagado) : r.gs;
    const deudaNombre = (id) => S.deudas.find((d) => d.id === id)?.nombre;
    $("#gastoList").innerHTML = lista.map((g) => `
      <li class="item ${g.pagado ? "paid" : ""}" data-id="${g.id}">
        <button class="toggle" type="button" data-act="toggle" aria-label="${g.pagado ? "Marcar como no pagado" : "Marcar como pagado"}">✓</button>
        <div class="body" data-act="edit">
          <div class="desc">${esc(g.descripcion)}</div>
          <div class="meta">${g.pagado ? "Pagado" : "Pendiente"}${g.deuda_id && deudaNombre(g.deuda_id) ? ` · <span class="badge">Abono ${esc(deudaNombre(g.deuda_id))}</span>` : ""}</div>
        </div>
        <span class="amt" data-act="edit">${fmt(+g.monto)}</span>
      </li>`).join("");
    $("#noGastos").classList.toggle("hidden", lista.length > 0);
    if (!lista.length && r.gs.length) $("#noGastos").textContent = "Todo pagado 🎉";
    else $("#noGastos").innerHTML = "Sin gastos. Toca <b>+</b> para agregar.";
  }

  function renderDeudas() {
    const activas = S.deudas;
    $("#noDeudas").classList.toggle("hidden", activas.length > 0);
    const total = activas.reduce((s, d) => s + saldoDeuda(d), 0);
    $("#deudaTotal").textContent = activas.length ? "Total: " + fmt(total) : "";
    const pName = (id) => S.periodos.find((p) => p.id === id)?.nombre ?? "";

    $("#deudaList").innerHTML = activas.map((d) => {
      const saldo = saldoDeuda(d);
      const movs = [
        ...S.cargos.filter((c) => c.deuda_id === d.id).map((c) => ({ t: c.created_at, label: c.nota || "Cargo", m: +c.monto })),
        ...S.gastos.filter((g) => g.deuda_id === d.id && g.pagado).map((g) => ({ t: S.periodos.find((p) => p.id === g.periodo_id)?.fecha ?? g.created_at, label: "Abono · " + pName(g.periodo_id), m: -g.monto })),
      ].sort((a, b) => String(b.t).localeCompare(String(a.t)));
      const meta = d.meta != null ? +d.meta : null;
      // progreso hacia la meta, medido desde el saldo inicial
      const pct = meta != null && +d.saldo_inicial > meta
        ? Math.max(0, Math.min(100, ((+d.saldo_inicial - saldo) / (+d.saldo_inicial - meta)) * 100)) : null;
      return `
      <div class="card deuda" data-id="${d.id}">
        <div class="deuda-top">
          <h2>${esc(d.nombre)}</h2>
          <span class="deuda-saldo ${saldo <= 0 ? "pos" : ""}">${fmt(saldo)}</span>
        </div>
        <div class="deuda-meta">
          ${d.limite != null ? `<span>Límite ${fmt(+d.limite)} · Disponible <b>${fmt(+d.limite - saldo)}</b></span>` : ""}
          ${meta != null ? `<span>Meta: ${fmt(meta)} ${saldo <= meta ? "✓" : `(faltan ${fmt(saldo - meta)})`}</span>` : ""}
          ${+d.interes_pct ? `<span>Interés ${+d.interes_pct}%</span>` : ""}
        </div>
        ${pct != null ? `<div class="progress meta"><div style="width:${pct}%"></div></div>` : ""}
        <div class="deuda-actions">
          ${+d.interes_pct ? `<button class="btn sm" type="button" data-act="interes">+ Interés ${+d.interes_pct}%</button>` : ""}
          <button class="btn sm" type="button" data-act="cargo">± Cargo</button>
          <button class="btn sm ghost" type="button" data-act="edit">Editar</button>
        </div>
        ${movs.length ? `<details><summary>Movimientos (${movs.length})</summary><div class="movs">
          ${movs.map((m) => `<div><span>${esc(m.label)}</span><span class="${m.m < 0 ? "pos" : "neg"}">${m.m < 0 ? "−" : "+"}${fmt(Math.abs(m.m))}</span></div>`).join("")}
        </div></details>` : ""}
      </div>`;
    }).join("");
  }

  function renderHistorial() {
    const rows = S.periodos.map((p) => ({ p, r: resumen(p) }));
    const sum = (f) => rows.reduce((s, x) => s + f(x), 0);
    const n = rows.length || 1;
    $("#historyTotals").innerHTML = `
      <div class="stat"><span class="label">Ingresos</span><strong>${fmt(sum((x) => +x.p.salario))}</strong></div>
      <div class="stat"><span class="label">Pagado</span><strong>${fmt(sum((x) => x.r.pagado))}</strong></div>
      <div class="stat"><span class="label">Sobrante prom.</span><strong>${fmt(sum((x) => x.r.balance) / n)}</strong></div>`;
    $("#historyList").innerHTML = rows.map(({ p, r }) => {
      const pct = +p.salario > 0 ? Math.min(100, (r.pagado / +p.salario) * 100) : 0;
      return `
      <li class="item hist" data-id="${p.id}">
        <div class="body">
          <div class="hero-row"><span class="desc">${esc(p.nombre)}</span><b class="${r.balance < 0 ? "neg" : "pos"}">${fmt(r.balance)}</b></div>
          <div class="bar"><div style="width:${pct}%"></div></div>
          <div class="nums"><span>Salario ${fmt(+p.salario)}</span><span>Pagado ${fmt(r.pagado)}</span><span>${r.nPagados}/${r.gs.length} gastos</span></div>
        </div>
      </li>`;
    }).join("");
  }

  // ---------- Navegación ----------
  function setTab(tab) {
    S.tab = tab;
    $$(".tab").forEach((t) => t.classList.toggle("hidden", t.id !== "tab-" + tab));
    $$("#bottomNav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    window.scrollTo({ top: 0 });
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
    if (S.tab === "historial" || !current()) return openPeriod();
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
  });

  // ---------- Salario ----------
  const salaryInput = $("#salaryInput");
  salaryInput.addEventListener("focus", () => { salaryInput.value = +current().salario || ""; salaryInput.select(); });
  salaryInput.addEventListener("keydown", (e) => { if (e.key === "Enter") salaryInput.blur(); });
  salaryInput.addEventListener("blur", async () => {
    const p = current();
    const v = parseNum(salaryInput.value);
    if (v == null || Number.isNaN(v) || v === +p.salario) { renderPeriodo(); return; }
    const old = p.salario;
    p.salario = v; renderPeriodo(); renderHistorial();
    try { await q(sb.from("periodos").update({ salario: v }).eq("id", p.id)); }
    catch { p.salario = old; render(); }
  });

  // ---------- Gastos ----------
  $("#gastoList").addEventListener("click", async (e) => {
    const li = e.target.closest(".item");
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!li || !act) return;
    const g = S.gastos.find((x) => x.id === li.dataset.id);
    if (act === "edit") return openGasto(g);
    if (act === "toggle") {
      g.pagado = !g.pagado;
      render();
      try { await q(sb.from("gastos").update({ pagado: g.pagado }).eq("id", g.id)); }
      catch { g.pagado = !g.pagado; render(); }
    }
  });

  const gastoDialog = $("#gastoDialog");
  const gastoForm = $("#gastoForm");
  let editingGasto = null;

  function openGasto(g = null) {
    editingGasto = g;
    $("#gastoTitle").textContent = g ? "Editar gasto" : "Nuevo gasto";
    $("#gastoDelete").classList.toggle("hidden", !g);
    gastoForm.deuda_id.innerHTML = `<option value="">— Ninguna —</option>` +
      S.deudas.map((d) => `<option value="${d.id}">${esc(d.nombre)}</option>`).join("");
    gastoForm.descripcion.value = g?.descripcion ?? "";
    gastoForm.monto.value = g ? +g.monto : "";
    gastoForm.deuda_id.value = g?.deuda_id ?? "";
    gastoForm.pagado.checked = g?.pagado ?? false;
    gastoDialog.showModal();
    if (!g) gastoForm.descripcion.focus();
  }

  // Sugerir la deuda si el nombre coincide
  gastoForm.descripcion.addEventListener("change", () => {
    if (gastoForm.deuda_id.value) return;
    const d = S.deudas.find((x) => x.nombre.toLowerCase() === gastoForm.descripcion.value.trim().toLowerCase());
    if (d) gastoForm.deuda_id.value = d.id;
  });

  gastoForm.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "ok") return;
    const monto = parseNum(gastoForm.monto.value) ?? 0;
    if (Number.isNaN(monto)) { e.preventDefault(); toast("Monto inválido"); return; }
    const row = {
      descripcion: gastoForm.descripcion.value.trim(),
      monto,
      pagado: gastoForm.pagado.checked,
      deuda_id: gastoForm.deuda_id.value || null,
    };
    if (editingGasto) {
      const [upd] = await q(sb.from("gastos").update(row).eq("id", editingGasto.id).select());
      Object.assign(editingGasto, upd);
    } else {
      const orden = Math.max(0, ...gastosDe(S.currentId).map((g) => g.orden)) + 1;
      const [ins] = await q(sb.from("gastos").insert({ ...row, periodo_id: S.currentId, orden }).select());
      S.gastos.push(ins);
    }
    render();
  });

  $("#gastoDelete").addEventListener("click", async () => {
    if (!editingGasto || !confirm(`¿Eliminar "${editingGasto.descripcion}"?`)) return;
    await q(sb.from("gastos").delete().eq("id", editingGasto.id));
    S.gastos = S.gastos.filter((g) => g.id !== editingGasto.id);
    gastoDialog.close(); render();
  });

  async function markAllPaid() {
    const pend = gastosDe(S.currentId).filter((g) => !g.pagado);
    if (!pend.length) return toast("Ya está todo pagado");
    if (!confirm(`¿Marcar ${pend.length} gasto(s) como pagados?`)) return;
    await q(sb.from("gastos").update({ pagado: true }).in("id", pend.map((g) => g.id)));
    pend.forEach((g) => (g.pagado = true));
    render();
  }

  // ---------- Quincenas ----------
  const periodDialog = $("#periodDialog");
  const periodForm = $("#periodForm");
  let editingPeriod = null;
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
    editingPeriod = p;
    $("#periodTitle").textContent = p ? "Editar quincena" : "Nueva quincena";
    $("#periodDelete").classList.toggle("hidden", !p);
    $(".copy-row").classList.toggle("hidden", !!p || !current());
    const sug = nextQuincena();
    periodForm.nombre.value = p?.nombre ?? sug.nombre;
    periodForm.fecha.value = p?.fecha ?? sug.fecha;
    periodForm.salario.value = p ? +p.salario : (current() ? +current().salario : "");
    periodForm.copiar.checked = true;
    periodDialog.showModal();
  }

  periodForm.fecha.addEventListener("change", () => {
    if (editingPeriod) return;
    const [, m, d] = periodForm.fecha.value.split("-").map(Number);
    if (m && d) periodForm.nombre.value = `${d} de ${MESES[m - 1]}`;
  });

  periodForm.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "ok") return;
    const salario = parseNum(periodForm.salario.value) ?? 0;
    if (Number.isNaN(salario)) { e.preventDefault(); toast("Salario inválido"); return; }
    const row = { nombre: periodForm.nombre.value.trim(), fecha: periodForm.fecha.value, salario };

    if (editingPeriod) {
      const [upd] = await q(sb.from("periodos").update(row).eq("id", editingPeriod.id).select());
      Object.assign(editingPeriod, upd);
    } else {
      const copyFrom = periodForm.copiar.checked && current() ? gastosDe(current().id) : [];
      const [ins] = await q(sb.from("periodos").insert(row).select());
      S.periodos.push(ins);
      if (copyFrom.length) {
        const nuevos = await q(sb.from("gastos").insert(copyFrom.map((g, i) => ({
          periodo_id: ins.id, descripcion: g.descripcion, monto: g.monto,
          deuda_id: g.deuda_id, pagado: false, orden: i + 1,
        }))).select());
        S.gastos.push(...nuevos);
      }
      S.currentId = ins.id;
      toast("Quincena creada");
    }
    S.periodos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    render(); setTab("periodo");
  });

  $("#periodDelete").addEventListener("click", async () => {
    const p = editingPeriod;
    if (!p || !confirm(`¿Eliminar la quincena "${p.nombre}" y todos sus gastos?`)) return;
    await q(sb.from("periodos").delete().eq("id", p.id));
    S.periodos = S.periodos.filter((x) => x.id !== p.id);
    S.gastos = S.gastos.filter((g) => g.periodo_id !== p.id);
    S.currentId = S.periodos[0]?.id ?? null;
    periodDialog.close(); render();
  });

  // ---------- Deudas ----------
  const deudaDialog = $("#deudaDialog");
  const deudaForm = $("#deudaForm");
  let editingDeuda = null;

  function openDeuda(d = null) {
    editingDeuda = d;
    $("#deudaTitle").textContent = d ? "Editar deuda" : "Nueva deuda";
    $("#deudaDelete").classList.toggle("hidden", !d);
    $("#deudaEditHint").classList.toggle("hidden", !d);
    deudaForm.querySelector("[name=saldo_inicial]").previousSibling.textContent = d ? "Saldo inicial" : "Saldo actual";
    deudaForm.nombre.value = d?.nombre ?? "";
    deudaForm.saldo_inicial.value = d ? +d.saldo_inicial : "";
    deudaForm.limite.value = d?.limite ?? "";
    deudaForm.meta.value = d?.meta ?? "";
    deudaForm.interes_pct.value = d ? +d.interes_pct || "" : "";
    deudaDialog.showModal();
  }

  deudaForm.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "ok") return;
    const nums = ["saldo_inicial", "limite", "meta", "interes_pct"].map((k) => parseNum(deudaForm[k].value));
    if (nums.some(Number.isNaN)) { e.preventDefault(); toast("Revisa los montos"); return; }
    const [saldo_inicial, limite, meta, interes_pct] = nums;
    const row = { nombre: deudaForm.nombre.value.trim(), saldo_inicial: saldo_inicial ?? 0, limite, meta, interes_pct: interes_pct ?? 0 };
    if (editingDeuda) {
      const [upd] = await q(sb.from("deudas").update(row).eq("id", editingDeuda.id).select());
      Object.assign(editingDeuda, upd);
    } else {
      const [ins] = await q(sb.from("deudas").insert(row).select());
      S.deudas.push(ins);
    }
    render();
  });

  $("#deudaDelete").addEventListener("click", async () => {
    const d = editingDeuda;
    if (!d || !confirm(`¿Eliminar la deuda "${d.nombre}"? Los gastos se conservan.`)) return;
    await q(sb.from("deudas").delete().eq("id", d.id));
    S.deudas = S.deudas.filter((x) => x.id !== d.id);
    S.cargos = S.cargos.filter((c) => c.deuda_id !== d.id);
    S.gastos.forEach((g) => { if (g.deuda_id === d.id) g.deuda_id = null; });
    deudaDialog.close(); render();
  });

  const cargoDialog = $("#cargoDialog");
  const cargoForm = $("#cargoForm");
  let cargoDeuda = null;

  async function addCargo(deuda, monto, nota) {
    const [ins] = await q(sb.from("deuda_cargos").insert({ deuda_id: deuda.id, monto, nota }).select());
    S.cargos.push(ins);
    render();
  }

  $("#deudaList").addEventListener("click", async (e) => {
    const card = e.target.closest(".deuda");
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!card || !act) return;
    const d = S.deudas.find((x) => x.id === card.dataset.id);
    if (act === "edit") return openDeuda(d);
    if (act === "cargo") {
      cargoDeuda = d;
      $("#cargoTitle").textContent = "Cargo a " + d.nombre;
      cargoForm.reset();
      cargoDialog.showModal();
    }
    if (act === "interes") {
      const monto = round2((saldoDeuda(d) * +d.interes_pct) / 100);
      if (monto <= 0) return toast("No hay saldo para aplicar interés");
      if (!confirm(`Aplicar ${+d.interes_pct}% de interés (${fmt(monto)}) a ${d.nombre}?`)) return;
      await addCargo(d, monto, `Interés ${+d.interes_pct}%`);
      toast("Interés aplicado");
    }
  });

  cargoForm.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "ok") return;
    const monto = parseNum(cargoForm.monto.value);
    if (monto == null || Number.isNaN(monto) || monto === 0) { e.preventDefault(); toast("Monto inválido"); return; }
    await addCargo(cargoDeuda, monto, cargoForm.nota.value.trim() || null);
  });

  // Cerrar diálogos tocando el fondo
  $$("dialog").forEach((dlg) => dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }));

  loadAll();
})();
