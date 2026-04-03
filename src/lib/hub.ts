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

// GET classes for 6eme
export async function getClasses(): Promise<HubClasse[]> {
  const data = await hubFetch("/classes?niveau=6eme");
  return data.classes || [];
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
