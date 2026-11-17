// =====================================================================
//  CONFIGURACIÓN DEL LOCAL  -  Es lo único que hay que editar.
// =====================================================================

var configLocal = {
  nombre: "Pancho Dorado",
  barrio: "Villa Crespo, CABA",
  // Tiempo de espera que el bot le dice al cliente al confirmar el pedido.
  tiempoEspera: "25 a 35 minutos",
  // Horario de atención (formato 24 hs "HH:MM"). Se usa para el cartel "Abierto / Cerrado".
  horaApertura: "19:30",
  horaCierre: "23:30",
  // Días en que abre: 0 = domingo, 1 = lunes ... 6 = sábado.
  diasAbierto: [0, 1, 2, 3, 4, 5, 6],
  costoDelivery: 1500,
  // Demora (en milisegundos) del "escribiendo..." del bot. 0 = responde al instante.
  retardoBot: 600
};

// Productos del menú. "tipo": "pancho", "extra" o "bebida".
// Si un producto tiene "foto" se muestra como tarjeta; si no, como renglón de lista.
// "grande": true hace que la tarjeta ocupe dos columnas.
var productos = [
  {
    id: "clasico",
    tipo: "pancho",
    nombre: "Clásico",
    descripcion: "Salchicha, pan de viena, mostaza y ketchup.",
    alias: ["clasico", "pancho clasico", "simple", "comun", "normal"],
    precio: 3200,
    foto: "assets/img/clasico",
    alt: "Dos panchos con mostaza y ketchup junto a papas fritas"
  },
  {
    id: "pickle",
    tipo: "pancho",
    nombre: "Pickle",
    descripcion: "Salchicha grillada, pepinillo, cebolla y mostaza.",
    alias: ["pickle", "pepinillo", "pepinillos"],
    precio: 3800,
    foto: "assets/img/pickle",
    alt: "Pancho con pepinillo y cebolla en una bandeja de papel"
  },
  {
    id: "antiguo",
    tipo: "pancho",
    nombre: "Mostaza antigua",
    descripcion: "Salchicha a la parrilla, mostaza antigua y pickles picados.",
    alias: ["mostaza antigua", "antiguo", "antigua"],
    precio: 4200,
    foto: "assets/img/antiguo",
    alt: "Pancho cubierto de mostaza antigua y pickles picados"
  },
  {
    id: "papas",
    tipo: "extra",
    nombre: "Papas fritas",
    descripcion: "Porción para uno, con ketchup.",
    alias: ["papas", "papas fritas", "papitas", "fritas", "papa"],
    precio: 2800,
    foto: "assets/img/papas",
    alt: "Papas fritas con ketchup"
  },
  {
    id: "combo",
    tipo: "pancho",
    nombre: "Combo Dorado",
    descripcion: "Pancho clásico, papas fritas y una gaseosa de 500 ml.",
    alias: ["combo", "combo dorado"],
    precio: 6900,
    foto: "assets/img/combo",
    alt: "Pancho con mostaza y relish junto a papas fritas y ensalada",
    grande: true
  },
  { id: "gaseosa", tipo: "bebida", nombre: "Gaseosa 500 ml", descripcion: "Cola, lima limón o naranja.", alias: ["gaseosa", "coca", "cola", "sprite", "fanta", "refresco", "lima limon", "naranja"], precio: 1800 },
  { id: "agua", tipo: "bebida", nombre: "Agua mineral 500 ml", descripcion: "Con o sin gas.", alias: ["agua", "agua mineral", "agua con gas", "agua sin gas"], precio: 1500 },
  { id: "cerveza", tipo: "bebida", nombre: "Cerveza 473 ml", descripcion: "Rubia, solo para mayores de 18.", alias: ["cerveza", "birra", "rubia", "chopp"], precio: 3000 }
];
