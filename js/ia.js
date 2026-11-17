// =====================================================================
//  "Mini IA" del bot: entiende frases escritas como habla la gente.
//  No usa servicios externos ni internet: son reglas de lenguaje
//  (sinónimos, errores de tipeo, números en letras, verbos) que
//  convierten una frase en datos que el bot puede usar.
//
//  Ejemplo:
//   "quiero 2 clasicos y una coca para retirar, a nombre de Juan"
//   -> items: 2 x Clásico, 1 x Gaseosa / modalidad: retiro / nombre: Juan
//
//  Usa la lista "productos" de js/config.js (con sus "alias").
// =====================================================================

var palabrasNumero = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, par: 2, docena: 12
};

var verbosQuitar = ["saca", "sacar", "sacame", "saque", "quita", "quitar", "quitame", "elimina", "eliminar", "borra", "borrar", "cancela", "cancelar"];
var verbosFijar = ["cambia", "cambiar", "cambiame", "deja", "dejame", "dejalo", "mejor", "pasalo", "pasame"];

// Pasa a minúsculas, saca tildes y signos para poder comparar lo que escribe el cliente.
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(palabra) {
  if (palabra.length > 3 && palabra.charAt(palabra.length - 1) === "s") return palabra.slice(0, -1);
  return palabra;
}

function listaDePalabras(textoNormalizado) {
  var partes = textoNormalizado.split(" ");
  var resultado = [];
  for (var i = 0; i < partes.length; i++) {
    if (partes[i] !== "") resultado.push(singular(partes[i]));
  }
  return resultado;
}

function esta(lista, palabra) {
  return lista.indexOf(palabra) !== -1;
}

// Cantidad de letras que hay que cambiar para pasar de una palabra a otra (detecta errores de tipeo).
function distancia(a, b) {
  var fila = [];
  var i, j;
  for (j = 0; j <= b.length; j++) fila[j] = j;
  for (i = 1; i <= a.length; i++) {
    var anterior = fila[0];
    fila[0] = i;
    for (j = 1; j <= b.length; j++) {
      var guardado = fila[j];
      var costo = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + costo);
      anterior = guardado;
    }
  }
  return fila[b.length];
}

// Busca qué producto nombra un texto (ya normalizado). Devuelve el producto o null.
function buscarProductoEnTexto(textoNormalizado) {
  var palabras = listaDePalabras(textoNormalizado);
  var unido = " " + palabras.join(" ") + " ";
  var mejor = null;
  var mejorPuntaje = 0;

  for (var i = 0; i < productos.length; i++) {
    var nombres = (productos[i].alias || []).concat([normalizar(productos[i].nombre)]);
    for (var j = 0; j < nombres.length; j++) {
      var palabrasAlias = listaDePalabras(normalizar(nombres[j]));
      var puntaje = 0;

      if (unido.indexOf(" " + palabrasAlias.join(" ") + " ") !== -1) {
        puntaje = palabrasAlias.join("").length + 2;
      } else if (palabrasAlias.length === 1 && palabrasAlias[0].length >= 5) {
        // Errores de tipeo: "clasicoo", "pikle"
        var margen = palabrasAlias[0].length >= 8 ? 2 : 1;
        for (var k = 0; k < palabras.length; k++) {
          if (palabras[k].length >= 5 && distancia(palabras[k], palabrasAlias[0]) <= margen) {
            puntaje = palabrasAlias[0].length - 1;
          }
        }
      }
      if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = productos[i]; }
    }
  }

  // "pancho" a secas se entiende como el clásico
  if (!mejor && esta(palabras, "pancho")) return productos[0];
  return mejor;
}

// Devuelve { cantidad, explicita } del segmento: "2", "x2", "dos", "media docena"...
function buscarCantidad(textoNormalizado) {
  if (textoNormalizado.indexOf("media docena") !== -1) return { cantidad: 6, explicita: true };
  var partes = textoNormalizado.split(" ");
  for (var i = 0; i < partes.length; i++) {
    var limpio = partes[i].replace(/^x/, "").replace(/x$/, "");
    if (/^\d+$/.test(limpio)) return { cantidad: parseInt(limpio, 10), explicita: true };
    if (palabrasNumero[partes[i]] !== undefined) return { cantidad: palabrasNumero[partes[i]], explicita: true };
  }
  return { cantidad: 1, explicita: false };
}

function algunaPalabra(palabras, lista) {
  for (var i = 0; i < lista.length; i++) {
    if (esta(palabras, lista[i])) return true;
  }
  return false;
}

// Separa una frase en partes: "2 clasicos, una coca y papas" -> 3 partes
function separarPartes(texto) {
  return texto.split(/,|;|\+|\s+y\s+|\s+e\s+|\s+m[aá]s\s+/i);
}

// Saca nombre, dirección y modalidad de la frase original (con mayúsculas y tildes).
function buscarDatos(texto, normalizado) {
  var datos = { modalidad: "", nombre: "", direccion: "", notas: "" };
  var encontrado;

  encontrado = texto.match(/(?:a nombre de|me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i);
  if (encontrado) {
    var palabrasNombre = encontrado[1].split(/\s+/);
    var cortes = ["para", "con", "y", "en", "a", "por", "que", "quiero"];
    var nombre = [];
    for (var i = 0; i < palabrasNombre.length; i++) {
      if (cortes.indexOf(palabrasNombre[i].toLowerCase()) !== -1) break;
      nombre.push(palabrasNombre[i]);
    }
    datos.nombre = nombre.join(" ");
  }

  encontrado = texto.match(/(?:vivo en|mi direccion es|mi dirección es|direccion|dirección|mandalo a|mandamelo a|envialo a|enviamelo a|llevalo a|llevamelo a|entregar en|entregalo en|delivery (?:a|en)|envio (?:a|en)|domicilio (?:a|en))\s*:?\s+(.{5,80})$/i);
  if (encontrado) {
    // La dirección termina donde empieza otro dato ("..., soy Tomas")
    var direccion = encontrado[1].split(/,|\s+(?:a nombre de|me llamo|soy|y soy)\s/i)[0].trim();
    if (direccion.length >= 5) datos.direccion = direccion;
  }

  var palabras = listaDePalabras(normalizado);
  var quiereDelivery = algunaPalabra(palabras, ["delivery", "envio", "domicilio", "casa", "envien", "enviar", "mandalo", "mandamelo", "llevalo", "llevamelo"]) ||
    datos.direccion !== "";
  var quiereRetiro = algunaPalabra(palabras, ["retiro", "retirar", "retiro", "busco", "buscar", "buscarlo", "paso"]) ||
    normalizado.indexOf("take away") !== -1 || normalizado.indexOf("por el local") !== -1;
  if (quiereDelivery && !quiereRetiro) datos.modalidad = "delivery";
  else if (quiereRetiro && !quiereDelivery) datos.modalidad = "retiro";

  var sin = normalizado.match(/\bsin [a-z]+( ni [a-z]+)?/);
  if (sin) datos.notas = sin[0];

  return datos;
}

// Analiza una frase completa y devuelve todo lo que se pudo entender.
function analizarTexto(texto) {
  var normalizado = normalizar(texto);
  var palabras = listaDePalabras(normalizado);
  var resultado = {
    items: [],
    hayCantidadExplicita: false,
    hayVerbo: false,
    producto: buscarProductoEnTexto(normalizado),
    datos: buscarDatos(texto, normalizado),
    terminar: false,
    precio: false,
    ingredientes: false,
    total: false,
    recomendar: false,
    irA: "",
    resaltar: false,
    saludo: false,
    gracias: false,
    ayuda: false
  };

  // --- Preguntas y pedidos a la página ---
  resultado.precio = /cuanto (sale|cuesta|vale|cuestan|salen)|que precio|precio d/.test(normalizado);
  resultado.ingredientes = /(que|q) (tiene|lleva|trae|incluye)|ingredientes|de que (es|esta)/.test(normalizado);
  resultado.total = !resultado.producto && /cuanto (llevo|va|es|seria|me sale|queda|debo)|cual es el total|el total|la cuenta/.test(normalizado);
  resultado.recomendar = /recomend|suger|que me conviene|aconsej|mas pedido|lo mejor|sorprend|que (pido|pedir|elijo)/.test(normalizado);
  resultado.terminar = /eso es todo|nada mas|eso nomas|terminar|cerrar el pedido|ya esta|listo|finalizar/.test(normalizado);
  resultado.saludo = /^(hola|buenas|buen dia|buenas tardes|buenas noches|hey|holis|que tal)\b/.test(normalizado);
  resultado.gracias = /\b(gracias|muchas gracias|genial|buenisimo|perfecto)\b/.test(normalizado);
  resultado.ayuda = /\bayuda\b|que (podes|puedes|sabes) hacer|como funciona|como te uso/.test(normalizado);

  if (/donde (estan|queda|esta)|ubicacion|como llego|como llegar|direccion del local|que barrio/.test(normalizado)) {
    resultado.irA = "visita";
  } else if (/(llevame|ir a|ir al|anda a|anda al|bajame|subime|mostrame en la pagina|ver en la pagina).*(menu|carta|panchos|productos)/.test(normalizado)) {
    resultado.irA = "menu";
  } else if (/(llevame|ir a|ir al|mostrame).*(como pedir|pasos)/.test(normalizado)) {
    resultado.irA = "como";
  }
  if (resultado.producto && /(foto|donde esta|mostrame|mostra|ver el|ver la|enseñame)/.test(normalizado) && !/(quiero|agrega|sumame|dame|ponme)/.test(normalizado)) {
    resultado.resaltar = true;
    if (resultado.irA === "") resultado.irA = "menu";
  }

  // --- Productos y cantidades ---
  var partes = separarPartes(texto);
  var accionHeredada = "agregar";
  for (var i = 0; i < partes.length; i++) {
    var parte = normalizar(partes[i]);
    if (parte === "") continue;
    var palabrasParte = listaDePalabras(parte);

    var accion = accionHeredada;
    if (algunaPalabra(palabrasParte, verbosQuitar) || parte.indexOf("no quiero") !== -1) {
      accion = "quitar";
      resultado.hayVerbo = true;
    } else if (algunaPalabra(palabrasParte, verbosFijar) || parte.indexOf("en vez") !== -1) {
      accion = "fijar";
      resultado.hayVerbo = true;
    } else if (algunaPalabra(palabrasParte, ["agrega", "agregar", "agregame", "suma", "sumame", "sumar", "pone", "poneme", "ponme", "dame", "quiero", "queria", "quisiera", "necesito", "pedime", "anota", "anotame"])) {
      accion = "agregar";
      resultado.hayVerbo = true;
    }
    accionHeredada = accion;

    var producto = buscarProductoEnTexto(parte);
    if (!producto) continue;

    var cantidad = buscarCantidad(parte);
    if (cantidad.explicita) resultado.hayCantidadExplicita = true;
    resultado.items.push({
      producto: producto,
      cantidad: cantidad.cantidad,
      explicita: cantidad.explicita,
      accion: accion
    });
  }

  return resultado;
}
