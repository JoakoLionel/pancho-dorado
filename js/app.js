// =====================================================================
//  Lógica de la página: menú y bot de pedidos (Panchi).
//  Usa los datos de js/config.js y la "mini IA" de js/ia.js.
//
//  El bot funciona por "estados". En cada uno hace una pregunta y valida
//  la respuesta. Además, la mini IA entiende frases libres y completa
//  varios datos de una sola vez ("2 clásicos para retirar, a nombre de Ana").
//  inicio -> elegir -> cantidad -> mas -> modalidad -> direccion
//  -> nombre -> notas -> confirmar -> fin
// =====================================================================

var CLAVE_CARRITO = "panchoDoradoCarrito";
var CLAVE_PEDIDOS = "panchoDoradoPedidos";
var MAXIMO_POR_PRODUCTO = 99;

// Lo que el cliente va eligiendo: array de objetos { id: "clasico", cantidad: 2 }
var carrito = [];

// Datos del pedido que el bot va juntando
var datosPedido = { modalidad: "", direccion: "", nombre: "", notas: "" };
var notasListas = false;

var estado = "inicio";
var productoActual = null;
var conversacionIniciada = false;
var ultimoFoco = null;
var cantidadAnterior = 0;

// Cola de mensajes: el bot "escribe" uno por vez
var cola = [];
var colaCorriendo = false;

// ---------- Utilidades ----------

function porId(id) {
  return document.getElementById(id);
}

function crear(etiqueta, clase, texto) {
  var nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

function formatearPrecio(numero) {
  return "$" + numero.toLocaleString("es-AR");
}

function dice(t, palabras) {
  for (var i = 0; i < palabras.length; i++) {
    if (t === palabras[i]) return true;
  }
  return false;
}

function contiene(t, palabras) {
  for (var i = 0; i < palabras.length; i++) {
    if (t.indexOf(palabras[i]) !== -1) return true;
  }
  return false;
}

function buscarProducto(id) {
  for (var i = 0; i < productos.length; i++) {
    if (productos[i].id === id) return productos[i];
  }
  return null;
}

function posicionEnCarrito(id) {
  for (var i = 0; i < carrito.length; i++) {
    if (carrito[i].id === id) return i;
  }
  return -1;
}

function cantidadDe(id) {
  var pos = posicionEnCarrito(id);
  return pos === -1 ? 0 : carrito[pos].cantidad;
}

// ---------- Guardado en el navegador ----------

function leerGuardado(clave) {
  try { return JSON.parse(localStorage.getItem(clave) || "[]"); } catch (e) { return []; }
}

function escribirGuardado(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin guardado */ }
}

function cargarCarrito() {
  var datos = leerGuardado(CLAVE_CARRITO);
  if (!Array.isArray(datos)) return;
  for (var i = 0; i < datos.length; i++) {
    var cantidad = parseInt(datos[i].cantidad, 10);
    // Solo se aceptan productos que existen y cantidades válidas.
    if (buscarProducto(datos[i].id) && cantidad > 0 && cantidad <= MAXIMO_POR_PRODUCTO) {
      carrito.push({ id: datos[i].id, cantidad: cantidad });
    }
  }
}

// ---------- Horario ----------

function minutosDe(texto) {
  var partes = texto.split(":");
  return parseInt(partes[0], 10) * 60 + parseInt(partes[1], 10);
}

function estaAbierto() {
  var ahora = new Date();
  var hoyAbre = configLocal.diasAbierto.indexOf(ahora.getDay()) !== -1;
  var minutos = ahora.getHours() * 60 + ahora.getMinutes();
  return hoyAbre && minutos >= minutosDe(configLocal.horaApertura) && minutos <= minutosDe(configLocal.horaCierre);
}

function textoHorario() {
  return "Atendemos todos los días de " + configLocal.horaApertura + " a " + configLocal.horaCierre + " hs.";
}

function actualizarEstado() {
  var abierto = estaAbierto();
  porId("estadoLocal").className = "estado " + (abierto ? "abierto" : "cerrado");
  porId("estadoTexto").textContent = abierto
    ? "Abierto ahora, hasta las " + configLocal.horaCierre + " hs"
    : "Cerrado ahora. Abrimos de " + configLocal.horaApertura + " a " + configLocal.horaCierre + " hs";

  var aviso = porId("avisoCerrado");
  aviso.hidden = abierto;
  aviso.textContent = abierto ? "" :
    "Ahora estamos cerrados. Podés dejar el pedido anotado y lo preparamos cuando abramos (" +
    configLocal.horaApertura + " a " + configLocal.horaCierre + " hs).";
}

// ---------- Menú en la página ----------

function crearControlCantidad(id) {
  var cantidad = cantidadDe(id);
  if (cantidad === 0) {
    var agregar = crear("button", "boton boton-agregar", "Agregar");
    agregar.type = "button";
    agregar.setAttribute("data-agregar", id);
    return agregar;
  }
  var caja = crear("div", "cantidad");
  var menos = crear("button", "", "−");
  menos.type = "button";
  menos.setAttribute("data-restar", id);
  menos.setAttribute("aria-label", "Quitar una unidad");
  var numero = crear("span", "", String(cantidad));
  numero.setAttribute("aria-live", "polite");
  var mas = crear("button", "", "+");
  mas.type = "button";
  mas.setAttribute("data-sumar", id);
  mas.setAttribute("aria-label", "Agregar una unidad");
  caja.appendChild(menos);
  caja.appendChild(numero);
  caja.appendChild(mas);
  return caja;
}

function crearTarjeta(producto) {
  var tarjeta = crear("article", "tarjeta" + (producto.grande ? " tarjeta-grande" : ""));
  tarjeta.setAttribute("data-producto", producto.id);

  var cajaFoto = crear("div", "tarjeta-foto");
  var img = document.createElement("img");
  img.src = producto.foto + "-960.jpg";
  img.srcset = producto.foto + "-500.jpg 500w, " + producto.foto + "-960.jpg 960w";
  img.sizes = producto.grande ? "(max-width: 640px) 100vw, 33vw" : "(max-width: 640px) 100vw, (max-width: 960px) 50vw, 33vw";
  img.alt = producto.alt || producto.nombre;
  img.width = 960;
  img.height = 720;
  img.loading = "lazy";
  cajaFoto.appendChild(img);

  var cuerpo = crear("div", "tarjeta-cuerpo");
  if (producto.grande) cuerpo.appendChild(crear("span", "tarjeta-etiqueta", "El más pedido"));
  cuerpo.appendChild(crear("h3", "", producto.nombre));
  cuerpo.appendChild(crear("p", "tarjeta-desc", producto.descripcion));

  var pie = crear("div", "tarjeta-pie");
  pie.appendChild(crear("span", "precio", formatearPrecio(producto.precio)));
  pie.appendChild(crearControlCantidad(producto.id));
  cuerpo.appendChild(pie);

  tarjeta.appendChild(cajaFoto);
  tarjeta.appendChild(cuerpo);
  return tarjeta;
}

function crearRenglon(producto) {
  var fila = crear("li", "menu-renglon");
  fila.setAttribute("data-producto", producto.id);
  var texto = crear("div");
  texto.appendChild(crear("h4", "", producto.nombre));
  texto.appendChild(crear("p", "", producto.descripcion));
  fila.appendChild(texto);
  fila.appendChild(crear("span", "precio", formatearPrecio(producto.precio)));
  fila.appendChild(crearControlCantidad(producto.id));
  return fila;
}

function dibujarMenu() {
  var tarjetas = porId("menuTarjetas");
  var bebidas = porId("menuBebidas");
  tarjetas.textContent = "";
  bebidas.textContent = "";
  for (var i = 0; i < productos.length; i++) {
    if (productos[i].foto) tarjetas.appendChild(crearTarjeta(productos[i]));
    else bebidas.appendChild(crearRenglon(productos[i]));
  }
}

function totalUnidades() {
  var suma = 0;
  for (var i = 0; i < carrito.length; i++) suma += carrito[i].cantidad;
  return suma;
}

function refrescarPagina() {
  dibujarMenu();
  var contador = porId("contadorCarrito");
  var unidades = totalUnidades();
  contador.textContent = String(unidades);
  if (unidades !== cantidadAnterior) {
    contador.classList.remove("salta");
    void contador.offsetWidth; // reinicia la animación
    contador.classList.add("salta");
  }
  cantidadAnterior = unidades;
}

// Suma o resta unidades de un producto (desde la página o desde el bot).
function cambiarCantidad(id, cambio) {
  var pos = posicionEnCarrito(id);
  if (pos === -1) {
    if (cambio > 0) carrito.push({ id: id, cantidad: Math.min(cambio, MAXIMO_POR_PRODUCTO) });
  } else {
    var nueva = carrito[pos].cantidad + cambio;
    if (nueva <= 0) carrito.splice(pos, 1);
    else carrito[pos].cantidad = Math.min(nueva, MAXIMO_POR_PRODUCTO);
  }
  escribirGuardado(CLAVE_CARRITO, carrito);
  refrescarPagina();
}

function vaciarCarrito() {
  carrito = [];
  escribirGuardado(CLAVE_CARRITO, carrito);
  refrescarPagina();
}

// Marca con una animación el producto del menú de la página.
function resaltarProducto(id) {
  var nodo = document.querySelector('#menu [data-producto="' + id + '"]');
  if (!nodo) return;
  nodo.scrollIntoView({ behavior: "smooth", block: "center" });
  nodo.classList.remove("resaltado");
  void nodo.offsetWidth;
  nodo.classList.add("resaltado");
}

// ---------- Cálculos del pedido ----------

function calcularSubtotal() {
  var suma = 0;
  for (var i = 0; i < carrito.length; i++) {
    suma += buscarProducto(carrito[i].id).precio * carrito[i].cantidad;
  }
  return suma;
}

function calcularTotal() {
  var envio = datosPedido.modalidad === "delivery" ? configLocal.costoDelivery : 0;
  return calcularSubtotal() + envio;
}

function textoDetalle() {
  var lineas = [];
  for (var i = 0; i < carrito.length; i++) {
    var producto = buscarProducto(carrito[i].id);
    lineas.push(carrito[i].cantidad + " x " + producto.nombre + "  " +
      formatearPrecio(producto.precio * carrito[i].cantidad));
  }
  return lineas.join("\n");
}

function textoResumen() {
  var lineas = [textoDetalle()];
  if (datosPedido.modalidad === "delivery") lineas.push("Delivery  " + formatearPrecio(configLocal.costoDelivery));
  lineas.push("TOTAL  " + formatearPrecio(calcularTotal()));
  lineas.push("");
  lineas.push("Nombre: " + datosPedido.nombre);
  lineas.push(datosPedido.modalidad === "delivery" ? "Entrega en: " + datosPedido.direccion : "Retiro en el local");
  if (datosPedido.notas) lineas.push("Aclaraciones: " + datosPedido.notas);
  return lineas.join("\n");
}

// ---------- Chat: cola de mensajes con "escribiendo..." ----------

function bajarChat() {
  var log = porId("chatLog");
  log.scrollTop = log.scrollHeight;
}

function mostrarEscribiendo() {
  if (porId("chatEscribiendo")) return;
  var nodo = crear("div", "mensaje mensaje-bot escribiendo");
  nodo.id = "chatEscribiendo";
  nodo.setAttribute("aria-hidden", "true");
  nodo.appendChild(crear("span"));
  nodo.appendChild(crear("span"));
  nodo.appendChild(crear("span"));
  porId("chatLog").appendChild(nodo);
  bajarChat();
}

function ocultarEscribiendo() {
  var nodo = porId("chatEscribiendo");
  if (nodo) nodo.remove();
}

function correrCola() {
  if (cola.length === 0) {
    colaCorriendo = false;
    return;
  }
  colaCorriendo = true;
  var item = cola.shift();
  if (item.espera > 0 && configLocal.retardoBot > 0) {
    mostrarEscribiendo();
    setTimeout(function () {
      ocultarEscribiendo();
      item.accion();
      correrCola();
    }, item.espera);
  } else {
    item.accion();
    correrCola();
  }
}

function encolar(accion, espera) {
  cola.push({ accion: accion, espera: espera });
  if (!colaCorriendo) correrCola();
}

function botDice(texto, clase) {
  var espera = Math.min(configLocal.retardoBot, 250 + texto.length * 6);
  encolar(function () {
    porId("chatLog").appendChild(crear("div", "mensaje mensaje-bot" + (clase ? " " + clase : ""), texto));
    bajarChat();
  }, espera);
}

function usuarioDice(texto) {
  encolar(function () {
    porId("chatLog").appendChild(crear("div", "mensaje mensaje-usuario", texto));
    bajarChat();
  }, 0);
}

// opciones: array de { texto: "Lo que se ve", valor: "lo que el bot recibe" }
function mostrarOpciones(opciones) {
  encolar(function () {
    var caja = porId("chatChips");
    caja.textContent = "";
    for (var i = 0; i < opciones.length; i++) {
      var chip = crear("button", "chip", opciones[i].texto);
      chip.type = "button";
      chip.setAttribute("data-valor", opciones[i].valor);
      caja.appendChild(chip);
    }
  }, 0);
}

function limpiarOpciones() {
  porId("chatChips").textContent = "";
}

function textoMenu() {
  var lineas = [];
  for (var i = 0; i < productos.length; i++) {
    lineas.push((i + 1) + ". " + productos[i].nombre + "  " + formatearPrecio(productos[i].precio));
  }
  return lineas.join("\n");
}

// ---------- Chat: preguntas de cada estado ----------

function preguntar() {
  var opciones = [];
  var i;

  if (estado === "inicio") {
    mostrarOpciones([
      { texto: "Hacer un pedido", valor: "menu" },
      { texto: "Recomendame algo", valor: "recomendame algo" },
      { texto: "Horario", valor: "horario" }
    ]);
  } else if (estado === "elegir") {
    botDice("Escribí el número del producto (por ejemplo 1) o tocá uno. También podés pedir directo: “2 clásicos y una coca”.");
    for (i = 0; i < productos.length; i++) {
      opciones.push({ texto: productos[i].nombre, valor: "p:" + productos[i].id });
    }
    if (carrito.length > 0) {
      opciones.push({ texto: "Ver mi pedido", valor: "ver" });
      opciones.push({ texto: "Terminar pedido", valor: "terminar" });
    }
    mostrarOpciones(opciones);
  } else if (estado === "cantidad") {
    botDice("¿Cuántas unidades de " + productoActual.nombre + " querés? (de 1 a " + MAXIMO_POR_PRODUCTO + ")");
    mostrarOpciones([
      { texto: "1", valor: "1" }, { texto: "2", valor: "2" },
      { texto: "3", valor: "3" }, { texto: "4", valor: "4" }
    ]);
  } else if (estado === "mas") {
    botDice("¿Querés algo más?");
    mostrarOpciones([
      { texto: "Agregar otro producto", valor: "agregar" },
      { texto: "Ver mi pedido", valor: "ver" },
      { texto: "Terminar pedido", valor: "terminar" }
    ]);
  } else if (estado === "modalidad") {
    botDice("¿Lo retirás en el local o te lo llevamos? El delivery cuesta " + formatearPrecio(configLocal.costoDelivery) + ".");
    mostrarOpciones([
      { texto: "Retiro en el local", valor: "retiro" },
      { texto: "Delivery", valor: "delivery" }
    ]);
  } else if (estado === "direccion") {
    botDice("¿A qué dirección lo llevamos? (calle, altura y piso)");
    mostrarOpciones([]);
  } else if (estado === "nombre") {
    botDice("¿A nombre de quién lo anoto?");
    mostrarOpciones([]);
  } else if (estado === "notas") {
    botDice("¿Alguna aclaración? Por ejemplo “sin cebolla”. Si no, tocá “Ninguna”.");
    mostrarOpciones([{ texto: "Ninguna", valor: "no" }]);
  } else if (estado === "confirmar") {
    botDice("Este es tu pedido:\n\n" + textoResumen() + "\n\n¿Lo confirmo?");
    mostrarOpciones([
      { texto: "Sí, confirmar", valor: "si" },
      { texto: "No, cambiar algo", valor: "no" }
    ]);
  } else if (estado === "fin") {
    mostrarOpciones([{ texto: "Hacer otro pedido", valor: "menu" }]);
  }
}

function pasarA(nuevoEstado) {
  estado = nuevoEstado;
  preguntar();
}

// Decide cuál es el próximo dato que falta para cerrar el pedido.
function siguienteFaltante() {
  if (carrito.length === 0) return "elegir";
  if (datosPedido.modalidad === "") return "modalidad";
  if (datosPedido.modalidad === "delivery" && datosPedido.direccion === "") return "direccion";
  if (datosPedido.nombre === "") return "nombre";
  if (!notasListas) return "notas";
  return "confirmar";
}

function saludar() {
  conversacionIniciada = true;
  botDice("¡Hola! Soy Panchi, el bot de " + configLocal.nombre + ". Te tomo el pedido para retiro o delivery.\n" +
    "Podés escribirme como hablás, por ejemplo: “quiero 2 clásicos y una coca para retirar, a nombre de Juan”.\n" +
    "Ojo: no tomamos reservas de mesa, solo pedidos. " + textoHorario());
  if (carrito.length > 0) {
    botDice("Veo que ya elegiste esto en el menú:\n" + textoDetalle());
    pasarA("elegir");
  } else {
    preguntar();
  }
}

// ---------- Agregar productos ----------

// Entiende "3", "clasico", "2 clasico" o el valor de un botón "p:clasico".
function entenderProducto(t) {
  var cantidad = 0;
  var resto = t;

  if (t.indexOf("p:") === 0) {
    var porBoton = buscarProducto(t.substring(2));
    return porBoton ? { producto: porBoton, cantidad: 0 } : null;
  }

  var conCantidad = t.match(/^(\d+)\s*x?\s+(.+)$/);
  if (conCantidad) {
    cantidad = parseInt(conCantidad[1], 10);
    resto = conCantidad[2];
  }

  if (/^\d+$/.test(resto)) {
    var numero = parseInt(resto, 10);
    if (numero >= 1 && numero <= productos.length) return { producto: productos[numero - 1], cantidad: 0 };
    return null;
  }

  var encontrado = buscarProductoEnTexto(resto);
  return encontrado ? { producto: encontrado, cantidad: cantidad } : null;
}

// Agrega unidades controlando el máximo. Devuelve cuántas se agregaron.
function sumarAlPedido(producto, cantidad) {
  var actual = cantidadDe(producto.id);
  var lugar = MAXIMO_POR_PRODUCTO - actual;
  var agregadas = Math.min(cantidad, lugar);
  if (agregadas > 0) cambiarCantidad(producto.id, agregadas);
  if (agregadas < cantidad) {
    botDice("El máximo es " + MAXIMO_POR_PRODUCTO + " unidades por producto, así que de " + producto.nombre +
      " agregué solo " + agregadas + ".");
  }
  return agregadas;
}

function agregarYSeguir(producto, cantidad) {
  var agregadas = sumarAlPedido(producto, cantidad);
  if (agregadas > 0) {
    botDice("Listo, agregué " + agregadas + " x " + producto.nombre + ". Llevás " + formatearPrecio(calcularSubtotal()) + ".");
  }
  pasarA("mas");
}

function intentarProducto(t) {
  var elegido = entenderProducto(t);
  if (!elegido) return false;
  if (elegido.cantidad > 0) agregarYSeguir(elegido.producto, elegido.cantidad);
  else {
    productoActual = elegido.producto;
    pasarA("cantidad");
  }
  return true;
}

function irATerminar() {
  if (carrito.length === 0) {
    botDice("Todavía no elegiste nada. Primero sumá al menos un producto.");
    pasarA("elegir");
  } else {
    pasarA(siguienteFaltante());
  }
}

function verPedido() {
  if (carrito.length === 0) {
    botDice("Tu pedido está vacío por ahora.");
  } else {
    var envio = datosPedido.modalidad === "delivery" ? "\nDelivery  " + formatearPrecio(configLocal.costoDelivery) : "";
    botDice("Hasta ahora llevás:\n\n" + textoDetalle() + "\nSubtotal  " + formatearPrecio(calcularSubtotal()) + envio +
      (envio ? "\nTOTAL  " + formatearPrecio(calcularTotal()) : ""));
  }
}

function reiniciarDatos() {
  datosPedido = { modalidad: "", direccion: "", nombre: "", notas: "" };
  notasListas = false;
  productoActual = null;
}

// ---------- Confirmar y guardar la orden ----------

function guardarPedidoConfirmado() {
  var pedidos = leerGuardado(CLAVE_PEDIDOS);
  if (!Array.isArray(pedidos)) pedidos = [];
  var numero = pedidos.length + 1;
  var items = [];
  for (var i = 0; i < carrito.length; i++) {
    var producto = buscarProducto(carrito[i].id);
    items.push({ nombre: producto.nombre, cantidad: carrito[i].cantidad, precio: producto.precio });
  }
  pedidos.push({
    numero: numero,
    fecha: new Date().toISOString(),
    items: items,
    modalidad: datosPedido.modalidad,
    direccion: datosPedido.direccion,
    nombre: datosPedido.nombre,
    notas: datosPedido.notas,
    total: calcularTotal()
  });
  escribirGuardado(CLAVE_PEDIDOS, pedidos);
  return numero;
}

function confirmarPedido() {
  var numero = guardarPedidoConfirmado();
  var codigo = "#" + ("000" + numero).slice(-4);
  botDice("PEDIDO " + codigo + "\n\n" + textoResumen(), "mensaje-ticket");
  botDice("¡Gracias, " + datosPedido.nombre + "! Tu pedido quedó confirmado.\n" +
    (datosPedido.modalidad === "delivery"
      ? "Te lo llevamos en unos " + configLocal.tiempoEspera + ". Pagás al recibirlo."
      : "Va a estar listo para retirar en unos " + configLocal.tiempoEspera + ". Pagás al retirarlo.") +
    (estaAbierto() ? "" : "\nComo ahora estamos cerrados, lo preparamos apenas abramos."));
  vaciarCarrito();
  reiniciarDatos();
  pasarA("fin");
}

// ---------- Mini IA: entender frases libres ----------

function irAPagina(seccion, producto) {
  var nombres = { menu: "el menú", visita: "dónde estamos", como: "cómo pedir" };
  botDice("Te llevo a " + nombres[seccion] + ". Cuando quieras seguir con el pedido, tocá “Hacer pedido”.");
  cerrarPanel();
  var destino = porId(seccion);
  if (destino) destino.scrollIntoView({ behavior: "smooth", block: "start" });
  if (producto) setTimeout(function () { resaltarProducto(producto.id); }, 500);
}

function recomendar(ia) {
  var texto = /barato|economico/.test(normalizar(ia.textoOriginal))
    ? "Lo más conveniente es el Clásico (" + formatearPrecio(buscarProducto("clasico").precio) + "), un pancho simple y rico."
    : "Te recomiendo el Combo Dorado (" + formatearPrecio(buscarProducto("combo").precio) +
      "): pancho clásico, papas y gaseosa. Es lo más pedido. Si querés algo más fuerte, probá el Mostaza antigua.";
  botDice(texto);
}

// Aplica los productos que entendió la IA y devuelve las frases de lo que hizo.
function aplicarItems(items) {
  var avisos = [];
  for (var i = 0; i < items.length; i++) {
    var producto = items[i].producto;
    var cantidad = items[i].cantidad;
    var actual = cantidadDe(producto.id);

    if (items[i].accion === "quitar") {
      if (actual === 0) {
        avisos.push("No tenías " + producto.nombre + " en el pedido.");
      } else if (items[i].explicita && cantidad < actual) {
        cambiarCantidad(producto.id, -cantidad);
        avisos.push("Quité " + cantidad + " x " + producto.nombre + ".");
      } else {
        cambiarCantidad(producto.id, -actual);
        avisos.push("Saqué " + producto.nombre + " del pedido.");
      }
    } else if (items[i].accion === "fijar" && items[i].explicita) {
      var destino = Math.min(cantidad, MAXIMO_POR_PRODUCTO);
      cambiarCantidad(producto.id, destino - actual);
      avisos.push(destino === 0 ? "Saqué " + producto.nombre + " del pedido." : "Dejé " + producto.nombre + " en " + destino + ".");
    } else {
      var agregadas = sumarAlPedido(producto, cantidad);
      if (agregadas > 0) avisos.push("Agregué " + agregadas + " x " + producto.nombre + ".");
    }
  }
  return avisos;
}

// Devuelve true si la mini IA atendió el mensaje; false si lo debe atender el flujo normal.
function usarIA(texto) {
  var ia = analizarTexto(texto);
  ia.textoOriginal = texto;
  var datos = ia.datos;
  var hayDatos = datos.modalidad !== "" || datos.nombre !== "" || datos.direccion !== "";
  var hayPedido = ia.items.length > 0 && (ia.hayCantidadExplicita || ia.hayVerbo || ia.items.length > 1);

  // Preguntas y pedidos a la página
  if (ia.irA !== "" && !hayPedido) {
    irAPagina(ia.irA, ia.resaltar ? ia.producto : null);
    return true;
  }
  if (ia.ingredientes && ia.producto) {
    botDice(ia.producto.nombre + ": " + ia.producto.descripcion + " Cuesta " + formatearPrecio(ia.producto.precio) + ".");
    preguntar();
    return true;
  }
  if (ia.precio && ia.producto) {
    botDice(ia.producto.nombre + " cuesta " + formatearPrecio(ia.producto.precio) + ".");
    preguntar();
    return true;
  }
  if (ia.total) {
    verPedido();
    preguntar();
    return true;
  }
  if (ia.recomendar && !hayPedido) {
    recomendar(ia);
    if (estado === "inicio" || estado === "fin") { estado = "elegir"; }
    preguntar();
    return true;
  }
  if (ia.ayuda) {
    botDice("Puedo tomarte el pedido, sumar o sacar productos, decirte precios y qué lleva cada pancho, recomendarte algo y llevarte por la página.\n" +
      "Probá: “agregame 3 pickles”, “sacá las papas”, “cuánto llevo”, “llevame al menú”.");
    preguntar();
    return true;
  }

  // Pedido en lenguaje natural
  if (hayPedido || hayDatos) {
    if (estado === "fin") reiniciarDatos();
    var avisos = hayPedido ? aplicarItems(ia.items) : [];

    var anotado = [];
    if (datos.modalidad !== "") {
      datosPedido.modalidad = datos.modalidad;
      if (datos.modalidad === "retiro") datosPedido.direccion = "";
      anotado.push(datos.modalidad === "delivery" ? "delivery" : "retiro en el local");
    }
    if (datos.direccion !== "") { datosPedido.direccion = datos.direccion; anotado.push("dirección " + datos.direccion); }
    if (datos.nombre !== "") { datosPedido.nombre = datos.nombre; anotado.push("a nombre de " + datos.nombre); }
    if (datos.notas !== "" && hayPedido) {
      datosPedido.notas = datos.notas;
      notasListas = true;
      anotado.push("aclaración: " + datos.notas);
    }
    if (anotado.length > 0) avisos.push("Anoté: " + anotado.join(", ") + ".");
    if (carrito.length > 0 && hayPedido) avisos.push("Subtotal: " + formatearPrecio(calcularSubtotal()) + ".");
    if (avisos.length > 0) botDice(avisos.join("\n"));

    if (carrito.length === 0) pasarA("elegir");
    else if (hayDatos || ia.terminar || estado === "confirmar") pasarA(siguienteFaltante());
    else pasarA("mas");
    return true;
  }

  if (ia.saludo) {
    botDice("¡Hola! ¿Qué te preparo hoy?");
    preguntar();
    return true;
  }
  if (ia.gracias) {
    botDice("¡De nada! Cualquier cosa, acá estoy.");
    preguntar();
    return true;
  }
  return false;
}

// ---------- Chat: flujo normal por estados ----------

// Lo que se puede decir en cualquier momento. Devuelve true si lo atendió.
function atenderComandosGenerales(t) {
  if (t === "cancelar" || t === "cancelar todo" || t === "reiniciar" || t === "vaciar" || t === "empezar de nuevo") {
    vaciarCarrito();
    reiniciarDatos();
    botDice("Listo, cancelé tu pedido. Cuando quieras empezamos de nuevo.");
    pasarA("inicio");
    return true;
  }
  if (contiene(t, ["reserva"])) {
    botDice("No tomamos reservas de mesa por acá, solo pedidos para retiro o delivery.");
    preguntar();
    return true;
  }
  if (dice(t, ["horario", "horarios", "hora", "a que hora abren", "cuando abren"])) {
    botDice(textoHorario() + (estaAbierto() ? " Ahora estamos abiertos." : " Ahora estamos cerrados."));
    preguntar();
    return true;
  }
  if (estado !== "fin" && estado !== "inicio" && dice(t, ["menu", "carta"])) {
    botDice(textoMenu());
    pasarA("elegir");
    return true;
  }
  return false;
}

function procesar(texto, etiqueta) {
  var mostrar = (etiqueta || texto).trim();
  if (mostrar === "") return;
  limpiarOpciones();
  usuarioDice(mostrar);
  var t = normalizar(texto);

  if (atenderComandosGenerales(t)) return;

  // En estos estados lo que se escribe es un dato (dirección, nombre, aclaración).
  var esDato = estado === "direccion" || estado === "nombre" || estado === "notas";
  if (!esDato && usarIA(texto)) return;

  if (estado === "inicio" || estado === "fin") {
    if (estado === "fin") reiniciarDatos();
    if (dice(t, ["menu", "carta", "pedido", "pedir", "hacer pedido", "hacer un pedido", "si", "dale"]) || contiene(t, ["pedido", "quiero", "menu"])) {
      botDice(textoMenu());
      pasarA("elegir");
    } else {
      botDice("No te entendí. Podés tocar una opción o escribir “menu”.");
      preguntar();
    }

  } else if (estado === "elegir") {
    if (dice(t, ["terminar", "terminar pedido", "listo", "finalizar", "nada mas"])) irATerminar();
    else if (dice(t, ["ver", "ver pedido", "ver mi pedido", "pedido"])) { verPedido(); preguntar(); }
    else if (!intentarProducto(t)) {
      botDice("No encontré esa opción. Escribí un número del 1 al " + productos.length + " o el nombre del producto.");
      preguntar();
    }

  } else if (estado === "cantidad") {
    if (/^-\d+$/.test(t)) {
      botDice("La cantidad no puede ser negativa.");
      preguntar();
    } else if (!/^\d+$/.test(t)) {
      botDice("Necesito un número. Por ejemplo 2.");
      preguntar();
    } else {
      var cantidad = parseInt(t, 10);
      if (cantidad < 1 || cantidad > MAXIMO_POR_PRODUCTO) {
        botDice("La cantidad tiene que estar entre 1 y " + MAXIMO_POR_PRODUCTO + ".");
        preguntar();
      } else {
        agregarYSeguir(productoActual, cantidad);
      }
    }

  } else if (estado === "mas") {
    if (dice(t, ["agregar", "agregar otro", "agregar otro producto", "mas", "si", "otro", "otra"])) {
      botDice(textoMenu());
      pasarA("elegir");
    } else if (dice(t, ["ver", "ver pedido", "ver mi pedido"])) { verPedido(); preguntar(); }
    else if (dice(t, ["terminar", "terminar pedido", "listo", "no", "nada", "nada mas", "eso es todo"])) irATerminar();
    else if (!intentarProducto(t)) {
      botDice("No te entendí. Tocá una opción o escribí el nombre de otro producto.");
      preguntar();
    }

  } else if (estado === "modalidad") {
    if (contiene(t, ["retiro", "retirar", "busco", "local"]) && !contiene(t, ["delivery"])) {
      datosPedido.modalidad = "retiro";
      datosPedido.direccion = "";
      pasarA(siguienteFaltante());
    } else if (contiene(t, ["delivery", "envio", "domicilio", "llevar", "casa"])) {
      datosPedido.modalidad = "delivery";
      pasarA(siguienteFaltante());
    } else {
      botDice("Elegí una: retiro o delivery.");
      preguntar();
    }

  } else if (estado === "direccion") {
    if (texto.trim().length < 5) {
      botDice("Esa dirección es muy corta. Escribí calle, altura y piso.");
      preguntar();
    } else {
      datosPedido.direccion = texto.trim();
      pasarA(siguienteFaltante());
    }

  } else if (estado === "nombre") {
    if (texto.trim().length < 2) {
      botDice("Necesito un nombre para anotar el pedido.");
      preguntar();
    } else {
      datosPedido.nombre = texto.trim();
      pasarA(siguienteFaltante());
    }

  } else if (estado === "notas") {
    datosPedido.notas = dice(t, ["no", "ninguna", "nada", "ninguno", "n"]) ? "" : texto.trim();
    notasListas = true;
    pasarA(siguienteFaltante());

  } else if (estado === "confirmar") {
    var primeraPalabra = t.split(" ")[0];
    if (dice(primeraPalabra, ["si", "s", "sii", "dale", "ok", "okey", "confirmo", "confirmar", "listo"])) {
      confirmarPedido();
    } else if (dice(primeraPalabra, ["no", "n", "cambiar", "nop"])) {
      botDice("Sin problema, tu pedido sigue guardado. Decime qué querés cambiar (por ejemplo “sacá las papas” o “agregá 2 pickles”) o tocá una opción.");
      botDice(textoMenu());
      pasarA("elegir");
    } else {
      botDice("Respondeme “sí” para confirmar o “no” para cambiar algo.");
      preguntar();
    }
  }
}

// ---------- Panel del bot (abrir y cerrar) ----------

function abrirPanel() {
  ultimoFoco = document.activeElement;
  porId("panel").hidden = false;
  porId("velo").hidden = false;
  document.body.classList.add("bloqueado");
  if (!conversacionIniciada) saludar();
  bajarChat();
  porId("chatInput").focus();
}

function cerrarPanel() {
  porId("panel").hidden = true;
  porId("velo").hidden = true;
  document.body.classList.remove("bloqueado");
  if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
}

function panelAbierto() {
  return !porId("panel").hidden;
}

// Mantiene el foco del teclado dentro del panel mientras está abierto.
function mantenerFoco(evento) {
  if (evento.key !== "Tab" || !panelAbierto()) return;
  var candidatos = porId("panel").querySelectorAll("button, input, [tabindex='0']");
  var visibles = [];
  for (var i = 0; i < candidatos.length; i++) {
    if (candidatos[i].offsetParent !== null) visibles.push(candidatos[i]);
  }
  if (visibles.length === 0) return;
  var primero = visibles[0];
  var ultimo = visibles[visibles.length - 1];
  if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus(); }
  else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus(); }
}

// ---------- Eventos ----------

function alHacerClick(evento) {
  var boton = evento.target.closest("button");
  if (!boton) return;

  var chip = boton.getAttribute("data-valor");
  if (chip !== null) {
    procesar(chip, boton.textContent);
    porId("chatInput").focus();
    return;
  }

  var id;
  var cambio = 0;
  if ((id = boton.getAttribute("data-agregar"))) cambio = 1;
  else if ((id = boton.getAttribute("data-sumar"))) cambio = 1;
  else if ((id = boton.getAttribute("data-restar"))) cambio = -1;
  if (cambio === 0) return;

  cambiarCantidad(id, cambio);

  // Al redibujar los botones se pierde el foco; lo devolvemos para quien usa teclado.
  var siguiente = document.querySelector('#menu [data-sumar="' + id + '"]') ||
                  document.querySelector('#menu [data-agregar="' + id + '"]');
  if (siguiente) siguiente.focus();
}

function iniciar() {
  // Textos que dependen de la configuración
  document.title = configLocal.nombre + " | Panchos para retirar o pedir a domicilio";
  porId("marcaNombre").textContent = configLocal.nombre;
  porId("pieNombre").textContent = configLocal.nombre;
  porId("visitaBarrio").textContent = configLocal.barrio;
  porId("visitaHorario").textContent = "Todos los días de " + configLocal.horaApertura + " a " + configLocal.horaCierre + " hs";
  porId("visitaDelivery").textContent = formatearPrecio(configLocal.costoDelivery);

  // Si la persona pidió menos movimiento, el bot responde al instante.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    configLocal.retardoBot = 0;
  }

  cargarCarrito();
  cantidadAnterior = totalUnidades();
  refrescarPagina();
  actualizarEstado();
  setInterval(actualizarEstado, 60000);

  document.addEventListener("click", alHacerClick);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panelAbierto()) cerrarPanel();
    mantenerFoco(e);
  });

  var abridores = ["botonAbrirCarrito", "botonPortadaPedido", "botonVisitaPedido", "botonFlotante"];
  for (var i = 0; i < abridores.length; i++) porId(abridores[i]).addEventListener("click", abrirPanel);
  porId("botonCerrarPanel").addEventListener("click", cerrarPanel);
  porId("velo").addEventListener("click", cerrarPanel);

  porId("chatForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var campo = porId("chatInput");
    var texto = campo.value;
    campo.value = "";
    procesar(texto);
  });
}

iniciar();
