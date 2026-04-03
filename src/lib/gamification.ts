// Badges for DictéeMaster (orthography-themed)
export const BADGES = [
  { id: "premier-pas", name: "Premier pas", emoji: "🎯", desc: "Terminé une première dictée" },
  { id: "perseverant", name: "Persévérant", emoji: "💪", desc: "10+ tentatives sur une dictée" },
  { id: "progresseur", name: "Progresseur", emoji: "📈", desc: "3+ améliorations de score" },
  { id: "zero-faute", name: "Zéro faute", emoji: "💯", desc: "Score parfait sur une dictée" },
  { id: "regulier", name: "Régulier", emoji: "🔥", desc: "7 jours de suite" },
  { id: "marathonien", name: "Marathonien", emoji: "🏃", desc: "50+ tentatives au total" },
  { id: "explorateur", name: "Explorateur", emoji: "🗺️", desc: "Travaillé 10+ dictées différentes" },
  { id: "polyglotte", name: "Polyglotte", emoji: "📚", desc: "Complété les 5 activités d'une dictée" },
];

// Check which badges a student has earned
export function computeBadges(stats: {
  totalAttempts: number;
  dicteesTried: number;
  perfectCount: number;
  improvementCount: number;
  streak: number;
  completedParcours: number; // dictées where all 5 activities done
  maxAttemptsOnOne: number; // max attempts on a single dictée
}): string[] {
  const earned: string[] = [];
  if (stats.dicteesTried >= 1) earned.push("premier-pas");
  if (stats.maxAttemptsOnOne >= 10) earned.push("perseverant");
  if (stats.improvementCount >= 3) earned.push("progresseur");
  if (stats.perfectCount >= 1) earned.push("zero-faute");
  if (stats.streak >= 7) earned.push("regulier");
  if (stats.totalAttempts >= 50) earned.push("marathonien");
  if (stats.dicteesTried >= 10) earned.push("explorateur");
  if (stats.completedParcours >= 1) earned.push("polyglotte");
  return earned;
}

// Mastery levels
export function getMasteryLevel(note20: number): { name: string; emoji: string } {
  if (note20 >= 17) return { name: "Excellence", emoji: "🏆" };
  if (note20 >= 13) return { name: "Bien", emoji: "👍" };
  if (note20 >= 9) return { name: "En progrès", emoji: "📈" };
  return { name: "À encourager", emoji: "💪" };
}

// Perseverance level based on total attempts
export function getPerseveranceLevel(attempts: number): { name: string; emoji: string } {
  if (attempts >= 30) return { name: "Très engagé", emoji: "🌲" };
  if (attempts >= 16) return { name: "Motivé", emoji: "🌳" };
  if (attempts >= 6) return { name: "Déterminé", emoji: "🌿" };
  return { name: "Apprenti", emoji: "🌱" };
}

// XP System
export function computeXP(results: { score: number; total: number; isNewRecord: boolean; streak: number }[]): number {
  let xp = 0;
  for (const r of results) {
    xp += r.score * 10; // 10 XP per correct answer
    xp += 20; // 20 XP completion bonus
    if (r.isNewRecord) xp += 50; // 50 XP for new personal best
    if (r.streak >= 3) xp = Math.round(xp * 1.1); // 10% streak bonus
  }
  return xp;
}

// Simple XP calculation from results
export function computeXPFromStats(totalCorrect: number, totalAttempts: number, perfectCount: number): number {
  return (totalCorrect * 10) + (totalAttempts * 20) + (perfectCount * 50);
}

// Levels (5 levels like MathExpress)
export const LEVELS = [
  { name: "Débutant", emoji: "🌱", minXP: 0 },
  { name: "Apprenti", emoji: "📘", minXP: 100 },
  { name: "Rédacteur", emoji: "✍️", minXP: 300 },
  { name: "Expert", emoji: "🎯", minXP: 600 },
  { name: "Maître", emoji: "👑", minXP: 1000 },
];

export function getLevel(xp: number): { name: string; emoji: string } {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
}

// Stars (0-3 based on percentage, like MathExpress)
export function getStarsCount(bestPct: number): number {
  if (bestPct >= 90) return 3;
  if (bestPct >= 70) return 2;
  if (bestPct >= 40) return 1;
  return 0;
}

export function renderStars(bestPct: number): string {
  const s = getStarsCount(bestPct);
  if (s === 0) return "";
  return "⭐".repeat(s);
}

// Auto-appreciation generator
export function generateAppreciation(params: {
  totalAttempts: number;
  dicteesTried: number;
  totalDictees: number;
  avgBestPct: number; // average best percentage across dictées
  perfectCount: number;
  improvementCount: number;
  streak: number;
  weakDictees: number[]; // dictée positions with score < 50%
  strongDictees: number[]; // dictée positions with score >= 80%
}): string {
  const parts: string[] = [];
  const { totalAttempts, dicteesTried, totalDictees, avgBestPct, perfectCount, improvementCount, streak, weakDictees, strongDictees } = params;

  if (totalAttempts === 0) {
    return "L'élève n'a pas encore commencé à s'entraîner. Il faut se lancer !";
  }

  // Part 1: Investment
  if (totalAttempts >= 30) {
    parts.push(`Très bon investissement avec ${totalAttempts} essais sur ${dicteesTried} dictées.`);
  } else if (totalAttempts >= 10) {
    parts.push(`${totalAttempts} essais réalisés sur ${dicteesTried} dictées, c'est un bon début.`);
  } else {
    parts.push(`Seulement ${totalAttempts} essais pour l'instant, il faut s'entraîner davantage.`);
  }

  // Part 2: Performance
  const avgScore15 = Math.round(avgBestPct * 15 / 100);
  if (avgBestPct >= 85) {
    parts.push(`Excellent niveau en orthographe (${avgScore15}/15 en moyenne).`);
    if (perfectCount > 0) parts.push(`${perfectCount} dictée${perfectCount > 1 ? "s" : ""} sans faute, bravo !`);
  } else if (avgBestPct >= 60) {
    parts.push(`Niveau satisfaisant (${avgScore15}/15 en moyenne).`);
    if (weakDictees.length > 0) parts.push(`Attention aux dictées ${weakDictees.map(d => "n°" + d).join(", ")} qui restent fragiles.`);
    parts.push("Avec un peu plus de régularité, les résultats vont encore progresser.");
  } else if (avgBestPct >= 35) {
    parts.push(`Des bases à consolider (${avgScore15}/15 en moyenne).`);
    if (strongDictees.length > 0) parts.push(`De bons résultats sur les dictées ${strongDictees.map(d => "n°" + d).join(", ")}, c'est encourageant.`);
    parts.push("Il faut persévérer, quelques minutes chaque jour font la différence.");
  } else {
    parts.push(`Des difficultés importantes (${avgScore15}/15 en moyenne).`);
    parts.push("Reprendre les premières dictées en mode flashcard, sans pression.");
  }

  // Part 3: Progress
  if (improvementCount >= 5) parts.push("La progression est régulière et encourageante.");
  else if (improvementCount >= 2) parts.push("Des progrès sont visibles, il faut continuer sur cette lancée.");

  // Part 4: Regularity
  if (streak >= 7) parts.push(`Excellent travail au quotidien (${streak} jours de suite).`);
  else if (streak >= 3) parts.push(`Bonne régularité ces derniers jours (${streak} jours de suite).`);
  else if (totalAttempts >= 5 && streak === 0) parts.push("Il faudrait reprendre un entraînement régulier.");

  // Part 5: Exploration
  if (dicteesTried < totalDictees && avgBestPct >= 60) {
    parts.push(`Il reste ${totalDictees - dicteesTried} dictées à découvrir !`);
  }

  return parts.join(" ");
}

// Certificate levels
export const CERT_LEVELS = [
  { id: "excellence", name: "Certificat d'Excellence", emoji: "🏆", minNote: 17, mention: "Mention Or" },
  { id: "maitrise", name: "Certificat de Maîtrise", emoji: "🥈", minNote: 13, mention: "Mention Argent" },
  { id: "reussite", name: "Certificat de Réussite", emoji: "🥉", minNote: 9, mention: "Mention Bronze" },
  { id: "encouragement", name: "Certificat d'Encouragement", emoji: "⭐", minNote: 0, mention: "Des progrès remarquables" },
];

export function getCertificateLevel(note20: number, dicteesTried: number, minDictees: number = 5): typeof CERT_LEVELS[0] | null {
  if (dicteesTried < minDictees) return null; // Must attempt enough dictées
  for (const cert of CERT_LEVELS) {
    if (note20 >= cert.minNote) return cert;
  }
  return CERT_LEVELS[CERT_LEVELS.length - 1]; // Encouragement
}
