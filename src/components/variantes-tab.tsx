"use client";
import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp, Plus, Settings, Volume2, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { saveFillBlanksVariants, type FillBlanksVariant } from "@/lib/dictee-service";
import {
  VARIANT_META,
  VARIANT_TYPE_ORDER,
  DEFAULT_SELECTED_VARIANTS,
  COST_PER_VARIANT_EUR,
  type VariantType,
  type VariantCategory,
} from "@/lib/variant-types";
import {
  loadTtsConfig,
  saveTtsConfig,
  generateTtsAudio,
  speakWithBrowser,
  type TtsConfig,
  type TtsProvider,
} from "@/lib/tts-service";

interface VariantesTabProps {
  dicteeId: string;
  teacherPassword: string;
  variants: FillBlanksVariant[];
  onVariantsChange: (variants: FillBlanksVariant[]) => void;
}

const STATUS_CHIP: Record<
  FillBlanksVariant["status"],
  { label: string; classes: string }
> = {
  draft:     { label: "Brouillon",  classes: "bg-gray-100 text-gray-600 border border-gray-300" },
  validated: { label: "Validée",    classes: "bg-emerald-100 text-emerald-700 border border-emerald-300" },
  rejected:  { label: "Rejetée",    classes: "bg-red-100 text-red-600 border border-red-300" },
};

const VARIANT_ICON = (type: VariantType): string => VARIANT_META[type]?.icon ?? "✨";

const CATEGORY_LABEL: Record<VariantCategory, string> = {
  nombre: "Nombre",
  temps: "Temps verbaux",
  pronom: "Pronoms",
};

// Groupage des types par catégorie, dans l'ordre stable du fichier variant-types.
const TYPES_BY_CATEGORY: Record<VariantCategory, VariantType[]> = (() => {
  const acc: Record<VariantCategory, VariantType[]> = { nombre: [], temps: [], pronom: [] };
  for (const t of VARIANT_TYPE_ORDER) {
    acc[VARIANT_META[t].category].push(t);
  }
  return acc;
})();

const TTS_PROVIDERS: { id: TtsProvider; label: string; needsKey: boolean }[] = [
  { id: "elevenlabs", label: "ElevenLabs", needsKey: true },
  { id: "google",     label: "Google TTS",  needsKey: true },
  { id: "azure",      label: "Azure TTS",   needsKey: true },
  { id: "webspeech",  label: "🔊 Navigateur (gratuit)", needsKey: false },
];

// Met en évidence les mots de vocabulaire dans le full_text en comparant avec fill_blanks_text.
// Là où fill_blanks_text contient ___, full_text contient un mot de vocabulaire (à mettre en couleur).
function renderHighlightedFullText(fullText: string, fillBlanksText: string): React.ReactNode[] {
  if (!fullText || !fillBlanksText) return [fullText];

  // Découpe fill_blanks_text par ___ pour obtenir les segments de contexte
  const contextSegments = fillBlanksText.split(/___/);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (let i = 0; i < contextSegments.length; i++) {
    const ctx = contextSegments[i];
    // Trouver ce segment de contexte dans full_text
    const idx = fullText.indexOf(ctx, cursor);
    if (idx === -1) {
      // Segment introuvable → fallback : rendre le reste sans highlight
      nodes.push(fullText.slice(cursor));
      return nodes;
    }
    // Ajouter le contexte tel quel
    nodes.push(<span key={`ctx-${i}`}>{ctx}</span>);
    cursor = idx + ctx.length;

    // Sauf pour le dernier segment, extraire le mot de vocabulaire qui suit
    if (i < contextSegments.length - 1) {
      const nextCtx = contextSegments[i + 1];
      const nextIdx = nextCtx ? fullText.indexOf(nextCtx, cursor) : fullText.length;
      const word = fullText.slice(cursor, nextIdx === -1 ? fullText.length : nextIdx);
      nodes.push(
        <span
          key={`word-${i}`}
          className="bg-orange-100 text-orange-800 font-semibold px-1 rounded"
        >
          {word}
        </span>,
      );
      cursor = nextIdx === -1 ? fullText.length : nextIdx;
    }
  }
  return nodes;
}

export default function VariantesTab({
  dicteeId,
  teacherPassword,
  variants,
  onVariantsChange,
}: VariantesTabProps) {
  const [generating, setGenerating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  const [lastCost, setLastCost] = useState<number | null>(null);
  const [lastTokens, setLastTokens] = useState<number | null>(null);

  // Panneau de sélection des transformations à générer
  const existingTypes = new Set(variants.map((v) => v.variant_type));
  const [showSelectionPanel, setShowSelectionPanel] = useState(variants.length === 0);
  const [selectedTypes, setSelectedTypes] = useState<Set<VariantType>>(() => {
    // Défaut : pré-sélectionner Pluriel + Imparfait, en excluant ceux déjà générés.
    return new Set(DEFAULT_SELECTED_VARIANTS.filter((t) => !existingTypes.has(t)));
  });

  // TTS config panel
  const [showTtsPanel, setShowTtsPanel] = useState(false);
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>({
    provider: "webspeech",
    apiKey: "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingTts, setSavingTts] = useState(false);

  // États de lecture audio par variante
  const [playingId, setPlayingId] = useState<string | null>(null);
  // États de génération audio à la validation
  const [audioGeneratingId, setAudioGeneratingId] = useState<string | null>(null);

  const selectedCount = selectedTypes.size;
  const estimatedCostEur = (selectedCount * COST_PER_VARIANT_EUR).toFixed(4);

  const toggleType = (type: VariantType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const openSelectionPanel = () => {
    // Pré-cocher les types manquants par défaut, sinon laisser vide.
    const missing = VARIANT_TYPE_ORDER.filter((t) => !existingTypes.has(t));
    const defaultMissing = DEFAULT_SELECTED_VARIANTS.filter((t) => missing.includes(t));
    setSelectedTypes(new Set(defaultMissing.length > 0 ? defaultMissing : []));
    setShowSelectionPanel(true);
  };

  // Charger la config TTS depuis localStorage au mount
  useEffect(() => {
    const saved = loadTtsConfig();
    if (saved) setTtsConfig(saved);
  }, []);

  // ── Accordion toggle ──────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Génération variantes ──────────────────────────────────────────────────
  const generate = async () => {
    if (selectedTypes.size === 0) {
      toast.error("Sélectionne au moins une transformation");
      return;
    }
    setGenerating(true);
    const transformations = Array.from(selectedTypes);
    try {
      const res = await fetch("/api/variants/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-teacher-password": teacherPassword,
        },
        body: JSON.stringify({ dicteeId, transformations }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Erreur ${res.status}`);
      }

      const data = await res.json();
      onVariantsChange(data.variants as FillBlanksVariant[]);
      if (data.model) setLastModelUsed(data.model as string);
      if (typeof data.cost === "number") setLastCost(data.cost);
      if (typeof data.tokens === "number") setLastTokens(data.tokens);
      const costEur = typeof data.cost === "number" ? (data.cost * 0.92).toFixed(4) : "?";
      const generated = Array.isArray(data.generated_types) ? data.generated_types.length : transformations.length;
      const errors = Array.isArray(data.errors) ? data.errors.length : 0;
      if (errors > 0) {
        toast.warning(`${generated} variante(s) générée(s), ${errors} échec(s) · ${costEur}€`);
      } else {
        toast.success(`${generated} variante(s) générée(s) · ${costEur}€`);
      }
      setShowSelectionPanel(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Génération échouée : ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── Sauvegarde config TTS ─────────────────────────────────────────────────
  const handleSaveTts = () => {
    setSavingTts(true);
    saveTtsConfig(ttsConfig);
    setTimeout(() => {
      setSavingTts(false);
      setShowTtsPanel(false);
      toast.success("Configuration TTS enregistrée");
    }, 300);
  };

  // ── Lecture audio d'une variante ──────────────────────────────────────────
  const playVariant = async (variant: FillBlanksVariant) => {
    if (playingId === variant.id) {
      // Arrêter la lecture en cours
      window.speechSynthesis?.cancel();
      setPlayingId(null);
      return;
    }

    setPlayingId(variant.id);
    try {
      if (variant.audio_url) {
        // MP3 stocké → lecture directe
        const audio = new Audio(variant.audio_url);
        audio.onended = () => setPlayingId(null);
        audio.onerror = () => setPlayingId(null);
        await audio.play();
      } else {
        // Fallback Web Speech API
        const text = variant.full_text || variant.fill_blanks_text;
        await speakWithBrowser(text);
        setPlayingId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lecture";
      toast.error(`Impossible de lire la variante : ${msg}`);
      setPlayingId(null);
    }
  };

  // ── Validation + génération audio ─────────────────────────────────────────
  const updateStatus = async (
    variantId: string,
    newStatus: "validated" | "rejected",
  ) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    // Optimistic update
    const updated = variants.map((v) =>
      v.id === variantId ? { ...v, status: newStatus } : v,
    );
    onVariantsChange(updated);

    // Génération audio si on valide + config TTS avec clé
    let finalVariants = updated;
    if (newStatus === "validated" && ttsConfig.provider !== "webspeech" && ttsConfig.apiKey) {
      setAudioGeneratingId(variantId);
      try {
        const blob = await generateTtsAudio(variant.full_text || variant.fill_blanks_text, ttsConfig);
        if (blob) {
          // Upload vers Supabase Storage bucket dictee-audio
          const sb = createClient();
          const path = `variants/${variantId}.mp3`;
          const { error: uploadError } = await sb.storage
            .from("dictee-audio")
            .upload(path, blob, { upsert: true, contentType: "audio/mpeg" });

          if (!uploadError) {
            const { data: pub } = sb.storage.from("dictee-audio").getPublicUrl(path);
            const audioUrl = pub.publicUrl;
            // Injecter l'audio_url dans les variantes
            finalVariants = updated.map((v) =>
              v.id === variantId ? { ...v, audio_url: audioUrl } : v,
            );
            onVariantsChange(finalVariants);
          } else {
            console.warn("[variantes-tab] Upload audio échoué (on continue sans audio) :", uploadError.message);
          }
        }
      } catch (audioErr: unknown) {
        const msg = audioErr instanceof Error ? audioErr.message : "Erreur TTS";
        console.warn("[variantes-tab] Génération audio échouée (on continue sans audio) :", msg);
        toast.warning(`Audio non généré : ${msg}`);
      } finally {
        setAudioGeneratingId(null);
      }
    }

    // Sauvegarder en base
    try {
      await saveFillBlanksVariants(dicteeId, finalVariants);
      if (newStatus === "validated") {
        const hasAudio = finalVariants.find((v) => v.id === variantId)?.audio_url;
        toast.success(
          hasAudio
            ? "Variante validée + audio généré ✓"
            : ttsConfig.provider === "webspeech"
            ? "Variante validée (voix navigateur)"
            : "Variante validée ✓",
        );
      } else {
        toast.success("Variante rejetée");
      }
    } catch {
      // Rollback
      onVariantsChange(variants);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  // ── Régénérer l'audio d'une variante existante (avec la clé TTS actuelle) ──
  const regenerateAudio = async (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    if (ttsConfig.provider === "webspeech" || !ttsConfig.apiKey) {
      toast.error("Configure d'abord une clé TTS via le bouton ⚙️ Audio");
      return;
    }

    setAudioGeneratingId(variantId);
    try {
      const blob = await generateTtsAudio(
        variant.full_text || variant.fill_blanks_text,
        ttsConfig,
      );
      if (!blob) {
        toast.error("Aucun audio généré");
        return;
      }
      const sb = createClient();
      const path = `variants/${variantId}-${Date.now()}.mp3`;
      const { error: uploadError } = await sb.storage
        .from("dictee-audio")
        .upload(path, blob, { upsert: true, contentType: "audio/mpeg" });

      if (uploadError) {
        toast.error(`Upload échoué : ${uploadError.message}`);
        return;
      }

      const { data: pub } = sb.storage.from("dictee-audio").getPublicUrl(path);
      const audioUrl = pub.publicUrl;
      const updated = variants.map((v) =>
        v.id === variantId ? { ...v, audio_url: audioUrl } : v,
      );
      onVariantsChange(updated);
      await saveFillBlanksVariants(dicteeId, updated);
      toast.success(`Audio régénéré via ${ttsConfig.provider} ✓`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Génération audio échouée : ${msg}`);
    } finally {
      setAudioGeneratingId(null);
    }
  };

  // ── Libellé de statut TTS ─────────────────────────────────────────────────
  const ttsStatusChip = () => {
    const cfg = loadTtsConfig();
    if (!cfg || cfg.provider === "webspeech") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300">
          🔊 Voix navigateur (aucune clé)
        </span>
      );
    }
    const providerLabel = TTS_PROVIDERS.find((p) => p.id === cfg.provider)?.label ?? cfg.provider;
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-300">
        ✓ {providerLabel} configuré
      </span>
    );
  };

  // ── Panneau de sélection des transformations (sous-bloc réutilisable) ─────
  const renderSelectionPanel = () => (
    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-orange-900 text-sm">
            ✨ Quelles transformations générer ?
          </p>
          <p className="text-xs text-orange-700 mt-0.5">
            Coche les variantes que tu souhaites créer pour cette dictée.
          </p>
        </div>
        {variants.length > 0 && (
          <button
            onClick={() => setShowSelectionPanel(false)}
            title="Fermer le panneau"
            className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-100 transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {(Object.keys(TYPES_BY_CATEGORY) as VariantCategory[]).map((cat) => {
        const types = TYPES_BY_CATEGORY[cat];
        if (types.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-[11px] font-bold text-orange-800 uppercase tracking-wide mb-2">
              {CATEGORY_LABEL[cat]}
            </p>
            <div className="flex flex-wrap gap-2">
              {types.map((type) => {
                const meta = VARIANT_META[type];
                const isSelected = selectedTypes.has(type);
                const isExisting = existingTypes.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    title={isExisting ? "Cette variante existe déjà — la regénérer la remplacera." : undefined}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition ${
                      isSelected
                        ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:bg-orange-50"
                    }`}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    {isExisting && !isSelected && (
                      <span className="ml-0.5 text-[10px] text-emerald-600">✓</span>
                    )}
                    {isExisting && isSelected && (
                      <span className="ml-0.5 text-[10px] text-white/90">↻</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-orange-200 flex-wrap">
        <div className="text-xs text-orange-900">
          <strong>{selectedCount}</strong> variante{selectedCount > 1 ? "s" : ""} sélectionnée
          {selectedCount > 1 ? "s" : ""} ·{" "}
          <span className="text-emerald-700">Coût estimé ~{estimatedCostEur}€</span>
        </div>
        <button
          onClick={generate}
          disabled={generating || selectedCount === 0}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>✨</span>}
          {generating
            ? "Génération en cours…"
            : selectedCount === 0
            ? "Sélectionne au moins une variante"
            : `Générer ${selectedCount} variante${selectedCount > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );

  // ── Affichage sans variantes ──────────────────────────────────────────────
  if (variants.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col items-center justify-center gap-3 py-6 px-6 text-center">
          <span className="text-5xl">📝</span>
          <div>
            <p className="font-semibold text-gray-800">Aucune variante générée pour l&apos;instant.</p>
            <p className="text-sm text-gray-500 mt-1">
              Choisis les transformations grammaticales à générer pour cette dictée.
            </p>
          </div>
        </div>
        {renderSelectionPanel()}
      </div>
    );
  }

  // ── Affichage avec variantes ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-4">

      {/* En-tête avec bouton config TTS */}
      <div className="flex items-center justify-between gap-3">
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5 text-sm text-orange-800 flex-1">
          📝 <strong>Variantes du texte à trous :</strong> les variantes validées seront proposées à l&apos;élève en complément du texte original.
        </div>
        <button
          onClick={() => setShowTtsPanel((p) => !p)}
          title="Configurer la synthèse vocale"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition flex-shrink-0 ${
            showTtsPanel
              ? "bg-indigo-100 border-indigo-300 text-indigo-700"
              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Audio</span>
        </button>
      </div>

      {/* Panneau config TTS (inline, collapsible) */}
      {showTtsPanel && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-indigo-900 text-sm">⚙️ Synthèse vocale — configuration</span>
            {ttsStatusChip()}
          </div>

          {/* Sélection du fournisseur — chips, jamais de select */}
          <div>
            <p className="text-xs font-medium text-indigo-800 mb-2">Fournisseur</p>
            <div className="flex flex-wrap gap-2">
              {TTS_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTtsConfig((c) => ({ ...c, provider: p.id, apiKey: p.needsKey ? c.apiKey : "" }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    ttsConfig.provider === p.id
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Champ clé API — masqué si webspeech */}
          {ttsConfig.provider !== "webspeech" && (
            <div>
              <p className="text-xs font-medium text-indigo-800 mb-1">Clé API</p>
              <div className="flex items-center gap-2">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={ttsConfig.apiKey}
                  onChange={(e) => setTtsConfig((c) => ({ ...c, apiKey: e.target.value }))}
                  placeholder="Colle ta clé API ici"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={() => setShowApiKey((v) => !v)}
                  title={showApiKey ? "Masquer" : "Afficher"}
                  className="p-2 rounded-lg bg-white border border-indigo-300 text-indigo-600 hover:bg-indigo-100 transition"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {ttsConfig.provider === "elevenlabs" && (
                <p className="text-[11px] text-indigo-600 mt-1">
                  Voice ID optionnel — laisse vide pour utiliser Rachel (multilangue).
                </p>
              )}
            </div>
          )}

          {/* Voice ID optionnel (ElevenLabs uniquement) */}
          {ttsConfig.provider === "elevenlabs" && (
            <div>
              <p className="text-xs font-medium text-indigo-800 mb-1">Voice ID <span className="font-normal">(optionnel)</span></p>
              <input
                type="text"
                value={ttsConfig.voiceId || ""}
                onChange={(e) => setTtsConfig((c) => ({ ...c, voiceId: e.target.value || undefined }))}
                placeholder="Ex: ThT5KcBeYPX3keUQqHPh"
                className="w-full px-3 py-2 text-sm rounded-lg border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowTtsPanel(false)}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveTts}
              disabled={savingTts}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-60"
            >
              {savingTts ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Bouton "Ajouter d'autres variantes" + panneau de sélection (au-dessus des cartes) */}
      {showSelectionPanel ? (
        renderSelectionPanel()
      ) : (
        <div className="flex justify-end">
          <button
            onClick={openSelectionPanel}
            disabled={generating}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold text-xs transition disabled:opacity-60"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter d&apos;autres variantes
          </button>
        </div>
      )}

      {/* Cartes de variantes */}
      <div className="flex flex-col gap-3">
        {variants.map((v) => {
          const isExpanded = expandedIds.has(v.id);
          const chipConfig = STATUS_CHIP[v.status];
          const preview = v.fill_blanks_text.length > 50
            ? v.fill_blanks_text.slice(0, 50) + "…"
            : v.fill_blanks_text;
          const isAudioGenerating = audioGeneratingId === v.id;
          const isPlaying = playingId === v.id;

          return (
            <div
              key={v.id}
              className={`rounded-xl border-2 transition-all ${
                v.status === "validated"
                  ? "border-emerald-300 bg-emerald-50"
                  : v.status === "rejected"
                  ? "border-red-200 bg-red-50 opacity-70"
                  : "border-orange-200 bg-white"
              }`}
            >
              {/* En-tête de la carte */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl flex-shrink-0">{VARIANT_ICON(v.variant_type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-800">{v.label}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${chipConfig.classes}`}>
                      {chipConfig.label}
                    </span>
                    {v.audio_url && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-300">
                        🎵 MP3
                      </span>
                    )}
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{preview}</p>
                  )}
                </div>

                {/* Boutons d'action */}
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  {/* Bouton Écouter (toujours visible) */}
                  {(v.full_text || v.fill_blanks_text) && (
                    <button
                      onClick={() => playVariant(v)}
                      title={isPlaying ? "Arrêter la lecture" : "Écouter la variante"}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        isPlaying
                          ? "bg-indigo-200 text-indigo-800 border border-indigo-300"
                          : "bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
                      }`}
                    >
                      <Volume2 className="w-3 h-3" />
                      {isPlaying ? "Stop" : "Écouter"}
                    </button>
                  )}

                  {/* Bouton Régénérer audio (visible seulement si une clé TTS est configurée) */}
                  {ttsConfig.provider !== "webspeech" && ttsConfig.apiKey && (v.full_text || v.fill_blanks_text) && (
                    <button
                      onClick={() => regenerateAudio(v.id)}
                      disabled={isAudioGenerating}
                      title={v.audio_url ? "Régénérer l'audio avec la clé TTS actuelle" : "Générer l'audio avec la clé TTS actuelle"}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-semibold transition disabled:opacity-60"
                    >
                      {isAudioGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>🎵</>
                      )}
                      {v.audio_url ? "Régénérer audio" : "Générer audio"}
                    </button>
                  )}

                  {v.status !== "validated" && (
                    <button
                      onClick={() => updateStatus(v.id, "validated")}
                      disabled={isAudioGenerating}
                      title="Valider cette variante"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold transition disabled:opacity-60"
                    >
                      {isAudioGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      ✓ Valider
                    </button>
                  )}
                  {v.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(v.id, "rejected")}
                      disabled={isAudioGenerating}
                      title="Rejeter cette variante"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-xs font-semibold transition disabled:opacity-60"
                    >
                      ✕ Rejeter
                    </button>
                  )}
                  <button
                    onClick={() => toggleExpand(v.id)}
                    title={isExpanded ? "Réduire" : "Voir le texte complet"}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition"
                  >
                    {isExpanded ? (
                      <><ChevronUp className="w-3 h-3" /> Réduire</>
                    ) : (
                      <><ChevronDown className="w-3 h-3" /> Voir le texte</>
                    )}
                  </button>
                </div>
              </div>

              {/* Texte complet (accordion) */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Texte à trous</p>
                    <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
                      {v.fill_blanks_text}
                    </div>
                  </div>
                  {v.full_text && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Texte complet (pour la lecture audio) — <span className="text-orange-600">mots de vocabulaire en orange</span>
                      </p>
                      <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {renderHighlightedFullText(v.full_text, v.fill_blanks_text)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer : infos modèle/coût */}
      {(lastModelUsed || lastCost !== null) && (
        <div className="pt-2 border-t border-orange-100 flex items-center gap-2 flex-wrap">
          {lastModelUsed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
              🤖 {lastModelUsed}
            </span>
          )}
          {lastCost !== null && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              💰 ${lastCost.toFixed(6)} · ~{(lastCost * 0.92).toFixed(4)}€{lastTokens !== null ? ` · ${lastTokens} tokens` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
