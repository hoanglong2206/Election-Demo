import { useState, useEffect, useRef, useMemo } from "react";
import type { HomeProps } from "./types";
import {
	enumerateSystemAudioDevices,
	getSavedAudioDeviceId,
	saveAudioDeviceId,
	type AudioDeviceInfo,
} from "../../services/audioDevices";
import {
	getAllAIModels,
	getSavedAIModelId,
	getSelectedModelConfig,
	measureRealAIPing,
	measureRealSTTLatency,
	getCachedLatency,
	setCachedLatency,
	getAvailableSTTEngines,
	getSavedSTTEngineId,
	type AIModelConfig,
} from "../../services/ai-model/aiModels";
import type { STTEngineConfig } from "../../services/ai-model/types";
import { usageTrackerService } from "../../services/usage-tracker";
import {
	getSavedMeetingContext,
	saveMeetingContext,
	estimateTokenCount,
	SAMPLE_JD,
	SAMPLE_CV,
	SAMPLE_DISCUSSION_CONTEXT,
	type MeetingContextData,
} from "../../services/meetingContext";
import { jdKeywordExtractor } from "../../services/ai-model/stt";
import {
	getSavedSessions,
	initSessionStorage,
	subscribeSessions,
	type MeetingSession,
} from "../../services/sessionHistory";

import {
	analyzeCvJdMatchHeuristic,
	analyzeCvJdMatchWithAI,
	type CvJdMatchResult,
} from "../../services/ai-model/copilot";

import { ContextEditorCard } from "./components/ContextEditorCard";
import { AudioDeviceSelectorCard } from "./components/AudioDeviceSelectorCard";
import { AIModelSelectorCard } from "./components/AIModelSelectorCard";
import { RecentSessionsCard } from "./components/RecentSessionsCard";
import { SystemQuickStatusCard } from "./components/SystemQuickStatusCard";
import { CvJdMatchDialog } from "./components/CvJdMatchDialog";
import {
	profileContextService,
	type ProfilePreset,
} from "../../services/profile-preset";
import { ProfilePresetDialog } from "./components/ProfilePresetDialog";
import { ProfileDeleteDialog } from "./components/ProfileDeleteDialog";
import { ProfileImportExportDialog } from "./components/ProfileImportExportDialog";

export function Home({ onViewChange, mode, onModeChange }: HomeProps) {
	// ── Lifecycle and Timer Safety ──────────────────────────────────────────────
	const isMountedRef = useRef(true);
	const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

	const safeSetTimeout = (fn: () => void, delayMs: number) => {
		const id = setTimeout(() => {
			timersRef.current.delete(id);
			if (isMountedRef.current) fn();
		}, delayMs);
		timersRef.current.add(id);
		return id;
	};

	useEffect(() => {
		isMountedRef.current = true;
		const activeTimers = timersRef.current;
		return () => {
			isMountedRef.current = false;
			activeTimers.forEach(clearTimeout);
			activeTimers.clear();
		};
	}, []);

	// ── Audio Device State ──────────────────────────────────────────────────────
	const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
		getSavedAudioDeviceId,
	);
	const [isScanningDevices, setIsScanningDevices] = useState(false);
	const [isAudioDropdownOpen, setIsAudioDropdownOpen] = useState(false);
	const audioDropdownRef = useRef<HTMLDivElement>(null);

	// ── AI Model & STT State ────────────────────────────────────────────────────
	// 1. Settings State (Reflecting official persistent configuration from Settings)
	const [settingModelId, setSettingModelId] = useState<string>(() =>
		getSavedAIModelId(),
	);
	const [settingSTTId, setSettingSTTId] = useState<string>(() =>
		getSavedSTTEngineId(),
	);
	const [aiModels, setAiModels] = useState<AIModelConfig[]>(() =>
		getAllAIModels(),
	);
	const [sttEngines] = useState<STTEngineConfig[]>(() =>
		getAvailableSTTEngines(),
	);

	const settingModel = getSelectedModelConfig(settingModelId);
	const settingSTTEngine =
		sttEngines.find((e) => e.id === settingSTTId) || sttEngines[0];

	// 2. Inspection State on Home (Purely for inspecting specs, latency & benchmark)
	const [inspectedModelId, setInspectedModelId] = useState<string>(() =>
		getSavedAIModelId(),
	);
	const [inspectedSTTId, setInspectedSTTId] = useState<string>(() =>
		getSavedSTTEngineId(),
	);
	const effectiveInspectedModelId =
		aiModels.find((model) => model.id === inspectedModelId)?.id ||
		aiModels[0]?.id ||
		inspectedModelId;
	const inspectedModel = getSelectedModelConfig(effectiveInspectedModelId);
	const inspectedSTTEngine =
		sttEngines.find((e) => e.id === inspectedSTTId) || sttEngines[0];

	const [isPinging, setIsPinging] = useState(false);
	const [livePing, setLivePing] = useState<number>(() => {
		const cached = getCachedLatency(effectiveInspectedModelId);
		return cached ?? inspectedModel.pingMs ?? 120;
	});
	const cachedInspectedPing = getCachedLatency(effectiveInspectedModelId);
	const displayedInspectedPing = cachedInspectedPing ?? livePing;
	const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
	const modelDropdownRef = useRef<HTMLDivElement>(null);
	const pingRequestIdRef = useRef(0);

	const [isSTTDropdownOpen, setIsSTTDropdownOpen] = useState(false);
	const sttDropdownRef = useRef<HTMLDivElement>(null);

	const [isSTTPinging, setIsSTTPinging] = useState(false);
	const [liveSTTLatency, setLiveSTTLatency] = useState<number>(() => {
		const cached = getCachedLatency(inspectedSTTId);
		return cached ?? inspectedSTTEngine?.latencyMs ?? 150;
	});
	const cachedInspectedSTTLatency = getCachedLatency(inspectedSTTId);
	const displayedInspectedSTTLatency =
		cachedInspectedSTTLatency ?? liveSTTLatency;
	const sttPingRequestIdRef = useRef(0);

	// Usage Tracker Monthly Summary
	const [monthSummary, setMonthSummary] = useState(() =>
		usageTrackerService.getCurrentMonthSummary(),
	);
	useEffect(() => {
		const unsub = usageTrackerService.subscribe((updated) => {
			setMonthSummary(updated);
		});
		return () => unsub();
	}, []);

	// ── Meeting Context State ───────────────────────────────────────────────────
	const [contextData, setContextData] = useState<MeetingContextData>(
		getSavedMeetingContext,
	);
	const contextDataRef = useRef<MeetingContextData>(contextData);

	const [interviewTab, setInterviewTab] = useState<"cv" | "jd">("cv");
	const [isContextSaved, setIsContextSaved] = useState(false);
	const [isParsingDocument, setIsParsingDocument] = useState(false);
	const [parsingError, setParsingError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ── Profile Preset State ────────────────────────────────────────────────────
	const [activeProfile, setActiveProfile] = useState<ProfilePreset | null>(() =>
		profileContextService.getActiveProfile(),
	);
	const activeProfileRef = useRef<ProfilePreset | null>(activeProfile);

	useEffect(() => {
		contextDataRef.current = contextData;
		activeProfileRef.current = activeProfile;
	}, [contextData, activeProfile]);

	const [allProfiles, setAllProfiles] = useState<ProfilePreset[]>(() =>
		profileContextService.getAllProfiles(),
	);
	const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
	const [profileDialogMode, setProfileDialogMode] = useState<"create" | "edit">(
		"create",
	);
	const [editingProfile, setEditingProfile] = useState<ProfilePreset | null>(
		null,
	);
	const [isDeleteProfileOpen, setIsDeleteProfileOpen] = useState(false);
	const [deletingProfile, setDeletingProfile] = useState<ProfilePreset | null>(
		null,
	);
	const [isImportExportOpen, setIsImportExportOpen] = useState(false);

	// Debounced pending profile/context sync ref
	const pendingSyncRef = useRef<{
		timerId?: ReturnType<typeof setTimeout>;
		profileId?: string;
		data: MeetingContextData;
	} | null>(null);

	const flushPendingContextSync = () => {
		if (pendingSyncRef.current) {
			clearTimeout(pendingSyncRef.current.timerId);
			const { profileId, data } = pendingSyncRef.current;
			pendingSyncRef.current = null;
			saveMeetingContext(data);
			if (profileId) {
				profileContextService.updateProfile(profileId, {
					jobDescription: data.jobDescription,
					resumeContext: data.cvSummary,
					keywords: data.keywords || [],
				});
			}
		}
	};

	// Subscribe to ProfileContextService
	useEffect(() => {
		const unsub = profileContextService.subscribe((active, all) => {
			if (!isMountedRef.current) return;
			setActiveProfile(active);
			setAllProfiles(all);
			if (mode === "interview") {
				const current = contextDataRef.current;
				const isDifferentProfile =
					!activeProfileRef.current ||
					activeProfileRef.current.id !== active?.id;
				const hasDataDifferences =
					current.jobDescription !== (active ? active.jobDescription : "") ||
					current.cvSummary !== (active ? active.resumeContext : "") ||
					current.interviewTitle !== (active ? active.name : "") ||
					JSON.stringify(current.keywords || []) !==
						JSON.stringify(active ? active.keywords || [] : []);

				// Only update contextData if profile switched or incoming data changed externally
				if (
					isDifferentProfile ||
					(!pendingSyncRef.current && hasDataDifferences)
				) {
					setContextData((prev) => ({
						...prev,
						jobDescription: active ? active.jobDescription : "",
						cvSummary: active ? active.resumeContext : "",
						keywords: active ? active.keywords : [],
						interviewTitle: active ? active.name : "",
					}));
				}
			}
		});
		return unsub;
	}, [mode]);

	// ── Recent Sessions State ───────────────────────────────────────────────────
	const [recentSessions, setRecentSessions] = useState<MeetingSession[]>(() =>
		getSavedSessions().slice(0, 2),
	);
	const [totalSessionsCount, setTotalSessionsCount] = useState<number>(
		() => getSavedSessions().length,
	);

	useEffect(() => {
		const unsubscribe = subscribeSessions((updated) => {
			setRecentSessions(updated.slice(0, 2));
			setTotalSessionsCount(updated.length);
		});
		initSessionStorage().then((loaded) => {
			setRecentSessions(loaded.slice(0, 2));
			setTotalSessionsCount(loaded.length);
		});
		return unsubscribe;
	}, []);

	const [meetingError, setMeetingError] = useState<string | null>(null);

	// ── CV - JD Match Analysis State ──────────────────────────────────────────
	const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false);
	const [matchResult, setMatchResult] = useState<CvJdMatchResult | null>(null);
	const [isAnalyzingMatch, setIsAnalyzingMatch] = useState(false);

	// Sync AI Models from custom event
	useEffect(() => {
		const handleModelsUpdate = () => {
			setAiModels(getAllAIModels());
			setSettingModelId(getSavedAIModelId());
			setSettingSTTId(getSavedSTTEngineId());
		};
		window.addEventListener("ai-models-updated", handleModelsUpdate);
		window.addEventListener("storage", handleModelsUpdate);
		return () => {
			window.removeEventListener("ai-models-updated", handleModelsUpdate);
			window.removeEventListener("storage", handleModelsUpdate);
		};
	}, []);

	// Refresh audio devices on mount
	useEffect(() => {
		let mounted = true;
		enumerateSystemAudioDevices().then((devs) => {
			if (mounted) setAudioDevices(devs);
		});
		return () => {
			mounted = false;
		};
	}, []);

	// Close dropdowns on outside click
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				audioDropdownRef.current &&
				!audioDropdownRef.current.contains(event.target as Node)
			) {
				setIsAudioDropdownOpen(false);
			}
			if (
				modelDropdownRef.current &&
				!modelDropdownRef.current.contains(event.target as Node)
			) {
				setIsModelDropdownOpen(false);
			}
			if (
				sttDropdownRef.current &&
				!sttDropdownRef.current.contains(event.target as Node)
			) {
				setIsSTTDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleDeviceChange = (deviceId: string) => {
		setSelectedDeviceId(deviceId);
		saveAudioDeviceId(deviceId);
		setIsAudioDropdownOpen(false);
	};

	const handleRefreshDevices = async () => {
		setIsScanningDevices(true);
		const devs = await enumerateSystemAudioDevices();
		if (isMountedRef.current) {
			setAudioDevices(devs);
			safeSetTimeout(() => setIsScanningDevices(false), 450);
		}
	};

	const handleModelInspectChange = (modelId: string) => {
		setInspectedModelId(modelId);
		setIsModelDropdownOpen(false);
		const cached = getCachedLatency(modelId);
		if (cached) {
			setLivePing(cached);
		}
	};

	const handleSTTInspectChange = (sttId: string) => {
		setInspectedSTTId(sttId);
		setIsSTTDropdownOpen(false);
		const cached = getCachedLatency(sttId);
		if (cached) {
			setLiveSTTLatency(cached);
		}
	};

	const handleTestPing = async (targetId?: string) => {
		const idToTest = targetId || effectiveInspectedModelId;
		if (!idToTest) return;
		const reqId = ++pingRequestIdRef.current;
		setIsPinging(true);
		try {
			const realLatency = await measureRealAIPing(idToTest);
			if (isMountedRef.current && reqId === pingRequestIdRef.current) {
				setLivePing(realLatency);
				setCachedLatency(idToTest, realLatency);
			}
		} catch {
			if (isMountedRef.current && reqId === pingRequestIdRef.current) {
				const cached = getCachedLatency(idToTest);
				if (cached) {
					setLivePing(cached);
				} else {
					const target = getSelectedModelConfig(idToTest);
					setLivePing(target.pingMs || 120);
				}
			}
		} finally {
			if (isMountedRef.current && reqId === pingRequestIdRef.current) {
				setIsPinging(false);
			}
		}
	};

	// Auto-measure real ping for the currently available inspected model.
	useEffect(() => {
		if (
			!effectiveInspectedModelId ||
			(getCachedLatency(effectiveInspectedModelId) !== null &&
				getCachedLatency(effectiveInspectedModelId) !== undefined)
		)
			return;

		const timer = setTimeout(() => {
			void handleTestPing(effectiveInspectedModelId);
		}, 0);
		return () => clearTimeout(timer);
	}, [effectiveInspectedModelId]);

	const handleTestSTTPing = async (targetId?: string) => {
		const idToTest = targetId || inspectedSTTId;
		if (!idToTest) return;
		const reqId = ++sttPingRequestIdRef.current;
		setIsSTTPinging(true);
		try {
			const realLatency = await measureRealSTTLatency(idToTest);
			if (isMountedRef.current && reqId === sttPingRequestIdRef.current) {
				setLiveSTTLatency(realLatency);
				setCachedLatency(idToTest, realLatency);
			}
		} catch {
			if (isMountedRef.current && reqId === sttPingRequestIdRef.current) {
				const cached = getCachedLatency(idToTest);
				if (cached) {
					setLiveSTTLatency(cached);
				} else {
					const target = sttEngines.find((e) => e.id === idToTest);
					setLiveSTTLatency(target?.latencyMs || 150);
				}
			}
		} finally {
			if (isMountedRef.current && reqId === sttPingRequestIdRef.current) {
				setIsSTTPinging(false);
			}
		}
	};

	// Auto-measure real latency for inspected STT engine on mount and when inspectedSTTId changes if not cached
	useEffect(() => {
		if (
			!inspectedSTTId ||
			(getCachedLatency(inspectedSTTId) !== null &&
				getCachedLatency(inspectedSTTId) !== undefined)
		)
			return;

		const timer = setTimeout(() => {
			void handleTestSTTPing(inspectedSTTId);
		}, 0);
		return () => clearTimeout(timer);
	}, [inspectedSTTId]);

	const handleSaveContext = () => {
		flushPendingContextSync();
		saveMeetingContext(contextData);
		if (mode === "interview" && activeProfile) {
			profileContextService.updateProfile(activeProfile.id, {
				jobDescription: contextData.jobDescription,
				resumeContext: contextData.cvSummary,
				keywords: contextData.keywords || [],
			});
		}
		setIsContextSaved(true);
		safeSetTimeout(() => setIsContextSaved(false), 2000);
	};

	// Ensure keywords are extracted if text exists but keywords list is empty for current mode
	useEffect(() => {
		if (mode === "interview") {
			if (!contextData.keywords || contextData.keywords.length === 0) {
				if (contextData.jobDescription && contextData.jobDescription.trim()) {
					const extracted = jdKeywordExtractor.extractKeywords(
						contextData.jobDescription,
					);
					if (extracted.length > 0) {
						const updated = { ...contextData, keywords: extracted };
						setTimeout(() => {
							setContextData(updated);
							saveMeetingContext(updated);
							if (activeProfile) {
								profileContextService.updateProfile(activeProfile.id, {
									keywords: extracted,
								});
							}
						}, 0);
					}
				}
			}
		} else {
			if (
				!contextData.discussionKeywords ||
				contextData.discussionKeywords.length === 0
			) {
				if (contextData.discussionTopic && contextData.discussionTopic.trim()) {
					const extracted = jdKeywordExtractor.extractKeywords(
						contextData.discussionTopic,
					);
					if (extracted.length > 0) {
						const updated = { ...contextData, discussionKeywords: extracted };
						setTimeout(() => {
							setContextData(updated);
							saveMeetingContext(updated);
						}, 0);
					}
				}
			}
		}
	}, [mode, contextData, activeProfile]);

	const handleContextChange = (nextData: MeetingContextData) => {
		// If JD or discussion changed and corresponding keywords was empty, extract automatically
		if (
			(!nextData.keywords || nextData.keywords.length === 0) &&
			mode === "interview" &&
			nextData.jobDescription &&
			nextData.jobDescription !== contextData.jobDescription
		) {
			const extracted = jdKeywordExtractor.extractKeywords(
				nextData.jobDescription,
			);
			nextData = { ...nextData, keywords: extracted };
		} else if (
			(!nextData.discussionKeywords ||
				nextData.discussionKeywords.length === 0) &&
			mode === "discussion" &&
			nextData.discussionTopic &&
			nextData.discussionTopic !== contextData.discussionTopic
		) {
			const extracted = jdKeywordExtractor.extractKeywords(
				nextData.discussionTopic,
			);
			nextData = { ...nextData, discussionKeywords: extracted };
		}

		setContextData(nextData);

		// Debounce background sync to prevent typing stutter and localStorage churn
		if (pendingSyncRef.current?.timerId) {
			clearTimeout(pendingSyncRef.current.timerId);
		}

		const targetProfileId =
			mode === "interview" ? activeProfile?.id : undefined;
		const timerId = setTimeout(() => {
			if (!isMountedRef.current) return;
			pendingSyncRef.current = null;
			saveMeetingContext(nextData);
			if (targetProfileId) {
				profileContextService.updateProfile(targetProfileId, {
					jobDescription: nextData.jobDescription,
					resumeContext: nextData.cvSummary,
					keywords: nextData.keywords || [],
				});
			}
		}, 300);

		pendingSyncRef.current = {
			timerId,
			profileId: targetProfileId,
			data: nextData,
		};
	};

	const handleSelectProfile = (id: string) => {
		// Flush pending changes of previous profile before switching
		flushPendingContextSync();
		const updated = profileContextService.setActiveProfile(id);
		if (updated) {
			setContextData((prev) => ({
				...prev,
				jobDescription: updated.jobDescription,
				cvSummary: updated.resumeContext,
				keywords: updated.keywords,
				interviewTitle: updated.name,
			}));
		}
	};

	const handleOpenCreateProfile = () => {
		setProfileDialogMode("create");
		setEditingProfile(null);
		setIsProfileDialogOpen(true);
	};

	const handleOpenEditProfile = (preset: ProfilePreset) => {
		setProfileDialogMode("edit");
		setEditingProfile(preset);
		setIsProfileDialogOpen(true);
	};

	const handleSaveProfile = (
		data: Omit<ProfilePreset, "id" | "createdAt" | "updatedAt">,
	) => {
		if (profileDialogMode === "create") {
			profileContextService.createProfile(data);
		} else if (editingProfile) {
			profileContextService.updateProfile(editingProfile.id, data);
		}
	};

	const handleDuplicateProfile = (id: string) => {
		profileContextService.duplicateProfile(id);
	};

	const handleOpenDeleteProfile = (preset: ProfilePreset) => {
		setDeletingProfile(preset);
		setIsDeleteProfileOpen(true);
	};

	const handleConfirmDeleteProfile = () => {
		if (deletingProfile) {
			profileContextService.deleteProfile(deletingProfile.id);
			setDeletingProfile(null);
		}
	};

	const handleAddKeyword = (newKw: string) => {
		const normalized = jdKeywordExtractor.normalizeKeyword(newKw);
		if (!normalized) return;
		if (mode === "interview") {
			const current = contextData.keywords || [];
			if (current.some((k) => k.toLowerCase() === normalized.toLowerCase()))
				return;
			const updated = {
				...contextData,
				keywords: [...current, normalized],
			};
			setContextData(updated);
			saveMeetingContext(updated);
			if (activeProfile) {
				profileContextService.updateProfile(activeProfile.id, {
					keywords: updated.keywords,
				});
			}
		} else {
			const current = contextData.discussionKeywords || [];
			if (current.some((k) => k.toLowerCase() === normalized.toLowerCase()))
				return;
			const updated = {
				...contextData,
				discussionKeywords: [...current, normalized],
			};
			setContextData(updated);
			saveMeetingContext(updated);
		}
	};

	const handleRemoveKeyword = (kwToRemove: string) => {
		if (mode === "interview") {
			const current = contextData.keywords || [];
			const updatedKeywords = current.filter(
				(k) => k.toLowerCase() !== kwToRemove.toLowerCase(),
			);
			const updated = {
				...contextData,
				keywords: updatedKeywords,
			};
			setContextData(updated);
			saveMeetingContext(updated);
			if (activeProfile) {
				profileContextService.updateProfile(activeProfile.id, {
					keywords: updatedKeywords,
				});
			}
		} else {
			const current = contextData.discussionKeywords || [];
			const updatedKeywords = current.filter(
				(k) => k.toLowerCase() !== kwToRemove.toLowerCase(),
			);
			const updated = {
				...contextData,
				discussionKeywords: updatedKeywords,
			};
			setContextData(updated);
			saveMeetingContext(updated);
		}
	};

	const handleReExtractKeywords = () => {
		if (mode === "interview") {
			const targetText = contextData.jobDescription || "";
			if (!targetText.trim()) return;
			const extracted = jdKeywordExtractor.extractKeywords(targetText);
			const updated = {
				...contextData,
				keywords: extracted,
			};
			setContextData(updated);
			saveMeetingContext(updated);
			if (activeProfile) {
				profileContextService.updateProfile(activeProfile.id, {
					keywords: extracted,
				});
			}
		} else {
			const targetText = contextData.discussionTopic || "";
			if (!targetText.trim()) return;
			const extracted = jdKeywordExtractor.extractKeywords(targetText);
			const updated = {
				...contextData,
				discussionKeywords: extracted,
			};
			setContextData(updated);
			saveMeetingContext(updated);
		}
	};

	const handleClearContext = () => {
		flushPendingContextSync();
		if (mode === "interview") {
			const updated = {
				...contextData,
				jobDescription: "",
				cvSummary: "",
				keywords: [],
			};
			setContextData(updated);
			saveMeetingContext(updated);
			if (activeProfile) {
				profileContextService.updateProfile(activeProfile.id, {
					jobDescription: "",
					resumeContext: "",
					keywords: [],
				});
			}
		} else {
			const updated = {
				...contextData,
				discussionTopic: "",
				discussionKeywords: [],
			};
			setContextData(updated);
			saveMeetingContext(updated);
		}
	};

	const handleLoadSampleCV = () => {
		const updated = { ...contextData, cvSummary: SAMPLE_CV };
		setContextData(updated);
		saveMeetingContext(updated);
		if (mode === "interview" && activeProfile) {
			profileContextService.updateProfile(activeProfile.id, {
				resumeContext: SAMPLE_CV,
			});
		}
		setIsContextSaved(true);
		safeSetTimeout(() => setIsContextSaved(false), 1500);
	};

	const handleLoadSampleJD = () => {
		const extractedKeywords = jdKeywordExtractor.extractKeywords(SAMPLE_JD);
		const updated = {
			...contextData,
			jobDescription: SAMPLE_JD,
			keywords: extractedKeywords,
		};
		setContextData(updated);
		saveMeetingContext(updated);
		if (mode === "interview" && activeProfile) {
			profileContextService.updateProfile(activeProfile.id, {
				jobDescription: SAMPLE_JD,
				keywords: extractedKeywords,
			});
		}
		setIsContextSaved(true);
		safeSetTimeout(() => setIsContextSaved(false), 1500);
	};

	const handleLoadSampleDiscussion = () => {
		const extractedKeywords = jdKeywordExtractor.extractKeywords(
			SAMPLE_DISCUSSION_CONTEXT,
		);
		const updated = {
			...contextData,
			discussionTopic: SAMPLE_DISCUSSION_CONTEXT,
			discussionKeywords: extractedKeywords,
		};
		setContextData(updated);
		saveMeetingContext(updated);
		setIsContextSaved(true);
		safeSetTimeout(() => setIsContextSaved(false), 1500);
	};

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsParsingDocument(true);
		setParsingError(null);

		try {
			const { parseDocumentFile } = await import("../../services/documentParser");
			const parsed = await parseDocumentFile(file);
			// Allow up to 15,000 characters for rich context
			const content =
				parsed.text.length > 15000 ? parsed.text.slice(0, 15000) : parsed.text;
			const fileBadge = `${file.name}${parsed.pageCount ? ` (${parsed.pageCount} trang)` : ""}`;

			let updated: MeetingContextData;
			if (mode === "discussion") {
				const extracted = jdKeywordExtractor.extractKeywords(content);
				updated = {
					...contextData,
					discussionTopic: content,
					uploadedFileName: fileBadge,
					discussionKeywords: extracted,
				};
			} else if (interviewTab === "jd") {
				const extracted = jdKeywordExtractor.extractKeywords(content);
				updated = {
					...contextData,
					jobDescription: content,
					keywords: extracted,
				};
				if (activeProfile) {
					profileContextService.updateProfile(activeProfile.id, {
						jobDescription: content,
						keywords: extracted,
					});
				}
			} else {
				// default interview 'cv' tab
				updated = {
					...contextData,
					cvSummary: content,
					uploadedFileName: fileBadge,
				};
				if (activeProfile) {
					profileContextService.updateProfile(activeProfile.id, {
						resumeContext: content,
					});
				}
			}

			if (isMountedRef.current) {
				setContextData(updated);
				saveMeetingContext(updated);
				setIsContextSaved(true);
				safeSetTimeout(() => setIsContextSaved(false), 2000);
			}
		} catch (err: unknown) {
			console.error("[Home] Failed to parse document:", err);
			if (isMountedRef.current) {
				const msg = err instanceof Error ? err.message : String(err);
				setParsingError(
					msg ||
						"Không thể đọc nội dung file. Vui lòng kiểm tra lại định dạng.",
				);
			}
		} finally {
			if (isMountedRef.current) {
				setIsParsingDocument(false);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			}
		}
	};

	const jdTokens = useMemo(
		() => estimateTokenCount(contextData.jobDescription),
		[contextData.jobDescription],
	);
	const cvTokens = useMemo(
		() => estimateTokenCount(contextData.cvSummary),
		[contextData.cvSummary],
	);
	const discussionTokens = useMemo(
		() => estimateTokenCount(contextData.discussionTopic || ""),
		[contextData.discussionTopic],
	);
	const currentModeTokens = useMemo(
		() => (mode === "interview" ? cvTokens + jdTokens : discussionTokens),
		[mode, cvTokens, jdTokens, discussionTokens],
	);
	const hasModeContext = currentModeTokens > 0;

	const hasCV = useMemo(
		() => Boolean(contextData.cvSummary && contextData.cvSummary.trim()),
		[contextData.cvSummary],
	);
	const hasJD = useMemo(
		() =>
			Boolean(contextData.jobDescription && contextData.jobDescription.trim()),
		[contextData.jobDescription],
	);
	const canEnterMeeting = useMemo(
		() => mode === "discussion" || (hasCV && hasJD),
		[mode, hasCV, hasJD],
	);

	// Real-time calculation of CV - JD match score
	useEffect(() => {
		if (mode === "interview" && hasCV && hasJD) {
			const heuristic = analyzeCvJdMatchHeuristic(
				contextData.cvSummary,
				contextData.jobDescription,
			);
			setTimeout(() => {
				setMatchResult((prev) => (prev?.isAI ? prev : heuristic));
			}, 0);
		} else {
			setTimeout(() => {
				setMatchResult(null);
			}, 0);
		}
	}, [mode, hasCV, hasJD, contextData.cvSummary, contextData.jobDescription]);

	const handleOpenMatchAnalysis = async () => {
		setIsMatchDialogOpen(true);
		// If not yet analyzed with AI, trigger deep AI analysis
		if (hasCV && hasJD && (!matchResult || !matchResult.isAI)) {
			setIsAnalyzingMatch(true);
			try {
				const aiRes = await analyzeCvJdMatchWithAI(
					contextData.cvSummary,
					contextData.jobDescription,
				);
				if (isMountedRef.current) {
					setMatchResult(aiRes);
				}
			} catch (err) {
				console.warn("[Home] AI match analysis error:", err);
			} finally {
				if (isMountedRef.current) {
					setIsAnalyzingMatch(false);
				}
			}
		}
	};

	const handleReAnalyzeWithAI = async () => {
		if (!hasCV || !hasJD) return;
		setIsAnalyzingMatch(true);
		try {
			const aiRes = await analyzeCvJdMatchWithAI(
				contextData.cvSummary,
				contextData.jobDescription,
				true,
			);
			if (isMountedRef.current) {
				setMatchResult(aiRes);
			}
		} catch (err) {
			console.warn("[Home] Re-analyze error:", err);
		} finally {
			if (isMountedRef.current) {
				setIsAnalyzingMatch(false);
			}
		}
	};

	const handleLaunchMeeting = () => {
		if (mode === "interview") {
			if (!hasCV && !hasJD) {
				setMeetingError(
					"Chế độ Phỏng Vấn yêu cầu phải có cả CV và JD trước khi vào phòng họp. Vui lòng bổ sung đầy đủ.",
				);
				setInterviewTab("cv");
				return;
			}
			if (!hasCV) {
				setMeetingError(
					"Chế độ Phỏng Vấn yêu cầu phải có CV. Vui lòng dán hoặc upload CV của bạn.",
				);
				setInterviewTab("cv");
				return;
			}
			if (!hasJD) {
				setMeetingError(
					"Chế độ Phỏng Vấn yêu cầu phải có JD (Mô tả công việc). Vui lòng nhập thông tin JD.",
				);
				setInterviewTab("jd");
				return;
			}
		}
		setMeetingError(null);

		// Flush any pending debounced sync
		flushPendingContextSync();

		// Ensure keywords exist if text is present
		let finalKeywords = contextData.keywords || [];
		if (finalKeywords.length === 0) {
			const targetText =
				mode === "interview"
					? contextData.jobDescription
					: contextData.discussionTopic || "";
			if (targetText && targetText.trim()) {
				finalKeywords = jdKeywordExtractor.extractKeywords(targetText);
			}
		}

		const snapshotData = {
			...contextData,
			keywords: finalKeywords,
		};

		// Persist immediately to meeting context storage and profile
		saveMeetingContext(snapshotData);
		if (mode === "interview" && activeProfile) {
			profileContextService.updateProfile(activeProfile.id, {
				jobDescription: snapshotData.jobDescription,
				resumeContext: snapshotData.cvSummary,
				keywords: finalKeywords,
			});
		}

		onViewChange("meeting");
	};

	const hasModels = aiModels.length > 0;
	const currentAudioDevice =
		audioDevices.find((d) => d.deviceId === selectedDeviceId) ||
		audioDevices[0];

	return (
		<div className="flex flex-col h-full p-2.5 sm:p-3 overflow-y-auto custom-scrollbar select-none animate-fade-in">
			{/* ── Main Working Grid (2 Columns matching Image 1 Wireframe) ── */}
			<div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3 min-h-full flex-1">
				{/* ── Left Column: Box 1 (Context Editor) + Box 2 (System Quick Status & Launch) ── */}
				<div className="md:col-span-7 flex flex-col gap-2.5 sm:gap-3 min-w-0 flex-1">
					<ContextEditorCard
						className="flex-1 min-h-0"
						mode={mode}
						onModeChange={onModeChange}
						contextData={contextData}
						interviewTab={interviewTab}
						isContextSaved={isContextSaved}
						fileInputRef={fileInputRef}
						cvTokens={cvTokens}
						jdTokens={jdTokens}
						discussionTokens={discussionTokens}
						currentModeTokens={currentModeTokens}
						hasModeContext={hasModeContext}
						hasCV={hasCV}
						hasJD={hasJD}
						isParsingDocument={isParsingDocument}
						parsingError={parsingError}
						matchScore={matchResult?.score}
						onOpenMatchAnalysis={handleOpenMatchAnalysis}
						onClearParsingError={() => setParsingError(null)}
						onInterviewTabChange={setInterviewTab}
						onContextChange={handleContextChange}
						onSaveContext={handleSaveContext}
						onClearContext={handleClearContext}
						onLoadSampleCV={handleLoadSampleCV}
						onLoadSampleJD={handleLoadSampleJD}
						onLoadSampleDiscussion={handleLoadSampleDiscussion}
						onFileUpload={handleFileUpload}
						onAddKeyword={handleAddKeyword}
						onRemoveKeyword={handleRemoveKeyword}
						onReExtractKeywords={handleReExtractKeywords}
						activeProfile={activeProfile}
						allProfiles={allProfiles}
						onSelectProfile={handleSelectProfile}
						onCreateProfile={handleOpenCreateProfile}
						onEditProfile={handleOpenEditProfile}
						onDuplicateProfile={handleDuplicateProfile}
						onDeleteProfile={handleOpenDeleteProfile}
						onOpenImportExport={() => setIsImportExportOpen(true)}
					/>

					<SystemQuickStatusCard
						className="shrink-0"
						mode={mode}
						canEnterMeeting={canEnterMeeting}
						meetingError={meetingError}
						onLaunchMeeting={handleLaunchMeeting}
						onClearMeetingError={() => setMeetingError(null)}
						currentAudioDeviceLabel={
							currentAudioDevice?.label || "Loopback Output"
						}
						currentSTTLabel={settingSTTEngine?.name || "Local Whisper"}
						isSTTLocal={settingSTTEngine?.provider === "Local"}
						currentLLMLabel={settingModel.name}
						hasLLMKey={hasModels}
						livePing={settingModel.pingMs}
						liveSTTLatency={displayedInspectedSTTLatency}
						totalTokensMonth={
							monthSummary.totalInputTokens + monthSummary.totalOutputTokens
						}
						estimatedCostMonth={monthSummary.totalEstimatedCostUsd}
						totalSessionsCount={totalSessionsCount}
						onViewChange={onViewChange}
					/>
				</div>

				{/* ── Right Column: Box 3 (Audio) + Box 4 (Model Inspector) + Box 5 (History) ── */}
				<div className="md:col-span-5 flex flex-col gap-2.5 min-w-0 flex-1">
					<AudioDeviceSelectorCard
						audioDevices={audioDevices}
						selectedDeviceId={selectedDeviceId}
						currentAudioDevice={currentAudioDevice}
						isScanningDevices={isScanningDevices}
						isAudioDropdownOpen={isAudioDropdownOpen}
						audioDropdownRef={audioDropdownRef}
						onToggleDropdown={() =>
							setIsAudioDropdownOpen(!isAudioDropdownOpen)
						}
						onDeviceChange={handleDeviceChange}
						onRefreshDevices={handleRefreshDevices}
						onOpenAudioTest={() => {
							onViewChange("audio-test");
						}}
					/>

					<AIModelSelectorCard
						aiModels={aiModels}
						selectedModelId={effectiveInspectedModelId}
						currentModel={inspectedModel}
						hasModels={hasModels}
						isModelDropdownOpen={isModelDropdownOpen}
						isPinging={isPinging}
						livePing={displayedInspectedPing}
						modelDropdownRef={modelDropdownRef}
						onToggleDropdown={() =>
							setIsModelDropdownOpen(!isModelDropdownOpen)
						}
						onModelChange={handleModelInspectChange}
						onTestPing={handleTestPing}
						onOpenSettings={() => onViewChange("settings")}
						onOpenBenchmark={() => {
							onViewChange("ai-diagnostic");
						}}
						sttEngines={sttEngines}
						selectedSTTId={inspectedSTTId}
						currentSTTEngine={inspectedSTTEngine}
						isSTTDropdownOpen={isSTTDropdownOpen}
						sttDropdownRef={sttDropdownRef}
						onToggleSTTDropdown={() => setIsSTTDropdownOpen(!isSTTDropdownOpen)}
						onSTTChange={handleSTTInspectChange}
						isSTTPinging={isSTTPinging}
						liveSTTLatency={displayedInspectedSTTLatency}
						onTestSTTPing={handleTestSTTPing}
						onOpenAudioTest={() => {
							onViewChange("audio-test");
						}}
					/>

					<RecentSessionsCard
						className="flex-1 min-h-[120px]"
						recentSessions={recentSessions}
						totalSessionsCount={totalSessionsCount}
						onViewAllHistory={() => onViewChange("history")}
					/>
				</div>
			</div>

			{/* CV - JD Match Analysis Dialog */}
			<CvJdMatchDialog
				open={isMatchDialogOpen}
				result={matchResult}
				isAnalyzing={isAnalyzingMatch}
				onClose={() => setIsMatchDialogOpen(false)}
				onReAnalyzeWithAI={handleReAnalyzeWithAI}
			/>

			{/* Profile Preset Create / Edit Dialog */}
			<ProfilePresetDialog
				open={isProfileDialogOpen}
				mode={profileDialogMode}
				initialPreset={editingProfile}
				onClose={() => setIsProfileDialogOpen(false)}
				onSave={handleSaveProfile}
			/>

			{/* Profile Preset Delete Confirmation Dialog */}
			<ProfileDeleteDialog
				open={isDeleteProfileOpen}
				preset={deletingProfile}
				isActive={deletingProfile?.id === activeProfile?.id}
				onClose={() => setIsDeleteProfileOpen(false)}
				onConfirm={handleConfirmDeleteProfile}
			/>

			{/* Profile Preset Import / Export Dialog */}
			<ProfileImportExportDialog
				open={isImportExportOpen}
				onClose={() => setIsImportExportOpen(false)}
			/>
		</div>
	);
}
