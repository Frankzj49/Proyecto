// ===========================================
//        CAJERO — EL ESFUERZO 
// ===========================================

import { db } from "../js/app.js";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    increment,
    addDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// -------------------------------------------
// Helpers
// -------------------------------------------
const $ = (id) => document.getElementById(id);
const CLP = (n) =>
    (Number(n) || 0).toLocaleString("es-CL", {
        style: "currency",
        currency: "CLP",
    });

// Mensajes suaves en la vista (no alert())
const mensajeUI = $("mensajeCajero");
function mostrarMensaje(msg = "", tipo = "info") {
    if (!mensajeUI) return; // si no existe el div, no hacemos nada
    mensajeUI.textContent = msg;
    mensajeUI.className = "mensaje-cajero " + tipo;

    if (msg) {
        clearTimeout(mensajeUI._timeout);
        mensajeUI._timeout = setTimeout(() => {
            mensajeUI.textContent = "";
            mensajeUI.className = "mensaje-cajero";
        }, 4000);
    }
}

// -------------------------------------------
// Elementos del DOM
// -------------------------------------------
const btnNotif = $("btnNotif");
const notifPanel = $("notifPanel");
const notifList = $("notifList");
const badgeNotifs = $("badgeNotifs");
const closeNotif = $("closeNotif");

const tbCarro = $("tbCarro");

const subTotalUI = $("subTotal");
const ivaUI = $("iva");
const totalUI = $("total");
const vueltoUI = $("vuelto");
const pagoInput = $("pagoInput");
const metodoPago = $("metodoPago");

// Modal boleta
const modalBoleta = $("modalBoleta");
const cerrarModalBoleta = $("cerrarModalBoleta");
const boletaIdPrint = $("boletaIdPrint");
const boletaFecha = $("boletaFecha");
const detalleBoleta = $("detalleBoleta");
const modalSubTotal = $("modalSubTotal");
const modalIVA = $("modalIVA");
const modalTotal = $("modalTotal");
const modalPago = $("modalPago");
const modalVuelto = $("modalVuelto");
const modalMetodoPago = $("modalMetodoPago");

// -------------------------------------------
// Estado
// -------------------------------------------
const productosRef = collection(db, "productos");
const ventasRef = collection(db, "ventas");

let productos = [];
let carro = [];
let filtroTerm = "";
let cantidadBuffer = "";
let seleccionadoId = null;
let modoCantidad = false;

// -------------------------------------------
// Notificaciones (cajero)
// -------------------------------------------
if (btnNotif && notifPanel) {
    btnNotif.onclick = () => notifPanel.classList.toggle("open");
}
if (closeNotif) {
    closeNotif.onclick = () => notifPanel.classList.remove("open");
}

// -------------------------------------------
// Catálogo
// -------------------------------------------
function renderCatalogo() {
    const ul = $("lista-catalogo");
    if (!ul) return;

    const data = productos.filter((p) => {
        const t = `${p.nombre || ""} ${p.codigoBarras || ""}`.toLowerCase();
        return t.includes(filtroTerm);
    });

    ul.innerHTML = data
        .map((p) => {
            const agotado = (p.cantidad || 0) <= 0;
            const bajo = (p.cantidad || 0) <= (p.minStock ?? 5);
            return `
        <li class="notif-item" data-id="${p.id}">
            <div>
            <strong>${p.nombre}</strong>
            <div class="muted">Precio: ${CLP(p.precio)} · Stock: ${p.cantidad}</div>
            ${bajo
                    ? `<small class="muted">⚠ Stock bajo (min: ${p.minStock ?? 5})</small>`
                    : ""
                }
            </div>
            <button class="pos-chip" data-add="${p.id}" ${agotado ? "disabled" : ""
                }>Agregar</button>
        </li>
    `;
        })
        .join("");

    ul.querySelectorAll("[data-add]").forEach((b) => {
        b.onclick = () => addToCarro(b.dataset.add, 1);
    });
}

// -------------------------------------------
// Carrito + Totales
// -------------------------------------------
function calcularSubtotal() {
    return carro.reduce((a, b) => a + b.cantidad * b.precio, 0);
}

function actualizarTotales() {
    const subtotal = calcularSubtotal();
    const iva = subtotal * 0.19;
    const total = subtotal + iva;

    const metodo = metodoPago?.value || "efectivo";
    let pago = Number(pagoInput?.value || 0);
    let vuelto = 0;

    if (metodo === "tarjeta") {
        // Tarjeta: pago exacto, sin vuelto y sin usar input
        pago = total;
        vuelto = 0;
        if (pagoInput) {
            pagoInput.value = "";
            pagoInput.disabled = true;
        }
    } else {
        // Efectivo
        if (pagoInput) {
            pagoInput.disabled = false;
        }
        vuelto = Math.max(0, pago - total);
    }

    subTotalUI.textContent = CLP(subtotal);
    ivaUI.textContent = CLP(iva);
    totalUI.textContent = CLP(total);
    vueltoUI.textContent = CLP(vuelto);
}

// -------------------------------------------
// Render carro (AJUSTADO PARA MOSTRAR INPUT)
// -------------------------------------------
function renderCarro() {
    if (!tbCarro) return;

    tbCarro.innerHTML = carro
        .map((it, i) => {
            const esSeleccionado = seleccionadoId === it.id;
            const enModoCantidad = esSeleccionado && modoCantidad;

            // Si está en modo cantidad, mostramos un "input" visual
            const celdaCantidad = enModoCantidad
                ? `<input class="input-cant" type="text" value="${it.cantidad}" readonly />`
                : it.cantidad;

            return `
        <tr data-id="${it.id}" class="${esSeleccionado ? "tr-sel" : ""}">
            <td>${i + 1}</td>
            <td>${it.nombre}</td>
            <td>${celdaCantidad}</td>
            <td>${CLP(it.cantidad * it.precio)}</td>
        </tr>`;
        })
        .join("");

    tbCarro.querySelectorAll("tr").forEach((tr) => {
        tr.onclick = () => {
            seleccionadoId = tr.dataset.id;
            // al seleccionar, salimos de modo cantidad para evitar confusiones;
            // se vuelve a activar con el botón X
            modoCantidad = false;
            cantidadBuffer = "";
            renderCarro();
        };
    });

    actualizarTotales();
}

// -------------------------------------------
// Agregar / cambiar cantidades con stock máximo
// -------------------------------------------
function addToCarro(id, cant) {
    const p = productos.find((x) => x.id === id);
    if (!p) return;

    const stockDisponible = p.cantidad ?? 0;
    const idx = carro.findIndex((x) => x.id === id);
    const actualEnCarro = idx >= 0 ? carro[idx].cantidad : 0;

    // Modo cambiar cantidad (remplaza la cantidad existente por la ingresada)
    if (modoCantidad && seleccionadoId === id) {
        const nueva = Number(cantidadBuffer);
        if (!nueva || nueva <= 0) {
            mostrarMensaje("Cantidad inválida.", "error");
            return;
        }
        if (nueva > stockDisponible) {
            mostrarMensaje(
                `Cantidad ajustada al stock disponible (${stockDisponible}).`,
                "warn"
            );
            if (idx >= 0) carro[idx].cantidad = stockDisponible;
        } else if (idx >= 0) {
            carro[idx].cantidad = nueva;
        }
        modoCantidad = false;
        cantidadBuffer = "";
        renderCarro();
        return;
    }

    // Agregar normal (desde catálogo, suma 1 por defecto)
    const maxAgregable = stockDisponible - actualEnCarro;
    if (maxAgregable <= 0) {
        mostrarMensaje("No hay más stock disponible para este producto.", "warn");
        return;
    }
    if (cant > maxAgregable) {
        mostrarMensaje(
            `Solo se agregan ${maxAgregable} unidades disponibles.`,
            "warn"
        );
        cant = maxAgregable;
    }

    if (idx >= 0) carro[idx].cantidad += cant;
    else
        carro.push({
            id,
            nombre: p.nombre,
            precio: p.precio,
            cantidad: cant,
        });

    renderCarro();
}

// -------------------------------------------
// Búsqueda catálogo
// -------------------------------------------
$("buscarInput")?.addEventListener("input", (e) => {
    filtroTerm = (e.target.value || "").toLowerCase();
    renderCatalogo();
});

// -------------------------------------------
// Teclado POS
// -------------------------------------------
const keypad = document.querySelector(".keypad");

if (keypad) {
    keypad.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const digit = btn.dataset.digit;
        const action = btn.dataset.action;

        // Números
        if (digit !== undefined) {
            if (modoCantidad && seleccionadoId) {
                cantidadBuffer += digit;
                const nueva = Number(cantidadBuffer);
                const item = carro.find((x) => x.id === seleccionadoId);
                const p = productos.find((x) => x.id === seleccionadoId);
                if (!item || !p) return;

                const stockDisponible = p.cantidad ?? 0;
                if (!nueva || nueva <= 0) {
                    return;
                }
                if (nueva > stockDisponible) {
                    mostrarMensaje(
                        `Cantidad ajustada al stock disponible (${stockDisponible}).`,
                        "warn"
                    );
                    item.cantidad = stockDisponible;
                    cantidadBuffer = String(stockDisponible);
                } else {
                    item.cantidad = nueva;
                }
                renderCarro();
            } else {
                // si no está en modo cantidad, simplemente acumula buffer (por si futuro)
                cantidadBuffer += digit;
            }
            return;
        }

        // X → modo cantidad
        if (action === "del") {
            if (!seleccionadoId) {
                mostrarMensaje("Seleccione un producto antes de modificar la cantidad.", "info");
                return;
            }
            modoCantidad = true;
            cantidadBuffer = "";
            mostrarMensaje("Modo cantidad activado. Ingrese el nuevo valor con el teclado numérico.", "info");
            renderCarro();
            return;
        }

        // CL → vaciar carrito (sin confirm(), solo mensaje)
        if (action === "clr") {
            if (!carro.length) {
                mostrarMensaje("El carrito ya está vacío.", "info");
                return;
            }
            carro = [];
            cantidadBuffer = "";
            seleccionadoId = null;
            modoCantidad = false;
            renderCarro();
            mostrarMensaje("Carrito vaciado.", "info");
            return;
        }

        // 🛒 → finalizar venta
        if (action === "add") {
            confirmarVenta();
            return;
        }
    });
}

pagoInput?.addEventListener("input", actualizarTotales);
metodoPago?.addEventListener("change", actualizarTotales);

// -------------------------------------------
// Notificaciones desde productos
// -------------------------------------------
function actualizarNotifsCajero(items) {
    if (!notifList || !badgeNotifs) return;

    const low = items.filter((p) => (p.cantidad ?? 0) <= (p.minStock ?? 5));

    badgeNotifs.textContent = low.length;
    badgeNotifs.style.display = low.length ? "inline-block" : "none";

    if (!low.length) {
        notifList.innerHTML = `<li class="notif-item"><small>Sin alertas 👍</small></li>`;
        return;
    }

    notifList.innerHTML = low
        .map(
            (p) => `
        <li class="notif-item">
        <div>
            <strong>${p.nombre}</strong><br/>
            <small>Stock: ${p.cantidad ?? 0} / Min: ${p.minStock ?? 5}</small>
        </div>
        </li>`
        )
        .join("");
}

// -------------------------------------------
// Suscripción productos (cajero)
// -------------------------------------------
onSnapshot(query(productosRef, orderBy("nombre", "asc")), (snap) => {
    productos = [];
    snap.forEach((d) => productos.push({ id: d.id, ...d.data() }));
    renderCatalogo();
    renderCarro(); // por si cambia stock en medio de una venta
    actualizarNotifsCajero(productos);
});

// -------------------------------------------
// Finalizar venta y generar boleta
// -------------------------------------------
async function confirmarVenta() {
    if (!carro.length) {
        mostrarMensaje("No hay productos en el carrito.", "warn");
        return;
    }

    const subtotal = calcularSubtotal();
    const iva = subtotal * 0.19;
    const total = subtotal + iva;

    const metodo = metodoPago.value || "efectivo";
    let pago;
    let vuelto;

    if (metodo === "tarjeta") {
        pago = total;
        vuelto = 0;
    } else {
        pago = Number(pagoInput.value);
        if (pago < total) {
            mostrarMensaje("El pago en efectivo es insuficiente.", "warn");
            return;
        }
        vuelto = pago - total;
    }

    const boletaId = prompt("Ingrese el número de boleta física:");
    if (!boletaId || !boletaId.trim()) {
        mostrarMensaje("Debe ingresar un número de boleta válido.", "warn");
        return;
    }

    try {
        // Registrar venta
        await addDoc(ventasRef, {
            boletaId: boletaId.trim(),
            metodoPago: metodo,
            subtotal,
            iva,
            total,
            pagoCliente: pago,
            vuelto,
            items: carro.map((p) => ({
                id: p.id,
                nombre: p.nombre,
                cantidad: p.cantidad,
                precio: p.precio,
            })),
            createdAt: serverTimestamp(),
        });

        // Descontar stock
        await Promise.all(
            carro.map((it) =>
                updateDoc(doc(db, "productos", it.id), {
                    cantidad: increment(-it.cantidad),
                    ventas: increment(it.cantidad)  
                })
            )
        );

        mostrarModalBoleta({
            boletaId,
            metodo,
            subtotal,
            iva,
            total,
            pago,
            vuelto,
            items: carro,
        });

        carro = [];
        seleccionadoId = null;
        cantidadBuffer = "";
        modoCantidad = false;
        if (pagoInput) pagoInput.value = "";
        renderCarro();
        mostrarMensaje("Venta registrada correctamente.", "info");
    } catch (err) {
        console.error(err);
        mostrarMensaje("Error al registrar la venta.", "error");
    }
}

// -------------------------------------------
// Modal boleta
// -------------------------------------------
function mostrarModalBoleta({ boletaId, metodo, subtotal, iva, total, pago, vuelto, items }) {
    if (!modalBoleta) return;

    const fecha = new Date();

    boletaIdPrint.textContent = boletaId;
    boletaFecha.textContent = fecha.toLocaleString("es-CL");
    detalleBoleta.innerHTML = items
        .map(
            (i) =>
                `<li>${i.nombre} x${i.cantidad} — ${CLP(i.cantidad * i.precio)}</li>`
        )
        .join("");
    modalSubTotal.textContent = CLP(subtotal);
    modalIVA.textContent = CLP(iva);
    modalTotal.textContent = CLP(total);
    modalPago.textContent = CLP(pago);
    modalVuelto.textContent = CLP(vuelto);
    modalMetodoPago.textContent = metodo === "tarjeta" ? "Tarjeta" : "Efectivo";

    modalBoleta.style.display = "flex";
}

if (cerrarModalBoleta && modalBoleta) {
    cerrarModalBoleta.onclick = () => {
        modalBoleta.style.display = "none";
    };
}

// ===========================================
// FIN
// ===========================================
