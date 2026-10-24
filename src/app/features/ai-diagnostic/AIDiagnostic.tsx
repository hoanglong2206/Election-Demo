import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
	getSavedAIModelId,
	getAllAIModels,
	EMPTY_PLACEHOLDER_MODEL,
	runAILatencyBenchmark,
	type AIModelConfig,
	type AIBenchmarkResult,
} from "../../services/ai-model/aiModels";
import {
	screenCaptureService,
	visualQuestionAnalyzer,
	getAvailableMultimodalModels,
	type CapturedImageInfo,
	type VisualAnalysisResult,
	type MultimodalModelOption,
	type CropRect,
} from "../../services/screen-capture";
import {
	getSavedResponseLanguage,
	normalizeResponseLanguage,
} from "../../services/ai-model/aiModels";
import { settingsManager } from "../../services/settings";
import { ScreenshotCropOverlay } from "../meeting-mode/components/ScreenshotCropOverlay";
import { ScreenCaptureSourcePicker } from "../meeting-mode/components/ScreenCaptureSourcePicker";
import { AIDiagnosticHeader } from "./components/AIDiagnosticHeader";
import { AILatencyBenchmarkSection } from "./components/AILatencyBenchmarkSection";
import { ScreenCaptureVisionSection } from "./components/ScreenCaptureVisionSection";
import type { DiagnosticViewTab } from "./types";

interface AIDiagnosticProps {
	onViewChange?: (
		view:
			| "home"
			| "meeting"
			| "audio-test"
			| "ai-diagnostic"
			| "history"
			| "settings",
	) => void;
}

export function AIDiagnostic({ onViewChange }: AIDiagnosticProps) {
	const [activeTab, setActiveTab] = useState<DiagnosticViewTab>("llm-speed");
	const [generalError, setGeneralError] = useState<string | null>(null);

	// ── LLM Benchmark State ──────────────────────────────────────────────────
	const [allLLMModels, setAllLLMModels] = useState<AIModelConfig[]>(() =>
		getAllAIModels(),
	);
	const [selectedLLMId, setSelectedLLMId] = useState<string>(() =>
		getSavedAIModelId(),
	);
	const currentLLM =
		allLLMModels.find((model) => model.id === selectedLLMId) ||
		EMPTY_PLACEHOLDER_MODEL;

	const [benchmarkResult, setBenchmarkResult] =
		useState<AIBenchmarkResult | null>(null);
	const [isBenchmarking, setIsBenchmarking] = useState(false);

	// Sync available models on storage/focus
	useEffect(() => {
		const handleSync = () => {
			setAllLLMModels(getAllAIModels());
		};
		window.addEventListener("storage", handleSync);
		window.addEventListener("focus", handleSync);
		window.addEventListener("ai-models-updated", handleSync);
		return () => {
			window.removeEventListener("storage", handleSync);
			window.removeEventListener("focus", handleSync);
			window.removeEventListener("ai-models-updated", handleSync);
		};
	}, []);

	const handleRunBenchmark = async (
		modelIdToTest: string,
		promptToTest: string,
	) => {
		setIsBenchmarking(true);
		setGeneralError(null);
		try {
			const res = await runAILatencyBenchmark(modelIdToTest, promptToTest);
			setBenchmarkResult(res);
		} catch (err: any) {
			setGeneralError(err?.message || "Không thể thực hiện đo tốc độ AI.");
		} finally {
			setIsBenchmarking(false);
		}
	};

	// ── Multimodal Vision & Screen Capture State ─────────────────────────────
	const [availableVisionModels, setAvailableVisionModels] = useState<
		MultimodalModelOption[]
	>(() => getAvailableMultimodalModels());
	const [selectedVisionId, setSelectedVisionId] = useState<string>(() => {
		const saved = settingsManager.get("selectedMultimodal") as string;
		if (saved) return saved;
		const models = getAvailableMultimodalModels();
		return models[0]?.id || "";
	});

	const currentVisionModel =
		availableVisionModels.find((m) => m.id === selectedVisionId) ||
		availableVisionModels[0] ||
		null;

	const [capturedImage, setCapturedImage] = useState<CapturedImageInfo | null>(
		null,
	);
	const [isCapturing, setIsCapturing] = useState(false);
	const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
	const [cropAfterCapture, setCropAfterCapture] = useState(false);
	const [isCropping, setIsCropping] = useState(false);
	const [isAnalyzingVision, setIsAnalyzingVision] = useState(false);
	const [visionAnalysisResult, setVisionAnalysisResult] =
		useState<VisualAnalysisResult | null>(null);
	const [selectedImplementationLanguage, setSelectedImplementationLanguage] =
		useState<string>("");
	const [responseLanguage] = useState(() =>
		normalizeResponseLanguage(getSavedResponseLanguage()),
	);
	const [sessionId] = useState(() => "diagnostic_" + Date.now());

	// Refresh vision models list
	useEffect(() => {
		const refreshVision = () => {
			const vModels = getAvailableMultimodalModels();
			setAvailableVisionModels(vModels);
			if (!selectedVisionId && vModels.length > 0) {
				setSelectedVisionId(vModels[0].id);
			}
		};
		refreshVision();
		window.addEventListener("storage", refreshVision);
		return () => window.removeEventListener("storage", refreshVision);
	}, [selectedVisionId]);

	const handleStartScreenCapture = async (source: {
		sourceType: "screen" | "window";
		sourceId?: string;
	}) => {
		setIsSourcePickerOpen(false);
		setIsCapturing(true);
		setGeneralError(null);
		try {
			const imgInfo = await screenCaptureService.captureScreen(source);
			setCapturedImage(imgInfo);
			if (cropAfterCapture) {
				setIsCropping(true);
			}
		} catch (err: any) {
			console.warn("[AIDiagnostic] Screen capture error:", err);
			setGeneralError(
				`Lỗi chụp màn hình: ${err?.message || "Người dùng đã hủy hoặc timeout."}`,
			);
		} finally {
			setIsCapturing(false);
		}
	};

	const handleTriggerScreenCapture = (cropImmediately: boolean) => {
		setCropAfterCapture(cropImmediately);
		setIsSourcePickerOpen(true);
	};

	const handleConfirmCrop = async (cropRect: CropRect) => {
		if (!capturedImage) return;
		setIsCropping(false);
		try {
			const cropped = await screenCaptureService.cropAndCompress(
				capturedImage.dataUrl,
				cropRect,
				{ maxWidth: 1400, quality: 0.85 },
			);
			setCapturedImage({
				dataUrl: cropped.dataUrl,
				width: cropped.width,
				height: cropped.height,
				source: capturedImage.source,
				capturedAt: Date.now(),
			});
		} catch (err: any) {
			console.warn("[AIDiagnostic] Crop error:", err);
			setGeneralError(
				`Lỗi cắt vùng ảnh: ${err?.message || "Không thể cắt ảnh."}`,
			);
		}
	};

	const handleAnalyzeVision = async (
		userPrompt?: string,
		implementationLanguage = selectedImplementationLanguage,
	) => {
		if (!capturedImage) return;
		setIsAnalyzingVision(true);
		setGeneralError(null);
		try {
			const result = await visualQuestionAnalyzer.analyzeVisualQuestion({
				imageBase64: capturedImage.dataUrl,
				mimeType: "image/jpeg",
				thumbnailUrl: capturedImage.dataUrl,
				sessionId,
				userContext: userPrompt?.trim() || undefined,
				customModelId: selectedVisionId,
				responseLanguage: normalizeResponseLanguage(getSavedResponseLanguage()),
				implementationLanguage: implementationLanguage || undefined,
			});
			setVisionAnalysisResult(result);
		} catch (err: any) {
			console.warn("[AIDiagnostic] Vision analysis error:", err);
			setGeneralError(
				`Lỗi phân tích hình ảnh từ AI: ${err?.message || "Không thể kết nối mô hình Vision."}`,
			);
		} finally {
			setIsAnalyzingVision(false);
		}
	};

	const handleImplementationLanguageChange = (language: string) => {
		setSelectedImplementationLanguage(language);
	};

	return (
		<div className="h-full overflow-y-auto p-4 space-y-3.5 animate-fade-in custom-scrollbar">
			{/* Top Header */}
			<AIDiagnosticHeader
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				currentLLM={currentLLM}
				currentVision={currentVisionModel}
				onOpenSettings={
					onViewChange ? () => onViewChange("settings") : undefined
				}
			/>

			{/* Global Error Banner if any */}
			{generalError && (
				<div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start justify-between gap-3 text-rose-200 animate-fade-in">
					<div className="flex items-start gap-2.5">
						<AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
						<div className="text-xs space-y-0.5">
							<span className="font-semibold text-rose-300 block">
								Thông báo lỗi chẩn đoán:
							</span>
							<p className="text-rose-200/90 leading-relaxed">{generalError}</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setGeneralError(null)}
						className="text-rose-300/60 hover:text-rose-200 p-0.5 rounded transition-colors"
						title="Đóng thông báo"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				</div>
			)}

			{/* Main Content Layout based on activeTab */}
			{activeTab === "llm-speed" && (
				<div className="w-full max-w-4xl mx-auto">
					<AILatencyBenchmarkSection
						currentModel={currentLLM}
						availableModels={allLLMModels}
						selectedModelId={selectedLLMId}
						onSelectModel={setSelectedLLMId}
						benchmarkResult={benchmarkResult}
						isBenchmarking={isBenchmarking}
						onRunBenchmark={handleRunBenchmark}
						onOpenSettings={
							onViewChange ? () => onViewChange("settings") : undefined
						}
					/>
				</div>
			)}

			{activeTab === "vision-capture" && (
				<div className="w-full max-w-4xl mx-auto">
					<ScreenCaptureVisionSection
						currentVisionModel={currentVisionModel}
						availableVisionModels={availableVisionModels}
						selectedVisionModelId={selectedVisionId}
						onSelectVisionModel={setSelectedVisionId}
						capturedImage={capturedImage}
						onSetCapturedImage={setCapturedImage}
						onTriggerScreenCapture={handleTriggerScreenCapture}
						isCapturing={isCapturing}
						isAnalyzing={isAnalyzingVision}
						analysisResult={visionAnalysisResult}
						onAnalyzeImage={handleAnalyzeVision}
						selectedImplementationLanguage={selectedImplementationLanguage}
						onSelectImplementationLanguage={handleImplementationLanguageChange}
						showTranslate={responseLanguage === "bilingual"}
						onOpenCropOverlay={() => setIsCropping(true)}
						onOpenSettings={
							onViewChange ? () => onViewChange("settings") : undefined
						}
					/>
				</div>
			)}

			{/* Interactive Screenshot Crop Overlay */}
			{isSourcePickerOpen && (
				<ScreenCaptureSourcePicker
					onSelect={handleStartScreenCapture}
					onCancel={() => setIsSourcePickerOpen(false)}
				/>
			)}

			{isCropping && capturedImage && (
				<ScreenshotCropOverlay
					imageInfo={capturedImage}
					onConfirmCrop={handleConfirmCrop}
					onCancel={() => setIsCropping(false)}
					onRetake={() => {
						setIsCropping(false);
						handleTriggerScreenCapture(true);
					}}
				/>
			)}
		</div>
	);
}
