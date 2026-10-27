import { useState } from "react";
import {
	UserCheck,
	Brain,
	Trash2,
	Check,
	FileCheck,
	Upload,
	MessageSquare,
	Loader2,
	AlertCircle,
	X,
	Sparkles,
	Tag,
	RefreshCw,
	Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppMode } from "../../../types/electron.d";
import type { MeetingContextData } from "../../../services/meetingContext";
import { jdKeywordExtractor } from "../../../services/ai-model/stt";
import type { ProfilePreset } from "../../../services/profile-preset";
import { ProfilePresetBar } from "./ProfilePresetBar";

interface ContextEditorCardProps {
	mode: AppMode;
	onModeChange?: (mode: AppMode) => void;
	contextData: MeetingContextData;
	interviewTab: "cv" | "jd";
	isContextSaved: boolean;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	cvTokens: number;
	jdTokens: number;
	discussionTokens: number;
	currentModeTokens: number;
	hasModeContext: boolean;
	hasCV: boolean;
	hasJD: boolean;
	isParsingDocument?: boolean;
	parsingError?: string | null;
	matchScore?: number;
	onClearParsingError?: () => void;
	onOpenMatchAnalysis?: () => void;
	onInterviewTabChange: (tab: "cv" | "jd") => void;
	onContextChange: (data: MeetingContextData) => void;
	onSaveContext: () => void;
	onClearContext: () => void;
	onLoadSampleCV: () => void;
	onLoadSampleJD: () => void;
	onLoadSampleDiscussion: () => void;
	onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onAddKeyword?: (kw: string) => void;
	onRemoveKeyword?: (kw: string) => void;
	onReExtractKeywords?: () => void;
	activeProfile?: ProfilePreset | null;
	allProfiles?: ProfilePreset[];
	onSelectProfile?: (id: string) => void;
	onCreateProfile?: () => void;
	onEditProfile?: (preset: ProfilePreset) => void;
	onDuplicateProfile?: (id: string) => void;
	onDeleteProfile?: (preset: ProfilePreset) => void;
	onOpenImportExport?: () => void;
	className?: string;
}

export function ContextEditorCard({
	className,
	mode,
	onModeChange,
	contextData,
	interviewTab,
	isContextSaved,
	fileInputRef,
	cvTokens,
	jdTokens,
	discussionTokens,
	currentModeTokens,
	hasModeContext,
	hasCV,
	hasJD,
	isParsingDocument = false,
	parsingError = null,
	matchScore,
	onClearParsingError,
	onOpenMatchAnalysis,
	onInterviewTabChange,
	onContextChange,
	onSaveContext,
	onClearContext,
	onLoadSampleCV,
	onLoadSampleJD,
	onLoadSampleDiscussion,
	onFileUpload,
	onAddKeyword,
	onRemoveKeyword,
	onReExtractKeywords,
	activeProfile,
	allProfiles,
	onSelectProfile,
	onCreateProfile,
	onEditProfile,
	onDuplicateProfile,
	onDeleteProfile,
	onOpenImportExport,
}: ContextEditorCardProps) {
	const [newKeywordInput, setNewKeywordInput] = useState("");
	const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
	const [extractKeywordsSuccess, setExtractKeywordsSuccess] = useState(false);

	const handleTriggerFileUpload = () => {
		// Preload parser chunk dynamically in background while file dialog is open,
		// ensuring pdfjs/mammoth are never loaded during app boot (< 300ms startup)
		void import("../../../services/documentParser");
		fileInputRef.current?.click();
	};

	const handleReExtract = () => {
		if (isExtractingKeywords || !onReExtractKeywords) return;
		setIsExtractingKeywords(true);
		setExtractKeywordsSuccess(false);
		onReExtractKeywords();
		setTimeout(() => {
			setIsExtractingKeywords(false);
			setExtractKeywordsSuccess(true);
			setTimeout(() => {
				setExtractKeywordsSuccess(false);
			}, 1800);
		}, 450);
	};

	const handleAddKeyword = () => {
		const normalized = jdKeywordExtractor.normalizeKeyword(newKeywordInput);
		if (!normalized) return;
		if (onAddKeyword) {
			onAddKeyword(normalized);
		} else {
			if (mode === "interview") {
				const current = contextData.keywords || [];
				if (
					!current.some((k) => k.toLowerCase() === normalized.toLowerCase())
				) {
					onContextChange({
						...contextData,
						keywords: [...current, normalized],
					});
				}
			} else {
				const current = contextData.discussionKeywords || [];
				if (
					!current.some((k) => k.toLowerCase() === normalized.toLowerCase())
				) {
					onContextChange({
						...contextData,
						discussionKeywords: [...current, normalized],
					});
				}
			}
		}
		setNewKeywordInput("");
	};

	const handleRemoveKeyword = (kwToRemove: string) => {
		if (onRemoveKeyword) {
			onRemoveKeyword(kwToRemove);
		} else {
			if (mode === "interview") {
				const current = contextData.keywords || [];
				onContextChange({
					...contextData,
					keywords: current.filter(
						(k) => k.toLowerCase() !== kwToRemove.toLowerCase(),
					),
				});
			} else {
				const current = contextData.discussionKeywords || [];
				onContextChange({
					...contextData,
					discussionKeywords: current.filter(
						(k) => k.toLowerCase() !== kwToRemove.toLowerCase(),
					),
				});
			}
		}
	};

	const renderKeywordsSection = (theme: "violet" | "indigo") => {
		const isViolet = theme === "violet";
		const accentClass = isViolet ? "text-violet-400" : "text-indigo-400";
		const borderClass = isViolet
			? "border-violet-500/30"
			: "border-indigo-500/30";
		const bgTagClass = isViolet
			? "bg-violet-500/15 hover:bg-violet-500/25"
			: "bg-indigo-500/15 hover:bg-indigo-500/25";
		const textTagClass = isViolet ? "text-violet-200" : "text-indigo-200";
		const btnBgClass = isViolet
			? "bg-violet-600 hover:bg-violet-500"
			: "bg-indigo-600 hover:bg-indigo-500";
		const focusBorder = isViolet
			? "focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25"
			: "focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25";

		const currentKeywords =
			mode === "interview"
				? contextData.keywords || []
				: contextData.discussionKeywords || [];

		return (
			<div className="shrink-0 flex flex-col mt-1.5 p-1.5 rounded-xl bg-black/35 border border-white/[0.07] overflow-hidden">
				<div className="flex items-center justify-between gap-2 shrink-0 pb-1 border-b border-white/[0.04]">
					<div className="flex items-center gap-1.5 min-w-0">
						<Tag className={cn("w-3.5 h-3.5 shrink-0", accentClass)} />
						<span className="text-[11px] font-semibold text-white/90 truncate">
							Technical Keywords
						</span>
						{currentKeywords.length > 0 ? (
							<Badge
								variant="outline"
								className={cn(
									"text-[8.5px] px-1.5 py-0 h-3.5 shrink-0 whitespace-nowrap font-mono",
									isViolet
										? "bg-violet-500/15 text-violet-300 border-violet-500/30"
										: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
								)}
							>
								{currentKeywords.length} keywords
							</Badge>
						) : (
							<Badge
								variant="outline"
								className="text-[8.5px] bg-white/5 text-white/40 border-white/10 px-1.5 py-0 h-3.5 shrink-0 whitespace-nowrap"
							>
								0 keywords
							</Badge>
						)}
					</div>

					{onReExtractKeywords && (
						<button
							type="button"
							id="btn-re-extract-keywords"
							disabled={isExtractingKeywords}
							onClick={handleReExtract}
							className={cn(
								"text-[9.5px] flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all shrink-0 whitespace-nowrap shadow-sm select-none",
								isExtractingKeywords
									? "bg-violet-500/25 border-violet-400/50 text-white cursor-wait animate-pulse"
									: extractKeywordsSuccess
										? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
										: isViolet
											? "bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/25 text-white/80 hover:text-white"
											: "bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/25 text-white/80 hover:text-white",
							)}
							title="Quét lại nội dung để tự động cập nhật danh sách từ khóa kỹ thuật cho Whisper"
						>
							{isExtractingKeywords ? (
								<>
									<RefreshCw className="w-2.5 h-2.5 shrink-0 animate-spin text-violet-300" />
									<span className="whitespace-nowrap font-medium text-violet-200">
										Đang trích xuất...
									</span>
								</>
							) : extractKeywordsSuccess ? (
								<>
									<Check className="w-2.5 h-2.5 shrink-0 text-emerald-400 animate-scale-in" />
									<span className="whitespace-nowrap font-medium text-emerald-300">
										Đã cập nhật!
									</span>
								</>
							) : (
								<>
									<RefreshCw className="w-2.5 h-2.5 shrink-0 transition-transform group-hover:rotate-180 duration-500" />
									<span className="whitespace-nowrap">
										Trích xuất lại từ {mode === "interview" ? "JD" : "Chủ đề"}
									</span>
								</>
							)}
						</button>
					)}
				</div>

				{/* Scrollable Keyword Tags List: capped at 2 lines (max-h-[48px]), scrolls when 3+ lines */}
				<div
					className={cn(
						"max-h-[48px] overflow-y-auto custom-scrollbar flex flex-wrap content-start items-center gap-1 py-0.5 transition-opacity duration-200",
						isExtractingKeywords && "opacity-50",
					)}
				>
					{currentKeywords.length > 0 ? (
						currentKeywords.map((kw) => (
							<span
								key={kw}
								className={cn(
									"inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9.5px] font-mono transition-all group",
									bgTagClass,
									borderClass,
									textTagClass,
								)}
							>
								<span>{kw}</span>
								<button
									type="button"
									onClick={() => handleRemoveKeyword(kw)}
									className="text-white/40 hover:text-rose-400 p-0.5 -mr-0.5 transition-colors rounded hover:bg-white/10"
									title={`Xóa keyword ${kw}`}
								>
									<X className="w-2.5 h-2.5" />
								</button>
							</span>
						))
					) : (
						<div className="flex items-center gap-1.5 text-[10px] text-white/40 italic py-1">
							<Sparkles className="w-3 h-3 text-white/20 shrink-0" />
							<span>
								Chưa có keyword kỹ thuật. Whisper sẽ nhận diện ở chế độ mặc định
								(không prompt).
							</span>
						</div>
					)}
				</div>

				{/* Bottom add keyword input */}
				<div className="shrink-0 pt-1 border-t border-white/[0.04] flex items-center gap-1.5">
					<input
						id="input-add-keyword"
						type="text"
						value={newKeywordInput}
						onChange={(e) => setNewKeywordInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleAddKeyword();
							}
						}}
						placeholder="+ Thêm keyword mới (nhấn Enter)..."
						className={cn(
							"bg-black/50 border border-white/10 rounded-md px-2 py-0.5 text-[10px] text-white/90 placeholder:text-white/30 focus:outline-none flex-1 min-w-0 transition-all",
							focusBorder,
						)}
					/>
					{newKeywordInput.trim() && (
						<button
							type="button"
							id="btn-confirm-add-keyword"
							onClick={handleAddKeyword}
							className={cn(
								"text-[9.5px] px-2 py-0.5 rounded-md text-white font-medium flex items-center gap-0.5 whitespace-nowrap shrink-0 transition-all shadow-sm",
								btnBgClass,
							)}
						>
							<Plus className="w-2.5 h-2.5 shrink-0" />
							<span className="whitespace-nowrap">Thêm</span>
						</button>
					)}
				</div>
			</div>
		);
	};

	return (
		<Card
			className={cn(
				"bg-zinc-950/40 border border-white/[0.08] backdrop-blur-sm rounded-xl p-2.5 flex flex-col justify-between min-w-0 overflow-hidden shadow-sm gap-1.5",
				className,
			)}
		>
			{/* ── Top Header Section (Shrink-0) ── */}
			<div className="shrink-0 space-y-1">
				{/* Row 1: Title + Centered Mode Switcher (Symmetric 3-col Grid) + Clear & Save buttons */}
				<div className="pb-1 border-b border-white/[0.05] grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-h-[30px]">
					{/* Left: Card Title with smooth transition & truncation */}
					<div className="flex items-center gap-1.5 min-w-0">
						<div
							className={cn(
								"w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors duration-200",
								mode === "interview"
									? "bg-violet-600/20 border-violet-500/30 text-violet-400"
									: "bg-indigo-600/20 border-indigo-500/30 text-indigo-400",
							)}
						>
							{mode === "interview" ? (
								<UserCheck className="w-3 h-3" />
							) : (
								<Brain className="w-3 h-3" />
							)}
						</div>
						<span
							className="text-[11.5px] text-white/90 font-semibold leading-tight truncate transition-colors duration-200"
							title={mode === "interview" ? "Hồ Sơ & CV" : "Chủ Đề Thảo Luận"}
						>
							{mode === "interview" ? "Hồ Sơ & CV" : "Chủ Đề Thảo Luận"}
						</span>
					</div>

					{/* Center: Mode Switcher pinned to center without horizontal jumping */}
					{onModeChange ? (
						<div className="flex items-center justify-center">
							<div className="h-7 flex items-center bg-black/60 p-0.5 rounded-lg border border-white/10 shadow-inner shrink-0">
								<button
									type="button"
									id="btn-mode-tab-interview"
									onClick={() => onModeChange("interview")}
									className={cn(
										"h-full w-[84px] flex items-center justify-center gap-1.5 rounded-md text-[10px] font-medium transition-all duration-200 select-none whitespace-nowrap",
										mode === "interview"
											? "bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.35)] font-semibold"
											: "text-white/45 hover:text-white/80 hover:bg-white/[0.04]",
									)}
									title="Chế độ Phỏng vấn: Nạp CV & JD để AI đóng vai ứng viên"
								>
									<UserCheck className="w-2.5 h-2.5 shrink-0" />
									<span>Phỏng vấn</span>
								</button>
								<button
									type="button"
									id="btn-mode-tab-discussion"
									onClick={() => onModeChange("discussion")}
									className={cn(
										"h-full w-[84px] flex items-center justify-center gap-1.5 rounded-md text-[10px] font-medium transition-all duration-200 select-none whitespace-nowrap",
										mode === "discussion"
											? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)] font-semibold"
											: "text-white/45 hover:text-white/80 hover:bg-white/[0.04]",
									)}
									title="Chế độ Thảo luận: Điền chủ đề, bài toán kiến trúc cuộc họp"
								>
									<Brain className="w-2.5 h-2.5 shrink-0" />
									<span>Thảo luận</span>
								</button>
							</div>
						</div>
					) : (
						<div />
					)}

					{/* Right: Actions */}
					<div className="flex items-center justify-end gap-1 min-w-0">
						{hasModeContext && (
							<button
								type="button"
								onClick={onClearContext}
								className="text-[9.5px] text-red-400/70 hover:text-red-300 flex items-center gap-0.5 px-1 py-0.5 whitespace-nowrap transition-colors shrink-0"
								title="Xóa toàn bộ nội dung ngữ cảnh hiện tại"
							>
								<Trash2 className="w-2.5 h-2.5" />
								<span>Xóa</span>
							</button>
						)}
						<Button
							id="btn-save-context"
							size="sm"
							onClick={onSaveContext}
							className={cn(
								"text-[10px] h-6 px-2 font-medium transition-all whitespace-nowrap shadow-sm shrink-0",
								isContextSaved
									? "bg-emerald-600 hover:bg-emerald-500 text-white"
									: "bg-violet-600 hover:bg-violet-500 text-white",
							)}
						>
							{isContextSaved ? (
								<>
									<Check className="w-2.5 h-2.5 mr-1" />
									Đã lưu
								</>
							) : (
								"Lưu context"
							)}
						</Button>
					</div>
				</div>

				{/* Row 2: Subtitle text + Badges & Match analysis */}
				<div className="flex items-center justify-between h-5 gap-1.5 text-[10px]">
					<p
						className="text-white/40 leading-none truncate flex-1 min-w-0"
						title={
							mode === "interview"
								? "Nạp CV & JD để AI phỏng vấn sát với thực tế."
								: "Điền chủ đề & tài liệu để AI hỗ trợ thảo luận."
						}
					>
						{mode === "interview"
							? "Nạp CV & JD để AI phỏng vấn sát với thực tế."
							: "Điền chủ đề & tài liệu để AI hỗ trợ thảo luận."}
					</p>

					<div className="flex items-center gap-1 shrink-0">
						{mode === "discussion" &&
							(hasModeContext ? (
								<Badge
									variant="outline"
									className="text-[8.5px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-1.5 py-0.5 h-4.5 font-mono whitespace-nowrap"
								>
									{currentModeTokens} tokens
								</Badge>
							) : (
								<Badge
									variant="outline"
									className="text-[8.5px] bg-white/5 text-white/40 border-white/10 px-1.5 py-0 h-3.5 whitespace-nowrap"
								>
									Chưa có
								</Badge>
							))}

						{mode === "interview" && (
							<div className="flex items-center gap-1 text-[8.5px] font-mono whitespace-nowrap">
								{currentModeTokens > 0 ? (
									<Badge
										variant="outline"
										className="text-[8.5px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-1.5 py-0.5 h-4.5 font-mono"
									>
										{currentModeTokens} tokens
									</Badge>
								) : (
									<Badge
										variant="outline"
										className="text-[8.5px] bg-white/5 text-white/40 border-white/10 px-1.5 py-0 h-3.5 whitespace-nowrap"
									>
										Chưa có
									</Badge>
								)}

								{hasCV && hasJD && onOpenMatchAnalysis && (
									<button
										type="button"
										id="btn-match-analysis"
										onClick={onOpenMatchAnalysis}
										className={cn(
											"px-1.5 py-0.5 rounded text-[8.5px] font-semibold flex items-center gap-1 border shadow-sm transition-all",
											matchScore !== undefined && matchScore >= 75
												? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25"
												: matchScore !== undefined && matchScore >= 50
													? "bg-violet-500/20 text-violet-200 border-violet-500/35 hover:bg-violet-500/30"
													: "bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25",
										)}
										title="Xem chi tiết độ tương thích giữa CV và JD"
									>
										<Sparkles className="w-2.5 h-2.5 text-amber-300" />
										<span>
											Độ khớp:{" "}
											{matchScore !== undefined ? `${matchScore}%` : "Kiểm tra"}
										</span>
									</button>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Row 3: Preset Toolbar */}
				<div className="shrink-0">
					{mode === "interview" ? (
						allProfiles &&
						onSelectProfile &&
						onCreateProfile &&
						onEditProfile &&
						onDuplicateProfile &&
						onDeleteProfile &&
						onOpenImportExport ? (
							<ProfilePresetBar
								activeProfile={activeProfile}
								allProfiles={allProfiles}
								onSelectProfile={onSelectProfile}
								onCreateProfile={onCreateProfile}
								onEditProfile={onEditProfile}
								onDuplicateProfile={onDuplicateProfile}
								onDeleteProfile={onDeleteProfile}
								onOpenImportExport={onOpenImportExport}
							/>
						) : null
					) : (
						<div className="w-full h-8 flex items-center justify-between px-2.5 rounded-lg bg-black/40 border border-white/[0.08] text-[10px]">
							<div className="flex items-center gap-1.5 min-w-0 truncate">
								<span className="text-white/40">Chủ đề mẫu:</span>
								<button
									type="button"
									onClick={onLoadSampleDiscussion}
									className="text-indigo-300 hover:text-white underline underline-offset-2 transition-colors whitespace-nowrap"
								>
									+ Caching & Redis Cluster
								</button>
							</div>
							{contextData.uploadedFileName && (
								<div className="flex items-center gap-1 text-[9.5px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded shrink-0">
									<FileCheck className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
									<span className="truncate max-w-[120px]">
										{contextData.uploadedFileName}
									</span>
									<button
										type="button"
										onClick={() =>
											onContextChange({
												...contextData,
												uploadedFileName: undefined,
											})
										}
										className="text-white/40 hover:text-white/80 ml-0.5"
										title="Xóa đính kèm"
									>
										<X className="w-2.5 h-2.5" />
									</button>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Hidden File Input */}
				<input
					ref={fileInputRef}
					type="file"
					accept=".pdf,.docx,.doc,.txt,.md"
					className="hidden"
					onChange={onFileUpload}
				/>

				{/* Parsing error alert */}
				{parsingError && (
					<div className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 flex items-center justify-between text-[9.5px] text-rose-300 animate-fade-in shrink-0">
						<div className="flex items-center gap-1.5 min-w-0">
							<AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
							<span className="truncate">{parsingError}</span>
						</div>
						{onClearParsingError && (
							<button
								type="button"
								onClick={onClearParsingError}
								className="text-rose-400 hover:text-rose-200 ml-2 shrink-0"
							>
								<X className="w-2.5 h-2.5" />
							</button>
						)}
					</div>
				)}
			</div>

			{/* Row 4: Tabs / Sub-actions (Compact & Guaranteed No Overflow) */}
			<div className="h-7 flex items-center justify-between gap-1.5 shrink-0 min-w-0">
				{mode === "interview" ? (
					<>
						<div className="flex items-center bg-black/45 p-0.5 rounded-lg border border-white/[0.08] shadow-inner min-w-0">
							<button
								type="button"
								id="tab-cv"
								onClick={() => onInterviewTabChange("cv")}
								className={cn(
									"px-2 py-0.5 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0",
									interviewTab === "cv"
										? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md font-semibold"
										: "text-white/50 hover:text-white/80 hover:bg-white/[0.04]",
								)}
							>
								<span
									className={cn(
										"w-1.5 h-1.5 rounded-full shrink-0",
										hasCV
											? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
											: "bg-white/25",
									)}
								/>
								<span>1. CV & Kinh Nghiệm</span>
								{cvTokens > 0 && (
									<span className="text-[8.5px] px-1 py-0 rounded bg-black/30 font-mono opacity-85">
										{cvTokens}
									</span>
								)}
							</button>

							<button
								type="button"
								id="tab-jd"
								onClick={() => onInterviewTabChange("jd")}
								className={cn(
									"px-2 py-0.5 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0",
									interviewTab === "jd"
										? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md font-semibold"
										: "text-white/50 hover:text-white/80 hover:bg-white/[0.04]",
								)}
							>
								<span
									className={cn(
										"w-1.5 h-1.5 rounded-full shrink-0",
										hasJD
											? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
											: "bg-white/25",
									)}
								/>
								<span>2. Mô Tả JD</span>
								{jdTokens > 0 && (
									<span className="text-[8.5px] px-1 py-0 rounded bg-black/30 font-mono opacity-85">
										{jdTokens}
									</span>
								)}
								{contextData.keywords && contextData.keywords.length > 0 && (
									<span className="text-[8px] bg-violet-400/25 text-violet-200 border border-violet-400/35 px-1 rounded-full font-mono shrink-0">
										{contextData.keywords.length} kw
									</span>
								)}
							</button>
						</div>

						<div className="flex items-center gap-1.5 shrink-0">
							{interviewTab === "cv" ? (
								<>
									<button
										type="button"
										id="btn-sample-cv"
										onClick={onLoadSampleCV}
										className="text-[10px] text-violet-300/80 hover:text-white underline underline-offset-2 whitespace-nowrap transition-colors"
									>
										+ Mẫu
									</button>
									<button
										type="button"
										id="btn-upload-cv"
										disabled={isParsingDocument}
										onClick={handleTriggerFileUpload}
										className={cn(
											"text-[10px] h-6 flex items-center gap-1 px-2 rounded-md border transition-all font-medium whitespace-nowrap shadow-sm",
											isParsingDocument
												? "bg-amber-500/10 text-amber-300 border-amber-500/25 cursor-wait"
												: "text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/25",
										)}
										title="Upload file CV (.pdf, .docx, .txt, .md)"
									>
										{isParsingDocument ? (
											<>
												<Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />
												<span>Đang đọc...</span>
											</>
										) : (
											<>
												<Upload className="w-2.5 h-2.5" />
												<span>Upload CV</span>
											</>
										)}
									</button>
								</>
							) : (
								<>
									<button
										type="button"
										id="btn-sample-jd"
										onClick={onLoadSampleJD}
										className="text-[10px] text-violet-300/80 hover:text-white underline underline-offset-2 whitespace-nowrap transition-colors"
									>
										+ Mẫu
									</button>
									<button
										type="button"
										id="btn-upload-jd"
										disabled={isParsingDocument}
										onClick={handleTriggerFileUpload}
										className={cn(
											"text-[10px] h-6 flex items-center gap-1 px-2 rounded-md border transition-all font-medium whitespace-nowrap shadow-sm",
											isParsingDocument
												? "bg-amber-500/10 text-amber-300 border-amber-500/25 cursor-wait"
												: "text-violet-300 hover:text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/25",
										)}
										title="Upload file JD (.pdf, .docx, .txt, .md)"
									>
										{isParsingDocument ? (
											<>
												<Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />
												<span>Đang đọc...</span>
											</>
										) : (
											<>
												<Upload className="w-2.5 h-2.5" />
												<span>Upload JD</span>
											</>
										)}
									</button>
								</>
							)}
						</div>
					</>
				) : (
					<>
						<span className="text-[10.5px] font-medium text-indigo-300 flex items-center gap-1.5 truncate min-w-0">
							<MessageSquare className="w-3 h-3 text-indigo-400 shrink-0" />
							<span className="truncate">Nội dung & Tài liệu thảo luận</span>
							{discussionTokens > 0 && (
								<span className="text-[8.5px] px-1 py-0 rounded bg-black/40 text-indigo-200 font-mono shrink-0">
									{discussionTokens} tok
								</span>
							)}
						</span>

						<div className="flex items-center gap-1.5 shrink-0">
							<button
								type="button"
								id="btn-upload-discussion-doc"
								disabled={isParsingDocument}
								onClick={handleTriggerFileUpload}
								className={cn(
									"text-[10px] h-6 flex items-center gap-1 px-2 rounded-md border transition-all font-medium whitespace-nowrap shadow-sm",
									isParsingDocument
										? "bg-amber-500/10 text-amber-300 border-amber-500/25 cursor-wait"
										: "text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/25",
								)}
								title="Upload tài liệu thảo luận (.pdf, .docx, .txt, .md)"
							>
								{isParsingDocument ? (
									<>
										<Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />
										<span>Đang đọc...</span>
									</>
								) : (
									<>
										<Upload className="w-2.5 h-2.5" />
										<span>Upload</span>
									</>
								)}
							</button>
						</div>
					</>
				)}
			</div>

			{/* ── Middle Editor Area (Flex-1, fills remaining space) ── */}
			<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
				{mode === "interview" ? (
					interviewTab === "cv" ? (
						<div className="w-full flex-1 min-h-0 flex flex-col justify-between overflow-hidden gap-1 animate-fade-in">
							<textarea
								id="input-cv-text"
								value={contextData.cvSummary}
								onChange={(e) =>
									onContextChange({ ...contextData, cvSummary: e.target.value })
								}
								placeholder="Dán tóm tắt CV, dự án thực tế, tech stack của bạn vào đây (hoặc nhấn Upload CV .pdf/.docx)... AI sẽ dùng kinh nghiệm này để trả lời phỏng vấn theo đúng thực tế."
								className="w-full flex-1 min-h-0 bg-black/35 hover:bg-black/45 focus:bg-black/50 border border-white/[0.08] focus:border-violet-500/50 rounded-xl p-2.5 text-[11px] text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none font-mono leading-relaxed custom-scrollbar transition-all"
							/>
							<div className="flex items-center justify-between px-1 text-[9px] text-white/40 shrink-0">
								<span className="truncate">
									{hasCV ? (
										<span className="text-emerald-400/90 flex items-center gap-1 font-medium">
											<Check className="w-2.5 h-2.5" />
											<span>CV đã nạp vào ngữ cảnh AI</span>
										</span>
									) : (
										<span>
											💡 Hỗ trợ nạp file PDF, DOCX, TXT hoặc dán trực tiếp CV
										</span>
									)}
								</span>
								<span className="font-mono text-white/30 shrink-0">
									{contextData.cvSummary?.length || 0} ký tự • ~{cvTokens} tok
								</span>
							</div>
						</div>
					) : (
						<div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden animate-fade-in">
							<div className="flex-1 shrink-0 flex flex-col relative">
								<textarea
									id="input-jd-text"
									value={contextData.jobDescription}
									onChange={(e) =>
										onContextChange({
											...contextData,
											jobDescription: e.target.value,
										})
									}
									placeholder="Dán yêu cầu tuyển dụng (JD) vào đây hoặc bấm Upload JD... Ví dụ: Vị trí Senior Software Engineer, yêu cầu Microservices, React, Docker, Golang..."
									className="w-full h-full bg-black/35 hover:bg-black/45 focus:bg-black/50 border border-white/[0.08] focus:border-violet-500/50 rounded-xl p-2.5 text-[11px] text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none font-mono leading-relaxed custom-scrollbar transition-all"
								/>
								<div className="absolute right-2 bottom-1.5 text-[8.5px] font-mono text-white/30 pointer-events-none bg-black/60 px-1.5 py-0.5 rounded border border-white/[0.05]">
									{contextData.jobDescription?.length || 0} ký tự • ~{jdTokens}{" "}
									tok
								</div>
							</div>
							{renderKeywordsSection("violet")}
						</div>
					)
				) : (
					<div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden animate-fade-in">
						<div className="flex-1 shrink-0 flex flex-col relative">
							<textarea
								id="input-discussion-text"
								value={contextData.discussionTopic || ""}
								onChange={(e) =>
									onContextChange({
										...contextData,
										discussionTopic: e.target.value,
									})
								}
								placeholder="Điền chủ đề cuộc họp, bài toán kiến trúc hoặc tải lên tài liệu (.pdf, .docx)... Ví dụ: Thiết kế hệ thống Rate Limiting phân tán, xử lý cache stampede khi flash sale, hoặc di chuyển từ Monolith sang Microservices..."
								className="w-full h-full bg-black/35 hover:bg-black/45 focus:bg-black/50 border border-white/[0.08] focus:border-indigo-500/50 rounded-xl p-2.5 text-[11px] text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 resize-none font-mono leading-relaxed custom-scrollbar transition-all"
							/>
							<div className="absolute right-2 bottom-1.5 text-[8.5px] font-mono text-white/30 pointer-events-none bg-black/60 px-1.5 py-0.5 rounded border border-white/[0.05]">
								{contextData.discussionTopic?.length || 0} ký tự • ~
								{discussionTokens} tok
							</div>
						</div>
						{renderKeywordsSection("indigo")}
					</div>
				)}
			</div>

			{/* ── Footnote Area (Shrink-0) ── */}
			<div className="pt-1.5 border-t border-white/[0.05] flex items-center justify-between text-[9.5px] shrink-0">
				<span className="text-white/40 truncate flex-1 min-w-0 pr-2">
					{hasModeContext ? (
						<span className="text-emerald-400/90 flex items-center gap-1.5 font-medium">
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
								<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
							</span>
							<span className="truncate">
								{mode === "interview"
									? "AI đã sẵn sàng cá nhân hóa câu trả lời theo hồ sơ CV của bạn"
									: "AI đã nạp chủ đề thảo luận để đưa ra giải pháp sát bài toán"}
							</span>
						</span>
					) : (
						<span className="flex items-center gap-1.5">
							<span className="w-1.5 h-1.5 rounded-full bg-white/20" />
							<span>Chưa nạp context (AI sẽ phản hồi ở mức tổng quát)</span>
						</span>
					)}
				</span>
				<span className="text-white/35 font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] shrink-0">
					{mode === "interview" ? "Chế độ: Phỏng vấn" : "Chế độ: Thảo luận"}
				</span>
			</div>
		</Card>
	);
}
