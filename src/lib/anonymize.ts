import { create } from "zustand";

// Écrivain(e)s célèbres francophones et internationaux
const FEMMES = [
  "George Sand", "Simone de Beauvoir", "Marguerite Duras", "Colette",
  "Agatha Christie", "Virginia Woolf", "Jane Austen", "Toni Morrison",
  "Marguerite Yourcenar", "Assia Djebar", "Maryse Condé", "Annie Ernaux",
  "Nathalie Sarraute", "Amélie Nothomb", "Leïla Slimani",
];

const HOMMES = [
  "Victor Hugo", "Albert Camus", "Molière", "Voltaire",
  "Alexandre Dumas", "Émile Zola", "Antoine de Saint-Exupéry", "Jules Verne",
  "Marcel Proust", "Aimé Césaire", "Léopold Sédar Senghor", "Tahar Ben Jelloun",
  "Albert Memmi", "André Malraux", "Romain Gary",
];

// Prénoms féminins courants (pour la détection du genre)
const PRENOMS_FEMININS = new Set([
  "léa", "emma", "chloé", "jade", "manon", "camille", "sarah", "inès",
  "zoé", "lina", "clara", "alice", "anna", "louise", "léna", "mila",
  "lola", "luna", "ambre", "rose", "juliette", "agathe", "margot",
  "charlotte", "victoria", "maëlys", "nour", "yasmine", "fatima", "aya",
  "sofia", "nina", "eva", "lily", "marie", "lucie", "océane", "mathilde",
  "romane", "gabrielle", "elsa", "célia", "mélissa", "laura", "noémie",
  "justine", "anaïs", "pauline", "marine", "eloïse",
]);

function isFeminin(prenom: string): boolean {
  return PRENOMS_FEMININS.has(prenom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

interface AnonymizeState {
  active: boolean;
  map: Record<string, string>;
  toggle: (names: string[]) => void;
}

export const useAnonymize = create<AnonymizeState>((set, get) => ({
  active: false,
  map: {},
  toggle: (names: string[]) => {
    const state = get();
    if (state.active) {
      set({ active: false, map: {} });
      return;
    }
    const map: Record<string, string> = {};
    let fi = 0, mi = 0;
    for (const name of names) {
      const prenom = name.split(" ")[0] || "";
      if (isFeminin(prenom)) {
        map[name] = FEMMES[fi % FEMMES.length];
        fi++;
      } else {
        map[name] = HOMMES[mi % HOMMES.length];
        mi++;
      }
    }
    set({ active: true, map });
  },
}));

export function useDisplayName() {
  const active = useAnonymize((s) => s.active);
  const map = useAnonymize((s) => s.map);
  return (name: string) => (active ? map[name] || name : name);
}
