import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QTEEvent } from "../types/game";
import { PopupVideo } from "./PopupVideo";

const BASE = import.meta.env.BASE_URL

// QTE 時間點設定 - 更密集，同時出現多個
const QTE_EVENTS: QTEEvent[] = [
    // 開場熱身 - 密集單個
    { time: 1.5, key: "", duration: 2500 },
    { time: 3, key: "", duration: 2500 },
    { time: 4.5, key: "", duration: 2200 },
    { time: 6, key: "", duration: 2000 },
    // 第二波 - 2個同時
    { time: 8, key: "", duration: 2000 },
    { time: 8.1, key: "", duration: 2800 },
    // 再來幾個單獨的
    { time: 10, key: "", duration: 2000 },
    { time: 12, key: "", duration: 1800 },
    // 第三波 - 3個同時
    { time: 14, key: "", duration: 1800 },
    { time: 14.1, key: "", duration: 2500 },
    { time: 14.2, key: "", duration: 3200 },
    // 單獨補充
    { time: 17, key: "", duration: 2000 },
    { time: 19, key: "", duration: 1800 },
    // 第四波 - 2個同時
    { time: 21, key: "", duration: 1500 },
    { time: 21.1, key: "", duration: 2200 },
    // 單獨補充
    { time: 24, key: "", duration: 1800 },
    { time: 26, key: "", duration: 1600 },
    // 第五波 - 4個同時
    { time: 28, key: "", duration: 1500 },
    { time: 28.1, key: "", duration: 2000 },
    { time: 28.2, key: "", duration: 2800 },
    { time: 28.3, key: "", duration: 3500 },
    // 單獨補充
    { time: 32, key: "", duration: 1500 },
    // 第六波 - 3個同時
    { time: 35, key: "", duration: 1200 },
    { time: 35.1, key: "", duration: 1800 },
    { time: 35.2, key: "", duration: 2500 },
    // 單獨補充
    { time: 38, key: "", duration: 1500 },
    { time: 40, key: "", duration: 1400 },
    // 最終波 - 4個同時
    { time: 42, key: "", duration: 1000 },
    { time: 42.1, key: "", duration: 1500 },
    { time: 42.2, key: "", duration: 2000 },
    { time: 42.3, key: "", duration: 2800 },
];

// 干擾影片出現的時間點（秒）- 更密集
const DISTRACTION_TIMES = [4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46];

// 干擾影片列表
const DISTRACTION_VIDEOS = [`${BASE}oia貓.mp4`, `${BASE}happy貓.mp4`];

// 失敗時顯示的影片
// const FAIL_VIDEOS = ["/oia貓.mp4", "/happy貓.mp4"];

const FAIL_VIDEOS = [`${BASE}嘲笑貓.mp4`];
function getRandomLetter(): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return letters[Math.floor(Math.random() * letters.length)];
}

function getRandomPosition() {
    const isMobile = window.innerWidth < 600;
    const padding = isMobile ? 20 : 50;
    const videoWidth = isMobile ? 200 : 300;
    return {
        x: padding + Math.random() * (window.innerWidth - videoWidth - padding * 2),
        y: padding + Math.random() * (window.innerHeight - 250),
    };
}

interface PopupVideoState {
    id: number;
    src: string;
    x: number;
    y: number;
    showClose: boolean;
    autoCloseOnEnd: boolean; // 播完自動關閉
    isDistraction: boolean; // 是否為干擾影片（關閉可加分）
    loop: boolean; // 是否循環播放
}

interface ActiveQTE {
    index: number;
    key: string;
    duration: number;
    startTime: number;
    timeLeft: number;
    position: { x: number; y: number };
    result: "success" | "fail" | null;
}

function getRandomQTEPosition(existingPositions: { x: number; y: number }[]) {
    const isMobile = window.innerWidth < 600;
    const buttonSize = isMobile ? 70 : 90;
    const padding = isMobile ? 20 : 50;
    const headerSpace = isMobile ? 100 : 120;
    const minGap = buttonSize + 20;

    // 嘗試找一個不重疊的位置
    for (let attempt = 0; attempt < 10; attempt++) {
        const x = padding + Math.random() * (window.innerWidth - buttonSize - padding * 2);
        const y = headerSpace + Math.random() * (window.innerHeight - buttonSize - headerSpace - padding);

        const overlaps = existingPositions.some((pos) => Math.abs(pos.x - x) < minGap && Math.abs(pos.y - y) < minGap);

        if (!overlaps || existingPositions.length === 0) {
            return { x, y };
        }
    }
    // 如果找不到，就隨機放
    return {
        x: padding + Math.random() * (window.innerWidth - buttonSize - padding * 2),
        y: headerSpace + Math.random() * (window.innerHeight - buttonSize - headerSpace - padding),
    };
}

interface QTEGameProps {
    onComplete: () => void;
}

export function QTEGame({ onComplete }: QTEGameProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [activeQTEs, setActiveQTEs] = useState<ActiveQTE[]>([]);
    const [completedQTEs, setCompletedQTEs] = useState<number[]>([]);
    const [triggeredDistractions, setTriggeredDistractions] = useState<number[]>([]);
    const [popupVideos, setPopupVideos] = useState<PopupVideoState[]>([]);
    const [score, setScore] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

    const qteTimersRef = useRef<Map<number, { timeout: number; interval: number }>>(new Map());
    const popupIdRef = useRef(0);

    // 監聽視窗大小變化
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 600);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // 初始化 QTE 事件的隨機字母（確保同時出現的 QTE 字母不重複）
    const [qteEvents] = useState(() => {
        const events = QTE_EVENTS.map((e) => ({ ...e, key: "" }));
        // 按時間分組
        const groups: number[][] = [];
        let currentGroup: number[] = [];
        let lastTime = -999;

        events.forEach((e, i) => {
            if (e.time - lastTime > 0.5) {
                if (currentGroup.length > 0) groups.push(currentGroup);
                currentGroup = [i];
            } else {
                currentGroup.push(i);
            }
            lastTime = e.time;
        });
        if (currentGroup.length > 0) groups.push(currentGroup);

        // 為每組分配不重複的字母
        groups.forEach((group) => {
            const usedLetters: string[] = [];
            group.forEach((i) => {
                let letter = getRandomLetter();
                while (usedLetters.includes(letter)) {
                    letter = getRandomLetter();
                }
                usedLetters.push(letter);
                events[i].key = letter;
            });
        });

        return events;
    });

    // 添加彈出影片
    const addPopupVideo = useCallback((src: string, options: { showClose: boolean; autoCloseOnEnd: boolean; isDistraction: boolean; loop: boolean }) => {
        const pos = getRandomPosition();
        const id = popupIdRef.current++;
        setPopupVideos((prev) => [...prev, { id, src, ...pos, ...options }]);
        return id;
    }, []);

    // 移除彈出影片（手動關閉干擾影片會 +1 分）
    const removePopupVideo = useCallback((id: number, addScore: boolean = false) => {
        setPopupVideos((prev) => prev.filter((v) => v.id !== id));
        if (addScore) {
            setScore((prev) => {
                const next = prev + 1;
                if (next >= 20) {
                    onComplete();
                }
                return next;
            });
        }
    }, [onComplete]);

    // 處理 QTE 成功
    const handleQTESuccess = useCallback((index: number) => {
        const timers = qteTimersRef.current.get(index);
        if (timers) {
            clearTimeout(timers.timeout);
            clearInterval(timers.interval);
            qteTimersRef.current.delete(index);
        }

        setActiveQTEs((prev) => prev.map((qte) => (qte.index === index ? { ...qte, result: "success" } : qte)));
        setCompletedQTEs((prev) => [...prev, index]);
        // 累積分數，達到 30 分立即過關
        setScore((prev) => {
            const next = prev + 1;
            if (next >= 20) {
                onComplete();
            }
            return next;
        });

        // 移除這個 QTE
        setTimeout(() => {
            setActiveQTEs((prev) => prev.filter((qte) => qte.index !== index));
        }, 300);
    }, []);

    // 處理 QTE 失敗
    const handleQTEFail = useCallback(
        (index: number) => {
            const timers = qteTimersRef.current.get(index);
            if (timers) {
                clearTimeout(timers.timeout);
                clearInterval(timers.interval);
                qteTimersRef.current.delete(index);
            }

            setActiveQTEs((prev) => prev.map((qte) => (qte.index === index ? { ...qte, result: "fail" } : qte)));
            setCompletedQTEs((prev) => [...prev, index]);

            // 隨機彈出失敗影片（懲罰：不能關閉，播完自動消失，不循環）
            const randomVideo = FAIL_VIDEOS[Math.floor(Math.random() * FAIL_VIDEOS.length)];
            addPopupVideo(randomVideo, { showClose: false, autoCloseOnEnd: true, isDistraction: false, loop: false });

            // 移除這個 QTE
            setTimeout(() => {
                setActiveQTEs((prev) => prev.filter((qte) => qte.index !== index));
            }, 300);
        },
        [addPopupVideo]
    );

    // 監聽影片時間
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const currentTime = video.currentTime;

            // 檢查是否到達 QTE 時間點
            qteEvents.forEach((event, index) => {
                if (
                    !completedQTEs.includes(index) &&
                    !activeQTEs.some((q) => q.index === index) &&
                    currentTime >= event.time &&
                    currentTime < event.time + 0.3
                ) {
                    // 找一個不重疊的位置
                    const existingPositions = activeQTEs.map((q) => q.position);
                    const position = getRandomQTEPosition(existingPositions);

                    // 添加新的 QTE
                    const newQTE: ActiveQTE = {
                        index,
                        key: event.key,
                        duration: event.duration,
                        startTime: Date.now(),
                        timeLeft: event.duration,
                        position,
                        result: null,
                    };

                    setActiveQTEs((prev) => [...prev, newQTE]);

                    // 倒數計時
                    const intervalId = window.setInterval(() => {
                        setActiveQTEs((prev) =>
                            prev.map((qte) => {
                                if (qte.index === index && qte.result === null) {
                                    const elapsed = Date.now() - qte.startTime;
                                    return { ...qte, timeLeft: Math.max(0, qte.duration - elapsed) };
                                }
                                return qte;
                            })
                        );
                    }, 50);

                    // 超時處理
                    const timeoutId = window.setTimeout(() => {
                        handleQTEFail(index);
                    }, event.duration);

                    qteTimersRef.current.set(index, { timeout: timeoutId, interval: intervalId });
                }
            });

            // 檢查是否到達干擾影片時間點
            DISTRACTION_TIMES.forEach((time, index) => {
                if (!triggeredDistractions.includes(index) && currentTime >= time && currentTime < time + 1.0) {
                    setTriggeredDistractions((prev) => [...prev, index]);
                    // 隨機選擇干擾影片（可關閉，關閉+1分，循環播放直到關閉）
                    const randomVideo = DISTRACTION_VIDEOS[Math.floor(Math.random() * DISTRACTION_VIDEOS.length)];
                    addPopupVideo(randomVideo, { showClose: true, autoCloseOnEnd: false, isDistraction: true, loop: true });
                }
            });
        };

        const handleEnded = () => {
            onComplete();
        };

        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("ended", handleEnded);

        return () => {
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("ended", handleEnded);

        };
    }, [qteEvents, completedQTEs, activeQTEs, triggeredDistractions, onComplete, addPopupVideo, handleQTEFail]);

    // 監聽按鍵
    useEffect(() => {
        if (activeQTEs.length === 0) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const pressedKey = e.key.toUpperCase();

            // 找到匹配的 QTE（尚未完成的）
            const matchingQTE = activeQTEs.find((qte) => qte.result === null && qte.key === pressedKey);

            if (matchingQTE) {
                handleQTESuccess(matchingQTE.index);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeQTEs, handleQTESuccess]);

    const qteButtonSize = isMobile ? 70 : 90;

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#0A0A0F",
                position: "relative",
                overflow: "hidden",
                padding: isMobile ? "10px" : "20px",
                boxSizing: "border-box",
            }}
        >
            {/* Ambient glow */}
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "min(800px, 100vw)",
                    height: "min(600px, 80vh)",
                    background: "radial-gradient(ellipse, rgba(245, 158, 11, 0.04) 0%, transparent 60%)",
                    pointerEvents: "none",
                }}
            />

            {/* Header with badge and title */}
            <div
                style={{
                    position: "absolute",
                    top: isMobile ? 10 : 24,
                    display: "flex",
                    flexDirection: isMobile ? "row" : "column",
                    alignItems: "center",
                    gap: isMobile ? 12 : 8,
                    zIndex: 10,
                    flexWrap: "wrap",
                    justifyContent: "center",
                    padding: "0 10px",
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: isMobile ? "4px 10px" : "6px 14px",
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.2)",
                        borderRadius: 9999,
                        fontSize: "clamp(11px, 2.5vw, 13px)",
                        color: "#F59E0B",
                        fontWeight: 500,
                    }}
                >
                    第二關
                </motion.div>
                {!isMobile && (
                    <motion.h2
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        style={{
                            color: "#FAFAFA",
                            fontSize: "clamp(18px, 5vw, 28px)",
                            fontWeight: 700,
                            fontFamily: '"Space Grotesk", system-ui, sans-serif',
                            letterSpacing: "-0.025em",
                            margin: 0,
                        }}
                    >
                        QTE 挑戰
                    </motion.h2>
                )}
                <div style={{ color: "#D4D4D8", fontSize: "clamp(12px, 3vw, 14px)" }}>
                    分數：<span style={{ color: "#F59E0B", fontWeight: 700 }}>{score}</span> / 20
                </div>
            </div>

            {/* 影片播放器 */}
            <motion.video
                ref={videoRef}
                src={`${BASE}oia貓一分鐘版.mp4`}
                autoPlay
                playsInline
                onLoadedMetadata={() => {
                    if (videoRef.current) videoRef.current.volume = 0.25;
                }}
                style={{
                    width: isMobile ? "95%" : "auto",
                    maxWidth: isMobile ? "95%" : "85%",
                    maxHeight: isMobile ? "45vh" : "65vh",
                    borderRadius: "clamp(8px, 2vw, 12px)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                    marginTop: isMobile ? "clamp(60px, 15vh, 80px)" : 80,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            />

            {/* QTE 提示 - 支援多個同時顯示，可點擊（手機支援） */}
            <AnimatePresence>
                {activeQTEs.map((qte) => (
                    <motion.div
                        key={qte.index}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        style={{
                            position: "fixed",
                            left: qte.position.x,
                            top: qte.position.y,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            zIndex: 20,
                        }}
                    >
                        <motion.div
                            onClick={() => {
                                if (qte.result === null) {
                                    handleQTESuccess(qte.index);
                                }
                            }}
                            whileHover={qte.result === null ? { scale: 1.1 } : {}}
                            whileTap={qte.result === null ? { scale: 0.95 } : {}}
                            animate={
                                qte.result === null
                                    ? {
                                          scale: [1, 1.08, 1],
                                          boxShadow: [
                                              "0 0 0 0 rgba(245, 158, 11, 0.5)",
                                              "0 0 0 15px rgba(245, 158, 11, 0)",
                                              "0 0 0 0 rgba(245, 158, 11, 0)",
                                          ],
                                      }
                                    : {}
                            }
                            transition={{ duration: 0.6, repeat: Infinity }}
                            style={{
                                width: qteButtonSize,
                                height: qteButtonSize,
                                background:
                                    qte.result === "success"
                                        ? "#22C55E"
                                        : qte.result === "fail"
                                        ? "#1A1A24"
                                        : "#F59E0B",
                                border: qte.result === "fail" ? "1px solid rgba(255,255,255,0.1)" : "none",
                                borderRadius: isMobile ? 10 : 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: isMobile ? 32 : 42,
                                fontWeight: 700,
                                fontFamily: '"Space Grotesk", system-ui, sans-serif',
                                color: qte.result === "fail" ? "#71717A" : "#0A0A0F",
                                boxShadow:
                                    qte.result === null
                                        ? "0 0 30px rgba(245, 158, 11, 0.3)"
                                        : qte.result === "success"
                                        ? "0 0 30px rgba(34, 197, 94, 0.3)"
                                        : "none",
                                cursor: qte.result === null ? "pointer" : "default",
                                userSelect: "none",
                                WebkitTapHighlightColor: "transparent",
                            }}
                        >
                            {qte.result === "success" ? "✓" : qte.result === "fail" ? "✗" : qte.key}
                        </motion.div>

                        {qte.result === null && (
                            <>
                                <div
                                    style={{
                                        marginTop: isMobile ? 6 : 10,
                                        color: "#FAFAFA",
                                        fontSize: isMobile ? 11 : 14,
                                        fontWeight: 500,
                                        textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                                        userSelect: "none",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {isMobile ? "點擊" : "按 / 點擊"} <span style={{ color: "#F59E0B", fontWeight: 700 }}>{qte.key}</span>
                                </div>

                                {/* 倒數條 */}
                                <div
                                    style={{
                                        marginTop: isMobile ? 4 : 8,
                                        width: qteButtonSize,
                                        height: isMobile ? 3 : 4,
                                        background: "rgba(255,255,255,0.1)",
                                        borderRadius: 2,
                                        overflow: "hidden",
                                    }}
                                >
                                    <motion.div
                                        style={{
                                            height: "100%",
                                            background: qte.timeLeft > 500 ? "#F59E0B" : "#EF4444",
                                            width: `${(qte.timeLeft / qte.duration) * 100}%`,
                                            boxShadow:
                                                qte.timeLeft > 500
                                                    ? "0 0 10px rgba(245, 158, 11, 0.5)"
                                                    : "0 0 10px rgba(239, 68, 68, 0.5)",
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* 彈出的影片 */}
            <AnimatePresence>
                {popupVideos.map((video) => (
                    <PopupVideo
                        key={video.id}
                        src={video.src}
                        x={video.x}
                        y={video.y}
                        showCloseButton={video.showClose}
                        autoCloseOnEnd={video.autoCloseOnEnd}
                        loop={video.loop}
                        // 👇👇👇 新增這一行 👇👇👇
                        //muted={isMobile}  // 如果是手機版(isMobile為真)，就開啟靜音！
                        // 👆👆👆 新增結束 👆👆👆
                        onClose={() => removePopupVideo(video.id, video.isDistraction)} // 只有干擾影片關閉才 +1 分
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}
