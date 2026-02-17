// public/elesfuerzo/productos.js
import { db } from "../js/app.js";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  onSnapshot,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Colecciones
const productosRef = collection(db, "productos");
const proveedoresRef = collection(db, "proveedores");
const usuariosRef = collection(db, "usuarios");
const ventasRef = collection(db, "ventas");

// Estado inventario / filtros
let productos = [];
let filtroCategoria = "";
let filtroProveedor = "";
let orden = "nombre";

// Estado pedidos
let pedido = [];

// Estado ventas / notificaciones
let ventasHist = [];
let notifStock = [];
let notifVentas = [];

// ------------------------------
// Helpers
// ------------------------------
function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function CLP(n) {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(num);
  } catch {
    return `$${num}`;
  }
}

// ------------------------------
// Carga de proveedores
// ------------------------------
async function cargarProveedoresEnSelectAgregar() {
  const sel = document.getElementById("proveedorSelect");
  if (!sel) return;
  sel.innerHTML = `<option value="">— Selecciona proveedor —</option>`;
  const snap = await getDocs(proveedoresRef);
  snap.forEach((d) => {
    const p = d.data();
    sel.innerHTML += `<option value="${d.id}">${p.nombre || p.email || "Proveedor"}</option>`;
  });
}

async function cargarProveedoresPedido() {
  const sel = document.getElementById("proveedorPedido");
  if (!sel) return;
  sel.innerHTML = `<option value="">Selecciona proveedor</option>`;
  const snap = await getDocs(proveedoresRef);
  snap.forEach((d) => {
    const p = d.data();
    sel.innerHTML += `<option value="${d.id}" data-nombre="${p.nombre || p.email || "Proveedor"}">${p.nombre || p.email || "Proveedor"}</option>`;
  });
}

async function cargarProductosDeProveedor(proveedorId) {
  const sel = document.getElementById("productoPedido");
  if (!sel) return;
  sel.innerHTML = `<option value="">Selecciona producto</option>`;
  if (!proveedorId) return;
  const qProd = query(productosRef, where("proveedorId", "==", proveedorId));
  const snap = await getDocs(qProd);
  snap.forEach((d) => {
    const p = d.data();
    sel.innerHTML += `<option value="${d.id}" data-nombre="${p.nombre}">${p.nombre}</option>`;
  });
}

// ------------------------------
// Suscripciones Firestore
// ------------------------------
onSnapshot(productosRef, (snapshot) => {
  productos = [];
  snapshot.forEach((d) => productos.push({ id: d.id, ...d.data() }));

  popularCategorias(productos);
  renderStats(productos);
  renderLista(productos);

  // notificaciones de stock / proveedor
  actualizarNotificacionesStock(productos);
});

onSnapshot(ventasRef, (snap) => {
  ventasHist = [];
  snap.forEach((d) => ventasHist.push({ id: d.id, ...d.data() }));
  // ordenar por fecha desc
  ventasHist.sort((a, b) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  });
  actualizarNotificacionesVentas();
  renderHistorialVentas();
});

// ------------------------------
// Form: agregar producto
// ------------------------------
const form = document.getElementById("formProducto");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const codigoBarras = document.getElementById("codigoBarras")?.value.trim();
    const nombre = document.getElementById("nombre")?.value.trim();
    const cantidad = parseInt(document.getElementById("cantidad")?.value, 10);
    const precio = parseFloat(document.getElementById("precio")?.value);
    const categoria = (document.getElementById("categoria")?.value || "").trim();
    const minStock = parseInt(document.getElementById("minStock")?.value || "5", 10);

    const proveedorId = document.getElementById("proveedorSelect")?.value || "";
    let proveedorNombre =
      document.getElementById("proveedorNombre")?.value.trim() || "";

    // 🔥 si eligió proveedor desde el select, tomar el nombre de ahí
    if (proveedorId) {
      const sel = document.getElementById("proveedorSelect");
      if (sel && sel.selectedIndex >= 0) {
        proveedorNombre = sel.options[sel.selectedIndex].textContent.trim();
      }
    }

    if (!codigoBarras || !nombre) {
      alert("El código de barras y el nombre son obligatorios");
      return;
    }
    if (isNaN(cantidad) || cantidad < 0) {
      alert("La cantidad debe ser ≥ 0");
      return;
    }
    if (isNaN(precio) || precio <= 0) {
      alert("Debes ingresar un precio mayor a 0");
      return;
    }

    // usar código de barras como ID
    const ref = doc(db, "productos", codigoBarras);
    const existe = await getDoc(ref);
    if (existe.exists()) {
      alert("Este código de barras ya está registrado en otro producto.");
      return;
    }

    await setDoc(ref, {
      codigoBarras,
      nombre,
      cantidad,
      precio,
      categoria: categoria || null,
      proveedorId: proveedorId || null,
      proveedor: proveedorNombre || null,
      minStock: isNaN(minStock) ? 5 : minStock,
      ventas: 0,
      creado: new Date(),
    });

    alert(`Producto "${nombre}" agregado con éxito`);
    form.reset();
    cargarProveedoresEnSelectAgregar();
  });
}

// ------------------------------
// Filtros inventario
// ------------------------------
const selCat = document.getElementById("filtroCategoria");
const inpProv = document.getElementById("filtroProveedor");
const selOrden = document.getElementById("ordenLista");

if (selCat)
  selCat.addEventListener("change", () => {
    filtroCategoria = selCat.value;
    renderLista(productos);
  });

if (inpProv)
  inpProv.addEventListener("input", () => {
    filtroProveedor = inpProv.value.toLowerCase();
    renderLista(productos);
  });

if (selOrden)
  selOrden.addEventListener("change", () => {
    orden = selOrden.value;
    renderLista(productos);
  });

function popularCategorias(items) {
  const control = document.getElementById("filtroCategoria");
  if (!control) return;
  const uniq = Array.from(
    new Set(items.map((p) => p.categoria || "sin-categoria"))
  );
  control.innerHTML =
    `<option value="">Todas</option>` +
    uniq.map((c) => `<option value="${c}">${c}</option>`).join("");
}

// ------------------------------
// Estadísticas (AJUSTADO)
// ------------------------------
function renderStats(items) {
  // Total de productos = suma de todos los stocks
  const total = items.reduce(
    (acc, p) => acc + (Number(p.cantidad) || 0),
    0
  );

  // Bajo mínimo = suma del stock de productos que están en o bajo el mínimo
  const bajo = items.reduce((acc, p) => {
    const cant = Number(p.cantidad) || 0;
    const min = Number(p.minStock ?? 5) || 0;
    return cant <= min ? acc + cant : acc;
  }, 0);

  // Valor total del inventario
  const valor = items.reduce(
    (acc, p) => acc + ((+p.precio || 0) * (+p.cantidad || 0)),
    0
  );

  // Top vendido
  const top = [...items].sort((a, b) => (b.ventas ?? 0) - (a.ventas ?? 0))[0];

  setText("statTotal", total);
  setText("statBajo", bajo);
  setText("statValor", CLP(valor));
  setText(
    "statTop",
    top ? `${top.nombre} (${top.ventas ?? 0} ventas)` : "—"
  );
}

// ------------------------------
// Lista inventario
// ------------------------------
function renderLista(items) {
  const lista = document.getElementById("lista-productos");
  if (!lista) return;

  let data = items.filter((p) => {
    const okCat =
      !filtroCategoria || (p.categoria || "sin-categoria") === filtroCategoria;
    const okProv =
      !filtroProveedor ||
      (p.proveedor || "").toLowerCase().includes(filtroProveedor);
    return okCat && okProv;
  });

  if (orden === "cantidadAsc")
    data.sort((a, b) => (a.cantidad ?? 0) - (b.cantidad ?? 0));
  else if (orden === "nombre")
    data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  lista.innerHTML = data
    .map((p) => {
      const stockBajo = (p.cantidad ?? 0) <= (p.minStock ?? 5);
      return `
        <li class="list-group-item d-flex justify-content-between align-items-center ${stockBajo ? "list-group-item-danger" : ""
        }">
          <div class="me-3">
            <strong>${p.nombre}</strong><br>
            <small>Código: ${p.codigoBarras} • Cat: ${p.categoria || "—"
        } • Prov: ${p.proveedor || "—"}</small><br>
            <small>Stock: ${p.cantidad ?? 0} • Precio: ${CLP(p.precio)}</small>
          </div>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-secondary" data-accion="menos" data-id="${p.id
        }">−</button>
            <button class="btn btn-sm btn-outline-secondary" data-accion="mas" data-id="${p.id
        }">+</button>
            <button class="btn btn-sm btn-outline-primary"  data-accion="pedir" data-id="${p.id
        }">Añadir a pedido</button>
          </div>
        </li>`;
    })
    .join("");

  lista.querySelectorAll("button[data-accion]").forEach((btn) => {
    btn.onclick = onAccionProducto;
  });

  renderPedido();
}

async function onAccionProducto(e) {
  const accion = e.currentTarget.dataset.accion;
  const id = e.currentTarget.dataset.id;
  const p = productos.find((x) => x.id === id);
  if (!p) return;

  if (accion === "mas") {
    await updateDoc(doc(db, "productos", id), { cantidad: increment(1) });
  } else if (accion === "menos") {
    if ((p.cantidad ?? 0) <= 0) return;
    await updateDoc(doc(db, "productos", id), { cantidad: increment(-1) });
  } else if (accion === "pedir") {
    agregarAPedidoDesdeItem(p);
  }
}

// ------------------------------
// Notificaciones (stock + ventas)
// ------------------------------
function actualizarNotificacionesStock(items) {
  notifStock = [];
  items.forEach((p) => {
    const min = p.minStock ?? 5;
    if ((p.cantidad ?? 0) <= min) {
      notifStock.push({
        tipo: "stock",
        mensaje: `Stock bajo: ${p.nombre} (stock ${p.cantidad ?? 0
          } / min ${min})`,
      });
      if (!p.proveedor) {
        notifStock.push({
          tipo: "proveedor",
          mensaje: `Producto sin proveedor asignado: ${p.nombre}`,
        });
      }
    }
  });
  renderNotificaciones();
}

function actualizarNotificacionesVentas() {
  notifVentas = ventasHist.slice(0, 5).map((v) => ({
    tipo: "venta",
    mensaje: `Nueva venta Boleta Nº ${v.boletaId || v.id} por ${CLP(
      v.total || 0
    )} (${v.metodoPago || "método no registrado"})`,
  }));
  renderNotificaciones();
}

function renderNotificaciones() {
  const ul = document.getElementById("notificacionesList");
  const badge = document.getElementById("badgeNotifs");
  if (!ul || !badge) return;

  const todas = [...notifStock, ...notifVentas];

  badge.textContent = todas.length;
  badge.style.display = todas.length ? "inline-block" : "none";

  if (!todas.length) {
    ul.innerHTML = `<li class="list-item"><small>Sin notificaciones</small></li>`;
    return;
  }

  ul.innerHTML = todas
    .map((n) => {
      let icon = "⚠️";
      if (n.tipo === "venta") icon = "🧾";
      if (n.tipo === "proveedor") icon = "📦";
      return `<li class="list-item"><span>${icon}</span> ${n.mensaje}</li>`;
    })
    .join("");
}

const btnCampana = document.getElementById("btnCampana");
if (btnCampana) {
  btnCampana.addEventListener("click", () => {
    const bar = document.getElementById("notifBar");
    if (!bar) return;
    bar.style.display = bar.style.display === "block" ? "none" : "block";
  });
}

// ------------------------------
// Pedido (desde inventario y formulario)
// ------------------------------
function agregarAPedidoDesdeItem(p) {
  const ya = pedido.find((x) => x.productId === p.id);
  if (ya) ya.cantidad += 1;
  else
    pedido.push({
      proveedorId: p.proveedorId || "",
      proveedorNombre: p.proveedor || "Sin asignar",
      productId: p.id,
      nombre: p.nombre,
      cantidad: 1,
    });
  renderPedido();
}

const selProvPedido = document.getElementById("proveedorPedido");
if (selProvPedido) {
  selProvPedido.addEventListener("change", (e) =>
    cargarProductosDeProveedor(e.target.value)
  );
}

const btnAddPedido = document.getElementById("btnAddPedido");
if (btnAddPedido) {
  btnAddPedido.addEventListener("click", (e) => {
    e.preventDefault();
    const provSel = document.getElementById("proveedorPedido");
    const prodSel = document.getElementById("productoPedido");
    const cant = parseInt(
      document.getElementById("cantidadPedido")?.value || "1",
      10
    );

    if (!provSel?.value || !prodSel?.value) {
      alert("Selecciona proveedor y producto");
      return;
    }

    const proveedorNombre =
      provSel.options[provSel.selectedIndex].dataset.nombre || "Proveedor";
    const productNombre =
      prodSel.options[prodSel.selectedIndex].dataset.nombre || "Producto";

    const ya = pedido.find((x) => x.productId === prodSel.value);
    if (ya) ya.cantidad += cant;
    else
      pedido.push({
        proveedorId: provSel.value,
        proveedorNombre,
        productId: prodSel.value,
        nombre: productNombre,
        cantidad: cant,
      });

    renderPedido();
  });
}

function renderPedido() {
  const ul = document.getElementById("listaPedidos");
  if (!ul) return;

  if (!pedido.length) {
    ul.innerHTML = `<li class="list-group-item">No hay productos en el pedido.</li>`;
    return;
  }

  ul.innerHTML = pedido
    .map(
      (i) => `
    <li class="list-item">
      <div>
        <strong>${i.nombre}</strong><br>
        <small>Prov: ${i.proveedorNombre || "—"} • Cant: ${i.cantidad}</small>
      </div>
      <div class="btn-group">
        <button class="btn-sm" data-accion="menosItem" data-id="${i.productId}">−</button>
        <button class="btn-sm" data-accion="masItem"   data-id="${i.productId}">+</button>
        <button class="btn-sm" data-accion="remItem"   data-id="${i.productId}">Quitar</button>
      </div>
    </li>`
    )
    .join("");

  ul.querySelectorAll("button[data-accion]").forEach((b) => {
    const id = b.dataset.id;
    b.onclick = () => {
      const idx = pedido.findIndex((x) => x.productId === id);
      if (idx < 0) return;
      if (b.dataset.accion === "menosItem")
        pedido[idx].cantidad = Math.max(1, pedido[idx].cantidad - 1);
      if (b.dataset.accion === "masItem") pedido[idx].cantidad += 1;
      if (b.dataset.accion === "remItem") pedido.splice(idx, 1);
      renderPedido();
    };
  });
}

const btnWA = document.getElementById("btnEnviarPedidoWA");
const btnMail = document.getElementById("btnEnviarPedidoMail");
const btnClear = document.getElementById("btnLimpiarPedido");

if (btnWA) {
  btnWA.onclick = () => {
    if (!pedido.length) return alert("El pedido está vacío");
    const cuerpo = armarMensajePedido(pedido);
    const url = `https://wa.me/?text=${encodeURIComponent(cuerpo)}`;
    window.open(url, "_blank");
  };
}

if (btnMail) {
  btnMail.onclick = () => {
    if (!pedido.length) return alert("El pedido está vacío");
    const subject = "Pedido Elesfuerzo";
    const cuerpo = armarMensajePedido(pedido);
    const mailto = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(cuerpo)}`;
    window.location.href = mailto;
  };
}

if (btnClear) {
  btnClear.onclick = () => {
    pedido = [];
    renderPedido();
  };
}

function armarMensajePedido(items) {
  const grupos = items.reduce((acc, it) => {
    const k = it.proveedorNombre || "Sin proveedor";
    acc[k] = acc[k] || [];
    acc[k].push(it);
    return acc;
  }, {});
  let msg = "Hola, necesito abastecer los siguientes productos:\n\n";
  Object.entries(grupos).forEach(([prov, arr]) => {
    msg += `Proveedor: ${prov}\n`;
    arr.forEach((x) => {
      msg += `• ${x.nombre} x${x.cantidad}\n`;
    });
    msg += "\n";
  });
  msg += "Gracias.\n— Elesfuerzo";
  return msg;
}

// ------------------------------
// Modal nuevo proveedor
// ------------------------------
const modalProv = document.getElementById("modalProveedor");
const btnNP = document.getElementById("btnNuevoProveedor");

if (btnNP && modalProv) {
  btnNP.onclick = () => (modalProv.style.display = "block");
  document.getElementById("np_cerrar").onclick = () =>
    (modalProv.style.display = "none");
  document.getElementById("np_guardar").onclick = async () => {
    const nombre = document.getElementById("np_nombre")?.value.trim();
    const email = document.getElementById("np_email")?.value.trim() || null;
    const telefono = document.getElementById("np_tel")?.value.trim();
    if (!nombre || !telefono) {
      alert("Nombre y teléfono son obligatorios");
      return;
    }
    const ref = await addDoc(proveedoresRef, {
      nombre,
      email,
      telefono,
      creado: new Date(),
    });
    modalProv.style.display = "none";
    await cargarProveedoresEnSelectAgregar();
    const sel = document.getElementById("proveedorSelect");
    if (sel) sel.value = ref.id;
  };
}

// ------------------------------
// Panel de usuarios (roles)
// ------------------------------
const panelUsuarios = document.getElementById("usuariosPanel");
const btnUsuarios = document.getElementById("btnUsuarios");
const closeUsuarios = document.getElementById("closeUsuarios");
const listaUsuarios = document.getElementById("listaUsuarios");

if (btnUsuarios && panelUsuarios) btnUsuarios.onclick = cargarUsuarios;
if (closeUsuarios && panelUsuarios)
  closeUsuarios.onclick = () => (panelUsuarios.style.display = "none");

async function cargarUsuarios() {
  if (!listaUsuarios) return;
  listaUsuarios.innerHTML = `<li class="list-item"><em>Cargando...</em></li>`;
  panelUsuarios.style.display = "block";

  const snap = await getDocs(usuariosRef);
  const items = [];
  snap.forEach((d) => {
    const u = d.data();
    items.push({
      id: d.id,
      email: u.correo || u.email || "—",
      rol: u.rol || "cajero",
      verificado: u.verificado ?? null,
    });
  });

  listaUsuarios.innerHTML = items
    .map(
      (u) => `
    <li class="list-item">
      <div>
        <strong>${u.email}</strong><br/>
        <small>Rol actual: <b>${u.rol}</b></small>
        ${u.verificado === true ? `<span class="badge-ok">Verificado</span>` : ""}
      </div>
      <div class="btn-group">
        <button class="btn-sm" data-rol="admin"  data-id="${u.id}">Admin</button>
        <button class="btn-sm" data-rol="cajero" data-id="${u.id}">Cajero</button>
      </div>
    </li>`
    )
    .join("");

  listaUsuarios.querySelectorAll("button[data-rol]").forEach((b) => {
    b.onclick = async (e) => {
      const rol = e.currentTarget.dataset.rol;
      const id = e.currentTarget.dataset.id;
      await updateDoc(doc(db, "usuarios", id), { rol });
      alert(`Rol actualizado a "${rol}".`);
      cargarUsuarios();
    };
  });
}

// ------------------------------
// Historial de ventas (dashboard)
// ------------------------------
function renderHistorialVentas() {
  const tbody = document.getElementById("tablaVentas");
  if (!tbody) return;

  if (!ventasHist.length) {
    tbody.innerHTML = `<tr><td colspan="5"><em>No hay ventas registradas.</em></td></tr>`;
    return;
  }

  tbody.innerHTML = ventasHist
    .map((v) => {
      const fecha = v.createdAt?.toDate ? v.createdAt.toDate() : new Date();
      const fechaStr = fecha.toLocaleString("es-CL");
      return `
        <tr data-id="${v.id}">
          <td>${v.boletaId || v.id}</td>
          <td>${fechaStr}</td>
          <td>${CLP(v.total || 0)}</td>
          <td>${v.metodoPago || "—"}</td>
          <td><button class="btn btn-sm btn-outline-primary" data-ver="${v.id}">Ver</button></td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll("button[data-ver]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.ver;
      const venta = ventasHist.find((v) => v.id === id);
      if (venta) mostrarModalVenta(venta);
    };
  });
}

function mostrarModalVenta(v) {
  const modal = document.getElementById("modalVenta");
  if (!modal) return;

  const boletaEl = document.getElementById("hvBoletaId");
  const fechaEl = document.getElementById("hvFecha");
  const detalleEl = document.getElementById("hvDetalle");
  const subEl = document.getElementById("hvSubTotal");
  const ivaEl = document.getElementById("hvIVA");
  const totalEl = document.getElementById("hvTotal");
  const metodoEl = document.getElementById("hvMetodoPago");
  const pagoEl = document.getElementById("hvPago");
  const vueltoEl = document.getElementById("hvVuelto");
  const fecha = v.createdAt?.toDate ? v.createdAt.toDate() : new Date();

  if (boletaEl) boletaEl.textContent = v.boletaId || v.id;
  if (fechaEl) fechaEl.textContent = fecha.toLocaleString("es-CL");
  if (detalleEl) {
    detalleEl.innerHTML = (v.items || [])
      .map(
        (i) =>
          `<li>${i.nombre} x${i.cantidad} — ${CLP(
            (i.cantidad || 0) * (i.precio || 0)
          )}</li>`
      )
      .join("");
  }
  if (subEl) subEl.textContent = CLP(v.subtotal || 0);
  if (ivaEl) subEl.textContent = CLP(v.iva || 0);
  if (totalEl) totalEl.textContent = CLP(v.total || 0);
  if (metodoEl) metodoEl.textContent = v.metodoPago || "—";
  if (pagoEl) pagoEl.textContent = CLP(v.pagoCliente || 0);
  if (vueltoEl) vueltoEl.textContent = CLP(v.vuelto || 0);

  modal.style.display = "flex";

  const cerrar = document.getElementById("cerrarModalVenta");
  if (cerrar) {
    cerrar.onclick = () => {
      modal.style.display = "none";
    };
  }
}

// ====== Menú hamburguesa dashboard ======
const menuToggle = document.getElementById("menuToggle");
const topbarMenu = document.getElementById("topbarMenu");

if (menuToggle && topbarMenu) {
  menuToggle.addEventListener("click", () => {
    topbarMenu.classList.toggle("menu-open");
  });
}

// ------------------------------
// Init
// ------------------------------
cargarProveedoresEnSelectAgregar();
cargarProveedoresPedido();
