(async function () {
  // 1. Intentar descargar los datos reales desde tu base de datos de Supabase a través del servidor
  let state = {
    stats: { totalArticulos: 0, escaneados: 0, restantes: 0 },
    articles: [],
    activity: []
  };

  try {
    // Como el frontend y el backend están en el mismo dominio de Azure, basta con usar la ruta relativa
    const response = await fetch('/api/state');
    if (!response.ok) throw new Error('Error al conectar con la base de datos');
    
    const dbData = await response.json();
    // Combinamos la estructura recibida con nuestro estado local
    state = Object.assign(state, dbData);
  } catch (error) {
    console.error("❌ Error cargando inventario real:", error);
    // Mensaje visual de error por si falla Supabase o la red
    state.activity.push({ 
      id: "err", 
      titulo: "Error de Conexión", 
      detalle: "No se pudo sincronizar con el almacén central.", 
      tiempo: "Ahora" 
    });
  }

  const $content = document.getElementById("content");
  const $bottomNav = document.getElementById("bottomNav");

  const screens = {
    dashboard: renderDashboard,
    scanner: renderScanner,
    add: renderAdd,
    inventory: renderInventory,
    materials: renderInventory,
    reports: renderReports,
    profile: renderProfile
  };

  let currentScreen = "dashboard";

  const navItems = [
    { id: "dashboard", label: "Inicio", icon: homeIcon },
    { id: "materials", label: "Material", icon: packageIcon },
    { id: "add", label: "Ajuste", icon: plusIcon },
    { id: "scanner", label: "Escáner", icon: scanIcon },
    { id: "profile", label: "Perfil", icon: userIcon }
  ];

  function setScreen(screenId) {
    currentScreen = screenId in screens ? screenId : "dashboard";
    renderBottomNav();
    renderHeaderForScreen(currentScreen);
    renderScreen();
  }

  // Exponer setScreen para onclick inline
  window.__invexSetScreen = setScreen;

  function renderScreen() {
    const renderer = screens[currentScreen] || renderDashboard;
    if (!$content) return;
    $content.innerHTML = "";
    const node = renderer();
    if (node) $content.appendChild(node);
  }

  function renderBottomNav() {
    if (!$bottomNav) return;

    const inner = document.createElement("div");
    inner.className = "nav-inner";

    const row = document.createElement("div");
    row.className = "nav-items";

    navItems.forEach((item) => {
      const isActive =
        item.id === currentScreen ||
        (item.id === "dashboard" && currentScreen === "dashboard");

      const btn = document.createElement("button");
      btn.className = "nav-item" + (isActive ? " active" : "");
      btn.type = "button";
      btn.addEventListener("click", () => setScreen(item.id));

      const ico = document.createElement("div");
      ico.className = "ico";
      ico.innerHTML = item.icon();

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = item.label;

      btn.appendChild(ico);
      btn.appendChild(label);
      row.appendChild(btn);
    });

    inner.appendChild(row);
    $bottomNav.innerHTML = "";
    $bottomNav.appendChild(inner);
  }

  function renderHeaderForScreen(screenId) {
    const $topbar = document.getElementById("topbar");
    if (!$topbar) return;

    const titles = {
      dashboard: "Inicio",
      scanner: "Escáner de códigos",
      add: "Ajuste de Inventario",
      materials: "Material",
      inventory: "Ajuste de Inventario",
      reports: "Informes",
      profile: "Perfil"
    };

    const sub = "Gestión de Planchas";

    $topbar.innerHTML = `
      <div class="brand" style="width:100%; max-width:430px;">
        <div class="brand-mark">
          <img alt="Invex" src="${safeAsset("src/assets/invex-logo.png")}" onerror="this.style.display='none'"/>
        </div>
        <div style="min-width:0;">
          <div class="title">${escapeHtml(titles[screenId] || "Gestión de Planchas")}</div>
          <div class="subtitle">${escapeHtml(sub)}</div>
        </div>

        <div class="row" style="margin-left:auto; gap:10px;">
          <button class="icon-btn" type="button" aria-label="Notificaciones" title="Notificaciones">
            ${bellIcon()}
          </button>

          <button
            class="icon-btn"
            type="button"
            aria-label="Ir al perfil"
            title="Perfil"
            onclick="window.__invexSetScreen && window.__invexSetScreen('profile')"
          >
            ${userIcon()}
          </button>
        </div>
      </div>
    `;
  }

  function renderDashboard() {
    const wrap = document.createElement("div");
    wrap.className = "space-y-16";

    wrap.innerHTML = `
      <div class="welcome">
      <div>
        <h2 class="h-hero" style="margin-bottom:2px;">¡Hola!</h2>
        <p class="subtle small">Gestiona tu inventario fácilmente</p>
      </div>
      </div>
    `;
    const cta = document.createElement("section");
    cta.className = "card cta";
    cta.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <div>
          <div class="cta-title" style="text-align:left;">Escanea rápido</div>
          <div class="cta-sub">Escanea un código de barras para comenzar</div>
        </div>

        <button
          class="btn btn-ghost"
          type="button"
          style="border:0; background:#fff; color:#0284c7; padding:0; width:44px; height:44px; border-radius:999px; display:flex; align-items:center; justify-content:center;"
          aria-label="Ir al escáner"
          onclick="window.__invexSetScreen('scanner')"
        >
          ${qrIcon()}
        </button>
      </div>
    `;

    const quick = document.createElement("section");
    const quickActions = [
      { screen: "scanner", label: "Escáner", icon: scanLineIcon, color: "rgba(14,165,233,.14)", text: "#0284c7" },
      { screen: "materials", label: "Lista de materiales", icon: packageIcon, color: "rgba(34,197,94,.14)", text: "#15803d" },
      { screen: "add", label: "Añadir artículo", icon: plusIcon, color: "rgba(139,92,246,.14)", text: "#6d28d9" },
      { screen: "reports", label: "Informe", icon: chartIcon, color: "rgba(245,158,11,.14)", text: "#b45309" }
    ];

    quick.innerHTML = `
      <h3 class="section-title">Acceso rápido</h3>
      <div class="grid-2"></div>
    `;

    const grid = quick.querySelector(".grid-2");
    quickActions.forEach((a) => {
      const card = document.createElement("div");
      card.className = "card quick-card";
      card.innerHTML = `
        <div style="padding:10px;">
          <div class="quick-icon-wrap" style="background:${a.color}; color:${a.text};">
            ${a.icon()}
          </div>
          <div class="quick-label">${escapeHtml(a.label)}</div>
        </div>
      `;
      card.addEventListener("click", () => setScreen(a.screen));
      grid.appendChild(card);
    });

    const stats = document.createElement("section");
    stats.className = "card card-flat";
    stats.innerHTML = `
      <h3 class="section-title">Resumen rápido</h3>
      <div class="grid-3">
        <div class="stat">
          <div class="stat-value">${number(state.stats.totalArticulos)}</div>
          <div class="stat-label">Artículos totales</div>
        </div>

        <div class="stat">
          <div class="stat-value" style="color:#16a34a;">${number(state.stats.escaneados)}</div>
          <div class="stat-label">Escaneados</div>
        </div>

        <div class="stat">
          <div class="stat-value" style="color:#f59e0b;">${number(state.stats.restantes)}</div>
          <div class="stat-label">Restantes</div>
        </div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      .stat{ text-align:center; padding:6px 0; }
      .stat-value{ font-size:28px; font-weight:900; }
      .stat-label{ font-size:12.5px; color: rgba(17,24,39,.55); margin-top:2px; font-weight:700;}
    `;
    wrap.appendChild(style);
    wrap.appendChild(cta);
    wrap.appendChild(quick);
    wrap.appendChild(stats);

    const footer = document.createElement("section");
    footer.className = "card cta";
    footer.style.background = "linear-gradient(90deg, #0284c7 0%, #0369a1 100%)";
    footer.style.boxShadow = "0 16px 30px rgba(3,105,161,.22)";

    footer.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; gap:14px; padding:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="background:#fff; padding:6px; border-radius:12px; border:1px solid var(--border); box-shadow: var(--shadow-sm);">
            <img alt="Invex" src="${safeAsset("src/assets/invex-logo.png")}" style="width:24px; height:24px; object-fit:contain;" onerror="this.style.display='none'"/>
          </div>
          <div>
            <div style="color:#fff; font-weight:900; font-size:16px;">FAMECA</div>
          </div>
        </div>
      </div>
    `;
    wrap.appendChild(footer);
    return wrap;
  }

  function renderScanner() {
    const wrap = document.createElement("div");
    wrap.className = "space-y-12";

    wrap.innerHTML = `
      <div class="card" style="padding:16px;">
        <h3 class="section-title" style="margin-bottom:6px;">Escáner</h3>
        <p class="subtle small" style="margin-bottom:12px;">
          Demo: simula un escaneo para actualizar el inventario.
        </p>

        <div class="item" style="padding:12px; border-radius:var(--radius); background:var(--card-2);">
          <div class="item-left">
            <div class="item-thumb" style="width:44px; height:44px;">
              ${qrIcon()}
            </div>

            <div class="item-meta">
              <div class="item-name">Código detectado</div>
              <div class="item-sub">Pulsa “Simular escaneo”</div>
            </div>
          </div>

          <button class="btn btn-primary" type="button" onclick="window.__invexSimulateScan && window.__invexSimulateScan()">
            Simular escaneo
          </button>
        </div>
      </div>

      <div class="card" style="padding:16px;">
        <h3 class="section-title">Actividad</h3>
        <div class="list" id="activityList"></div>
      </div>
    `;

    const activityList = wrap.querySelector("#activityList");
    const items = state.activity || [];

    if (items.length === 0) {
      activityList.innerHTML = `<div class="subtle small">Sin actividad.</div>`;
    } else {
      activityList.innerHTML = items.map((a) => `
        <div class="item" style="padding:12px; background:var(--card-2); border-radius:var(--radius); border:1px solid var(--border);">
          <div class="item-meta">
            <div class="item-name">${escapeHtml(a.titulo)}</div>
            <div class="item-sub">${escapeHtml(a.detalle)} • ${escapeHtml(a.tiempo)}</div>
          </div>
        </div>
      `).join("");
    }

    return wrap;
  }

  window.__invexSimulateScan = function () {
    if (!state.stats) return;

    state.stats.escaneados = Math.min(state.stats.totalArticulos, (state.stats.escaneados || 0) + 1);
    state.stats.restantes = Math.max(0, (state.stats.totalArticulos || 0) - state.stats.escaneados);

    renderScreen();
  };

function renderAdd() {
  const wrap = document.createElement("div");
  wrap.className = "space-y-12";

  wrap.innerHTML = `
    <div class="card" style="padding:16px;">
      <style>
        #loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(5px);
          z-index: 9999;
          display: none;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        body.loading { overflow: hidden; }

        .ms-switch-wrap{
          display:flex;
          align-items:center;
          justify-content:center;
          gap:14px;
          margin-bottom:12px;
        }
        .ms-switch{
          position:relative;
          width:180px;
          height:40px;
          border-radius:999px;
          padding:4px;
          border:1px solid var(--border);
          background: #fff;
          box-shadow: var(--shadow-sm);
          overflow:hidden;
          cursor: pointer;
        }
        .ms-switch .ms-thumb{
          position:absolute;
          top:4px;
          left:4px;
          width:calc(50% - 4px);
          height:calc(100% - 8px);
          border-radius:999px;
          transition: transform .18s ease;
          background:#E2EFDA; /* Recepción */
          border:1px solid rgba(22,163,74,.22);
        }
        .ms-switch[data-mode="retiro"] .ms-thumb{
          transform: translateX(calc(100% - 4px));
          background:#FFCDCD; /* Retiro */
          border-color: rgba(239,68,68,.22);
        }
        .ms-labels{
          width:100%;
          position:relative;
          z-index:2;
          display:flex;
          height:100%;
          align-items:center;
          justify-content:space-between;
          padding:0 12px;
          font-weight:900;
          font-size:12.5px;
          color: rgba(17,24,39,.65);
          pointer-events:none;
        }
        .ms-labels .left{ color:#15803d; }
        .ms-labels .right{ color:#b91c1c; }

        .section-title-soft{
          font-size:14.5px;
          font-weight:850;
          margin:0 0 10px;
          color: rgba(17,24,39,.92);
        }

        .grid-stack{
          display:grid;
          grid-template-columns: 1fr;
          gap:10px;
        }

        .select{
          width:100%;
          border:1px solid var(--border);
          border-radius:14px;
          padding:11px 12px;
          font-size:14px;
          background:#fff;
          outline:none;
        }
        .select:focus{
          border-color: rgba(14,165,233,.55);
          box-shadow: 0 0 0 3px rgba(14,165,233,.15);
        }

        .carrito-list{
          display:flex;
          flex-direction:column;
          gap:10px;
          margin-top:10px;
        }
        .carrito-item{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:12px;
          background:var(--card-2);
          border-radius:var(--radius);
          border:1px solid var(--border);
        }
        .carrito-item .item-info{ min-width:0; flex: 1; }
        .carrito-item .item-nombre{
          font-weight:900;
          font-size:13.5px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .carrito-item .item-sub{
          margin-top:2px;
          font-size:12px;
          color:var(--muted);
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .carrito-item .item-controls{ display:flex; align-items:center; gap:10px; }

        .qty-input{
          width:92px;
          border:1px solid var(--border);
          border-radius:14px;
          padding:9px 10px;
          font-size:14px;
          background:#fff;
          outline:none;
        }
        .qty-input:focus{
          border-color: rgba(14,165,233,.55);
          box-shadow: 0 0 0 3px rgba(14,165,233,.15);
        }

        .remove-btn{
          border:0;
          background:transparent;
          color: rgba(17,24,39,.45);
          cursor:pointer;
          font-weight:900;
          font-size:14px;
          padding:0 4px;
        }

        .add-btn{
          border:0;
          background: rgba(14,165,233,.14);
          color: #0284c7;
          padding:10px 12px;
          border-radius:14px;
          font-weight:900;
          cursor:pointer;
          border:1px solid rgba(14,165,233,.22);
          height:44px;
        }
        .add-btn:disabled{ opacity:.6; cursor:not-allowed; }
      </style>

      <h3 class="section-title">Ajuste de Inventario</h3>
      <p class="subtle small" style="margin-top:-4px; margin-bottom:12px;">
        Implementación completa: <b>Recepción</b>.
      </p>

      <div class="ms-switch-wrap">
        <div class="ms-switch" id="ms-switch" data-mode="recepcion" role="switch" aria-checked="false" tabindex="0">
          <div class="ms-thumb" id="ms-thumb"></div>
          <div class="ms-labels">
            <div class="left">Recepción</div>
            <div class="right">Retiro</div>
          </div>
        </div>
      </div>

      <div class="section" style="margin-top:2px;">
        <label style="font-weight:900; font-size:12.5px; color:rgba(17,24,39,.7); display:block;">
          ID de Recepción
          <div style="margin-top:6px; font-weight:950; font-size:16px;" id="lblProximoId">—</div>
        </label>
      </div>

      <div class="grid-stack" style="margin-top:12px;">
        <label style="font-weight:900; font-size:12.5px; color:rgba(17,24,39,.7);">
          Proveedor
          <select id="selectorProveedor" class="select"><option value="">Cargando…</option></select>
        </label>

        <label style="font-weight:900; font-size:12.5px; color:rgba(17,24,39,.7);">
          Almacén
          <select id="selectorAlmacen" class="select"><option value="">Cargando…</option></select>
        </label>
      </div>

      <div class="section" style="margin-top:14px;">
        <div class="section-title-soft">Tipo de plancha</div>
        <select id="selectorFamilia" class="select">
          <option value="">-- Todas las familias --</option>
        </select>
      </div>

      <div class="section" style="margin-top:12px;">
        <div class="section-title-soft">Subtipo</div>
        <select id="selectorSubfamilia" class="select">
          <option value="">-- Todas las subfamilias --</option>
        </select>
      </div>

      <div class="section" style="margin-top:12px;">
        <div class="section-title-soft">Item</div>
        <div class="row" style="gap:10px; align-items:flex-end; display:flex;">
          <div style="flex:1 1 auto;">
            <select id="selectorItem" class="select">
              <option value="">-- Seleccione un item --</option>
            </select>
          </div>
          <button class="add-btn" type="button" id="btnAddCarrito">
            + Añadir
          </button>
        </div>
      </div>

      <div class="section" style="margin-top:14px;">
        <div class="section-title-soft">Carrito</div>
        <div id="carritoBody" class="carrito-list"></div>
      </div>

      <div class="section" style="margin-top:14px;">
        <label style="font-weight:900; font-size:12.5px; color:rgba(17,24,39,.7); display:block;">
          Observaciones (Opcional)
          <textarea id="txtObservaciones" rows="3" maxlength="20000" placeholder="Escriba aquí notas adicionales..." style="width:100%; margin-top:6px; border:1px solid var(--border); border-radius:14px; padding:11px 12px; font-size:14px; background:#fff; outline:none; resize:none; box-sizing: border-box;"></textarea>
        </label>
      </div>

      <div class="row" style="margin-top:16px; display:flex; justify-content:space-between;">
        <button class="btn btn-ghost" type="button" id="btnCancelar">
          Cancelar
        </button>
        <button class="btn btn-primary" type="button" id="btnSubmitRecepcion" style="background:#E2EFDA; color:#15803d; border:1px solid rgba(22,163,74,.22); font-weight:bold; padding:10px 16px; border-radius:14px; cursor:pointer;">
          Ajustar inventario
        </button>
      </div>
    </div>

    <div id="loading-overlay">Cargando...</div>
  `;

  // --- ÁMBITO DE ESTADO PRIVADO (Encapsulado) ---
  const state = {
    proximoId: 1,
    proveedores: [],
    almacenes: [],
    familias: [],
    subfamilias: [],
    itemsCache: [],
    carrito: new Map() // key: String(idItem) -> { id_item: Number, nombre, subfamiliaNombre, cantidad }
  };

  // --- ELEMENTOS DEL DOM ---
  const getEl = (id) => wrap.querySelector(`#${id}`);

  function showLoading() {
    const overlay = getEl('loading-overlay');
    const btn = getEl('btnSubmitRecepcion');
    if (overlay) overlay.style.display = 'flex';
    document.body.classList.add('loading');
    if (btn) btn.disabled = true;
  }

  function hideLoading() {
    const overlay = getEl('loading-overlay');
    const btn = getEl('btnSubmitRecepcion');
    if (overlay) overlay.style.display = 'none';
    document.body.classList.remove('loading');
    if (btn) btn.disabled = false;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function fillSelect($select, list, getValue, getLabel, emptyLabel) {
    if (!$select) return;
    $select.innerHTML = '';
    if (emptyLabel !== undefined) {
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = emptyLabel;
      $select.appendChild(opt0);
    }
    (list || []).forEach((x) => {
      const opt = document.createElement('option');
      opt.value = getValue(x);
      opt.textContent = getLabel(x);
      $select.appendChild(opt);
    });
  }

  function llenarItemsDropdown(items) {
    const $selItem = getEl('selectorItem');
    if (!$selItem) return;
    $selItem.innerHTML = '';
    
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '-- Seleccione un item --';
    $selItem.appendChild(opt0);

    (items || []).forEach((it) => {
      const opt = document.createElement('option');
      opt.value = it.itemId;
      opt.textContent = it.itemNombre + (it.subfamiliaNombre ? (' | ' + it.subfamiliaNombre) : '');
      opt.setAttribute('data-sub', it.subfamiliaNombre || '');
      $selItem.appendChild(opt);
    });
  }

  // --- ACCIONES API ---
  async function cargarRecepcion() {
    showLoading();
    try {
      const resp = await fetch('/api/recepcion-data');
      if (!resp.ok) throw new Error('Error al cargar datos de recepción');
      const data = await resp.json();

      state.proximoId = data.proximoId || 1;
      const lblId = getEl('lblProximoId');
      if (lblId) lblId.textContent = state.proximoId;

      state.proveedores = data.proveedores || [];
      state.almacenes = data.almacenes || [];
      state.familias = data.familias || [];
      state.itemsCache = data.items || [];
      state.subfamilias = data.subfamilias || [];

      fillSelect(getEl('selectorProveedor'), state.proveedores, (x) => x.id, (x) => x.nombre, '-- Seleccione proveedor --');
      fillSelect(getEl('selectorAlmacen'), state.almacenes, (x) => x.id, (x) => x.nombre, '-- Seleccione almacén --');
      fillSelect(getEl('selectorFamilia'), state.familias, (x) => x.id, (x) => x.nombre, '-- Todas las familias --');
      fillSelect(getEl('selectorSubfamilia'), state.subfamilias, (x) => x.id, (x) => x.nombre, '-- Todas las subfamilias --');

      llenarItemsDropdown(state.itemsCache);
    } catch (err) {
      console.error(err);
      alert('Error: ' + (err.message || err));
    } finally {
      hideLoading();
    }
  }

  async function cargarConFiltros(familiaId, subfamiliaId) {
    showLoading();
    try {
      let url = '/api/recepcion-data';
      const qs = [];
      if (familiaId) qs.push('familia_id=' + encodeURIComponent(familiaId));
      if (subfamiliaId) qs.push('subfamilia_id=' + encodeURIComponent(subfamiliaId));
      if (qs.length) url += '?' + qs.join('&');

      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Error al cargar filtros');
      const data = await resp.json();

      state.itemsCache = data.items || [];
      
      if (!subfamiliaId) {
        state.subfamilias = data.subfamilias || [];
        fillSelect(getEl('selectorSubfamilia'), state.subfamilias, (x) => x.id, (x) => x.nombre, '-- Todas las subfamilias --');
        if (familiaId) getEl('selectorSubfamilia').value = '';
      }
      
      llenarItemsDropdown(state.itemsCache);
    } catch (err) {
      console.error(err);
      alert('Error: ' + (err.message || err));
    } finally {
      hideLoading();
    }
  }

  // --- LÓGICA DEL CARRITO ---
  function agregarAlCarrito() {
    const $selItem = getEl('selectorItem');
    if (!$selItem) return;
    
    const opt = $selItem.options[$selItem.selectedIndex];
    if (!opt || !opt.value) return;

    const idItem = String(opt.value);
    const nombre = opt.textContent.split('|')[0].trim();
    const sub = opt.getAttribute('data-sub') || '';

    if (state.carrito.has(idItem)) {
      alert('Este item ya está en el carrito. No se permiten duplicados.');
      return;
    }

    state.carrito.set(idItem, { 
      id_item: Number(idItem), 
      nombre: nombre, 
      subfamiliaNombre: sub, 
      cantidad: 1 
    });

    const carritoList = getEl('carritoBody');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'carrito-item';
    itemDiv.setAttribute('data-id', idItem);

    itemDiv.innerHTML = `
      <div class="item-info">
        <div class="item-nombre">${escapeHtml(nombre)}</div>
        <div class="item-sub">${escapeHtml(sub)}</div>
      </div>
      <div class="item-controls">
        <input type="number" class="qty-input" value="1" min="1" step="1" />
        <button class="remove-btn" type="button" aria-label="Eliminar">✕</button>
      </div>
    `;

    itemDiv.querySelector('.remove-btn').addEventListener('click', () => {
      state.carrito.delete(idItem);
      itemDiv.remove();
    });

    itemDiv.querySelector('.qty-input').addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      const qty = (!isNaN(v) && v > 0) ? v : 1;
      state.carrito.get(idItem).cantidad = qty;
    });
    
    itemDiv.querySelector('.qty-input').addEventListener('blur', (e) => {
      // Reestablece visualmente el input si lo dejaron vacío o con letras
      e.target.value = state.carrito.get(idItem).cantidad;
    });

    carritoList.appendChild(itemDiv);
    $selItem.value = '';
  }

  async function procesarGuardado() {
    if (state.carrito.size === 0) {
      alert('El carrito está vacío');
      return;
    }

    const id_proveedor = getEl('selectorProveedor').value;
    const id_almacen = getEl('selectorAlmacen').value;
    const observaciones = getEl('txtObservaciones').value;

    if (!id_proveedor) return alert('Seleccione un proveedor');
    if (!id_almacen) return alert('Seleccione un almacén');

    const datosParaEnviar = {
      id_proveedor,
      id_almacen,
      observaciones,
      items: Array.from(state.carrito.values()).map(x => ({ id: x.id_item, cantidad: x.cantidad }))
    };

    showLoading();

    try {
      const response = await fetch('/api/ajuste-recepcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosParaEnviar)
      });

      const resultado = await response.json();
      if (resultado && resultado.success) {
        alert(resultado.message || 'Ajuste procesado con éxito');
        if (window.__invexSetScreen) {
          window.__invexSetScreen('materials');
        } else {
          location.href = '/';
        }
      } else {
        alert('Error: ' + (resultado?.message || 'No se pudo ajustar'));
      }
    } catch (error) {
      alert('Error de conexión: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  // --- ASIGNACIÓN DE EVENTOS SEGUROS (Post-Render) ---
  // Usamos setTimeout para asegurar que el elemento ya se encuentra en el DOM activo
  setTimeout(() => {
    getEl('selectorFamilia').addEventListener('change', async (e) => {
      getEl('selectorSubfamilia').value = '';
      await cargarConFiltros(e.target.value, null);
    });

    getEl('selectorSubfamilia').addEventListener('change', async (e) => {
      const familiaId = getEl('selectorFamilia').value;
      await cargarConFiltros(familiaId || null, e.target.value || null);
    });

    getEl('btnAddCarrito').addEventListener('click', agregarAlCarrito);
    getEl('btnSubmitRecepcion').addEventListener('click', procesarGuardado);
    
    getEl('btnCancelar').addEventListener('click', () => {
      if (window.__invexSetScreen) window.__invexSetScreen('materials');
    });

    // Toggle de Modo Microsoft
    getEl('ms-switch').addEventListener('click', function() {
      const mode = this.getAttribute('data-mode');
      if (mode === 'recepcion') {
        this.setAttribute('data-mode', 'retiro');
        this.setAttribute('aria-checked', 'true');
        alert('Retiro: lógica no implementada por ahora.');
        // Revertir automáticamente ya que no está implementado
        setTimeout(() => {
          this.setAttribute('data-mode', 'recepcion');
          this.setAttribute('aria-checked', 'false');
        }, 300);
      }
    });

    // Carga inicial de datos
    cargarRecepcion();
  }, 0);

  return wrap;
}
  window.__invexAddDemo = function () {
    setScreen("materials");
  };

  function renderInventory() {
    const wrap = document.createElement("div");
    wrap.className = "space-y-12";

    const cards = document.createElement("div");
    cards.className = "list";

    const articles = state.articles || [];
    cards.innerHTML = articles.map((a) => {
      const badgeClass =
        a.estado === "ok" ? "badge ok" :
        a.estado === "warn" ? "badge warn" :
        "badge danger";

      const badgeText =
        a.estado === "ok" ? "OK" :
        a.estado === "warn" ? "Bajo" :
        "Crítico";

      return `
        <div class="item" style="background:var(--card-2); border-radius:var(--radius); border:1px solid var(--border); padding:14px;">
          <div class="item-left">
            <div class="item-thumb">
              ${boxIcon()}
            </div>

            <div class="item-meta">
              <div class="item-name">${escapeHtml(a.item || a.nombre)}</div>
              <div class="item-sub">${escapeHtml(a.familia || a.categoria || "")} • ID: ${escapeHtml(a.id)} • Ubicación: ${escapeHtml(a.ubicacion || "")}</div>
            </div>
          </div>

          <div style="display:flex; align-items:flex-end; gap:10px;">
            <div style="text-align:right;">
              <div style="font-weight:950; font-size:16px;">${number(a.stock)}</div>
              <div style="font-size:11.5px; font-weight:750; color:rgba(17,24,39,.55); margin-top:1px;">en stock</div>
            </div>

            <span class="${badgeClass}">${badgeText}</span>
          </div>
        </div>
      `;
    }).join("");

    const header = document.createElement("div");
    header.className = "card card-flat";
    header.style.padding = "14px 14px 10px";
    header.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <div>
          <h3 class="section-title" style="margin-bottom:2px;">Ajuste de Inventario</h3>
          <div class="subtle small">${articles.length} artículos</div>
        </div>

        <button class="btn btn-ghost" type="button" onclick="window.__invexSetScreen && window.__invexSetScreen('scanner')">
          Escanear
        </button>
      </div>
    `;

    wrap.appendChild(header);
    wrap.appendChild(cards);
    return wrap;
  }

  function renderReports() {
    const wrap = document.createElement("div");
    wrap.className = "space-y-12";

    const reports = document.createElement("div");
    reports.className = "grid-2";

    const card1 = `
      <div class="card" style="padding:16px;">
        <h3 class="section-title">Resumen de stock</h3>
        <div class="subtle small" style="margin-top:-6px;">
          Demo: distribución por estado.
        </div>

        <div style="margin-top:12px; display:grid; gap:10px;">
          <div class="row" style="justify-content:space-between;">
            <span class="small" style="font-weight:850; color:rgba(17,24,39,.72);">OK</span>
            <span class="badge ok">Actual</span>
          </div>

          <div class="row" style="justify-content:space-between;">
            <span class="small" style="font-weight:850; color:rgba(17,24,39,.72);">Bajo</span>
            <span class="badge warn">Atención</span>
          </div>

          <div class="row" style="justify-content:space-between;">
            <span class="small" style="font-weight:850; color:rgba(17,24,39,.72);">Crítico</span>
            <span class="badge danger">Acción</span>
          </div>
        </div>
      </div>
    `;

    const card2 = `
      <div class="card" style="padding:16px;">
        <h3 class="section-title">Actividades</h3>
        <div class="subtle small" style="margin-top:-6px;">
          Últimos cambios y conteos.
        </div>
        <div id="reportsActivity" class="list" style="margin-top:12px;"></div>
      </div>
    `;

    reports.innerHTML = card1 + card2;
    wrap.appendChild(reports);

    const list = wrap.querySelector("#reportsActivity");
    const items = state.activity || [];

    list.innerHTML = items.length
      ? items.slice(0, 4).map((a) => `
          <div class="item" style="padding:12px; background:var(--card-2); border-radius:var(--radius); border:1px solid var(--border);">
            <div class="item-meta">
              <div class="item-name">${escapeHtml(a.titulo)}</div>
              <div class="item-sub">${escapeHtml(a.detalle)} • ${escapeHtml(a.tiempo)}</div>
            </div>
          </div>
        `).join("")
      : `<div class="subtle small">Sin reportes.</div>`;

    return wrap;
  }

  function renderProfile() {
    const wrap = document.createElement("div");
    wrap.className = "space-y-12";

    const user = state.user || { nombre: "Usuario", email: "—" };

    wrap.innerHTML = `
      <div class="card" style="padding:16px;">
        <h3 class="section-title">Perfil</h3>

        <div class="row" style="margin-top:12px;">
          <div class="item-thumb" style="width:56px; height:56px; border-radius:18px;">
            ${userIcon()}
          </div>

          <div class="item-meta">
            <div class="item-name" style="font-size:16px;">${escapeHtml(user.nombre)}</div>
            <div class="item-sub">${escapeHtml(user.email)}</div>
          </div>
        </div>

        <div style="margin-top:14px; display:grid; gap:10px;">
          <div class="row" style="justify-content:space-between;">
            <span class="subtle small" style="font-weight:850; color:rgba(17,24,39,.72);">Organización</span>
            <span class="badge">${escapeHtml(state.companyName || "—")}</span>
          </div>

          <div class="row" style="justify-content:space-between;">
            <span class="subtle small" style="font-weight:850; color:rgba(17,24,39,.72);">Modo</span>
            <span class="badge ok">Inventario</span>
          </div>
        </div>

        <div class="row" style="margin-top:16px; justify-content:flex-end;">
          <button class="btn btn-ghost" type="button" onclick="window.__invexSetScreen && window.__invexSetScreen('dashboard')">
            Volver al inicio
          </button>
        </div>
      </div>
    `;

    return wrap;
  }

  // Helpers
  function number(n) {
    const num = Number(n);
    return Number.isFinite(num) ? num.toString() : "0";
  }

  // UI mode toggles (para que no reviente el formulario si aún no está implementado)
  function aplicarModo(mode) {
    // Por ahora no aplica estilos extra; solo evita ReferenceError.
    // Puedes extenderlo para Retiro/Recepción cuando lo necesites.
    return mode;
  }


  function escapeHtml(str) {
    return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  }

  function safeAsset(rel) {
    return "./" + String(rel).replace(/^\.?\//, "");
  }

  // Icons (SVG inline minimal)
  function homeIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5"/>
      <path d="M5 10v10h14V10"/>
    </svg>`;
  }

  function packageIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.732l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.732l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12 20.73 6.96"/>
      <line x1="12" y1="22" x2="12" y2="12"/>
    </svg>`;
  }

  function plusIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 5v14"/>
      <path d="M5 12h14"/>
    </svg>`;
  }

  function scanIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M7 3H3v4"/>
      <path d="M21 3h-4"/>
      <path d="M7 21H3v-4"/>
      <path d="M21 21h-4"/>
      <rect x="7" y="7" width="10" height="10" rx="2"/>
    </svg>`;
  }

  function userIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>`;
  }

  function bellIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>`;
  }

  function qrIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 4h6v6H4z"/>
      <path d="M14 4h6v6h-6z"/>
      <path d="M4 14h6v6H4z"/>
      <path d="M14 14h3"/>
      <path d="M17 14v6"/>
      <path d="M14 20h6"/>
    </svg>`;
  }

  function scanLineIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 7v-3h3"/>
      <path d="M20 7V4h-3"/>
      <path d="M4 17v3h3"/>
      <path d="M20 17v3h-3"/>
      <path d="M8 12h8"/>
    </svg>`;
  }

  function chartIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M7 14l2-2 3 3 4-6"/>
    </svg>`;
  }

  function boxIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.732l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.732l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12 20.73 6.96"/>
    </svg>`;
  }

  // Input styling (isolated)
  const inlineInputStyle = document.createElement("style");
  inlineInputStyle.textContent = `
    .input{
      width:100%;
      border:1px solid var(--border);
      border-radius:14px;
      padding:11px 12px;
      font-size:14px;
      background:#fff;
      outline:none;
    }
    .input:focus{
      border-color: rgba(14,165,233,.55);
      box-shadow: 0 0 0 3px rgba(14,165,233,.15);
    }
  `;
  document.head.appendChild(inlineInputStyle);

  // Start
  renderBottomNav();
  renderHeaderForScreen(currentScreen);
  renderScreen();
})();
