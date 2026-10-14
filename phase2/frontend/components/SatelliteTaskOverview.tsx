"use client";

import React, { useState } from "react";
import { Satellite, Radio, Cpu, Battery, Activity, ShieldAlert, AlertTriangle, Zap, CheckCircle2, ChevronRight, Target, PlusCircle } from "lucide-react";

interface SatelliteData {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  altitude: number;
  latitude: number;
  longitude: number;
  battery: number;
  health: number;
  risk: number;
  failure_prob?: number;
  status: string;
  active_links?: number;
  is_faulty?: boolean;
  is_busy?: boolean;
  current_task?: string;
}

interface TaskData {
  id: string;
  name?: string;
  place_name?: string;
  target: {
    latitude: number;
    longitude: number;
    priority?: string;
    place_name?: string;
    name?: string;
  };
  assigned_satellite?: string;
  phase: string;
  progress: number;
  status_message?: string;
}

interface SatelliteTaskOverviewProps {
  satellites: SatelliteData[];
  tasks: TaskData[];
  selectedSatelliteId?: string;
  selectedTaskId?: string;
  onSelectSatellite: (satId: string) => void;
  onSelectTask?: (taskId: string) => void;
  onOpenAddTaskModal?: () => void;
  onTriggerFailure?: (satId: string) => void;
}

export default function SatelliteTaskOverview({
  satellites = [],
  tasks = [],
  selectedSatelliteId,
  selectedTaskId,
  onSelectSatellite,
  onSelectTask,
  onOpenAddTaskModal,
  onTriggerFailure,
}: SatelliteTaskOverviewProps) {
  const [viewMode, setViewMode] = useState<"ACTIVE_MISSIONS" | "FLEET_ALL">("ACTIVE_MISSIONS");

  // Filter tasks that are actively executing or completed
  const activeTasks = tasks.filter((t) => t.phase !== "COMPLETED");
  const completedTasks = tasks.filter((t) => t.phase === "COMPLETED");

  // Determine current active or selected satellite
  const selectedSat = satellites.find((s) => s.id === selectedSatelliteId) || satellites[0];

  // Assigned task for selected satellite
  const selectedSatTask = tasks.find(
    (t) => t.assigned_satellite === selectedSat?.id && t.phase !== "COMPLETED"
  ) || tasks.find((t) => t.assigned_satellite === selectedSat?.id) || null;

  // Is single task mode or multiple tasks
  const isSingleActiveTask = tasks.length <= 1;

  return (
    <div className="hud-panel rounded-2xl p-4 border border-cyan-500/30 bg-space-950/95 flex flex-col h-full font-mono shadow-xl relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Satellite className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>SATELLITE TASK OVERVIEW</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                {tasks.length > 0 ? `${tasks.length} TASKS` : "NOMINAL"}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Autonomous Fleet Task Execution &amp; Telemetry
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-space-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
          <button
            onClick={() => setViewMode("ACTIVE_MISSIONS")}
            className={`px-2 py-1 rounded transition-all font-bold cursor-pointer ${
              viewMode === "ACTIVE_MISSIONS"
                ? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            MISSIONS ({tasks.length})
          </button>
          <button
            onClick={() => setViewMode("FLEET_ALL")}
            className={`px-2 py-1 rounded transition-all font-bold cursor-pointer ${
              viewMode === "FLEET_ALL"
                ? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            FLEET (20)
          </button>
        </div>
      </div>

      {/* STRICT SCROLLABLE CONTAINER: ONLY THIS CONTAINER SCROLLS INTERNALLY */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
        {/* VIEW MODE 1: ACTIVE MISSIONS */}
        {viewMode === "ACTIVE_MISSIONS" && (
          <>
            {tasks.length === 0 ? (
              // CASE 0: No active mission initialized yet
              <div className="flex flex-col items-center justify-center p-6 text-center gap-3 bg-space-900/40 rounded-xl border border-dashed border-slate-800">
                <Satellite className="w-10 h-10 text-cyan-500/40 animate-pulse" />
                <div className="text-xs font-bold text-slate-300">NO ACTIVE MISSIONS IN FLIGHT</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The 20-satellite constellation is cruising in nominal LEO orbits. Initialize a new autonomous mission.
                </p>
                {onOpenAddTaskModal && (
                  <button
                    onClick={onOpenAddTaskModal}
                    className="mt-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-space-950 font-bold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-lg"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>LAUNCH NEW MISSION</span>
                  </button>
                )}
              </div>
            ) : isSingleActiveTask && selectedSatTask ? (
              // CASE 1: Only ONE satellite is executing a task (or one task exists) -> SHOW DETAILED OVERVIEW
              <div className="flex flex-col gap-3">
                <div className="bg-space-900/90 border-2 border-cyan-400/80 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg shadow-cyan-950/50">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-sm font-bold text-white tracking-wider">
                        {selectedSatTask.assigned_satellite || selectedSat?.id}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold">
                        ACTIVE TASK
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                      {selectedSatTask.phase}
                    </span>
                  </div>

                  {/* Target & Mission */}
                  <div className="bg-space-950/70 p-2.5 rounded-lg border border-slate-800/80 flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span>MISSION:</span>
                      <span className="text-white font-bold">{selectedSatTask.id}</span>
                    </div>
                    <div className="text-cyan-300 font-bold text-xs">
                      {selectedSatTask.place_name || selectedSatTask.target.place_name || "Earth Observation Mission"}
                    </div>
                    <div className="text-slate-300 text-[11px] flex items-center gap-1 mt-0.5">
                      <Target className="w-3 h-3 text-red-400" />
                      <span>{selectedSatTask.target.latitude.toFixed(2)}° N, {selectedSatTask.target.longitude.toFixed(2)}° E</span>
                    </div>
                  </div>

                  {/* Telemetry Grid */}
                  {selectedSat && (
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-space-950/50 p-2.5 rounded-lg border border-slate-800/60">
                      <div>
                        <span className="text-slate-400 text-[10px]">Battery:</span>
                        <div className="text-amber-300 font-bold">{selectedSat.battery.toFixed(1)}%</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Health Score:</span>
                        <div className="text-emerald-400 font-bold">{selectedSat.health.toFixed(3)} (GOOD)</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Risk Index:</span>
                        <div className="text-cyan-300 font-bold">{selectedSat.risk.toFixed(3)}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Altitude:</span>
                        <div className="text-white font-bold">{selectedSat.altitude.toFixed(1)} km</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Velocity Mag:</span>
                        <div className="text-white font-bold">
                          {Math.sqrt(
                            selectedSat.velocity[0] ** 2 +
                            selectedSat.velocity[1] ** 2 +
                            selectedSat.velocity[2] ** 2
                          ).toFixed(2)} km/s
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">MPC Controller:</span>
                        <div className="text-emerald-400 font-bold">
                          {selectedSatTask.phase === "EXECUTING" || selectedSatTask.phase === "MPC_ACTIVE" ? "ACTIVE TRACKING" : "STANDBY"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Position Vector */}
                  {selectedSat && (
                    <div className="text-[10px] text-slate-400 bg-space-950/80 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 mb-0.5">POSITION ECI [X, Y, Z] km:</div>
                      <div className="text-slate-200 font-mono text-[9.5px]">
                        [{selectedSat.position[0].toFixed(1)}, {selectedSat.position[1].toFixed(1)}, {selectedSat.position[2].toFixed(1)}]
                      </div>
                    </div>
                  )}

                  {/* Mission Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>MISSION PROGRESS</span>
                      <span className="text-emerald-400 font-bold">{selectedSatTask.progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-space-950 border border-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${selectedSatTask.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Fault Trigger Quick Button */}
                  {onTriggerFailure && (
                    <button
                      onClick={() => onTriggerFailure(selectedSatTask.assigned_satellite || selectedSat.id)}
                      className="mt-1 w-full py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/50 text-red-300 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                      <span>INJECT SATELLITE FAULT SCENARIO</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // CASE 2: MULTIPLE satellites are executing tasks -> MULTIPLE TASK CARDS IN SCROLLABLE LIST
              <div className="flex flex-col gap-2.5">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>CONCURRENT ACTIVE TASKS ({tasks.length})</span>
                  <span className="text-cyan-400 font-bold">CLICK CARD TO SELECT</span>
                </div>

                {tasks.map((task) => {
                  const sat = satellites.find((s) => s.id === task.assigned_satellite);
                  const isSelected = task.id === selectedTaskId || sat?.id === selectedSatelliteId;

                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        if (task.assigned_satellite) onSelectSatellite(task.assigned_satellite);
                        if (onSelectTask) onSelectTask(task.id);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? "bg-space-900 border-cyan-400 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-400"
                          : "bg-space-900/70 border-slate-800/80 hover:border-slate-600 hover:bg-space-900"
                      }`}
                    >
                      {/* Top Bar of Card */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              task.phase === "COMPLETED"
                                ? "bg-cyan-400"
                                : "bg-emerald-400 animate-ping"
                            }`}
                          />
                          <span className="text-xs font-bold text-white">
                            {task.assigned_satellite || "MAS ALLOCATING"}
                          </span>
                          <span className="text-[10px] text-slate-400">[{task.id}]</span>
                        </div>
                        <span
                          className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold ${
                            task.phase === "COMPLETED"
                              ? "bg-cyan-950 border border-cyan-500/40 text-cyan-300"
                              : "bg-emerald-950 border border-emerald-500/40 text-emerald-300"
                          }`}
                        >
                          {task.phase}
                        </span>
                      </div>

                      {/* Target Location */}
                      <div className="text-[11px] text-slate-200 flex items-center justify-between">
                        <span className="truncate max-w-[140px] text-slate-300 font-medium">
                          {task.place_name || task.target.place_name || "Observation Target"}
                        </span>
                        <span className="text-[10px] text-amber-300 font-bold">
                          {task.target.latitude.toFixed(1)}°N, {task.target.longitude.toFixed(1)}°E
                        </span>
                      </div>

                      {/* Satellite Health & Battery mini stats */}
                      {sat && (
                        <div className="grid grid-cols-3 gap-1 text-[10px] bg-space-950/60 p-1.5 rounded border border-slate-800/60 text-center">
                          <div>
                            <span className="text-slate-400">Battery:</span>{" "}
                            <span className="text-amber-300 font-bold">{sat.battery.toFixed(0)}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Health:</span>{" "}
                            <span className="text-emerald-400 font-bold">{sat.health.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Risk:</span>{" "}
                            <span className="text-cyan-300 font-bold">{sat.risk.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
                          <span>Progress</span>
                          <span className="text-white font-bold">{task.progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-space-950 border border-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* VIEW MODE 2: ALL 20 SATELLITES IN FLEET */}
        {viewMode === "FLEET_ALL" && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
              ALL 20 SATELLITES • CLICK TO FOCUS &amp; INSPECT
            </div>
            {satellites.map((sat) => {
              const isSelected = sat.id === selectedSatelliteId;
              const hasTask = tasks.some(
                (t) => t.assigned_satellite === sat.id && t.phase !== "COMPLETED"
              );

              return (
                <div
                  key={sat.id}
                  onClick={() => onSelectSatellite(sat.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? "bg-space-900 border-cyan-400 ring-1 ring-cyan-400 shadow-md"
                      : "bg-space-900/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          hasTask
                            ? "bg-emerald-400 animate-ping"
                            : sat.is_faulty
                            ? "bg-red-500"
                            : "bg-cyan-400"
                        }`}
                      />
                      <span>{sat.id}</span>
                      {hasTask && (
                        <span className="text-[9px] px-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                          EXECUTING
                        </span>
                      )}
                      {sat.is_faulty && (
                        <span className="text-[9px] px-1 rounded bg-red-950 border border-red-500/40 text-red-300">
                          FAULTY
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Alt: <span className="text-white font-bold">{sat.altitude.toFixed(0)} km</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-300">
                    <div>Bat: <span className="text-amber-300 font-bold">{sat.battery.toFixed(0)}%</span></div>
                    <div>Hlth: <span className="text-emerald-400 font-bold">{sat.health.toFixed(2)}</span></div>
                    <div>Risk: <span className="text-cyan-300 font-bold">{sat.risk.toFixed(2)}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Sticky Action / Add Task button inside left panel */}
      {onOpenAddTaskModal && (
        <div className="pt-2 border-t border-slate-800 mt-2">
          <button
            onClick={onOpenAddTaskModal}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-space-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/40 active:scale-95 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 fill-space-950 text-cyan-200" />
            <span>+ ADD NEW MISSION TASK</span>
          </button>
        </div>
      )}
    </div>
  );
}
