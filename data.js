/**
 * Datos simulados para la demo (sin backend).
 * Backend real: reemplaza este archivo o inyecta datos desde tu API.
 */
(function () {
  const state = {
    appName: "Invex",
    companyName: "RADEEL",
    user: {
      nombre: "Usuario Demo",
      email: "demo@invex.com"
    },
    stats: {
      totalArticulos: 247,
      escaneados: 189,
      restantes: 58
    },
    // Estado de stock para badges
    // - ok: stock suficiente
    // - warn: bajo stock
    // - danger: crítico
    articles: [
      { id: "A-1001", nombre: "Aceite hidráulico 20L", categoria: "Lubricantes", stock: 42, estado: "ok" },
      { id: "A-1002", nombre: "Filtro de aire (Diesel)", categoria: "Filtros", stock: 9, estado: "warn" },
      { id: "A-1003", nombre: "Correa de transmisión", categoria: "Repuestos", stock: 2, estado: "danger" },
      { id: "A-1004", nombre: "Guantes de seguridad talla M", categoria: "EPP", stock: 27, estado: "ok" },
      { id: "A-1005", nombre: "Cinta aislante 19mm", categoria: "Eléctrico", stock: 6, estado: "warn" },
      { id: "A-1006", nombre: "Tornillos M8 x 20", categoria: "Ferretería", stock: 0, estado: "danger" }
    ],
    activity: [
      { id: "H-1", titulo: "Escaneo completado", detalle: "2 artículos actualizados", tiempo: "Hace 2 horas" },
      { id: "H-2", titulo: "Inventario revisado", detalle: "Conteo manual - Taller A", tiempo: "Ayer" }
    ]
  };

  // Export global para app.js
  window.__INVEX_STATE__ = state;
})();