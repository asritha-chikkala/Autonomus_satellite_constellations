"use client";

import React, { useState } from "react";
import { PlusCircle, Play, AlertTriangle, RefreshCw, Cpu, Globe, Rocket, ShieldAlert, Layers, MapPin, CheckCircle2 } from "lucide-react";
import { resolvePlaceName } from "./AddTaskModal";

interface MissionControlPanelProps {
  onAddTask: (target: {
    latitude: number;
    longitude: number;
    priority: string;
    type: string;
    action: string;
    place_name?: string;
    name?: string;
  }) => void;
  onOpenModal?: () => void;
  onTriggerFailure: (satId: string) => void;
  onRunMatlab: () => void;
  onReset: () => void;
  activeTasksCount?: number;
}

export default function MissionControlPanel({
  onAddTask,
  onOpenModal,
  onTriggerFailure,
  onRunMatlab,
  onReset,
  activeTasksCount = 0,
}: MissionControlPanelProps) {
  const [lat, setLat] = useState<number>(16.50);
  const [lon, setLon] = useState<number>(80.60);
  const [priority, setPriority] = useState<string>("HIGH");
  const [missionType, setMissionType] = useState<string>("Earth Observation");
  const [action, setAction] = useState<string>("CAPTURE IMAGE");
  const [faultSatId, setFaultSatId] = useState<string>("SAT-03");

  const isFirstTask = activeTasksCount === 0;
  const detectedPlace = resolvePlaceName(lat, lon);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTask({
      latitude: Number(lat),
      longitude: Number(lon),
      priority,
      type: missionType,
      action,
      place_name: detectedPlace,
      name: `TASK-${activeTasksCount + 1}: ${detectedPlace}`,
    });
  };

  const setPreset = (name: string, pLat: number, pLon: number) => {
    setLat(pLat);
    setLon(pLon);
    setAction(`CAPTURE ${name.toUpperCase()}`);
  };

  return (
    <div className="hud-panel rounded-2xl p-5 border border-cyan-500/30 flex flex-col gap-4 bg-space-950/90 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-400/30">
            <Layers className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono flex items-center gap-2">
              <span>DYNAMIC MULTI-TASK DISPATCHER</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300">
                PARALLEL MAS
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Execute initial task • Add simultaneous tasks dynamically anytime
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenModal && (
            <button
              type="button"
              onClick={onOpenModal}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>CUSTOM FORM</span>
            </button>
          )}
          <div className="text-xs font-mono bg-space-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300">
            Running: <span className="text-emerald-400 font-bold">{activeTasksCount}</span>
          </div>
        </div>
      </div>

      {/* Concurrent Task Status Banner */}
      {activeTasksCount > 0 && (
        <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-2.5 flex items-center gap-2 text-xs font-mono text-emerald-300">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Task active! You can click <strong>+ ADD TASK</strong> below to dispatch another task in parallel.</span>
        </div>
      )}

      {/* Quick Global Preset Target Buttons */}
      <div>
        <div className="text-[11px] text-slate-400 font-mono mb-1.5 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>Quick Preset Targets (Click to populate):</span>
        </div>
        <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
          <button
            type="button"
            onClick={() => setPreset("Vijayawada / AP, India", 16.50, 80.60)}
            className="px-2 py-1 rounded bg-space-900 hover:bg-space-800 border border-slate-700 hover:border-cyan-400 text-slate-200 transition-all cursor-pointer"
          >
            🇮🇳 India (16.5° N, 80.6° E)
          </button>
          <button
            type="button"
            onClick={() => setPreset("San Francisco, USA", 37.77, -122.41)}
            className="px-2 py-1 rounded bg-space-900 hover:bg-space-800 border border-slate-700 hover:border-cyan-400 text-slate-200 transition-all cursor-pointer"
          >
            🇺🇸 USA (37.7° N, -122.4° W)
          </button>
          <button
            type="button"
            onClick={() => setPreset("Paris, France", 48.85, 2.35)}
            className="px-2 py-1 rounded bg-space-900 hover:bg-space-800 border border-slate-700 hover:border-cyan-400 text-slate-200 transition-all cursor-pointer"
          >
            🇪🇺 Europe (48.8° N, 2.3° E)
          </button>
          <button
            type="button"
            onClick={() => setPreset("Tokyo, Japan", 35.67, 139.65)}
            className="px-2 py-1 rounded bg-space-900 hover:bg-space-800 border border-slate-700 hover:border-cyan-400 text-slate-200 transition-all cursor-pointer"
          >
            🇯🇵 Japan (35.7° N, 139.6° E)
          </button>
          <button
            type="button"
            onClick={() => setPreset("Sydney, Australia", -33.86, 151.20)}
            className="px-2 py-1 rounded bg-space-900 hover:bg-space-800 border border-slate-700 hover:border-cyan-400 text-slate-200 transition-all cursor-pointer"
          >
            🇦🇺 Australia (-33.8° S, 151.2° E)
          </button>
        </div>
      </div>

      {/* Task Creation Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          <div>
            <label className="text-slate-400 text-[11px] mb-1 block">Target Latitude (° N)</label>
            <input
              type="number"
              step="0.01"
              value={lat}
              onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
              className="w-full bg-space-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-white font-mono outline-none transition-all shadow-inner"
            />
          </div>
          <div>
            <label className="text-slate-400 text-[11px] mb-1 block">Target Longitude (° E)</label>
            <input
              type="number"
              step="0.01"
              value={lon}
              onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
              className="w-full bg-space-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-white font-mono outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Dynamic Place Name Display (User requested: "tell the place name as welll keep it on target in globe") */}
        <div className="bg-space-900/90 border border-cyan-500/40 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-slate-400 text-[11px]">Target Place:</span>
            <span className="text-cyan-200 font-bold">{detectedPlace}</span>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded font-bold">
            ✓ On-Globe Target
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          <div>
            <label className="text-slate-400 text-[11px] mb-1 block">Mission Type</label>
            <select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value)}
              className="w-full bg-space-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-white font-mono outline-none"
            >
              <option value="Earth Observation">Earth Observation</option>
              <option value="Disaster Monitoring">Disaster Monitoring</option>
              <option value="Reconnaissance">Reconnaissance</option>
              <option value="Atmospheric Sounding">Atmospheric Sounding</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-[11px] mb-1 block">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-space-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-white font-mono outline-none"
            >
              <option value="CRITICAL">CRITICAL (Immediate)</option>
              <option value="HIGH">HIGH (Standard)</option>
              <option value="MEDIUM">MEDIUM (Next Pass)</option>
              <option value="LOW">LOW (Opportunistic)</option>
            </select>
          </div>
        </div>

        {/* Primary Action Button: "START TASK" if 0 tasks, "+ ADD TASK" if continuing */}
        <button
          type="submit"
          className={`w-full py-3.5 px-4 rounded-xl font-mono font-bold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer shadow-lg ${
            isFirstTask
              ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-space-950 shadow-emerald-500/25 border border-emerald-300"
              : "bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-space-950 shadow-cyan-500/25 border border-cyan-200"
          }`}
        >
          {isFirstTask ? (
            <>
              <Play className="w-5 h-5 fill-space-950 text-emerald-200" />
              <span>START TASK (EXECUTE MISSION 1: {detectedPlace})</span>
            </>
          ) : (
            <>
              <PlusCircle className="w-5 h-5 fill-space-950 text-cyan-200" />
              <span>+ ADD TASK (SIMULTANEOUS: {detectedPlace})</span>
            </>
          )}
        </button>
      </form>

      {/* Control Actions & Scenario Buttons */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2 font-mono">
          <button
            type="button"
            onClick={onRunMatlab}
            className="px-3 py-2 bg-space-900 hover:bg-space-800 border border-amber-500/40 hover:border-amber-400 rounded-xl text-xs text-amber-300 flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>EXECUTE MATLAB</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="px-3 py-2 bg-space-900 hover:bg-space-800 border border-slate-700 hover:border-slate-500 rounded-xl text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>RESET FLEET</span>
          </button>
        </div>

        {/* Fault Injection Section */}
        <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl flex flex-col gap-2 font-mono">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-red-400 font-bold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              FAULT INJECTION (CONTINGENCY REALLOCATION)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={faultSatId}
              onChange={(e) => setFaultSatId(e.target.value)}
              className="bg-space-900 border border-red-900/60 rounded-lg px-2 py-1.5 text-xs text-red-200 outline-none flex-1"
            >
              <option value="SAT-03">SAT-03</option>
              <option value="SAT-01">SAT-01</option>
              <option value="SAT-05">SAT-05</option>
              <option value="SAT-08">SAT-08</option>
              <option value="SAT-12">SAT-12</option>
            </select>
            <button
              type="button"
              onClick={() => onTriggerFailure(faultSatId)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 border border-red-400 rounded-lg text-xs text-white font-semibold transition-all shadow-md shadow-red-900/40 cursor-pointer"
            >
              INJECT FAULT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
