import { useState, useRef } from "react";
import {
	Camera,
	Crop,
	Upload,
	Sparkles,
	Eye,
	CheckCircle2,
	Clock,
	RotateCcw,
	Copy,
	Check,
	ChevronDown,
	Trash2,
	Code,
	Lightbulb,
	FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import type {
	CapturedImageInfo,
	VisualAnalysisResult,
	MultimodalModelOption,
} from "../../../services/screen-capture/types";
import { VISION_SAMPLE_PRESETS } from "../types";
import { generateSampleCanvasImage } from "../utils/generateSampleImage";
import { useVietnameseTranslation } from "@/hooks/useVietnameseTranslation";

interface ScreenCaptureVisionSectionProps {
	currentVisionModel: MultimodalModelOption | null;
	availableVisionModels: MultimodalModelOption[];
	selectedVisionModelId: string;
	onSelectVisionModel: (modelId: string) => void;
	capturedImage: CapturedImageInfo | null;
	onSetCapturedImage: (img: CapturedImageInfo | null) => void;
	onTriggerScreenCapture: (cropImmediately: boolean) => void;
	isCapturing: boolean;
	isAnalyzing: boolean;
	analysisResult: VisualAnalysisResult | null;
	onAnalyzeImage: (customPrompt?: string) => void;
	onOpenCropOverlay: () => void;
	onOpenSettings?: () => void;
	selectedImplementationLanguage: string;
	onSelectImplementationLanguage: (language: string) => void;
	showTranslate: boolean;
}

export function ScreenCaptureVisionSection({
	currentVisionModel,
	availableVisionModels,
	selectedVisionModelId,
	onSelectVisionModel,
	capturedImage,
	onSetCapturedImage,
	onTriggerScreenCapture,
	isCapturing,
	isAnalyzing,
	analysisResult,
	onAnalyzeImage,
	onOpenCropOverlay,
	selectedImplementationLanguage,
	onSelectImplementationLanguage,
	showTranslate,
}: ScreenCaptureVisionSectionProps) {
	const [userContext, setUserContext] = useState("");
	const [copiedCode, setCopiedCode] = useState(false);
	const [copiedAnswer, setCopiedAnswer] = useState(false);
	const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
	const [isSampleDropdownOpen, setIsSampleDropdownOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { entries: translations, toggle: toggleTranslation } =
		useVietnameseTranslation();
	const answerTranslation = translations["vision-answer"];

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			const img = new Image();
			img.onload = () => {
				onSetCapturedImage({
					dataUrl,
					width: img.width,
					height: img.height,
					source: "browser_display_media",
					capturedAt: Date.now(),
				});
			};
			img.src = dataUrl;
		};
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	const handleLoadSample = (sample: (typeof VISION_SAMPLE_PRESETS)[0]) => {
		try {
			const generated = generateSampleCanvasImage(sample);
			onSetCapturedImage(generated);
			setIsSampleDropdownOpen(false);
		} catch (err) {
			console.warn(
				"[ScreenCaptureVisionSection] Error generating canvas sample:",
				err,
			);
		}
	};

	const handleCopyCode = () => {
		if (analysisResult?.extractedCode) {
			navigator.clipboard.writeText(analysisResult.extractedCode);
			setCopiedCode(true);
			setTimeout(() => setCopiedCode(false), 2000);
		}
	};

	const handleCopyAnswer = () => {
		if (analysisResult?.recommendedAnswer) {
			navigator.clipboard.writeText(analysisResult.recommendedAnswer);
			setCopiedAnswer(true);
			setTimeout(() => setCopiedAnswer(false), 2000);
		}
	};

	const isNoModel = !currentVisionModel || !selectedVisionModelId;

	return (
		<div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3.5 shadow-sm flex flex-col h-full">
			{/* Section Header */}
			<div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] gap-2 flex-wrap">
				<div className="flex items-center gap-2.5">
					<div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
						<Eye className="w-4 h-4 text-emerald-400" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<span className="text-[13px] font-semibold text-white/95 leading-tight">
								Kiểm Tra Chụp Màn Hình & Multimodal Vision
							</span>
							<Badge
								variant="outline"
								className="text-[9px] px-1.5 py-0 border font-mono bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
							>
								{currentVisionModel?.provider || "Vision"}
							</Badge>
						</div>
						<span className="text-[10px] text-white/40">
							Chụp màn hình, cắt vùng crop, OCR và trích xuất câu hỏi / code
							LeetCode
						</span>
					</div>
				</div>

				{/* Vision Model Selector Dropdown */}
				<div className="relative">
					<button
						type="button"
						onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
						className="h-7 px-2.5 rounded-lg bg-black/40 border border-white/10 hover:border-white/20 text-[11px] text-white/80 hover:text-white flex items-center gap-1.5 transition-colors"
					>
						<Sparkles className="w-3.5 h-3.5 text-emerald-400" />
						<span className="max-w-[140px] truncate font-mono text-[10.5px]">
							{currentVisionModel?.displayName ||
								currentVisionModel?.name ||
								"Chọn Vision Model"}
						</span>
						<ChevronDown className="w-3 h-3 text-white/40" />
					</button>

					{isModelDropdownOpen && (
						<div className="absolute right-0 top-full mt-1 w-64 max-h-60 overflow-y-auto rounded-xl bg-slate-900 border border-white/15 p-1 z-30 shadow-2xl custom-scrollbar animate-fade-in">
							<div className="px-2 py-1 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
								Mô hình Multimodal Vision
							</div>
							{availableVisionModels.length > 0 ? (
								availableVisionModels.map((m) => (
									<button
										key={m.id}
										type="button"
										onClick={() => {
											onSelectVisionModel(m.id);
											setIsModelDropdownOpen(false);
										}}
										className={cn(
											"w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors",
											selectedVisionModelId === m.id
												? "bg-emerald-500/20 text-emerald-200 font-medium"
												: "text-white/70 hover:bg-white/10 hover:text-white",
										)}
									>
										<span className="truncate">{m.displayName || m.name}</span>
										<Badge
											variant="outline"
											className="text-[8px] px-1 py-0 shrink-0 text-white/50"
										>
											{m.provider}
										</Badge>
									</button>
								))
							) : (
								<div className="px-2 py-2 text-[11px] text-white/40">
									Chưa có mô hình Vision nào được đồng bộ. Vui lòng vào Cài đặt
									để thêm API Key.
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Capture Action Buttons */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
				{/* Fullscreen Capture */}
				<Button
					variant="outline"
					size="sm"
					onClick={() => onTriggerScreenCapture(false)}
					disabled={isCapturing || isAnalyzing}
					className="h-8 px-2 text-[11px] bg-white/[0.03] border-white/10 hover:bg-white/10 text-white flex items-center justify-center gap-1.5"
					title="Chụp ngay toàn bộ màn hình hiện tại"
				>
					<Camera className="w-3.5 h-3.5 text-cyan-400" />
					<span>Chụp Toàn Bộ</span>
				</Button>

				{/* Capture & Crop */}
				<Button
					variant="outline"
					size="sm"
					onClick={() => onTriggerScreenCapture(true)}
					disabled={isCapturing || isAnalyzing}
					className="h-8 px-2 text-[11px] bg-white/[0.03] border-white/10 hover:bg-white/10 text-white flex items-center justify-center gap-1.5"
					title="Chụp màn hình và mở công cụ kéo chọn vùng cần phân tích"
				>
					<Crop className="w-3.5 h-3.5 text-amber-400" />
					<span>Chụp & Cắt Vùng</span>
				</Button>

				{/* Upload File */}
				<Button
					variant="outline"
					size="sm"
					onClick={() => fileInputRef.current?.click()}
					disabled={isCapturing || isAnalyzing}
					className="h-8 px-2 text-[11px] bg-white/[0.03] border-white/10 hover:bg-white/10 text-white flex items-center justify-center gap-1.5"
					title="Tải lên ảnh chụp màn hình có sẵn từ máy tính"
				>
					<Upload className="w-3.5 h-3.5 text-emerald-400" />
					<span>Tải Ảnh Lên</span>
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/png,image/jpeg,image/webp"
					className="hidden"
					onChange={handleFileUpload}
				/>

				{/* Sample Problem Generator Dropdown */}
				<div className="relative">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsSampleDropdownOpen(!isSampleDropdownOpen)}
						disabled={isCapturing || isAnalyzing}
						className="w-full h-8 px-2 text-[11px] bg-white/[0.03] border-white/10 hover:bg-white/10 text-white flex items-center justify-center gap-1.5"
						title="Dùng ảnh bài toán kỹ thuật mẫu để test nhanh mà không cần chụp"
					>
						<Sparkles className="w-3.5 h-3.5 text-violet-400" />
						<span>Đề Bài Mẫu</span>
						<ChevronDown className="w-3 h-3 text-white/40" />
					</Button>

					{isSampleDropdownOpen && (
						<div className="absolute right-0 top-full mt-1 w-64 rounded-xl bg-slate-900 border border-white/15 p-1 z-30 shadow-2xl animate-fade-in">
							<div className="px-2 py-1 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
								Chọn ảnh đề bài mẫu
							</div>
							{VISION_SAMPLE_PRESETS.map((sample) => (
								<button
									key={sample.id}
									type="button"
									onClick={() => handleLoadSample(sample)}
									className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors block"
								>
									<div className="font-medium text-white/90 truncate">
										{sample.title}
									</div>
									<div className="text-[10px] text-white/40 truncate">
										{sample.description}
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Captured Image Preview Strip */}
			{capturedImage ? (
				<div className="bg-black/40 border border-white/[0.08] rounded-xl p-2.5 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2.5 min-w-0">
						<div className="w-16 h-12 rounded-lg overflow-hidden border border-white/15 shrink-0 bg-black/60 relative">
							<img
								src={capturedImage.dataUrl}
								alt="Captured screen preview"
								className="w-full h-full object-cover"
							/>
						</div>
						<div className="min-w-0">
							<div className="flex items-center gap-1.5 flex-wrap">
								<span className="text-[11.5px] font-semibold text-white/90 truncate">
									Ảnh đã sẵn sàng phân tích
								</span>
								<Badge
									variant="outline"
									className="text-[8px] px-1 py-0 text-white/50 border-white/15"
								>
									{capturedImage.width}x{capturedImage.height}px
								</Badge>
							</div>
							<span className="text-[10px] text-white/40 block mt-0.5">
								Nguồn:{" "}
								{capturedImage.source === "native_electron"
									? "⚡ Native Electron"
									: "Trình duyệt Web"}
							</span>
						</div>
					</div>

					<div className="flex items-center gap-1.5 shrink-0">
						<Button
							variant="ghost"
							size="sm"
							onClick={onOpenCropOverlay}
							className="h-7 px-2 text-[10.5px] text-white/70 hover:text-white hover:bg-white/10"
							title="Cắt lại vùng chọn"
						>
							<Crop className="w-3.5 h-3.5 mr-1 text-amber-400" />
							<span>Cắt Vùng</span>
						</Button>

						<Button
							variant="ghost"
							size="sm"
							onClick={() => onSetCapturedImage(null)}
							className="h-7 px-2 text-[10.5px] text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
							title="Xóa ảnh này"
						>
							<Trash2 className="w-3.5 h-3.5" />
						</Button>
					</div>
				</div>
			) : (
				<div className="border border-dashed border-white/15 rounded-xl p-4 text-center text-white/40 space-y-1">
					<Camera className="w-6 h-6 mx-auto text-white/20" />
					<p className="text-xs font-medium text-white/60">
						Chưa có ảnh chụp màn hình
					</p>
					<p className="text-[10.5px] text-white/30">
						Bấm &quot;Chụp Toàn Bộ&quot;, &quot;Chụp & Cắt Vùng&quot; hoặc
						&quot;Đề Bài Mẫu&quot; để nạp ảnh kiểm thử.
					</p>
				</div>
			)}

			{/* Optional User Prompt & Vision Action */}
			<div className="space-y-2">
				<div className="flex items-center justify-between text-[11px] text-white/70">
					<span>Ngữ cảnh hoặc câu hỏi bổ sung cho Vision (tùy chọn):</span>
				</div>
				<div className="flex gap-2">
					<input
						type="text"
						value={userContext}
						onChange={(e) => setUserContext(e.target.value)}
						placeholder="Ví dụ: Giải bằng TypeScript, giải thích Big-O, hoặc tóm tắt lỗi..."
						className="flex-1 text-xs bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-white/90 placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
					/>

					<Button
						size="sm"
						onClick={() => onAnalyzeImage(userContext)}
						disabled={!capturedImage || isAnalyzing || isNoModel}
						className={cn(
							"h-8 px-4 text-xs font-medium gap-1.5 shadow-sm transition-all shrink-0",
							!capturedImage || isNoModel
								? "bg-white/10 text-white/40 cursor-not-allowed"
								: "bg-emerald-600 hover:bg-emerald-500 text-white",
						)}
					>
						{isAnalyzing ? (
							<>
								<RotateCcw className="w-3.5 h-3.5 animate-spin" />
								<span>AI Vision đang đọc...</span>
							</>
						) : (
							<>
								<Sparkles className="w-3.5 h-3.5" />
								<span>Phân Tích Bằng AI Vision</span>
							</>
						)}
					</Button>
				</div>
			</div>

			{/* Vision Analysis Result Panel */}
			<div className="flex-1 flex flex-col min-h-[220px] bg-black/40 border border-white/[0.08] rounded-xl p-3 space-y-2.5">
				<div className="flex items-center justify-between text-white/50 text-[10.5px] pb-1.5 border-b border-white/[0.05]">
					<span className="font-medium text-white/70 flex items-center gap-1.5">
						<FileText className="w-3.5 h-3.5 text-emerald-400" />
						Kết quả phân tích đề bài từ Vision
						{analysisResult && (
							<Badge
								variant="outline"
								className="text-[8.5px] px-1 py-0 border-emerald-500/30 text-emerald-300"
							>
								<Clock className="w-2.5 h-2.5 mr-0.5 inline" />
								{analysisResult.latencyMs}ms
							</Badge>
						)}
					</span>

					{analysisResult && (
						<div className="flex items-center gap-2">
							<span className="text-[9.5px] text-white/35 font-mono">
								{analysisResult.modelName || analysisResult.provider}
							</span>
						</div>
					)}
				</div>

				<div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar space-y-3 pr-1 text-xs text-white/90">
					{analysisResult ? (
						<div className="space-y-3 animate-fade-in">
							{/* Problem Title & Meta Badges */}
							<div className="flex items-start justify-between gap-2">
								<div>
									<h4 className="text-sm font-semibold text-white/95 leading-tight">
										{analysisResult.title}
									</h4>
									{analysisResult.problemSummary && (
										<p className="text-[11.5px] text-white/60 mt-1 leading-relaxed">
											{analysisResult.problemSummary}
										</p>
									)}
								</div>

								<div className="flex items-center gap-1.5 shrink-0 flex-wrap">
									{analysisResult.difficulty && (
										<Badge
											className={cn(
												"text-[9px] px-1.5 py-0 border font-semibold",
												analysisResult.difficulty === "Easy"
													? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
													: analysisResult.difficulty === "Medium"
														? "bg-amber-500/20 text-amber-300 border-amber-500/40"
														: "bg-rose-500/20 text-rose-300 border-rose-500/40",
											)}
										>
											{analysisResult.difficulty}
										</Badge>
									)}

									{analysisResult.language && (
										<Badge
											variant="outline"
											className="text-[9px] px-1.5 py-0 text-cyan-300 border-cyan-500/30"
										>
											{analysisResult.language}
										</Badge>
									)}
								</div>
							</div>

							{/* Extracted Code if available */}
							{analysisResult.extractedCode && (
								<div className="space-y-1 bg-slate-950/80 border border-white/10 rounded-lg p-2.5">
									<div className="flex items-center justify-between text-[10px] text-white/40 pb-1 border-b border-white/[0.06]">
										<span className="flex items-center gap-1 font-mono text-cyan-400">
											<Code className="w-3 h-3" />
											Mã nguồn trích xuất từ ảnh
										</span>
										<button
											type="button"
											onClick={handleCopyCode}
											className="text-white/50 hover:text-white transition-colors"
										>
											{copiedCode ? (
												<Check className="w-3 h-3 text-emerald-400" />
											) : (
												<Copy className="w-3 h-3" />
											)}
										</button>
									</div>
									<pre className="text-[11px] font-mono text-emerald-300 overflow-x-auto custom-scrollbar p-1">
										{analysisResult.extractedCode}
									</pre>
								</div>
							)}

							{analysisResult.contentType === "coding_question" && (
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-cyan-500/25 bg-gradient-to-r from-cyan-950/25 via-cyan-950/10 to-transparent p-2.5 shadow-sm">
									<div className="flex items-center gap-2 min-w-0">
										<div className="w-5 h-5 rounded-md bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
											<Code className="w-3 h-3 text-cyan-300" />
										</div>
										<div className="min-w-0">
											<div className="text-[11px] font-semibold text-cyan-200 leading-tight">
												Ngôn ngữ lời giải
											</div>
											<div className="text-[9.5px] text-white/40 leading-tight truncate">
												{analysisResult.language
													? `Đang dùng: ${selectedImplementationLanguage || analysisResult.language} (bấm để đổi ngôn ngữ)`
													: "Tự động nhận diện theo đề bài hoặc chọn ngôn ngữ"}
											</div>
										</div>
									</div>

									<div className="flex items-center gap-2 shrink-0">
										<div className="w-48 sm:w-56 shrink-0">
											<CustomSelect
												value={selectedImplementationLanguage || ""}
												onChange={(val) => onSelectImplementationLanguage(val)}
												options={[
													{
														value: "",
														label: analysisResult.language
															? `Tự nhận diện (${analysisResult.language})`
															: "Tự nhận diện",
														subLabel: analysisResult.language
															? `Mặc định theo đề bài (${analysisResult.language})`
															: "Tự động nhận diện theo đề bài",
														badge: "AUTO",
													},
													{
														value: "TypeScript",
														label: "TypeScript",
														badge: "TS",
													},
													{ value: "Python", label: "Python", badge: "PY" },
													{ value: "Java", label: "Java", badge: "JAVA" },
													{ value: "Go", label: "Go (Golang)", badge: "GO" },
													{ value: "C++", label: "C++", badge: "CPP" },
													{ value: "C#", label: "C#", badge: "CS" },
													{
														value: "JavaScript",
														label: "JavaScript",
														badge: "JS",
													},
													{ value: "Rust", label: "Rust", badge: "RS" },
												]}
												themeColor="cyan"
												triggerClassName="h-7 text-[11px] py-1 px-2.5 bg-black/60 border-cyan-500/30 text-cyan-100 hover:border-cyan-400/50 hover:bg-cyan-950/30 shadow-sm"
												menuClassName="min-w-[220px]"
											/>
										</div>

										{selectedImplementationLanguage &&
											selectedImplementationLanguage !==
												analysisResult.language && (
												<Button
													type="button"
													size="sm"
													onClick={() => onAnalyzeImage(userContext)}
													disabled={isAnalyzing}
													className="h-6 px-2.5 text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm shrink-0 whitespace-nowrap transition-all"
													title="Gọi lại Vision để sinh lời giải theo ngôn ngữ đã chọn"
												>
													{isAnalyzing ? "Đang sinh..." : "Sinh lại"}
												</Button>
											)}
									</div>
								</div>
							)}

							{/* Key Insights & Strategy */}
							{analysisResult.solutionCode && (
								<div className="space-y-1 bg-emerald-950/20 border border-emerald-500/25 rounded-lg p-2.5">
									<span className="text-[10.5px] font-semibold text-emerald-300 flex items-center gap-1">
										<Code className="w-3 h-3 text-emerald-400" />
										Lời giải tối ưu (
										{analysisResult.language || "ngôn ngữ được nhận diện"}):
									</span>
									<pre className="text-[11px] font-mono text-emerald-200 overflow-x-auto whitespace-pre-wrap">
										{analysisResult.solutionCode}
									</pre>
								</div>
							)}

							{/* Key Insights & Strategy */}
							{analysisResult.keyInsights &&
								analysisResult.keyInsights.length > 0 && (
									<div className="space-y-1.5 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
										<span className="text-[10.5px] font-semibold text-amber-300 flex items-center gap-1">
											<Lightbulb className="w-3 h-3 text-amber-400" />
											Điểm then chốt & Edge Cases:
										</span>
										<ul className="space-y-1">
											{analysisResult.keyInsights.map((insight, idx) => (
												<li
													key={idx}
													className="flex items-start gap-1.5 text-[11px] text-white/75 leading-relaxed"
												>
													<CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
													<span>{insight}</span>
												</li>
											))}
										</ul>
									</div>
								)}

							{/* Step by Step Solution & Complexity */}
							{analysisResult.stepByStepSolution && (
								<div className="space-y-1 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
									<span className="text-[10.5px] font-semibold text-violet-300 flex items-center gap-1">
										<Code className="w-3 h-3 text-violet-400" />
										Các bước giải quyết & Độ phức tạp:
									</span>
									<p className="text-[11px] text-white/75 leading-relaxed whitespace-pre-wrap">
										{analysisResult.stepByStepSolution}
									</p>
									{(analysisResult.timeComplexity ||
										analysisResult.spaceComplexity) && (
										<div className="border-t border-white/[0.05] pt-1 text-[10.5px] text-violet-200/80">
											{analysisResult.timeComplexity && (
												<div>Time: {analysisResult.timeComplexity}</div>
											)}
											{analysisResult.spaceComplexity && (
												<div>Space: {analysisResult.spaceComplexity}</div>
											)}
										</div>
									)}
								</div>
							)}

							{/* Recommended Interviewer Answer */}
							{analysisResult.recommendedAnswer && (
								<div className="space-y-1.5 bg-emerald-950/20 border border-emerald-500/25 rounded-lg p-2.5">
									<div className="flex items-center justify-between">
										<span className="text-[10.5px] font-semibold text-emerald-300 flex items-center gap-1">
											<Sparkles className="w-3 h-3 text-emerald-400" />
											Gợi ý trả lời tự tin với Interviewer:
										</span>
										<button
											type="button"
											onClick={handleCopyAnswer}
											className="text-emerald-400/70 hover:text-emerald-300 transition-colors"
											title="Sao chép lời nói"
										>
											{copiedAnswer ? (
												<Check className="w-3 h-3 text-emerald-400" />
											) : (
												<Copy className="w-3 h-3" />
											)}
										</button>
									</div>
									{showTranslate && (
										<button
											type="button"
											onClick={() =>
												void toggleTranslation(
													"vision-answer",
													analysisResult.recommendedAnswer,
												)
											}
											disabled={answerTranslation?.busy}
											className="text-[10px] text-emerald-300 hover:text-emerald-200"
										>
											{answerTranslation?.busy
												? "Đang dịch..."
												: answerTranslation?.showing
													? "Hiện bản gốc"
													: "Dịch sang tiếng Việt"}
										</button>
									)}
									<p className="text-[11px] text-emerald-100/90 leading-relaxed font-sans whitespace-pre-wrap">
										{answerTranslation?.showing && answerTranslation.text
											? answerTranslation.text
											: analysisResult.recommendedAnswer}
									</p>
									{answerTranslation?.error && (
										<p className="text-[10px] text-rose-300">
											{answerTranslation.error}
										</p>
									)}
								</div>
							)}
						</div>
					) : (
						<div className="h-full flex flex-col items-center justify-center text-center py-8 text-white/30 space-y-1">
							<Eye className="w-6 h-6 text-white/20" />
							<p className="text-[11px]">Chưa có kết quả phân tích hình ảnh.</p>
							<p className="text-[10px] text-white/25">
								Chụp màn hình bài toán phỏng vấn hoặc chọn đề bài mẫu để AI
								Vision phân tích.
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
