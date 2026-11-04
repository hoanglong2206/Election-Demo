import { useState, useEffect, useRef, useCallback } from "react";
import {
  getSavedSTTEngineId,
  getAvailableSTTEngines,
  LOCAL_WHISPER_BASE_ENGINE,
} from "@/services/ai-model/aiModels";
import {
  sttJobQueue,
  type STTJob,
  type STTQueueMetrics,
  whisperPromptBuilder,
} from "@/services/ai-model/stt";
import { SpeechSegmenter } from "@/core/audio";
import { getSavedMeetingContext } from "@/services/meeting-context";
import { YOUTUBE_STT_SAMPLES } from "../constants";
import { DEFAULT_JARGON_PRESETS } from "../components/jargon/TechnicalJargonTrainer";
import type { STTLang, STTPreviewLine } from "../types";
import type { AudioSegment } from "@/core/audio/types";
import type { AudioCaptureOwner } from "@/hooks/useAudioPipeline";

export interface UseAudioTestSTTParams {
  isCapturing: boolean;
  captureOwner?: AudioCaptureOwner;
  sourceType: "mic" | "system";
  subscribeAudioFrames?: (
    listener: (pcm16: Int16Array, totalSamples: number) => void
  ) => () => void;
  getAudioSegmentSince?: (
    sinceSample: number,
    minDurationSec?: number
  ) => AudioSegment | null;
}

export function useAudioTestSTT({
  isCapturing,
  captureOwner,
  sourceType,
  subscribeAudioFrames,
  getAudioSegmentSince,
}: UseAudioTestSTTParams) {
  const isTestingActive =
    isCapturing && (captureOwner === "audio-test" || captureOwner === undefined);
  const [selectedSTT, setSelectedSTT] = useState<string>(getSavedSTTEngineId);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttLines, setSttLines] = useState<STTPreviewLine[]>([]);
  const [isSimulatingSTT, setIsSimulatingSTT] = useState(false);
  const [queueMetrics, setQueueMetrics] = useState<STTQueueMetrics>(() =>
    sttJobQueue.getMetrics()
  );
  const [sttLang, setSttLang] = useState<STTLang>("auto");

  // Active keywords tracking in sync with Jargon Trainer
  const [activeKeywords, setActiveKeywords] = useState<string[]>(() => {
    const saved = getSavedMeetingContext().keywords;
    return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_JARGON_PRESETS;
  });
  const activeKeywordsRef = useRef<string[]>(activeKeywords);

  useEffect(() => {
    activeKeywordsRef.current = activeKeywords;
  }, [activeKeywords]);

  useEffect(() => {
    const handleContextUpdate = () => {
      const saved = getSavedMeetingContext().keywords;
      if (Array.isArray(saved) && saved.length > 0) {
        setActiveKeywords(saved);
        activeKeywordsRef.current = saved;
      }
    };
    window.addEventListener("meeting-context-updated", handleContextUpdate);
    window.addEventListener("storage", handleContextUpdate);
    return () => {
      window.removeEventListener("meeting-context-updated", handleContextUpdate);
      window.removeEventListener("storage", handleContextUpdate);
    };
  }, []);

  const availableSTTEngines = getAvailableSTTEngines();
  const currentSTTEngine =
    availableSTTEngines.find((e) => e.id === selectedSTT) ||
    availableSTTEngines[0] ||
    LOCAL_WHISPER_BASE_ENGINE;

  const sequenceIdRef = useRef<number>(1);
  const [initialSessionId] = useState(() => "audiotest_" + Date.now());
  const sessionIdRef = useRef<string>(initialSessionId);
  const lastProcessedSampleRef = useRef<number>(0);
  const segmenterRef = useRef<SpeechSegmenter | null>(null);

  const sttLangRef = useRef<STTLang>("auto");
  const selectedSTTRef = useRef<string>(selectedSTT);
  const sourceTypeRef = useRef<string>(sourceType);

  useEffect(() => {
    sttLangRef.current = sttLang;
    selectedSTTRef.current = selectedSTT;
    sourceTypeRef.current = sourceType;
  }, [sttLang, selectedSTT, sourceType]);

  // Reset sample pointer, session ID & queue when capture state toggles
  useEffect(() => {
    if (isTestingActive) {
      const newSessionId = "audiotest_" + Date.now();
      sessionIdRef.current = newSessionId;
      sequenceIdRef.current = 1;
      lastProcessedSampleRef.current = 0;
      sttJobQueue.reset(newSessionId);
    }
  }, [isTestingActive]);

  // Revert sttJobQueue provider back to settings configuration & cancel pending jobs when unmounting
  useEffect(() => {
    return () => {
      sttJobQueue.handleProviderSwitch(getSavedSTTEngineId(), {
        cancelPending: true,
      });
      sttJobQueue.clear();
    };
  }, []);

  // Sync STT provider & concurrency limit
  useEffect(() => {
    sttJobQueue.handleProviderSwitch(selectedSTT);
  }, [selectedSTT]);

  // Subscribe to STTJobQueue metrics & TranscriptAssembler monotonic commits
  useEffect(() => {
    const unsubMetrics = sttJobQueue.subscribe((m) => {
      setQueueMetrics(m);
      setIsTranscribing(m.processingJobs > 0 || m.queueDepth > 0);
    });

    const unsubCommit = sttJobQueue.assembler.onCommit((commit) => {
      const { result, speakerLabel, timestampStr } = commit;
      if (result.success && result.text.trim()) {
        const newLine: STTPreviewLine = {
          id: Date.now() + Math.random(),
          timestamp: timestampStr || "00:00",
          originalEn: result.text,
          translatedVi: result.translatedVi || result.text,
          confidence: result.confidence || 98,
          latencyMs: result.latencyMs,
          speaker: speakerLabel || "Audio Stream",
          engineBadge: `${result.engineName.split(" (")[0]}`,
          isReal: true,
        };

        setSttLines((prev) => {
          if (
            prev.length > 0 &&
            prev[prev.length - 1].originalEn.trim().toLowerCase() ===
              result.text.trim().toLowerCase()
          ) {
            return prev;
          }
          return [...prev, newLine];
        });
      }
    });

    return () => {
      unsubMetrics();
      unsubCommit();
    };
  }, []);

  const dispatchSegment = useCallback(
    (segment: { blob: Blob; hasSpeech: boolean; durationMs?: number }) => {
      if (!segment.hasSpeech) return;

    const seqId = sequenceIdRef.current++;
    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, "0")}:${String(
      now.getSeconds()
    ).padStart(2, "0")}`;

    const effectiveLang =
      sttLangRef.current === "auto"
        ? sourceTypeRef.current === "system"
          ? "en"
          : "vi"
        : sttLangRef.current;

    const dynamicPrompt = whisperPromptBuilder.buildPrompt(activeKeywordsRef.current, {
      language: effectiveLang,
      contextType: "discussion",
    });

    const job: STTJob = {
      jobId: `stt_${sessionIdRef.current}_${seqId}_${Date.now()}`,
      sessionId: sessionIdRef.current,
      sequenceId: seqId,
      audioBuffer: segment.blob,
      hasSpeech: true,
      createdAt: Date.now(),
      priority: 1,
      engineId: selectedSTTRef.current,
      language: sttLangRef.current,
      sourceType: sourceTypeRef.current as "system" | "mic",
      speakerLabel:
        sourceTypeRef.current === "system"
          ? "YouTube / Loopback"
          : "Microphone Speaker",
      timestampStr: timeStr,
      prompt: dynamicPrompt || undefined,
      feature: "audio_signal_test",
      durationMs: segment.durationMs,
    };

    sttJobQueue.enqueue(job);
  }, []);

  // Real-Time Sentence-Boundary Speech-to-Text Pipeline
  useEffect(() => {
    if (!isTestingActive) {
      if (segmenterRef.current) {
        const flushed = segmenterRef.current.flush();
        if (flushed && flushed.hasSpeech) {
          dispatchSegment(flushed);
        }
        segmenterRef.current.reset();
      }
      sttJobQueue.pause();
      return;
    }

    sttJobQueue.resume();

    // Use intelligent sentence segmenter with VAD:
    // Natural human pauses (silenceEndMs = 400ms) or max sentence ceiling (4500ms)
    // Prevents aggressive 1-second chopping that causes queue backpressure and dropped chunks.
    const segmenter = new SpeechSegmenter({
      sampleRate: 16000,
      silenceEndMs: 400,
      maxSegmentMs: 4500,
      vadThresholdRms: 0.012,
    });
    segmenterRef.current = segmenter;

    if (subscribeAudioFrames) {
      const unsub = subscribeAudioFrames((pcm16, totalSamples) => {
        if (!isTestingActive || !segmenterRef.current) return;
        const closed = segmenterRef.current.feed(pcm16, totalSamples);
        for (const seg of closed) {
          if (seg.hasSpeech) {
            dispatchSegment(seg);
          }
        }
      });

      return () => {
        unsub();
        if (segmenterRef.current) {
          const flushed = segmenterRef.current.flush();
          if (flushed && flushed.hasSpeech) {
            dispatchSegment(flushed);
          }
          segmenterRef.current.reset();
        }
        sttJobQueue.pause();
      };
    } else if (getAudioSegmentSince) {
      // Fallback for mocked unit tests or environments without subscribeAudioFrames
      const intervalTimer = setInterval(() => {
        // Backpressure guard: if queue is already processing or waiting, don't overload
        if (sttJobQueue.getMetrics().queueDepth >= 2) return;

        const segment = getAudioSegmentSince(lastProcessedSampleRef.current, 2.5);
        if (!segment) return;

        lastProcessedSampleRef.current = segment.endSample;
        if (segment.hasAudio) {
          dispatchSegment({
            blob: segment.blob,
            hasSpeech: true,
            durationMs: Math.round((segment.sampleCount / 16000) * 1000),
          });
        }
      }, 1500);

      return () => {
        clearInterval(intervalTimer);
        sttJobQueue.pause();
      };
    }
  }, [isTestingActive, subscribeAudioFrames, getAudioSegmentSince, dispatchSegment]);

  const handleSimulateSTT = useCallback(() => {
    setIsSimulatingSTT(true);
    setSttLines((prev) => {
      if (prev.length === 0) {
        const first = YOUTUBE_STT_SAMPLES[0];
        return [
          {
            id: Date.now(),
            timestamp: "00:04",
            originalEn: first.originalEn,
            translatedVi: first.translatedVi,
            confidence: first.confidence,
            latencyMs: first.latencyMs,
            speaker: "YouTube / Audio Stream",
            engineBadge: `${currentSTTEngine.name.split(" (")[0]}`,
          },
        ];
      }
      const idx = prev.length % YOUTUBE_STT_SAMPLES.length;
      const sample = YOUTUBE_STT_SAMPLES[idx];
      return [
        ...prev,
        {
          id: Date.now(),
          timestamp: `00:${String((prev.length + 1) * 4).padStart(2, "0")}`,
          originalEn: sample.originalEn,
          translatedVi: sample.translatedVi,
          confidence: sample.confidence,
          latencyMs: sample.latencyMs,
          speaker:
            sourceTypeRef.current === "system"
              ? "YouTube / Audio Stream"
              : "Microphone Speaker",
          engineBadge: `${currentSTTEngine.name.split(" (")[0]}`,
        },
      ];
    });
  }, [currentSTTEngine.name]);

  const handleClearSTT = useCallback(() => {
    setSttLines([]);
    setIsSimulatingSTT(false);
    sequenceIdRef.current = 1;
    sessionIdRef.current = "audiotest_" + Date.now();
    lastProcessedSampleRef.current = 0;
    sttJobQueue.reset(sessionIdRef.current);
    if (segmenterRef.current) {
      segmenterRef.current.reset();
    }
  }, []);

  const handleSelectSTTEngine = useCallback((engineId: string) => {
    setSelectedSTT(engineId);
    sttJobQueue.handleProviderSwitch(engineId);
  }, []);

  return {
    selectedSTT,
    setSelectedSTT: handleSelectSTTEngine,
    availableSTTEngines,
    currentSTTEngine,
    sttLang,
    setSttLang,
    sttLines,
    isTranscribing,
    isSimulatingSTT,
    queueMetrics,
    handleSimulateSTT,
    handleClearSTT,
    activeKeywords,
  };
}
