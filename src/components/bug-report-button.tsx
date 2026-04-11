"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bug, Camera, Send, X, Loader2, CheckCircle2,
  Clock, MessageSquare, Upload, CropIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

const SEEN_KEY = "dm_bug_seen_resolved";

const STATUS_LABEL = {
  new: { text: "Envoyé", color: "bg-gray-100 text-gray-600", icon: Clock },
  read: { text: "Lu par le prof", color: "bg-blue-100 text-blue-700", icon: Clock },
  resolved: { text: "Corrigé !", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

interface BugReport {
  id: string;
  description: string;
  status: string;
  admin_note: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

// Extraire le contexte depuis le DOM (titre de la page, dictée en cours, etc.)
function detectContext(): string {
  const pathname = window.location.pathname;
  if (pathname === "/") return "[Accueil]";
  if (pathname.startsWith("/teacher")) return "[Espace enseignant]";

  // Page élève : lire le titre visible dans le DOM
  const heading = document.querySelector("h1, h2");
  if (heading?.textContent) {
    return `[${heading.textContent.trim().slice(0, 60)}]`;
  }
  return "[Espace élève]";
}

// Appliquer le crop sur l'image via canvas
function getCroppedImage(
  image: HTMLImageElement,
  crop: PixelCrop,
): string {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL("image/jpeg", 0.6);
}

export default function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "history">("new");
  const [description, setDescription] = useState("");
  const [rawScreenshot, setRawScreenshot] = useState<string | null>(null);
  const [croppedScreenshot, setCroppedScreenshot] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasNews, setHasNews] = useState(false);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);

  const { connectedEleve, user } = useAppStore();

  // Déterminer le type et le nom du reporter
  const isTeacher = user?.role === "teacher";
  const reporterName = isTeacher
    ? "Enseignant"
    : connectedEleve
      ? `${connectedEleve.prenom} (${connectedEleve.classe || "?"})`
      : null;
  const reporterType = isTeacher ? "teacher" : "student";

  // Charger les signalements passés
  const loadReports = useCallback(async () => {
    if (!reporterName) return;
    setReportsLoading(true);
    try {
      const res = await fetch(`/api/bugs?reporterName=${encodeURIComponent(reporterName)}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch {
      // silencieux
    } finally {
      setReportsLoading(false);
    }
  }, [reporterName]);

  // Badge quand signalement traité
  useEffect(() => {
    if (reports.length === 0) return;
    const seenIds: string[] = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    const newResolved = reports.filter(r => r.status === "resolved" && !seenIds.includes(r.id));
    setHasNews(newResolved.length > 0);
  }, [reports]);

  // Charger les signalements au montage et périodiquement
  useEffect(() => {
    if (reporterName) loadReports();
  }, [reporterName, loadReports]);

  const markResolvedAsSeen = () => {
    const resolvedIds = reports.filter(r => r.status === "resolved").map(r => r.id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(resolvedIds));
    setHasNews(false);
  };

  const captureScreen = useCallback(async () => {
    setScreenshotLoading(true);
    try {
      const fab = document.getElementById("bug-report-fab");
      const modal = document.getElementById("bug-report-modal");
      if (fab) fab.style.display = "none";
      if (modal) modal.style.display = "none";

      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(document.body, {
        scale: 0.7,
        useCORS: true,
        logging: false,
      });

      if (fab) fab.style.display = "";
      if (modal) modal.style.display = "";

      const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
      setRawScreenshot(dataUrl);
      setCroppedScreenshot(null);
      setIsCropping(true);
      setCrop(undefined);
      setCompletedCrop(undefined);
    } catch (e) {
      console.error("Capture échouée:", e);
      toast.error("Impossible de capturer l'écran. Tu peux ajouter une image manuellement.");
      const fab = document.getElementById("bug-report-fab");
      const modal = document.getElementById("bug-report-modal");
      if (fab) fab.style.display = "";
      if (modal) modal.style.display = "";
    } finally {
      setScreenshotLoading(false);
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("Image trop lourde (max 2 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setRawScreenshot(dataUrl);
      setCroppedScreenshot(null);
      setIsCropping(true);
      setCrop(undefined);
      setCompletedCrop(undefined);
    };
    reader.readAsDataURL(file);
  };

  const applyCrop = () => {
    if (completedCrop && cropImageRef.current && completedCrop.width > 0 && completedCrop.height > 0) {
      const cropped = getCroppedImage(cropImageRef.current, completedCrop);
      setCroppedScreenshot(cropped);
    } else {
      // Pas de recadrage : garder l'image originale
      setCroppedScreenshot(rawScreenshot);
    }
    setIsCropping(false);
  };

  const skipCrop = () => {
    setCroppedScreenshot(rawScreenshot);
    setIsCropping(false);
  };

  const removeScreenshot = () => {
    setRawScreenshot(null);
    setCroppedScreenshot(null);
    setIsCropping(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !reporterName) return;
    setSubmitting(true);

    const context = detectContext();
    const fullDescription = context ? `${context}\n${description.trim()}` : description.trim();

    try {
      const res = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: fullDescription,
          screenshot: croppedScreenshot,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          reporterName,
          reporterType,
        }),
      });

      if (!res.ok) throw new Error();

      setSent(true);
      loadReports();
      setTimeout(() => {
        setSent(false);
        setDescription("");
        removeScreenshot();
        setTab("history");
      }, 1500);
    } catch {
      toast.error("Erreur lors de l'envoi. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (hasNews && reporterName) {
      setTab("history");
      markResolvedAsSeen();
    } else {
      setTab("new");
    }
  };

  // Ne pas afficher si personne n'est connecté
  if (!connectedEleve && !user) return null;

  const finalScreenshot = croppedScreenshot || rawScreenshot;

  return (
    <>
      {/* Bouton flottant */}
      <button
        id="bug-report-fab"
        onClick={handleOpen}
        className="fixed bottom-4 right-16 z-50 w-9 h-9 rounded-full bg-red-400 hover:bg-red-500 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center active:scale-95 opacity-60 hover:opacity-100"
        title="Signaler un problème"
      >
        <Bug className="w-4 h-4" />
        {hasNews && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white">!</span>
        )}
      </button>

      {/* Modal */}
      {open && (
        <div
          id="bug-report-modal"
          className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            {/* Confirmation d'envoi */}
            {sent ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-gray-800">
                  Merci {connectedEleve?.prenom || ""} pour ton signalement !
                </p>
                <p className="text-gray-500 text-sm">
                  {isTeacher ? "C'est noté." : "M. Belhaj va regarder ça."}
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bug className="w-5 h-5 text-red-500" />
                    <h2 className="text-lg font-bold text-gray-800">Signaler un problème</h2>
                  </div>
                  <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Identité */}
                <div className="mb-4 bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Connecté :</span>
                  <span className="font-medium text-gray-800">
                    {isTeacher ? "Enseignant" : connectedEleve?.prenom}
                  </span>
                  {!isTeacher && connectedEleve?.classe && (
                    <span className="text-gray-400">({connectedEleve.classe})</span>
                  )}
                </div>

                {/* Onglets */}
                {reports.length > 0 && (
                  <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setTab("new")}
                      className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                        tab === "new" ? "bg-white shadow-sm text-gray-800" : "text-gray-500"
                      }`}
                    >
                      Nouveau
                    </button>
                    <button
                      onClick={() => { setTab("history"); markResolvedAsSeen(); }}
                      className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors relative ${
                        tab === "history" ? "bg-white shadow-sm text-gray-800" : "text-gray-500"
                      }`}
                    >
                      Mes signalements
                      {hasNews && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />}
                    </button>
                  </div>
                )}

                {/* TAB: Nouveau signalement */}
                {tab === "new" && (
                  <>
                    <div className="mb-3">
                      <label className="text-sm font-medium text-gray-600 mb-1 block">
                        Décris le problème *
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ex : Quand je clique sur Vérifier, rien ne se passe..."
                        rows={3}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none resize-none"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-600 mb-2 block">
                        Capture d'écran
                      </label>

                      {/* Mode recadrage — PLEIN ÉCRAN */}
                      {isCropping && rawScreenshot ? null : finalScreenshot ? (
                        /* Image finale (recadrée ou complète) */
                        <div className="relative">
                          <img
                            src={finalScreenshot}
                            alt="Capture"
                            className="w-full rounded-lg border"
                          />
                          <div className="absolute top-1 right-1 flex gap-1">
                            <button
                              onClick={() => setIsCropping(true)}
                              className="bg-white rounded-full p-1 shadow hover:bg-gray-100"
                              title="Recadrer"
                            >
                              <CropIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={removeScreenshot}
                              className="bg-white rounded-full p-1 shadow hover:bg-gray-100"
                              title="Supprimer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Boutons de capture */
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={captureScreen}
                            disabled={screenshotLoading}
                            className="flex-1"
                          >
                            {screenshotLoading ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Camera className="w-4 h-4 mr-1" />
                            )}
                            Capturer l'écran
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1"
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            Ajouter une image
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={!description.trim() || submitting}
                      className="w-full bg-red-500 hover:bg-red-600"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Envoyer le signalement
                    </Button>
                  </>
                )}

                {/* TAB: Historique */}
                {tab === "history" && (
                  <div className="space-y-3">
                    {reportsLoading ? (
                      <div className="text-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
                      </div>
                    ) : reports.length === 0 ? (
                      <p className="text-center text-gray-500 py-6">Aucun signalement</p>
                    ) : (
                      reports.map((report) => {
                        const config = STATUS_LABEL[report.status as keyof typeof STATUS_LABEL] || STATUS_LABEL.new;
                        const Icon = config.icon;
                        const date = report.created_at ? new Date(report.created_at) : null;
                        return (
                          <div key={report.id} className="border rounded-xl p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <p className="text-sm text-gray-700 flex-1 line-clamp-2">
                                {report.description}
                              </p>
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 ${config.color}`}
                              >
                                <Icon className="w-3 h-3" />
                                {config.text}
                              </span>
                            </div>
                            {report.admin_note && (
                              <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-sm">
                                <div className="flex items-center gap-1 text-violet-700 font-medium text-xs mb-0.5">
                                  <MessageSquare className="w-3 h-3" />
                                  Réponse de M. Belhaj
                                </div>
                                <p className="text-violet-800">{report.admin_note}</p>
                              </div>
                            )}
                            {date && (
                              <p className="text-xs text-gray-400">
                                {date.toLocaleDateString("fr-FR")} à{" "}
                                {date.toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay plein écran pour le recadrage */}
      {isCropping && rawScreenshot && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/50">
            <p className="text-white text-sm font-medium">
              Glisse pour sélectionner la zone à garder
            </p>
            <button onClick={removeScreenshot} className="text-white/70 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
            >
              <img
                ref={cropImageRef}
                src={rawScreenshot}
                alt="Capture à recadrer"
                className="max-w-full max-h-[75vh] object-contain"
              />
            </ReactCrop>
          </div>
          <div className="flex gap-3 justify-center px-4 py-4 bg-black/50">
            <Button
              onClick={applyCrop}
              disabled={!completedCrop || completedCrop.width === 0}
              className="bg-red-500 hover:bg-red-600 px-6"
            >
              <CropIcon className="w-4 h-4 mr-2" />
              Recadrer
            </Button>
            <Button
              variant="outline"
              onClick={skipCrop}
              className="border-white/30 text-white hover:bg-white/10 px-6"
            >
              Garder tout
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
