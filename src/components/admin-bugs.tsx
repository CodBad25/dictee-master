"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bug, X, Loader2, CheckCircle2, Clock, Eye,
  MessageSquare, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BugReport {
  id: string;
  description: string;
  screenshot: string | null;
  page_url: string | null;
  user_agent: string | null;
  reporter_name: string | null;
  reporter_type: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_CONFIG = {
  new: { text: "Nouveau", color: "bg-red-100 text-red-700", icon: Bug },
  read: { text: "Lu", color: "bg-yellow-100 text-yellow-700", icon: Eye },
  resolved: { text: "Résolu", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

interface AdminBugsProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminBugs({ open, onClose }: AdminBugsProps) {
  const teacherPassword = typeof window !== "undefined"
    ? localStorage.getItem("dictee_master_teacher_pwd") || ""
    : "";
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "read" | "resolved">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bugs?admin=true", {
        headers: { "x-teacher-password": teacherPassword },
      });
      if (res.ok) {
        setReports(await res.json());
      } else {
        toast.error("Erreur de chargement des signalements");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [teacherPassword]);

  useEffect(() => {
    if (open) loadReports();
  }, [open, loadReports]);

  const updateStatus = async (id: string, status: string, adminNote?: string) => {
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-teacher-password": teacherPassword,
        },
        body: JSON.stringify({ status, adminNote }),
      });
      if (res.ok) {
        loadReports();
        toast.success(status === "resolved" ? "Signalement résolu" : "Statut mis à jour");
      }
    } catch {
      toast.error("Erreur de mise à jour");
    }
  };

  const deleteReport = async (id: string) => {
    try {
      const res = await fetch(`/api/bugs/${id}`, {
        method: "DELETE",
        headers: { "x-teacher-password": teacherPassword },
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        toast.success("Signalement supprimé");
      }
    } catch {
      toast.error("Erreur de suppression");
    }
  };

  const handleSaveNote = (id: string) => {
    updateStatus(id, "resolved", noteText);
    setEditingNote(null);
    setNoteText("");
  };

  if (!open) return null;

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const newCount = reports.filter((r) => r.status === "new").length;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold">Signalements</h2>
            {newCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {newCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 px-4 py-3 border-b">
          {(["all", "new", "read", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? "Tous" : STATUS_CONFIG[f].text}
              {f === "new" && newCount > 0 && (
                <span className="ml-1 text-red-500">({newCount})</span>
              )}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-12">Aucun signalement</p>
          ) : (
            filtered.map((report) => {
              const config = STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
              const Icon = config.icon;
              const isExpanded = expandedId === report.id;
              const date = new Date(report.created_at);

              return (
                <div key={report.id} className="border rounded-xl overflow-hidden">
                  {/* Résumé */}
                  <button
                    onClick={() => {
                      setExpandedId(isExpanded ? null : report.id);
                      if (!isExpanded && report.status === "new") {
                        updateStatus(report.id, "read");
                      }
                    }}
                    className="w-full p-3 flex items-start gap-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          {report.reporter_name || "Anonyme"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {date.toLocaleDateString("fr-FR")} {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{report.description}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 ${config.color}`}>
                      <Icon className="w-3 h-3" />
                      {config.text}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />}
                  </button>

                  {/* Détails */}
                  {isExpanded && (
                    <div className="border-t p-3 space-y-3 bg-gray-50">
                      {/* Description complète */}
                      <div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.description}</p>
                      </div>

                      {/* Screenshot */}
                      {report.screenshot && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Capture d'écran</p>
                          <img
                            src={report.screenshot}
                            alt="Capture"
                            className="max-w-full rounded-lg border cursor-pointer"
                            onClick={() => window.open(report.screenshot!, "_blank")}
                          />
                        </div>
                      )}

                      {/* Infos techniques */}
                      <div className="text-xs text-gray-400 space-y-0.5">
                        {report.page_url && <p>URL : {report.page_url}</p>}
                        {report.user_agent && <p>Navigateur : {report.user_agent.slice(0, 80)}...</p>}
                        <p>Type : {report.reporter_type === "teacher" ? "Enseignant" : "Élève"}</p>
                      </div>

                      {/* Note admin existante */}
                      {report.admin_note && (
                        <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1 text-violet-700 font-medium text-xs mb-0.5">
                            <MessageSquare className="w-3 h-3" />
                            Votre réponse
                          </div>
                          <p className="text-sm text-violet-800">{report.admin_note}</p>
                        </div>
                      )}

                      {/* Zone de réponse */}
                      {editingNote === report.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Écrire une réponse visible par l'élève..."
                            rows={2}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none resize-none"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveNote(report.id)} className="bg-green-500 hover:bg-green-600">
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Résoudre
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingNote(null)}>
                              Annuler
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {report.status !== "resolved" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingNote(report.id);
                                  setNoteText(report.admin_note || "");
                                }}
                              >
                                <MessageSquare className="w-4 h-4 mr-1" />
                                Répondre & résoudre
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(report.id, "resolved")}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Résolu
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteReport(report.id)}
                            className="text-red-500 hover:text-red-600 ml-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
