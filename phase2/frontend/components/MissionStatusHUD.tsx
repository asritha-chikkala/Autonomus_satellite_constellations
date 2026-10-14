"use client";

import React, { useState } from "react";
import { Activity, Radio, Cpu, CheckCircle2, AlertOctagon, Camera, ArrowRight, ShieldCheck, Layers, Clock } from "lucide-react";

interface TaskData {
  id: string;
  target: { latitude: number; longitude: number; priority?: string };
  assigned_satellite?: string;
  phase: string;
  progress: number;
  status_message?: string;
  captured_image?: any;
  metrics?: any;
}

interface MissionStatusHUDProps {
  currentPhase: string;
  progress: number;
  statusMessage: string;
  selectedSatellite: any;
  capturedImage: any;
  missionMetrics: any;
  tasks?: TaskData[];
}

export default function MissionStatusHUD({
  currentPhase,
  progress,
  statusMessage,
  selectedSatellite,
  capturedImage,
  missionMetrics,
  tasks = [],
}: MissionStatusHUDProps) {
  const PHASES_LIST = [
    { key: "INITIALIZING", label: "INIT", desc: "Mission Request" },
    { key: "COMMUNICATING", label: "COMM", desc: "Dynamic Links A(t)" },
    { key: "ANALYZING", label: "AI FUSION", desc: "GAT+LSTM+RF" },
    { key: "ALLOCATING", label: "ALLOCATE", desc: "Hungarian MAS" },
    { key: "MPC_ACTIVE", label: "MPC", desc: "6-DOF Controller" },
    { key: "EXECUTING", label: "EXEC", desc: "Trajectory Maneuver" },
    { key: "TARGET_ACQUIRED", label: "LOCK", desc: "Sensor Nadir" },
    { key: "CAPTURING", label: "CAPTURE", desc: "Observation" },
    { key: "COMPLETED", label: "COMPLETE", desc: "Feedback Loop" },
  ];

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const activeTask = tasks.length > 0 
    ? (tasks.find(t => t.id === selectedTaskId) || tasks[tasks.length - 1])
    : null;

  const displayPhase = activeTask ? activeTask.phase : currentPhase;
  const displayProgress = activeTask ? activeTask.progress : progress;
  const displayMessage = activeTask?.status_message || statusMessage;
  const displayImage = activeTask?.captured_image || capturedImage;
  const displayMetrics = activeTask?.metrics || missionMetrics;

  const getPhaseIndex = (p: string) => {
    const idx = PHASES_LIST.findIndex((item) => item.key === p);
    if (idx !== -1) return idx;
    if (p === "IDLE") return -1;
    return 0;
  };

  const activeIdx = getPhaseIndex(displayPhase);

  return (
    <div className="hud-panel rounded-2xl p-5 border border-cyan-500/30 flex flex-col gap-4 bg-space-950/90 shadow-2xl">
      {/* HUD Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-400/30">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono flex items-center gap-2">
              <span>MISSION STATUS &amp; CONCURRENT TASK PIPELINE</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Live feedback loop • Multi-Agent coordination &amp; 6-DOF execution
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-slate-400">Phase:</span>
          <span className="px-2.5 py-1 rounded-md font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
            {displayPhase}
          </span>
          <span className="text-slate-400">Progress:</span>
          <span className="text-white font-bold bg-space-900 px-2 py-1 rounded border border-slate-800">
            {displayProgress.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Concurrent Tasks Badges / Switcher */}
      {tasks.length > 0 && (
        <div className="flex flex-col gap-2 bg-space-900/60 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-cyan-300">
              <Layers className="w-3.5 h-3.5" />
              CONCURRENT ACTIVE TASKS ({tasks.length})
            </span>
            <span>Click task to inspect details</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tasks.map((t) => {
              const isSelected = (selectedTaskId === t.id) || (!selectedTaskId && t === activeTask);
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className={`px-3 py-1.5 rounded-lg border text-left font-mono text-xs flex items-center gap-2 transition-all ${
                    isSelected
                      ? "bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/20"
                      : "bg-space-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      t.phase === "COMPLETED"
                        ? "bg-emerald-400"
                        : "bg-cyan-400 animate-ping"
                    }`}
                  />
                  <div className="font-bold">{t.id}</div>
                  <div className="text-[10px] text-slate-400">
                    {t.assigned_satellite ? `→ ${t.assigned_satellite}` : "Negotiating..."}
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-space-900 border border-slate-700 text-cyan-300">
                    {t.progress.toFixed(0)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Phase Pipeline Progress Tracker */}
      <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 pt-1">
        {PHASES_LIST.map((step, idx) => {
          const isPassed = activeIdx > idx || displayPhase === "COMPLETED" || displayPhase === "MISSION_COMPLETE";
          const isCurrent = activeIdx === idx;
          return (
            <div
              key={step.key}
              className={`p-2 rounded-lg border text-center transition-all ${
                isCurrent
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20 scale-[1.02]"
                  : isPassed
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-space-900/60 border-slate-800 text-slate-500"
              }`}
            >
              <div className="text-[10px] font-mono font-bold">{step.label}</div>
              <div className="text-[9px] text-slate-400 truncate">{step.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-space-900 rounded-full h-2 overflow-hidden border border-slate-800">
        <div
          className="bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-300 h-full transition-all duration-500 ease-out"
          style={{ width: `${displayProgress}%` }}
        />
      </div>

      {/* Live Broadcast Status Console */}
      <div className="bg-space-950/80 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 flex items-start gap-2.5">
        <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 animate-ping flex-shrink-0" />
        <div className="flex-1">
          <div className="text-slate-400 text-[10px]">MISSION BROADCAST STREAM</div>
          <div className="text-cyan-300 font-semibold mt-0.5">{displayMessage}</div>
        </div>
      </div>

      {/* Assigned Satellite Active Card */}
      {(activeTask?.assigned_satellite || selectedSatellite) && (
        <div className="bg-space-900/90 border border-cyan-500/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 font-bold text-sm">
              {activeTask?.assigned_satellite || selectedSatellite.id}
            </div>
            <div>
              <div className="text-[11px] text-slate-400">ASSIGNED MULTI-AGENT NODE</div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{selectedSatellite?.status || "ENGAGED"}</span>
                <span className="text-[11px] text-emerald-400">✓ Hungarian Optimal</span>
              </div>
            </div>
          </div>

          {selectedSatellite && (
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <div className="text-[10px] text-slate-400">BATTERY</div>
                <div className="text-amber-300 font-bold">{selectedSatellite.battery?.toFixed(1)}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-400">HEALTH</div>
                <div className="text-emerald-400 font-bold">{selectedSatellite.health?.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-400">RISK SCORE</div>
                <div className="text-cyan-300 font-bold">{selectedSatellite.risk?.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-400">ALTITUDE</div>
                <div className="text-white font-bold">{selectedSatellite.altitude?.toFixed(1)} km</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Captured Image Result Card */}
      {displayImage && (
        <div className="bg-space-900 border border-emerald-500/40 rounded-xl p-4 flex flex-col gap-3 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Camera className="w-4 h-4" />
              <span>SIMULATED HIGH-RESOLUTION EARTH OBSERVATION CAPTURED</span>
            </div>
            <span className="text-[10px] text-slate-400">{displayImage.timestamp}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-48 h-32 rounded-lg overflow-hidden border border-cyan-500/40 bg-space-950 flex-shrink-0">
              <img
                src={displayImage.image_url.startsWith("http") ? displayImage.image_url : `http://localhost:8000${displayImage.image_url}`}
                alt="Simulated Earth Observation"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px] text-cyan-300">
                0.5m GSD
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Satellite:</span>{" "}
                <span className="text-white font-bold">{displayImage.satellite_id}</span>
              </div>
              <div>
                <span className="text-slate-400">Target Coords:</span>{" "}
                <span className="text-amber-400 font-bold">{displayImage.target}</span>
              </div>
              <div>
                <span className="text-slate-400">GSD Resolution:</span>{" "}
                <span className="text-emerald-400">{displayImage.resolution}</span>
              </div>
              <div>
                <span className="text-slate-400">Cloud Cover:</span>{" "}
                <span className="text-white">{displayImage.cloud_cover}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mission Metrics Summary */}
      {displayMetrics && Object.keys(displayMetrics).length > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-center">
          <div>
            <div className="text-[10px] text-slate-400">MISSION TIME</div>
            <div className="text-xs font-bold text-white">{displayMetrics.mission_time_sec} s</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">ENERGY CONSUMED</div>
            <div className="text-xs font-bold text-amber-300">{displayMetrics.energy_consumed_pct}%</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">TRACKING RMSE</div>
            <div className="text-xs font-bold text-cyan-300">{displayMetrics.tracking_rmse_km} km</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">MISSION RISK</div>
            <div className="text-xs font-bold text-emerald-400">{displayMetrics.mission_risk?.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">FAILURE PROB</div>
            <div className="text-xs font-bold text-emerald-400">{displayMetrics.failure_prob?.toFixed(3)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
