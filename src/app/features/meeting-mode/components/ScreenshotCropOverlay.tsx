import React, { useState, useRef, useEffect, useCallback } from "react";
import {
	Crop,
	Maximize2,
	RefreshCw,
	X,
	Sparkles,
	Camera,
	MousePointer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
	CapturedImageInfo,
	CropRect,
} from "../../../services/screen-capture/types";

interface ScreenshotCropOverlayProps {
	imageInfo: CapturedImageInfo;
	isProcessing?: boolean;
	onConfirmCrop: (cropRect: CropRect) => void;
	onCancel: () => void;
	onRetake: () => void;
}

export function ScreenshotCropOverlay({
	imageInfo,
	isProcessing = false,
	onConfirmCrop,
	onCancel,
	onRetake,
}: ScreenshotCropOverlayProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);

	// Exit animation transition state
	const [isClosing, setIsClosing] = useState(false);
	const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

	const triggerClose = useCallback(
		(callback: () => void) => {
			if (isClosing) return;
			setIsClosing(true);
			closeTimerRef.current = setTimeout(() => {
				callback();
			}, 200);
		},
		[isClosing],
	);

	useEffect(() => {
		return () => {
			if (closeTimerRef.current) {
				clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	// Selection box state in natural image pixel coordinates
	const [cropRect, setCropRect] = useState<CropRect | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
		null,
	);

	// Client display scaling ratio (naturalWidth vs renderedWidth)
	const [scale, setScale] = useState<{ x: number; y: number }>({ x: 1, y: 1 });

	const updateScale = useCallback(() => {
		if (!imgRef.current) return;
		const renderedWidth = imgRef.current.clientWidth;
		const renderedHeight = imgRef.current.clientHeight;
		const naturalWidth = imgRef.current.naturalWidth || imageInfo.width || 1920;
		const naturalHeight =
			imgRef.current.naturalHeight || imageInfo.height || 1080;

		if (renderedWidth > 0 && renderedHeight > 0) {
			setScale({
				x: naturalWidth / renderedWidth,
				y: naturalHeight / renderedHeight,
			});
		}
	}, [imageInfo.width, imageInfo.height]);

	useEffect(() => {
		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, [updateScale]);

	// Select entire screen by default
	const handleSelectFullScreen = useCallback(() => {
		const width = imgRef.current?.naturalWidth || imageInfo.width || 1920;
		const height = imgRef.current?.naturalHeight || imageInfo.height || 1080;
		setCropRect({ x: 0, y: 0, width, height });
	}, [imageInfo.width, imageInfo.height]);

	// Handle Dragging
	const handleMouseDown = (e: React.MouseEvent) => {
		if (isProcessing || isClosing) return;
		e.preventDefault();
		if (!imgRef.current) return;

		const rect = imgRef.current.getBoundingClientRect();
		const clientX = e.clientX - rect.left;
		const clientY = e.clientY - rect.top;

		const imgX = Math.max(
			0,
			Math.min(imgRef.current.naturalWidth, clientX * scale.x),
		);
		const imgY = Math.max(
			0,
			Math.min(imgRef.current.naturalHeight, clientY * scale.y),
		);

		setIsDragging(true);
		setDragStart({ x: imgX, y: imgY });
		setCropRect({ x: imgX, y: imgY, width: 0, height: 0 });
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging || !dragStart || !imgRef.current) return;

		const rect = imgRef.current.getBoundingClientRect();
		const clientX = e.clientX - rect.left;
		const clientY = e.clientY - rect.top;

		const currentX = Math.max(
			0,
			Math.min(imgRef.current.naturalWidth, clientX * scale.x),
		);
		const currentY = Math.max(
			0,
			Math.min(imgRef.current.naturalHeight, clientY * scale.y),
		);

		const x = Math.min(dragStart.x, currentX);
		const y = Math.min(dragStart.y, currentY);
		const width = Math.abs(currentX - dragStart.x);
		const height = Math.abs(currentY - dragStart.y);

		setCropRect({ x, y, width, height });
	};

	const handleMouseUp = () => {
		setIsDragging(false);
		setDragStart(null);
		// If clicked without dragging or box is tiny (< 20px), reset
		if (cropRect && (cropRect.width < 25 || cropRect.height < 25)) {
			setCropRect(null);
		}
	};

	// Confirm selection with smooth exit transition
	const handleConfirm = useCallback(() => {
		if (isProcessing || isClosing) return;
		const confirmedRect =
			!cropRect || cropRect.width < 25 || cropRect.height < 25
				? {
						x: 0,
						y: 0,
						width: imgRef.current?.naturalWidth || imageInfo.width || 1920,
						height: imgRef.current?.naturalHeight || imageInfo.height || 1080,
					}
				: cropRect;

		triggerClose(() => onConfirmCrop(confirmedRect));
	}, [
		isProcessing,
		isClosing,
		cropRect,
		imageInfo.width,
		imageInfo.height,
		onConfirmCrop,
		triggerClose,
	]);

	// Keyboard accessibility: Escape = Cancel, Enter = Confirm, F = Fullscreen
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				triggerClose(onCancel);
			} else if (e.key === "Enter") {
				e.preventDefault();
				handleConfirm();
			} else if (e.key === "f" || e.key === "F") {
				if (!e.ctrlKey && !e.metaKey) {
					e.preventDefault();
					handleSelectFullScreen();
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onCancel, handleConfirm, handleSelectFullScreen, triggerClose]);

	// Compute rendered coordinates for overlay box
	const renderedBox = cropRect
		? {
				left: cropRect.x / scale.x,
				top: cropRect.y / scale.y,
				width: cropRect.width / scale.x,
				height: cropRect.height / scale.y,
			}
		: null;

	return (
		<div
			ref={containerRef}
			className={cn(
				"fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md select-none",
				isClosing
					? "animate-overlay-out pointer-events-none"
					: "animate-overlay-in",
			)}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
		>
			{/* Top Header Bar */}
			<div
				className={cn(
					"flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/40 transition-opacity duration-150",
					isClosing ? "opacity-0" : "opacity-100",
				)}
			>
				<div className="flex items-center gap-3">
					<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
						<Crop className="w-4 h-4" />
					</div>
					<div>
						<h2 className="text-sm font-semibold text-white flex items-center gap-2">
							<span>Khoanh vùng câu hỏi trên màn hình</span>
							<Badge
								variant="outline"
								className="text-[10px] bg-violet-500/10 text-violet-300 border-violet-500/20 font-mono"
							>
								Multimodal AI
							</Badge>
						</h2>
						<p className="text-[11px] text-white/50">
							Kéo chuột để chọn vùng bài toán/code/diagram cần AI giải đáp ·
							Enter để phân tích
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{cropRect && cropRect.width > 20 && (
						<Badge
							variant="outline"
							className="bg-white/5 border-white/10 text-white/70 font-mono text-[11px]"
						>
							{Math.round(cropRect.width)} × {Math.round(cropRect.height)} px
						</Badge>
					)}

					<button
						onClick={() => triggerClose(onCancel)}
						disabled={isProcessing || isClosing}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
					>
						<X className="w-3.5 h-3.5" />
						<span>Hủy (Esc)</span>
					</button>
				</div>
			</div>

			{/* Main Image Viewport with Marquee Box */}
			<div
				className={cn(
					"relative flex-1 min-h-0 overflow-hidden flex items-center justify-center p-4",
					isClosing
						? "animate-overlay-content-out"
						: "animate-overlay-content-in",
				)}
			>
				<div
					className="relative max-w-full max-h-full cursor-crosshair shadow-2xl rounded-lg overflow-hidden border border-white/10"
					onMouseDown={handleMouseDown}
				>
					<img
						ref={imgRef}
						src={imageInfo.dataUrl}
						alt="Captured Screen"
						className="max-h-[75vh] w-auto object-contain block pointer-events-none"
						onLoad={updateScale}
						onError={() => {
							console.error(
								"[ScreenshotCropOverlay] Không thể load dữ liệu ảnh chụp màn hình.",
							);
							onCancel();
						}}
					/>

					{/* Dimmed backdrop mask when selection exists */}
					{renderedBox && (
						<div
							className="absolute inset-0 bg-black/55 pointer-events-none transition-opacity"
							style={{
								clipPath: `polygon(
                  0% 0%, 0% 100%, 
                  ${renderedBox.left}px 100%, 
                  ${renderedBox.left}px ${renderedBox.top}px, 
                  ${renderedBox.left + renderedBox.width}px ${renderedBox.top}px, 
                  ${renderedBox.left + renderedBox.width}px ${renderedBox.top + renderedBox.height}px, 
                  ${renderedBox.left}px ${renderedBox.top + renderedBox.height}px, 
                  ${renderedBox.left}px 100%, 
                  100% 100%, 100% 0%
                )`,
							}}
						/>
					)}

					{/* Glowing Crop Selection Marquee Box */}
					{renderedBox && (
						<div
							className="absolute border-2 border-violet-400 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.35)] pointer-events-none"
							style={{
								left: renderedBox.left,
								top: renderedBox.top,
								width: renderedBox.width,
								height: renderedBox.height,
							}}
						>
							{/* Corner Handles */}
							<div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-violet-500 rounded-sm" />
							<div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-violet-500 rounded-sm" />
							<div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-violet-500 rounded-sm" />
							<div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-violet-500 rounded-sm" />

							{/* Dimension Floating Pill */}
							<div className="absolute -top-7 left-0 px-2 py-0.5 rounded bg-violet-600 text-[10px] font-mono text-white shadow-md">
								{Math.round(cropRect?.width || 0)} ×{" "}
								{Math.round(cropRect?.height || 0)}
							</div>
						</div>
					)}

					{/* Guide hint when no selection is made yet */}
					{!renderedBox && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none">
							<div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/75 border border-white/15 text-white/80 text-xs shadow-lg backdrop-blur-md">
								<MousePointer className="w-4 h-4 text-violet-400 animate-pulse" />
								<span>Nhấp và kéo chuột để khoanh vùng câu hỏi</span>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Bottom Action Bar */}
			<div
				className={cn(
					"flex items-center justify-between px-6 py-3.5 border-t border-white/10 bg-black/50 backdrop-blur-md transition-opacity duration-150",
					isClosing ? "opacity-0" : "opacity-100",
				)}
			>
				<div className="flex items-center gap-2">
					<button
						onClick={handleSelectFullScreen}
						disabled={isProcessing || isClosing}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
					>
						<Maximize2 className="w-3.5 h-3.5 text-blue-400" />
						<span>Toàn màn hình (F)</span>
					</button>

					<button
						onClick={() => setCropRect(null)}
						disabled={!cropRect || isProcessing || isClosing}
						className={cn(
							"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
							cropRect
								? "text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border-white/10"
								: "text-white/30 bg-white/5 border-transparent cursor-not-allowed",
						)}
					>
						<RefreshCw className="w-3.5 h-3.5" />
						<span>Chọn lại</span>
					</button>

					<button
						onClick={() => triggerClose(onRetake)}
						disabled={isProcessing || isClosing}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
					>
						<Camera className="w-3.5 h-3.5 text-emerald-400" />
						<span>Chụp lại</span>
					</button>
				</div>

				<div className="flex items-center gap-3">
					<span className="text-[11px] text-white/40 hidden sm:inline">
						{cropRect
							? "Đã chọn vùng"
							: "Chưa khoanh vùng (sẽ dùng toàn màn hình)"}
					</span>

					<button
						onClick={handleConfirm}
						disabled={isProcessing || isClosing}
						className={cn(
							"flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all",
							isProcessing
								? "bg-violet-600/50 cursor-wait"
								: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98]",
						)}
					>
						{isProcessing ? (
							<>
								<RefreshCw className="w-4 h-4 animate-spin" />
								<span>Đang xử lý ảnh...</span>
							</>
						) : (
							<>
								<Sparkles className="w-4 h-4 text-amber-300" />
								<span>Lưu ảnh (Enter)</span>
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
