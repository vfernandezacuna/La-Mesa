export type QuoteTag = "munger" | "buffett" | "estoico" | "artedeguerra" | "biografia";

export interface Quote {
  t: QuoteTag;
  text: string;
  src: string;
}

const reflections: Quote[] = [
  // --- Charlie Munger (8) ---
  { t: "munger", text: "Es notable cuánta ventaja de largo plazo hemos conseguido personas como nosotros con solo tratar de no ser tontos de forma consistente, en vez de tratar de ser muy inteligentes.", src: "Charlie Munger" },
  { t: "munger", text: "El dinero grande no está en comprar y vender, sino en esperar.", src: "Charlie Munger" },
  { t: "munger", text: "Pasa cada día tratando de ser un poco más sabio de lo que eras al despertar.", src: "Charlie Munger" },
  { t: "munger", text: "Constantemente veo triunfar en la vida a personas que no son las más inteligentes, a veces ni las más disciplinadas, pero son máquinas de aprender.", src: "Charlie Munger" },
  { t: "munger", text: "Saber lo que no sabes es más útil que ser brillante.", src: "Charlie Munger" },
  { t: "munger", text: "En toda mi vida no he conocido a ninguna persona sabia que no leyera constantemente — ninguna, cero.", src: "Charlie Munger" },
  { t: "munger", text: "Lo mejor que puede hacer un ser humano es ayudar a otro ser humano a saber más.", src: "Charlie Munger" },
  { t: "munger", text: "Reconocer lo que no sabes es el amanecer de la sabiduría.", src: "Charlie Munger" },
  // --- Warren Buffett (8) ---
  { t: "buffett", text: "El precio es lo que pagas. El valor es lo que obtienes.", src: "Warren Buffett" },
  { t: "buffett", text: "Sé temeroso cuando otros son codiciosos, y codicioso cuando otros son temerosos.", src: "Warren Buffett" },
  { t: "buffett", text: "Es mucho mejor comprar una empresa maravillosa a un precio justo que una empresa justa a un precio maravilloso.", src: "Warren Buffett" },
  { t: "buffett", text: "Alguien está sentado hoy a la sombra porque alguien plantó un árbol hace mucho tiempo.", src: "Warren Buffett" },
  { t: "buffett", text: "El riesgo viene de no saber lo que estás haciendo.", src: "Warren Buffett" },
  { t: "buffett", text: "La inversión más importante que puedes hacer es en ti mismo.", src: "Warren Buffett" },
  { t: "buffett", text: "Toma veinte años construir una reputación y cinco minutos arruinarla.", src: "Warren Buffett" },
  { t: "buffett", text: "Regla número 1: nunca pierdas dinero. Regla número 2: nunca olvides la regla número 1.", src: "Warren Buffett" },
  // --- Estoico (8) ---
  { t: "estoico", text: "No es lo que te sucede, sino cómo reaccionas ante ello lo que importa.", src: "Epicteto" },
  { t: "estoico", text: "Tienes poder sobre tu mente, no sobre los eventos externos. Date cuenta de esto y encontrarás fuerza.", src: "Marco Aurelio, Meditaciones" },
  { t: "estoico", text: "El hombre no se perturba por las cosas, sino por la opinión que tiene de las cosas.", src: "Epicteto" },
  { t: "estoico", text: "La suerte es lo que sucede cuando la preparación se encuentra con la oportunidad.", src: "Séneca" },
  { t: "estoico", text: "No es que tengamos poco tiempo, sino que perdemos mucho.", src: "Séneca, Sobre la brevedad de la vida" },
  { t: "estoico", text: "El obstáculo en el camino se convierte en el camino. Dentro de cada dificultad hay una oportunidad de avanzar.", src: "Marco Aurelio, Meditaciones" },
  { t: "estoico", text: "Primero dite a ti mismo qué quieres ser; luego haz lo que tengas que hacer.", src: "Epicteto" },
  { t: "estoico", text: "Que tus principios sean como faros: fijos, mientras el mundo cambia a tu alrededor.", src: "Marco Aurelio, Meditaciones" },
  // --- El arte de la guerra, Sun Tzu (8) ---
  { t: "artedeguerra", text: "Conoce a tu enemigo y conócete a ti mismo; en cien batallas, nunca saldrás derrotado.", src: "Sun Tzu, El arte de la guerra" },
  { t: "artedeguerra", text: "La oportunidad de vencer al enemigo te la da el enemigo mismo.", src: "Sun Tzu, El arte de la guerra" },
  { t: "artedeguerra", text: "El supremo arte de la guerra es someter al enemigo sin luchar.", src: "Sun Tzu, El arte de la guerra" },
  { t: "artedeguerra", text: "Todo el arte de la guerra se basa en el engaño.", src: "Sun Tzu, El arte de la guerra" },
  { t: "artedeguerra", text: "En medio del caos, hay también oportunidad.", src: "Sun Tzu, El arte de la guerra" },
  { t: "artedeguerra", text: "El general que gana la batalla hace muchos cálculos en su templo antes de que se libre la batalla.", src: "Sun Tzu, El arte de la guerra" },
  { t: "artedeguerra", text: "Si conoces al enemigo y te conoces a ti mismo, no debes temer el resultado de cien batallas.", src: "Sun Tzu, El arte de la guerra" },
  { t: "artedeguerra", text: "La rapidez es la esencia de la guerra.", src: "Sun Tzu, El arte de la guerra" },
  // --- Grandes biografías (8) ---
  { t: "biografia", text: "La forma de hacer dinero es comprar cuando la sangre corre por las calles.", src: "John D. Rockefeller, citado en Titán (Ron Chernow)" },
  { t: "biografia", text: "Creo que el poder de hacer dinero es un don de Dios.", src: "John D. Rockefeller, citado en Titán (Ron Chernow)" },
  { t: "biografia", text: "La unicidad de propósito es una de las cualidades esenciales para el éxito en la vida, sin importar cuál sea la meta.", src: "John D. Rockefeller, citado en Titán (Ron Chernow)" },
  { t: "biografia", text: "Aquellos que no pueden gobernarse a sí mismos según la razón, necesitan ser gobernados por otros.", src: "Alexander Hamilton, citado en Hamilton (Ron Chernow)" },
  { t: "biografia", text: "No dejes de lado el crédito hasta que hayas visto todo lo que puede hacer por ti.", src: "Alexander Hamilton, citado en Hamilton (Ron Chernow)" },
  { t: "biografia", text: "La diligencia es la madre de la buena suerte.", src: "Benjamin Franklin, citado en Benjamin Franklin (Walter Isaacson)" },
  { t: "biografia", text: "El trabajo va a llenar gran parte de tu vida, y la única forma de estar plenamente satisfecho es hacer lo que consideras un gran trabajo.", src: "Steve Jobs, citado en Steve Jobs (Walter Isaacson)" },
  { t: "biografia", text: "No hay victoria a bajo costo. Cuando llega, llega con esfuerzo, y merece la pena por lo mismo que costó.", src: "Theodore Roosevelt, citado en The Rise of Theodore Roosevelt (Edmund Morris)" },
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
  munger: "Munger",
  buffett: "Buffett",
  estoico: "Estoico",
  artedeguerra: "Arte de la guerra",
  biografia: "Biografía",
};

export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}
