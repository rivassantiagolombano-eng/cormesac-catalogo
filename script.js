"use strict";
// CONFIGURACIÓN INICIAL: cambia solamente el enlace CSV. El teléfono vive aquí.
const CONFIG = {
  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSuZFGxSxV5Pnt1qgkpKKaX--x396iNEmBy_vDVJyBds_cFkBsKGK1NcQuUHxtsjCK7X5krEEJg8NWA/pub?gid=0&single=true&output=csv",
  WHATSAPP: "51963437603"
};
const COLUMNAS = ["Nombre del producto", "Precio", "Descripción corta",
  "Link de la imagen", "Categoría", "Disponible"];
const normalizar = valor => String(valor).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const moneda = new Intl.NumberFormat("es-PE", {style:"currency", currency:"PEN"});
let productos = []; // Estado temporal: no se guarda en el navegador.

// Lee CSV incluyendo comas, saltos de línea y comillas dentro de las celdas.
function leerCSV(texto) {
  texto = texto.replace(/^\uFEFF/, "");
  const filas = []; let fila = [], celda = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (comillas && texto[i + 1] === '"') {celda += '"'; i++;}
      else comillas = !comillas;
    } else if (c === "," && !comillas) {fila.push(celda); celda = "";}
    else if ((c === "\n" || c === "\r") && !comillas) {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda); filas.push(fila); fila = []; celda = "";
    } else celda += c;
  }
  if (comillas) throw new Error("Hay comillas sin cerrar en el CSV.");
  fila.push(celda); filas.push(fila);
  return filas.filter(f => f.some(c => c.trim()));
}

// Valida las columnas y omite filas incompletas o marcadas como No.
function convertirProductos(texto) {
  const filas = leerCSV(texto);
  const cabecera = (filas.shift() || []).map(normalizar);
  const posiciones = COLUMNAS.map(c => cabecera.indexOf(normalizar(c)));
  if (posiciones.includes(-1) || new Set(cabecera).size !== cabecera.length)
    throw new Error("Revisa los nombres de las columnas y el enlace CSV publicado.");
  let omitidos = 0;
  const datos = filas.flatMap(fila => {
    const [nombre, importe, descripcion, imagen, categoria, disponible] =
      posiciones.map(i => (fila[i] || "").trim());
    if (normalizar(disponible) === "no") return [];
    if (!nombre || normalizar(disponible) !== "si" ||
        (importe && !/^\d+(?:[.,]\d{1,2})?$/.test(importe))) {
      omitidos++; return [];
    }
    return [{nombre, precio: importe ? Number(importe.replace(",", ".")) : null,
      descripcion, imagen, categoria: categoria || "Sin categoría"}];
  });
  return {datos, omitidos};
}

// Convierte enlaces compartidos de Drive. Es un recurso práctico sin garantía
// de permanencia; si falla la miniatura, se conserva el enlace a la foto.
function resolverImagen(enlace) {
  try {
    const url = new URL(enlace);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "drive.google.com") {
      const id = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get("id");
      if (!id || !/^[\w-]+$/.test(id)) return null;
      const miniatura = new URL("https://drive.google.com/thumbnail");
      miniatura.searchParams.set("id", id); miniatura.searchParams.set("sz", "w800");
      const clave = url.searchParams.get("resourcekey");
      if (clave) miniatura.searchParams.set("resourcekey", clave);
      return {src: miniatura.href, original: url.href, drive: true};
    }
    return {src: url.href, original: url.href, drive: false};
  } catch {return null;}
}

function enlaceWhatsApp(nombre) {
  const mensaje = nombre
    ? `Hola, vi el catálogo de Cormesac y deseo pedir: ${nombre}. ¿Me confirman precio y disponibilidad?`
    : "Hola, vi el catálogo de Cormesac y deseo consultar por un producto";
  return `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

// textContent evita interpretar como HTML el contenido escrito en la hoja.
function elemento(tipo, clase, texto) {
  const nodo = document.createElement(tipo);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}
function enlaceExterno(nodo, destino) {
  nodo.href = destino; nodo.target = "_blank"; nodo.rel = "noopener noreferrer";
  return nodo;
}
function tarjeta(producto) {
  const articulo = elemento("article", "tarjeta");
  const foto = elemento("div", "foto");
  const enlace = resolverImagen(producto.imagen);
  if (enlace) {
    const img = elemento("img"); img.alt = producto.nombre;
    img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => foto.replaceChildren(
      elemento("span", "", "Imagen no disponible")), {once:true});
    img.src = enlace.src; foto.append(img);
  } else foto.append(elemento("span", "", "Foto próximamente"));
  const contenido = elemento("div", "contenido");
  contenido.append(elemento("span", "categoria", producto.categoria),
    elemento("h3", "", producto.nombre),
    elemento("p", "precio", producto.precio === null ? "Precio a consultar" : moneda.format(producto.precio)),
    elemento("p", "descripcion", producto.descripcion));
  if (enlace?.drive) contenido.append(enlaceExterno(
    elemento("a", "ver-foto", "Ver foto en Drive ↗"), enlace.original));
  contenido.append(enlaceExterno(elemento("a", "boton", "Pedir por WhatsApp"),
    enlaceWhatsApp(producto.nombre)));
  articulo.append(foto, contenido); return articulo;
}

let aviso = "";
function mostrarProductos() {
  const consulta = normalizar(document.querySelector("#buscar").value);
  const categoria = document.querySelector("#categoria").value;
  const visibles = productos.filter(p => normalizar(p.nombre).includes(consulta) &&
    (!categoria || normalizar(p.categoria) === categoria));
  document.querySelector("#lista").replaceChildren(...visibles.map(tarjeta));
  document.querySelector("#estado").textContent = (visibles.length
    ? `${visibles.length} producto(s). Confirma disponibilidad por WhatsApp.`
    : "No hay productos para mostrar con esta selección.") + aviso;
}

// Se consulta Google al abrir la página o pulsar Actualizar; no requiere claves.
async function cargarProductos() {
  const estado = document.querySelector("#estado"), lista = document.querySelector("#lista");
  const boton = document.querySelector("#actualizar");
  const controles = [document.querySelector("#buscar"), document.querySelector("#categoria")];
  boton.disabled = true; controles.forEach(c => c.disabled = true);
  lista.setAttribute("aria-busy", "true"); estado.textContent = "Cargando catálogo…";
  const abortar = new AbortController();
  const temporizador = setTimeout(() => abortar.abort(), 12000);
  try {
    if (CONFIG.CSV_URL === "PEGA_AQUI_EL_ENLACE_CSV") {
      estado.textContent = "Catálogo en preparación. Puedes consultarnos por WhatsApp.";
      return;
    }
    const url = new URL(CONFIG.CSV_URL);
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com")
      throw new Error("Usa el enlace CSV de Google Sheets publicado.");
    const respuesta = await fetch(url, {cache:"no-store", credentials:"omit", signal:abortar.signal});
    if (!respuesta.ok) throw new Error("Google no pudo entregar el catálogo.");
    const {datos, omitidos} = convertirProductos(await respuesta.text());
    productos = datos;
    aviso = omitidos ? ` Hay ${omitidos} fila(s) incompleta(s) que revisar en la hoja.` : "";
    const selector = controles[1], anterior = selector.value;
    selector.replaceChildren(new Option("Todas las categorías", ""));
    const categorias = new Map();
    productos.forEach(p => categorias.set(normalizar(p.categoria), p.categoria));
    [...categorias].sort((a,b) => a[1].localeCompare(b[1], "es")).forEach(
      ([valor, nombre]) => selector.add(new Option(nombre, valor)));
    selector.value = categorias.has(anterior) ? anterior : "";
    mostrarProductos();
  } catch (error) {
    // Se retira el catálogo anterior para no presentar precios desactualizados.
    productos = []; lista.replaceChildren();
    estado.textContent = "No pudimos cargar el catálogo. Pulsa Actualizar o consúltanos por WhatsApp.";
    console.warn("Carga del catálogo:", error.message);
  } finally {
    clearTimeout(temporizador); boton.disabled = false;
    controles.forEach(c => c.disabled = productos.length === 0);
    lista.setAttribute("aria-busy", "false");
  }
}

// Enlaces generales, contacto y eventos de la página.
document.querySelectorAll(".whatsapp").forEach(a => enlaceExterno(a, enlaceWhatsApp()));
document.querySelector("#telefono").textContent = `+${CONFIG.WHATSAPP}`;
document.querySelector("#anio").textContent = new Date().getFullYear();
document.querySelector("#buscar").addEventListener("input", mostrarProductos);
document.querySelector("#categoria").addEventListener("change", mostrarProductos);
document.querySelector("#actualizar").addEventListener("click", cargarProductos);
cargarProductos();
