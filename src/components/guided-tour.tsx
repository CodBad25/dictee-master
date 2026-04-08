"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  clickBefore?: string;
}

interface GuidedTourProps {
  tourId: string;
  steps: TourStep[];
  onComplete?: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 768;

export default function GuidedTour({ tourId, steps, onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const updateTargetPosition = useCallback(() => {
    if (!step?.target) return;
    const element = document.querySelector(`[data-tour="${step.target}"]`);
    if (element) {
      const rect = element.getBoundingClientRect();
      // Scroll l'élément dans la vue (y compris dans des containers scrollables)
      const isFullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth;
      if (!isFullyVisible) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        // Re-lire la position après le scroll
        setTimeout(() => {
          const newRect = element.getBoundingClientRect();
          setTargetRect({ top: newRect.top, left: newRect.left, width: newRect.width, height: newRect.height });
        }, 400);
      }
      setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    } else {
      setTargetRect(null);
    }
  }, [step?.target]);

  useEffect(() => {
    if (step?.clickBefore) {
      // Délai pour laisser le DOM se stabiliser avant de cliquer
      const timer = setTimeout(() => {
        const el = document.querySelector(`[data-tour="${step.clickBefore}"]`) as HTMLElement;
        el?.click();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [step?.clickBefore, currentStep]);

  useEffect(() => {
    const delay = step?.clickBefore ? 600 : 0;
    const timer = setTimeout(updateTargetPosition, delay);
    window.addEventListener("resize", updateTargetPosition);
    window.addEventListener("scroll", updateTargetPosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateTargetPosition);
      window.removeEventListener("scroll", updateTargetPosition);
    };
  }, [updateTargetPosition, currentStep, step?.clickBefore]);

  useEffect(() => {
    const timer = setTimeout(updateTargetPosition, 400);
    return () => clearTimeout(timer);
  }, [currentStep, updateTargetPosition]);

  const handleComplete = () => {
    localStorage.setItem(`tour_${tourId}_completed`, "true");
    setIsVisible(false);
    onComplete?.();
  };

  if (!isVisible) return null;

  const getTooltipStyle = (): React.CSSProperties => {
    const mobile = isMobile();
    const padding = mobile ? 12 : 16;
    const tooltipWidth = mobile ? Math.min(280, window.innerWidth - padding * 2) : 320;
    const tooltipHeight = 200;

    if (!targetRect) {
      return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: tooltipWidth };
    }

    const position = step.position || "bottom";
    const safeLeft = Math.min(
      Math.max(padding, targetRect.left + targetRect.width / 2 - tooltipWidth / 2),
      window.innerWidth - tooltipWidth - padding,
    );
    const safeTop = Math.min(
      Math.max(padding, targetRect.top + targetRect.height / 2 - tooltipHeight / 2),
      window.innerHeight - tooltipHeight - padding,
    );

    const base: React.CSSProperties = { position: "fixed", width: tooltipWidth };

    if (mobile) {
      const below = window.innerHeight - (targetRect.top + targetRect.height);
      if (below >= tooltipHeight + padding) return { ...base, top: targetRect.top + targetRect.height + padding, left: safeLeft };
      if (targetRect.top >= tooltipHeight + padding) return { ...base, top: targetRect.top - tooltipHeight - padding, left: safeLeft };
      return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }

    switch (position) {
      case "top": return { ...base, top: Math.max(padding, targetRect.top - padding - 8 - tooltipHeight), left: safeLeft };
      case "bottom": return { ...base, top: targetRect.top + targetRect.height + padding, left: safeLeft };
      case "left": return targetRect.left - padding >= tooltipWidth
        ? { ...base, top: safeTop, left: targetRect.left - padding - tooltipWidth }
        : { ...base, top: targetRect.top + targetRect.height + padding, left: safeLeft };
      case "right": return window.innerWidth - (targetRect.left + targetRect.width) - padding >= tooltipWidth
        ? { ...base, top: safeTop, left: targetRect.left + targetRect.width + padding }
        : { ...base, top: targetRect.top + targetRect.height + padding, left: safeLeft };
      default: return { ...base, top: targetRect.top + targetRect.height + padding, left: safeLeft };
    }
  };

  const getSpotlightRect = () => {
    if (!targetRect) return null;
    const padding = 12;
    const minSize = 48;
    let width = targetRect.width + padding * 2;
    let height = targetRect.height + padding * 2;
    let left = targetRect.left - padding;
    let top = targetRect.top - padding;
    if (width < minSize) { left = targetRect.left + targetRect.width / 2 - minSize / 2; width = minSize; }
    if (height < minSize) { top = targetRect.top + targetRect.height / 2 - minSize / 2; height = minSize; }
    return { left, top, width, height };
  };

  const spotlightRect = getSpotlightRect();

  return (
    <div className="fixed inset-0 z-[100]">
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect x={spotlightRect.left} y={spotlightRect.top} width={spotlightRect.width} height={spotlightRect.height} rx="12" fill="black" />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0, 0, 0, 0.75)" mask="url(#spotlight-mask)" />
      </svg>

      {spotlightRect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 1, scale: 1,
            boxShadow: ["0 0 20px rgba(168,85,247,0.5)", "0 0 40px rgba(168,85,247,0.8)", "0 0 20px rgba(168,85,247,0.5)"],
          }}
          transition={{ boxShadow: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } }}
          className="fixed pointer-events-none"
          style={{ top: spotlightRect.top, left: spotlightRect.left, width: spotlightRect.width, height: spotlightRect.height, borderRadius: 12, border: "3px solid #a855f7" }}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          style={getTooltipStyle()}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden z-10"
        >
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white" />
              <span className="text-white font-semibold text-sm">Étape {currentStep + 1}/{steps.length}</span>
            </div>
            <button onClick={handleComplete} className="text-white/80 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
          </div>
          <div className="px-4 pb-4 flex items-center gap-2">
            {!isFirstStep && (
              <button onClick={() => setCurrentStep(p => p - 1)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={isLastStep ? handleComplete : () => setCurrentStep(p => p + 1)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all"
            >
              <span>{isLastStep ? "Terminer" : "Suivant"}</span>
              {isLastStep ? <Sparkles className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
          <div className="px-4 pb-3 text-center">
            <button onClick={handleComplete} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Passer le tutoriel
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function shouldShowTour(tourId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`tour_${tourId}_completed`) !== "true";
}

export function resetTour(tourId: string): void {
  localStorage.removeItem(`tour_${tourId}_completed`);
}
