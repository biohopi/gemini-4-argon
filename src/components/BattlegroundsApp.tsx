"use client";

import { cloneLayout, DEFAULT_HUD_LAYOUT } from "@/game/defaultLayout";
import { BattlegroundsEngine } from "@/game/engine/BattlegroundsEngine";
import {
  GraphicsQuality,
  HUDLayoutMap,
  HUDLiveSnapshot,
  MatchConfig,
} from "@/game/types";
import { Smartphone } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { GameHUD } from "./GameHUD";
import { LaunchScreen } from "./LaunchScreen";
import { LayoutEditorModal } from "./LayoutEditorModal";
import { LobbyScreen } from "./LobbyScreen";
import { PauseMenuModal } from "./PauseMenuModal";

export const BattlegroundsApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BattlegroundsEngine | null>(null);

  const [screen, setScreen] = useState<"launch" | "lobby" | "match">("launch");
  const [lobbyInitialTab, setLobbyInitialTab] = useState<
    "offline" | "multiplayer"
  >("multiplayer");

  const [playerId, setPlayerId] = useState("op_guest");
  const [playerName, setPlayerName] = useState("Operator_01");
  const [quality, setQuality] = useState<GraphicsQuality>("hd");
  const [muted, setMuted] = useState(false);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  const [hudLayout, setHudLayout] = useState<HUDLayoutMap>(() =>
    cloneLayout(DEFAULT_HUD_LAYOUT)
  );
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);

  const [activeMatchConfig, setActiveMatchConfig] =
    useState<MatchConfig | null>(null);
  const [hudSnapshot, setHudSnapshot] = useState<HUDLiveSnapshot | null>(null);

  // Initialize persistent Operator ID, Name, & Custom HUD Layout (LocalStorage + PostgreSQL)
  useEffect(() => {
    // Notice we use sessionStorage for playerId per browser tab so opening 2 localhost tabs
    // creates 2 distinct multiplayer operators automatically!
    let pid = sessionStorage.getItem("erangel_tab_player_id");
    if (!pid) {
      pid = `op_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("erangel_tab_player_id", pid);
    }
    setPlayerId(pid);

    const savedName = localStorage.getItem("erangel_operator_name");
    if (savedName) {
      setPlayerName(savedName);
    } else {
      const randSuffix = Math.floor(10 + Math.random() * 89);
      setPlayerName(`Operator_${randSuffix}`);
    }

    const localLayout = localStorage.getItem("erangel_hud_layout_v1");
    if (localLayout) {
      try {
        const parsed = JSON.parse(localLayout) as HUDLayoutMap;
        setHudLayout({ ...cloneLayout(DEFAULT_HUD_LAYOUT), ...parsed });
      } catch {
        // fallback default
      }
    }

    const layoutProfileId =
      localStorage.getItem("erangel_layout_profile_id") || pid;
    localStorage.setItem("erangel_layout_profile_id", layoutProfileId);

    fetch(`/api/layouts?playerId=${encodeURIComponent(layoutProfileId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.layout) {
          setHudLayout((prev) => ({ ...prev, ...data.layout }));
        }
      })
      .catch(() => {});
  }, []);

  // Mount Three.js 3D Engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new BattlegroundsEngine(canvasRef.current, {
      quality: "hd",
      onHudUpdate: (snap) => setHudSnapshot(snap),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Fullscreen & Landscape Orientation Listener
  useEffect(() => {
    const checkViewport = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setIsPortraitMobile(
        window.innerWidth < 680 && window.innerHeight > window.innerWidth * 1.1
      );
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    document.addEventListener("fullscreenchange", checkViewport);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape" && screen === "match" && !layoutEditorOpen) {
        setPauseOpen((prev) => {
          const next = !prev;
          engineRef.current?.setPaused(next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", checkViewport);
      document.removeEventListener("fullscreenchange", checkViewport);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [screen, layoutEditorOpen]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        if (typeof window !== "undefined" && window.screen?.orientation) {
          const so = window.screen.orientation as unknown as {
            lock?: (mode: string) => Promise<void>;
          };
          so.lock?.("landscape").catch(() => {});
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Browser denied fullscreen
    }
  }, []);

  const handleChangeName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem("erangel_operator_name", name);
  };

  const handleChangeQuality = (q: GraphicsQuality) => {
    setQuality(q);
    engineRef.current?.applyGraphicsQuality(q);
  };

  const handleToggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      if (engineRef.current) engineRef.current.sound.muted = next;
      return next;
    });
  };

  const handleChangeSensitivity = (val: number) => {
    setSensitivity(val);
    if (engineRef.current) engineRef.current.lookSensitivity = val;
  };

  const handleStartMatch = (config: MatchConfig) => {
    setActiveMatchConfig(config);
    setPauseOpen(false);
    setScreen("match");
    engineRef.current?.startMatch(config);
  };

  const handleReturnToLobby = () => {
    setPauseOpen(false);
    engineRef.current?.returnToLobbyPreview();
    setScreen("lobby");
  };

  const layoutProfileKey =
    typeof window !== "undefined"
      ? localStorage.getItem("erangel_layout_profile_id") || playerId
      : playerId;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      {/* Persistent Three.js 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="block h-full w-full outline-none"
      />

      {/* Landscape View Priority Notice for Narrow Portrait Mobile Screens */}
      {isPortraitMobile && (
        <div className="pointer-events-auto fixed bottom-2 left-2 right-2 z-50 flex items-center justify-between rounded-xl border border-amber-400/60 bg-slate-950/92 px-3 py-2 text-xs text-amber-200 shadow-xl">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 rotate-90 text-amber-400 shrink-0" />
            <span>
              Rotate device to <strong>Landscape View</strong> or tap Full
              Screen for optimal tactical HUD.
            </span>
          </div>
          <button
            onClick={handleToggleFullscreen}
            className="ml-2 rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-black uppercase text-slate-950 shrink-0"
          >
            Landscape
          </button>
        </div>
      )}

      {/* 1. Launched First Screen Tab */}
      {screen === "launch" && (
        <LaunchScreen
          playerName={playerName}
          onChangeName={handleChangeName}
          quality={quality}
          onChangeQuality={handleChangeQuality}
          muted={muted}
          onToggleMute={handleToggleMute}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onEnterLobby={(target) => {
            if (target === "layout") {
              setLobbyInitialTab("multiplayer");
              setScreen("lobby");
              setLayoutEditorOpen(true);
            } else {
              setLobbyInitialTab(target);
              setScreen("lobby");
            }
          }}
        />
      )}

      {/* 2. Offline & Multiplayer Room Creation / Connecting Lobby Screen */}
      {screen === "lobby" && (
        <LobbyScreen
          playerId={playerId}
          playerName={playerName || "Operator"}
          initialTab={lobbyInitialTab}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onBackToLaunch={() => setScreen("launch")}
          onOpenLayoutEditor={() => setLayoutEditorOpen(true)}
          onStartMatch={handleStartMatch}
        />
      )}

      {/* 3. Live 3D Match Tactical HUD */}
      {screen === "match" &&
        engineRef.current &&
        hudSnapshot &&
        activeMatchConfig && (
          <GameHUD
            engine={engineRef.current}
            snap={hudSnapshot}
            layout={hudLayout}
            playerTeam={activeMatchConfig.playerTeam}
            roomCode={activeMatchConfig.roomCode}
            mode={activeMatchConfig.mode}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onOpenLayoutEditor={() => {
              engineRef.current?.setPaused(true);
              setLayoutEditorOpen(true);
            }}
            onOpenPauseMenu={() => {
              engineRef.current?.setPaused(true);
              setPauseOpen(true);
            }}
            onReturnToLobby={handleReturnToLobby}
          />
        )}

      {/* Pause Menu Modal */}
      <PauseMenuModal
        open={pauseOpen && !layoutEditorOpen}
        sensitivity={sensitivity}
        onChangeSensitivity={handleChangeSensitivity}
        quality={quality}
        onChangeQuality={handleChangeQuality}
        muted={muted}
        onToggleMute={handleToggleMute}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenLayoutEditor={() => setLayoutEditorOpen(true)}
        onResume={() => {
          setPauseOpen(false);
          engineRef.current?.setPaused(false);
        }}
        onQuitToLobby={handleReturnToLobby}
      />

      {/* Custom HUD Buttons Layout Customization Tab Modal */}
      {layoutEditorOpen && (
        <LayoutEditorModal
          playerId={layoutProfileKey}
          initialLayout={hudLayout}
          onSave={(updated) => setHudLayout(updated)}
          onClose={() => {
            setLayoutEditorOpen(false);
            if (screen === "match" && !pauseOpen) {
              engineRef.current?.setPaused(false);
            }
          }}
        />
      )}
    </div>
  );
};
