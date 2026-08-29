const HUB_URL = "https://hub.beltools.fr/api/v1";
// NOTE: Hub API key is NEXT_PUBLIC because the Hub API has CORS restrictions
// (only allows requests from whitelisted domains) and the key has read-only access.
// A server-side proxy would require refactoring all Hub calls through API routes,
// which is not worth the overhead given the existing CORS protections.
const HUB_KEY = process.env.NEXT_PUBLIC_HUB_API_KEY || "";
const HUB_APP = "dictee-master";

// Types
export interface HubClasse {
  id: string;
  nom: string;
  niveau: string;
  nbEleves: number;
  anneeScolaire?: string; // ex. "26-27"
}

// Année scolaire en cours au format Hub ("26-27") : bascule au 1er août.
export function currentSchoolYear(): string {
  const now = new Date();
  const y = now.getFullYear() % 100;
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// Une classe est « active » si elle est de l'année en cours, si le Hub
// n'indique pas d'année, ou si c'est une classe de test en « T » (6T, 5T…
// où vit l'élève fictif Lambda — indispensable au bouton 🧪 Tester et au
// mode Visiteur, jamais recréées à la rentrée).
export function isCurrentYearClasse(c: HubClasse): boolean {
  if (/^\dT$/i.test(c.nom.trim())) return true;
  return !c.anneeScolaire || c.anneeScolaire === currentSchoolYear();
}

export interface HubEleve {
  id: string;
  nom: string;
  prenom: string;
  actif: boolean;
}

export interface HubResultat {
  id: string;
  eleveId: string;
  app: string;
  exercice: string;
  score: number;
  total: number;
  details: any;
  createdAt: string;
}

// Helper for fetch with API key header
async function hubFetch(path: string, options?: RequestInit) {
  const url = `${HUB_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": HUB_KEY,
    ...options?.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Hub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// GET classes — 6e et 5e (le corpus de dictées existe pour ces deux niveaux)
export async function getClasses(): Promise<HubClasse[]> {
  const [six, cinq] = await Promise.all([
    hubFetch("/classes?niveau=6eme"),
    // Tolérant : si le Hub ne connaît pas encore de 5e, on continue avec les 6e
    hubFetch("/classes?niveau=5eme").catch(() => ({ classes: [] })),
  ]);
  return [...(six.classes || []), ...(cinq.classes || [])];
}

// Classes affectées à un enseignant, d'après sa fiche Hub (liste de NOMS de
// classes, parfois pollués par un id brut — le filtre appelant doit être
// tolérant). Renvoie null si la fiche est introuvable ou vide : dans ce cas
// l'appelant affiche tout (ne jamais bloquer un prof sur une fiche mal remplie).
export async function getEnseignantClasses(enseignantId: string): Promise<string[] | null> {
  try {
    const data = await hubFetch("/enseignants");
    const moi = (data.enseignants || []).find((e: any) => e.id === enseignantId);
    const classes: string[] = moi?.classes || [];
    return classes.length > 0 ? classes : null;
  } catch {
    return null;
  }
}

// GET students of a class
export async function getEleves(classeId: string): Promise<HubEleve[]> {
  const data = await hubFetch(`/classes/${classeId}/eleves?actif=true`);
  return data.eleves || [];
}

// PIN management
export async function checkPin(eleveId: string): Promise<{ hasPin: boolean }> {
  return hubFetch("/eleves/pin", {
    method: "POST",
    body: JSON.stringify({ eleveId, action: "check" }),
  });
}

export async function createPin(eleveId: string, pin: string): Promise<{ success: boolean }> {
  return hubFetch("/eleves/pin", {
    method: "POST",
    body: JSON.stringify({ eleveId, action: "create", pin }),
  });
}

export async function verifyPin(eleveId: string, pin: string): Promise<{ valid: boolean }> {
  return hubFetch("/eleves/pin", {
    method: "POST",
    body: JSON.stringify({ eleveId, action: "verify", pin }),
  });
}

// Save a result
export async function saveResultat(
  eleveId: string,
  exercice: string,
  score: number,
  total: number,
  details?: any
): Promise<void> {
  await hubFetch("/resultats", {
    method: "POST",
    body: JSON.stringify({
      eleveId,
      app: HUB_APP,
      exercice,
      score,
      total,
      details,
    }),
  });
}

// Save an activity
export async function saveActivite(eleveId: string, type: string, data?: any): Promise<void> {
  await hubFetch("/activites", {
    method: "POST",
    body: JSON.stringify({
      eleveId,
      app: HUB_APP,
      type,
      data,
    }),
  });
}

// Get results for a student
export async function getResultats(eleveId: string): Promise<HubResultat[]> {
  const data = await hubFetch(`/resultats?eleve_id=${eleveId}&app=${HUB_APP}`);
  return data.resultats || [];
}

// Get all results for the app
export async function getAllResultats(): Promise<HubResultat[]> {
  const data = await hubFetch(`/resultats?app=${HUB_APP}`);
  return data.resultats || [];
}

// LocalStorage helpers for connected student
const STORAGE_KEY = "dictee_master_eleve";

export interface ConnectedEleve {
  eleveId: string;
  prenom: string;
  nom: string;
  classe: string;
  classeId: string;
}

export function getConnectedEleve(): ConnectedEleve | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setConnectedEleve(eleve: ConnectedEleve): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(eleve));
}

export function disconnectEleve(): void {
  localStorage.removeItem(STORAGE_KEY);
}
