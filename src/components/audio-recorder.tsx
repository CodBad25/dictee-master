"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, Play, Pause, RotateCcw, Trash2, Check, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updateWordAudioUrl } from "@/lib/dictee-service";

type Phase = "idle" | "permission_denied" | "recording" | "preview" | "uploading" | "saved";

interface AudioRecorderProps {
  dicteeId: string;
  position: number;
  initialAudioUrl: string | null;
  onUpdated: (newUrl: string | null) => void;
  maxSeconds?: number;
}

const SPEEDS = [0.75, 1, 1.25] as const;

export default function AudioRecorder({
  dicteeId,
  position,
  initialAudioUrl,
  onUpdated,
  maxSeconds = 30,
}: AudioRecorderProps) {
  const [phase, setPhase] = useState<Phase>(initialAudioUrl ? "saved" : "idle");
  const [savedUrl, setSavedUrl] = useState<string | null>(initialAudioUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const [micLevel, setMicLevel] = useState(0); // 0-100
  const [isPlaying, setIsPlaying] = useState(false);
  const [playPos, setPlayPos] = useState(0); // 0-1
  const [duration, setDuration] = useState(0); // seconds
  const [speed, setSpeed] = useState<typeof SPEEDS[number]>(1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup à l'unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchroniser la vitesse de lecture
  useEffect(() => {
    if (audioElRef.current) audioElRef.current.playbackRate = speed;
  }, [speed]);

  function stopAllStreams() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }

  const startRecording = async () => {
    setRecordingMs(0);
    setMicLevel(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000, channelCount: 1 },
      });
      streamRef.current = stream;

      // AudioContext + AnalyserNode pour le niveau micro temps réel
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ac = new AC();
      audioContextRef.current = ac;
      const source = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        // RMS approx pour avoir un niveau plus stable
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setMicLevel(Math.min(100, Math.round(rms * 200)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Choix mimeType — webm/opus si dispo, sinon défaut
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewUrl(url);
        setPhase("preview");
        stopAllStreams();
      };
      mr.start();
      startedAtRef.current = Date.now();
      setPhase("recording");

      // Timer + auto-stop
      const timerId = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setRecordingMs(elapsed);
        if (elapsed >= maxSeconds * 1000) {
          clearInterval(timerId);
          if (mr.state === "recording") mr.stop();
        }
      }, 100);
      // Stocker le timerId pour cleanup au stop manuel
      (mr as any)._timerId = timerId;
    } catch (err: any) {
      console.error("Erreur accès micro:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPhase("permission_denied");
      } else {
        toast.error("Impossible d'accéder au micro : " + (err.message || err.name));
        setPhase("idle");
      }
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      const tid = (mr as any)._timerId;
      if (tid) clearInterval(tid);
      mr.stop();
    }
  };

  const restartFromPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPhase("idle");
    setRecordingMs(0);
    setIsPlaying(false);
    setPlayPos(0);
  };

  const validateAndUpload = async () => {
    if (!previewBlob) return;
    setPhase("uploading");
    setUploadProgress(0);

    const ext = previewBlob.type.includes("webm") ? "webm" : "ogg";
    const path = `${dicteeId}/${position}-${Date.now()}.${ext}`;
    const sb = createClient();

    // Retry x3 avec backoff
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Note : l'API Supabase storage n'expose pas un onProgress direct
        // côté navigateur — on simule une progression linéaire pour l'UX.
        const fakeProgress = setInterval(() => {
          setUploadProgress((p) => Math.min(90, p + 10));
        }, 100);

        const { error: uploadError } = await sb.storage
          .from("dictee-audio")
          .upload(path, previewBlob, { upsert: false, contentType: previewBlob.type });

        clearInterval(fakeProgress);
        if (uploadError) throw uploadError;

        const { data: pub } = sb.storage.from("dictee-audio").getPublicUrl(path);
        const publicUrl = pub.publicUrl;

        await updateWordAudioUrl(dicteeId, position, publicUrl);

        setUploadProgress(100);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPreviewBlob(null);
        setSavedUrl(publicUrl);
        setPhase("saved");
        onUpdated(publicUrl);
        toast.success("Audio enregistré");
        return;
      } catch (err: any) {
        lastError = err;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 * attempt)); // backoff 500ms / 1s
        }
      }
    }

    toast.error("Erreur d'upload : " + (lastError?.message || "réseau"));
    setPhase("preview");
    setUploadProgress(0);
  };

  const deleteAudio = async () => {
    if (!confirm("Supprimer l'audio personnalisé ? La synthèse vocale sera utilisée à la place.")) return;
    try {
      await updateWordAudioUrl(dicteeId, position, null);
      setSavedUrl(null);
      setPhase("idle");
      onUpdated(null);
      toast.success("Audio supprimé");
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message || "suppression impossible"));
    }
  };

  const askReplace = () => {
    setConfirmReplace(true);
  };
  const cancelReplace = () => setConfirmReplace(false);
  const confirmReplaceYes = () => {
    setConfirmReplace(false);
    setPhase("idle");
  };

  // Player partagé (preview ou saved)
  const currentAudioUrl = phase === "preview" ? previewUrl : savedUrl;
  const togglePlay = () => {
    const a = audioElRef.current;
    if (!a) return;
    if (a.paused) {
      a.playbackRate = speed;
      a.play();
    } else {
      a.pause();
    }
  };
  const onLoadedMeta = () => {
    if (audioElRef.current) setDuration(audioElRef.current.duration || 0);
  };
  const onTimeUpdate = () => {
    const a = audioElRef.current;
    if (!a) return;
    setPlayPos(a.duration ? a.currentTime / a.duration : 0);
  };
  const onPlayEv = () => setIsPlaying(true);
  const onPauseEv = () => setIsPlaying(false);
  const onEndedEv = () => {
    setIsPlaying(false);
    setPlayPos(0);
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioElRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = a.duration * Math.max(0, Math.min(1, ratio));
  };

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // === Rendu ===

  if (phase === "permission_denied") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-red-900">Accès au micro refusé</h4>
            <p className="text-sm text-red-800 mt-1">
              Le navigateur a bloqué l'accès au micro. Pour autoriser :
            </p>
            <ul className="text-xs text-red-700 mt-2 list-disc list-inside">
              <li>Clique sur l'icône 🔒 ou ⓘ dans la barre d'adresse</li>
              <li>Autorise le micro pour ce site</li>
              <li>Recharge la page</li>
            </ul>
            <button
              onClick={() => setPhase("idle")}
              className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Audio element caché qui sert au player */}
      {currentAudioUrl && (
        <audio
          ref={audioElRef}
          src={currentAudioUrl}
          preload="metadata"
          onLoadedMetadata={onLoadedMeta}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlayEv}
          onPause={onPauseEv}
          onEnded={onEndedEv}
        />
      )}

      {/* État vide / saved sans replace en cours */}
      {phase === "idle" && (
        <button
          onClick={startRecording}
          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors inline-flex items-center justify-center gap-2"
        >
          <Mic className="w-5 h-5" />
          Enregistrer la voix
        </button>
      )}

      {/* Enregistrement en cours */}
      {phase === "recording" && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="font-bold text-red-700">ENREGISTREMENT</span>
            </div>
            <span className="font-mono text-red-700 text-sm">
              {formatTime(recordingMs / 1000)} / {formatTime(maxSeconds)}
            </span>
          </div>
          {/* Niveau micro */}
          <div className="h-3 bg-white rounded-full overflow-hidden border border-red-200">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-amber-500 transition-all duration-75"
              style={{ width: `${micLevel}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-red-700 font-semibold">
            <span>Parle au micro — la barre doit bouger</span>
            <span>{micLevel < 5 ? "(silence)" : micLevel > 80 ? "(fort)" : ""}</span>
          </div>
          <button
            onClick={stopRecording}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Square className="w-5 h-5" />
            Arrêter
          </button>
        </div>
      )}

      {/* Preview avant validation */}
      {phase === "preview" && currentAudioUrl && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-emerald-900">
            ✅ Enregistré — écoute pour vérifier avant de valider
          </div>
          <PlayerUI
            isPlaying={isPlaying}
            playPos={playPos}
            duration={duration}
            speed={speed}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onSpeedChange={setSpeed}
            color="emerald"
          />
          <div className="flex gap-2">
            <button
              onClick={restartFromPreview}
              className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> Refaire
            </button>
            <button
              onClick={validateAndUpload}
              className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Valider et enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Upload en cours */}
      {phase === "uploading" && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span className="font-bold text-indigo-900 text-sm">Upload en cours…</span>
            <span className="ml-auto text-xs font-mono text-indigo-700">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden border border-indigo-200">
            <div
              className="h-full bg-indigo-500 transition-all duration-100"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Audio existant (saved) */}
      {phase === "saved" && currentAudioUrl && !confirmReplace && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-indigo-900">
            🎧 Audio personnalisé enregistré
          </div>
          <PlayerUI
            isPlaying={isPlaying}
            playPos={playPos}
            duration={duration}
            speed={speed}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onSpeedChange={setSpeed}
            color="indigo"
          />
          <div className="flex gap-2">
            <button
              onClick={askReplace}
              className="flex-1 px-3 py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> Refaire
            </button>
            <button
              onClick={deleteAudio}
              className="px-3 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-50 inline-flex items-center gap-1.5"
              title="Supprimer et revenir à la synthèse vocale"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation remplacement */}
      {phase === "saved" && confirmReplace && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <h4 className="font-bold text-amber-900 mb-1">Refaire l'enregistrement ?</h4>
          <p className="text-sm text-amber-800 mb-3">
            L'audio actuel sera remplacé par le nouveau. Cette action est définitive.
          </p>
          <div className="flex gap-2">
            <button
              onClick={cancelReplace}
              className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={confirmReplaceYes}
              className="flex-1 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700"
            >
              Oui, refaire
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Sous-composant : barre de progression + speed selector
function PlayerUI({
  isPlaying,
  playPos,
  duration,
  speed,
  onTogglePlay,
  onSeek,
  onSpeedChange,
  color,
}: {
  isPlaying: boolean;
  playPos: number;
  duration: number;
  speed: typeof SPEEDS[number];
  onTogglePlay: () => void;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSpeedChange: (s: typeof SPEEDS[number]) => void;
  color: "emerald" | "indigo";
}) {
  const colorClasses =
    color === "emerald"
      ? { btn: "bg-emerald-600 hover:bg-emerald-700", bar: "bg-emerald-500", barBg: "bg-emerald-100" }
      : { btn: "bg-indigo-600 hover:bg-indigo-700", bar: "bg-indigo-500", barBg: "bg-indigo-100" };

  const cur = duration * playPos;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          className={`w-10 h-10 rounded-full text-white flex items-center justify-center transition-colors shrink-0 ${colorClasses.btn}`}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div
            className={`relative h-2 rounded-full cursor-pointer ${colorClasses.barBg}`}
            onClick={onSeek}
          >
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-[width] duration-75 ${colorClasses.bar}`}
              style={{ width: `${playPos * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-gray-600 mt-1">
            <span>{formatTime(cur)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1">
        <span className="text-[11px] text-gray-500 mr-1">Vitesse :</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-0.5 text-xs font-semibold rounded ${
              speed === s
                ? "bg-gray-800 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
