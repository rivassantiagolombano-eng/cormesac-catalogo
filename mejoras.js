"use strict";
// Datos opcionales: completar una sola vez con información real de Cormesac.
// Vacío = no se muestra; no se inventan horarios, opiniones ni redes.
const NEGOCIO = {
  horarios: "",
  mapa: "", // Enlace exacto de la ubicación en Google Maps.
  redes: [], // Ejemplo de estructura: [{nombre:"Instagram", url:"https://..."}]
  testimonios: [], // Solo con permiso: [{nombre:"...", texto:"..."}]
  analyticsToken: "" // Token público de Cloudflare Web Analytics, opcional.
};

// El número para enlaces se mantiene sin espacios; solo se formatea al mostrarlo.
function formatoTelefono(numero) {
  return numero.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "+$1 $2 $3 $4");
}
function urlCatalogo() {
  const url = new URL(location.href); url.hash = ""; url.search = "";
  return url.href;
}
function urlProducto(p) {
  return `${urlCatalogo()}#producto=${encodeURIComponent(p.id || p.nombre)}`;
}
function mensajeProducto(p) {
  return [
    `Hola Cormesac, vi su catálogo y ${p.estado === "agotado" ? "quisiera consultar cuándo volverá a estar disponible" : "me interesa pedir"} este producto:`,
    `• Producto: ${p.nombre}`,
    p.codigo && `• Código: ${p.codigo}`,
    p.marca && `• Marca: ${p.marca}`,
    p.modelo && `• Modelo: ${p.modelo}`,
    p.presentacion && `• Presentación: ${p.presentacion}`,
    p.precio != null && `• Precio visto: ${moneda.format(p.precio)}`,
    p.id && `Enlace: ${urlProducto(p)}`,
    "¿Me confirman precio, disponibilidad y opciones de entrega? Gracias."
  ].filter(Boolean).join("\n");
}
function avisar(texto) {document.querySelector("#notificacion").textContent = texto;}
function enlaceSeguro(valor) {
  try {const url = new URL(valor); return url.protocol === "https:" ? url.href : "";}
  catch {return "";}
}
async function compartir(p) {
  const url = p ? urlProducto(p) : urlCatalogo();
  const title = p ? `${p.nombre} · Cormesac` : "Catálogo Cormesac";
  try {
    if (navigator.share) await navigator.share({title, url});
    else {await navigator.clipboard.writeText(url); avisar("Enlace copiado. Ya puedes pegarlo en WhatsApp.");}
  } catch (error) {
    if (error.name !== "AbortError") window.prompt("Copia este enlace para compartir:", url);
  }
}

// Galería accesible con diálogo nativo, cierre con Escape y botones por foto.
let productoAbierto, fotoActual = 0;
function abrirGaleria(p, indice = 0) {
  productoAbierto = p; fotoActual = indice;
  document.querySelector("#titulo-galeria").textContent = p.nombre;
  dibujarFoto();
  const dialogo = document.querySelector("#galeria");
  if (!dialogo.open) dialogo.showModal();
}
function dibujarFoto() {
  const fotos = productoAbierto.fotos || [];
  const caja = document.querySelector("#imagen-ampliada"); caja.replaceChildren();
  const foto = resolverImagen(fotos[fotoActual] || "");
  if (foto) {
    const img = elemento("img"); img.src = foto.src; img.alt = `${productoAbierto.nombre}, foto ${fotoActual + 1}`;
    img.referrerPolicy = "no-referrer";
    img.onerror = () => img.replaceWith(elemento("p", "", "No se pudo cargar la imagen."));
    caja.append(img, enlaceExterno(elemento("a", "", "Abrir foto original ↗"), foto.original));
  } else caja.append(elemento("p", "", "Foto próximamente"));
  caja.append(elemento("p","",productoAbierto.descripcion),enlaceExterno(elemento("a","boton","Consultar este producto"),enlaceWhatsApp(productoAbierto)));
  document.querySelector("#contador-fotos").textContent = fotos.length ? `${fotoActual+1} de ${fotos.length}` : "Sin fotos";
  document.querySelector("#foto-anterior").disabled = fotoActual <= 0;
  document.querySelector("#foto-siguiente").disabled = fotoActual >= fotos.length - 1;
}
function ampliarTarjeta(articulo, p) {
  const contenido = articulo.querySelector(".contenido");
  const estado = elemento("span", `estado-producto ${p.estado}`, {disponible:"Disponible",agotado:"Agotado",consultar:"Consultar disponibilidad"}[p.estado]);
  contenido.prepend(estado);
  if (p.etiqueta) contenido.prepend(elemento("span", "insignia", p.etiqueta));
  const detalles = [p.codigo && `Código: ${p.codigo}`, p.marca && `Marca: ${p.marca}`,
    p.modelo && `Modelo: ${p.modelo}`, p.presentacion && `Presentación: ${p.presentacion}`];
  const ficha = elemento("dl", "ficha");
  detalles.filter(Boolean).forEach(t => {const i=t.indexOf(":"); ficha.append(elemento("dt","",t.slice(0,i)),elemento("dd","",t.slice(i+1).trim()));});
  contenido.insertBefore(ficha, contenido.querySelector(".descripcion"));
  if (p.entrega) contenido.insertBefore(elemento("p","entrega",p.entrega),contenido.querySelector(".boton"));
  const foto = articulo.querySelector(".foto");
  const abrir = elemento("button", "abrir-foto", `Ver fotos (${p.fotos.length})`);
  abrir.type="button"; abrir.addEventListener("click",()=>abrirGaleria(p));
  if (p.fotos.length) foto.after(abrir);
  const compartirBoton=elemento("button","secundario compartir-producto","Compartir producto");
  compartirBoton.type="button"; compartirBoton.addEventListener("click",()=>compartir(p)); contenido.append(compartirBoton);
}

// Categorías reales de la hoja; los símbolos son ayudas de navegación.
function mostrarExtras(visibles, filtrando) {
  const destacados=visibles.filter(p=>p.destacado);
  document.querySelector("#destacados").hidden=filtrando || !destacados.length;
  document.querySelector("#lista-destacados").replaceChildren(...(filtrando?[]:destacados.map(tarjeta)));
  const categorias = new Map();
  productos.forEach(p=>{const key=normalizar(p.categoria);const v=categorias.get(key)||{nombre:p.categoria,total:0};v.total++;categorias.set(key,v);});
  const contenedor=document.querySelector("#categorias-visuales"); contenedor.replaceChildren();
  categorias.forEach((valor,key)=>{
    const simbolo=key.includes("equipo")?"⚙":key.includes("insumo")?"▦":key.includes("instrument")?"⌁":"◇";
    const b=elemento("button","categoria-visual",`${simbolo} ${valor.nombre} (${valor.total})`);b.type="button";
    b.setAttribute("aria-pressed",String(document.querySelector("#categoria").value===key));
    b.onclick=()=>{const select=document.querySelector("#categoria");select.value=select.value===key?"":key;mostrarProductos();};contenedor.append(b);
  });
  abrirDesdeEnlace();
}
let ultimoHashAbierto="";
function abrirDesdeEnlace() {
  if (!location.hash.startsWith("#producto=") || ultimoHashAbierto===location.hash) return;
  let id;try{id=decodeURIComponent(location.hash.slice(10));}catch{return;}
  const p=productos.find(p=>p.id===id);
  if (!p) return;
  ultimoHashAbierto=location.hash;
  // La ficha enlazada muestra también datos y el pedido, no solo la fotografía.
  abrirGaleria(p);
}

function iniciarMejoras() {
  document.querySelector("#llamar").href=`tel:+${CONFIG.WHATSAPP}`;
  const horarios=document.querySelector("#horarios");horarios.hidden=!NEGOCIO.horarios;horarios.textContent=NEGOCIO.horarios;
  const mapa=document.querySelector("#mapa");const urlMapa=enlaceSeguro(NEGOCIO.mapa);
  if(urlMapa){mapa.hidden=false;enlaceExterno(mapa,urlMapa);}
  NEGOCIO.redes.forEach(r=>{const url=enlaceSeguro(r.url);if(url)document.querySelector("#redes").append(enlaceExterno(elemento("a","",r.nombre),url));});
  document.querySelector("#testimonios").hidden=!NEGOCIO.testimonios.length;
  NEGOCIO.testimonios.forEach(t=>{const b=elemento("blockquote","opinion");b.append(elemento("p","",t.texto),elemento("cite","",t.nombre));document.querySelector("#opiniones").append(b);});
  document.querySelector("#compartir-catalogo").onclick=()=>compartir();
  document.querySelector("#disponibilidad").onchange=mostrarProductos;
  document.querySelectorAll("dialog .cerrar").forEach(b=>b.onclick=()=>b.closest("dialog").close());
  document.querySelector("#foto-anterior").onclick=()=>{fotoActual--;dibujarFoto();};
  document.querySelector("#foto-siguiente").onclick=()=>{fotoActual++;dibujarFoto();};
  window.addEventListener("hashchange",()=>{ultimoHashAbierto="";abrirDesdeEnlace();});
  document.querySelector("#consulta").onsubmit=event=>{
    event.preventDefault();const datos=new FormData(event.target);
    const nombre=String(datos.get("nombre")).trim(), mensaje=String(datos.get("mensaje")).trim();
    if(!mensaje)return;
    const texto=`Hola Cormesac${nombre?`, soy ${nombre}`:""}. ${mensaje}`;
    location.href=`https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(texto)}`;
  };
  document.querySelector("#mostrar-qr").onclick=()=>{
    try {
      const qr=qrcode(0,"M");qr.addData(urlCatalogo());qr.make();
      // SVG generado localmente por la biblioteca, nunca desde la hoja.
      const svg=qr.createSvgTag({cellSize:6,margin:24,scalable:true});
      document.querySelector("#qr").innerHTML=svg;
      document.querySelector("#descargar-qr").href=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      document.querySelector("#qr-dialogo").showModal();
    } catch {avisar("No se pudo generar el QR. Usa Compartir catálogo.");}
  };
  // No hay seguimiento si el dueño no ha configurado su cuenta de estadísticas.
  if (/^[a-f0-9]{32}$/i.test(NEGOCIO.analyticsToken)) {
    const beacon=document.createElement("script");beacon.src="https://static.cloudflareinsights.com/beacon.min.js";
    beacon.defer=true;beacon.dataset.cfBeacon=JSON.stringify({token:NEGOCIO.analyticsToken});document.head.append(beacon);
  }
}
