export type QuoteTag =
  | "estoico"
  | "biblia"
  | "estrategia"
  | "historia"
  | "filosofia"
  | "proverbio";

export interface Quote {
  t: QuoteTag;
  text: string;
  src: string;
}

const reflections: Quote[] = [
  // --- Estoico (8) ---
  { t: "estoico", text: "No es lo que te sucede, sino cómo reaccionas ante ello lo que importa.", src: "Epicteto" },
  { t: "estoico", text: "Tienes poder sobre tu mente, no sobre los eventos externos. Date cuenta de esto y encontrarás fuerza.", src: "Marco Aurelio, Meditaciones" },
  { t: "estoico", text: "El hombre no se perturba por las cosas, sino por la opinión que tiene de las cosas.", src: "Epicteto" },
  { t: "estoico", text: "La suerte es lo que sucede cuando la preparación se encuentra con la oportunidad.", src: "Séneca" },
  { t: "estoico", text: "No es que tengamos poco tiempo, sino que perdemos mucho.", src: "Séneca, Sobre la brevedad de la vida" },
  { t: "estoico", text: "El obstáculo en el camino se convierte en el camino. Dentro de cada dificultad hay una oportunidad de avanzar.", src: "Marco Aurelio, Meditaciones" },
  { t: "estoico", text: "Primero dite a ti mismo qué quieres ser; luego haz lo que tengas que hacer.", src: "Epicteto" },
  { t: "estoico", text: "Que tus principios sean como faros: fijos, mientras el mundo cambia a tu alrededor.", src: "Marco Aurelio, Meditaciones" },
  // --- Bíblico (8) ---
  { t: "biblia", text: "Todo lo puedo en Cristo que me fortalece.", src: "Filipenses 4:13" },
  { t: "biblia", text: "Fíate del Señor de todo tu corazón, y no te apoyes en tu propia prudencia.", src: "Proverbios 3:5" },
  { t: "biblia", text: "El corazón del hombre traza su rumbo, pero el Señor dirige sus pasos.", src: "Proverbios 16:9" },
  { t: "biblia", text: "Esfuérzate y sé valiente; no temas ni desmayes, porque el Señor tu Dios estará contigo dondequiera que vayas.", src: "Josué 1:9" },
  { t: "biblia", text: "El que es fiel en lo muy poco, también en lo más es fiel.", src: "Lucas 16:10" },
  { t: "biblia", text: "Todo lo que hagas, hazlo de corazón, como para el Señor y no para los hombres.", src: "Colosenses 3:23" },
  { t: "biblia", text: "Como el hierro se afila con el hierro, así el hombre se afina en el trato con su prójimo.", src: "Proverbios 27:17" },
  { t: "biblia", text: "No os afanéis por el día de mañana, porque el día de mañana traerá su afán.", src: "Mateo 6:34" },
  // --- Estrategia y liderazgo (8) ---
  { t: "estrategia", text: "El precio de la grandeza es la responsabilidad.", src: "Winston Churchill" },
  { t: "estrategia", text: "La estrategia sin táctica es el camino más lento a la victoria; la táctica sin estrategia es el ruido antes de la derrota.", src: "Sun Tzu" },
  { t: "estrategia", text: "Lo importante rara vez es urgente, y lo urgente rara vez es importante.", src: "Dwight D. Eisenhower" },
  { t: "estrategia", text: "El riesgo viene de no saber lo que estás haciendo.", src: "Warren Buffett" },
  { t: "estrategia", text: "La oportunidad favorece a la mente preparada.", src: "Louis Pasteur" },
  { t: "estrategia", text: "No busques al hombre brillante; busca al que evita los errores tontos de forma consistente.", src: "Charlie Munger" },
  { t: "estrategia", text: "En medio de la dificultad yace la oportunidad.", src: "Albert Einstein" },
  { t: "estrategia", text: "La calidad de tu vida es la calidad de tus decisiones repetidas.", src: "principio de gestión" },
  // --- Historia y estadistas (8) ---
  { t: "historia", text: "El éxito no es definitivo, el fracaso no es fatal: lo que cuenta es el valor para continuar.", src: "Winston Churchill" },
  { t: "historia", text: "Casi todos los hombres pueden soportar la adversidad, pero si quieres probar el carácter de un hombre, dale poder.", src: "Abraham Lincoln" },
  { t: "historia", text: "La mejor manera de predecir el futuro es crearlo.", src: "atribuido a Abraham Lincoln" },
  { t: "historia", text: "No midas tu vida por lo que has cosechado, sino por las semillas que has plantado.", src: "proverbio de estadista" },
  { t: "historia", text: "Un hombre que no arriesga nada por sus ideas, o no valen nada sus ideas, o no vale nada él.", src: "atribuido a Martin Luther King Jr." },
  { t: "historia", text: "La libertad no vale nada si no incluye la libertad de equivocarse.", src: "Mahatma Gandhi" },
  { t: "historia", text: "Nunca se llega tan lejos como cuando no se sabe hacia dónde se va.", src: "Napoleón Bonaparte" },
  { t: "historia", text: "El pesimista ve dificultad en cada oportunidad; el optimista, oportunidad en cada dificultad.", src: "Winston Churchill" },
  // --- Filosofía práctica (8) ---
  { t: "filosofia", text: "Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto sino un hábito.", src: "Aristóteles" },
  { t: "filosofia", text: "La vida no examinada no merece ser vivida.", src: "Sócrates" },
  { t: "filosofia", text: "El que tiene un porqué para vivir puede soportar casi cualquier cómo.", src: "Friedrich Nietzsche" },
  { t: "filosofia", text: "Nada da tanta paz como decidir, aunque sea una vez, dejar de intentar lo imposible.", src: "Montaigne" },
  { t: "filosofia", text: "Un viaje de mil millas comienza con un solo paso.", src: "Lao Tsé" },
  { t: "filosofia", text: "El que conoce a los demás es sabio; el que se conoce a sí mismo está iluminado.", src: "Lao Tsé" },
  { t: "filosofia", text: "No es rico quien más tiene, sino quien menos necesita.", src: "Epicuro" },
  { t: "filosofia", text: "El que tiene salud tiene esperanza, y el que tiene esperanza lo tiene todo.", src: "proverbio de Tales de Mileto" },
  // --- Proverbios del mundo (8) ---
  { t: "proverbio", text: "Si quieres llegar rápido, ve solo; si quieres llegar lejos, ve acompañado.", src: "Proverbio africano" },
  { t: "proverbio", text: "La visión sin acción es un sueño; la acción sin visión es una pesadilla.", src: "Proverbio japonés" },
  { t: "proverbio", text: "Cae siete veces, levántate ocho.", src: "Proverbio japonés" },
  { t: "proverbio", text: "El bambú que se dobla es más fuerte que el roble que resiste.", src: "Proverbio japonés" },
  { t: "proverbio", text: "Poco a poco se anda lejos.", src: "Proverbio latinoamericano" },
  { t: "proverbio", text: "No cuentes los días, haz que los días cuenten.", src: "Proverbio popular" },
  { t: "proverbio", text: "El mejor momento para plantar un árbol fue hace veinte años; el segundo mejor momento es ahora.", src: "Proverbio chino" },
  { t: "proverbio", text: "La marea baja muestra quién nadaba desnudo.", src: "Proverbio del mundo financiero" },
];

// Entrelaza las reflexiones por categoría para que la rotación diaria
// alterne entre tipos en vez de mostrar 8 seguidas de la misma.
export const reflectionsMixed: Quote[] = (function () {
  const byCat: Record<string, Quote[]> = {};
  reflections.forEach((q) => {
    (byCat[q.t] = byCat[q.t] || []).push(q);
  });
  const cats = Object.keys(byCat);
  const maxLen = Math.max(...cats.map((c) => byCat[c].length));
  const out: Quote[] = [];
  for (let i = 0; i < maxLen; i++) {
    cats.forEach((c) => {
      if (byCat[c][i]) out.push(byCat[c][i]);
    });
  }
  return out;
})();

export const quoteTagLabels: Record<QuoteTag, string> = {
  estoico: "Estoico",
  biblia: "Bíblico",
  estrategia: "Estrategia",
  historia: "Historia",
  filosofia: "Filosofía",
  proverbio: "Proverbio",
};

export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}
