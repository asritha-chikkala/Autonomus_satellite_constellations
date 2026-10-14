"use client";

import React, { useMemo } from "react";
import { Camera, Eye, MapPin, Navigation, Radio, Shield, CheckCircle2, Clock, Activity, Target } from "lucide-react";

interface TargetData {
  latitude: number;
  longitude: number;
  priority?: string;
  place_name?: string;
  name?: string;
}

interface TaskData {
  id: string;
  name?: string;
  place_name?: string;
  target: TargetData;
  assigned_satellite?: string;
  phase: string;
  progress: number;
  status_message?: string;
  captured_image?: {
    status?: string;
    satellite_id?: string;
    target?: string;
    resolution?: string;
    cloud_cover?: string;
    timestamp?: string;
    image_url: string;
    is_simulated?: boolean;
  };
  metrics?: any;
}

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
  status: string;
}

interface EarthSurfaceObservationProps {
  selectedSatellite?: SatelliteData | null;
  selectedTask?: TaskData | null;
  tasks?: TaskData[];
  onSelectTask?: (taskId: string) => void;
}

export default function EarthSurfaceObservation({
  selectedSatellite,
  selectedTask,
  tasks = [],
  onSelectTask,
}: EarthSurfaceObservationProps) {
  // If no task explicitly selected, try finding active task assigned to selected satellite
  const activeTask = useMemo(() => {
    if (selectedTask) return selectedTask;
    if (selectedSatellite) {
      const match = tasks.find(
        (t) => t.assigned_satellite === selectedSatellite.id && t.phase !== "COMPLETED"
      );
      if (match) return match;
      const completedMatch = tasks.find((t) => t.assigned_satellite === selectedSatellite.id);
      if (completedMatch) return completedMatch;
    }
    return tasks.length > 0 ? tasks[tasks.length - 1] : null;
  }, [selectedTask, selectedSatellite, tasks]);

  // Compute distance to target & ETA if task and satellite exist
  const approachMetrics = useMemo(() => {
    if (!activeTask || !selectedSatellite) return null;
    const tgtLat = activeTask.target.latitude;
    const tgtLon = activeTask.target.longitude;

    // Convert target to Cartesian on Earth sphere (R = 6378.137 km)
    const phi = (90 - tgtLat) * (Math.PI / 180);
    const theta = (tgtLon + 180) * (Math.PI / 180);
    const re = 6378.137;
    const tx = -re * Math.sin(phi) * Math.cos(theta);
    const ty = re * Math.cos(phi);
    const tz = re * Math.sin(phi) * Math.sin(theta);

    const [sx, sy, sz] = selectedSatellite.position;
    const dx = sx - tx;
    const dy = sy - ty;
    const dz = sz - tz;
    const distKm = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const [vx, vy, vz] = selectedSatellite.velocity;
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz) || 7.6;
    const etaSec = distKm / speed;

    return {
      distanceKm: distKm,
      etaSeconds: etaSec,
      targetLat: tgtLat,
      targetLon: tgtLon,
    };
  }, [activeTask, selectedSatellite]);

  const phase = activeTask?.phase || "IDLE";
  const isCompleted = phase === "COMPLETED";
  const isCapturing = phase === "CAPTURING" || phase === "TARGET_ACQUIRED";
  const isExecuting = phase === "EXECUTING" || phase === "MPC_ACTIVE";
  const progress = activeTask?.progress || 0;
  const capturedImg = activeTask?.captured_image;

  return (
    <div className="hud-panel rounded-2xl p-4 border border-cyan-500/30 bg-space-950/95 flex flex-col gap-3 font-mono shadow-xl relative overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Camera className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>EARTH SURFACE OBSERVATION</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                0.50M GSD
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              High-Resolution Ground Observation Feed • Nadir Gimbal
            </p>
          </div>
        </div>

        {/* Live Capture Pulse */}
        <div className="flex items-center gap-1.5 text-[10px]">
          <span
            className={`w-2 h-2 rounded-full ${
              isCapturing || isExecuting
                ? "bg-emerald-400 animate-ping"
                : isCompleted
                ? "bg-cyan-400"
                : "bg-slate-600"
            }`}
          />
          <span
            className={
              isCapturing
                ? "text-emerald-400 font-bold"
                : isExecuting
                ? "text-amber-400 font-bold"
                : isCompleted
                ? "text-cyan-400 font-bold"
                : "text-slate-500"
            }
          >
            {isCapturing
              ? "CAPTURING LIVE"
              : isExecuting
              ? "APPROACHING"
              : isCompleted
              ? "ACQUIRED"
              : "STANDBY"}
          </span>
        </div>
      </div>

      {/* Surface Viewport Frame */}
      <div className="relative w-full h-44 rounded-xl overflow-hidden border border-cyan-500/40 bg-space-900 flex items-center justify-center group shadow-inner">
        {/* Render High-Resolution Simulated Earth Image if Captured */}
        {capturedImg ? (
          <div className="relative w-full h-full">
            <img
              src={
                capturedImg.image_url.startsWith("http")
                  ? capturedImg.image_url
                  : `http://localhost:8000${capturedImg.image_url}`
              }
              alt="Simulated Earth Observation"
              className="w-full h-full object-cover"
            />
            {/* Viewfinder Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-16 h-16 border border-emerald-400/60 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              </div>
            </div>
            {/* Resolution Stamp */}
            <div className="absolute top-2 left-2 bg-space-950/80 border border-emerald-500/50 backdrop-blur-md px-2 py-0.5 rounded text-[9px] text-emerald-300 font-bold">
              0.50 m GSD • RGB/NIR
            </div>
            <div className="absolute top-2 right-2 bg-space-950/80 border border-slate-700 backdrop-blur-md px-2 py-0.5 rounded text-[9px] text-slate-300">
              {capturedImg.cloud_cover || "3.8% Cloud"}
            </div>
          </div>
        ) : activeTask ? (
          // Simulated Earth Horizon & Approach Viewfinder
          <div className="relative w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-space-950 via-space-900 to-cyan-950/30 overflow-hidden">
            {/* Stylized Earth Curvature Curve in Background */}
            <div className="absolute -bottom-16 w-72 h-36 rounded-t-full bg-gradient-to-t from-cyan-600/30 via-blue-500/20 to-transparent border-t-2 border-cyan-400/60 shadow-lg shadow-cyan-500/20" />

            {/* Target Reticle Crosshair */}
            <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
              <div className="relative flex items-center justify-center">
                <div className="w-14 h-14 border border-cyan-400/50 rounded-full flex items-center justify-center animate-spin" style={{ animationDuration: "12s" }}>
                  <div className="w-10 h-10 border border-dashed border-emerald-400/60 rounded-full" />
                </div>
                <Target className="w-6 h-6 text-cyan-300 absolute animate-pulse" />
              </div>

              <div className="text-xs font-bold text-white tracking-wider uppercase mt-1">
                {activeTask.place_name || activeTask.target.place_name || `TARGET: ${activeTask.id}`}
              </div>
              <div className="text-[10px] text-cyan-300">
                {activeTask.target.latitude.toFixed(2)}° N, {activeTask.target.longitude.toFixed(2)}° E
              </div>
              <div className="text-[9px] text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40">
                {isExecuting ? "TARGET APPROACH • MPC ACTIVE" : phase}
              </div>
            </div>

            {/* Corner Targeting Brackets */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />
          </div>
        ) : (
          // Standby / No Active Task
          <div className="flex flex-col items-center justify-center gap-2 text-center p-4 text-slate-500">
            <Radio className="w-8 h-8 text-slate-600 animate-pulse" />
            <div className="text-xs font-bold text-slate-400">SELECT AN ACTIVE MISSION</div>
            <p className="text-[10px] text-slate-500 max-w-[200px]">
              Click a mission card or + ADD TASK to lock the surface camera.
            </p>
          </div>
        )}

        {/* Prominent Simulated Imagery Disclaimer Badge */}
        <div className="absolute bottom-1.5 left-2 bg-space-950/90 border border-cyan-500/40 px-2 py-0.5 rounded text-[8.5px] text-cyan-300 font-bold tracking-wide">
          SIMULATED EARTH OBSERVATION
        </div>

        {/* Live Satellite Platform Watermark */}
        {selectedSatellite && (
          <div className="absolute bottom-1.5 right-2 bg-space-950/90 border border-slate-700 px-2 py-0.5 rounded text-[8.5px] text-slate-300">
            PLATFORM: <span className="text-white font-bold">{selectedSatellite.id}</span>
          </div>
        )}
      </div>

      {/* Target Telemetry & Approach Readouts */}
      {activeTask && (
        <div className="grid grid-cols-2 gap-2 text-[11px] bg-space-900/60 p-2.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-slate-400 text-[10px]">Target Coords:</span>
            <div className="text-white font-bold text-xs">
              {activeTask.target.latitude.toFixed(2)}° N, {activeTask.target.longitude.toFixed(2)}° E
            </div>
          </div>
          <div>
            <span className="text-slate-400 text-[10px]">Assigned Satellite:</span>
            <div className="text-emerald-400 font-bold text-xs flex items-center gap-1">
              <span>{activeTask.assigned_satellite || "MAS ALLOCATING"}</span>
            </div>
          </div>

          <div>
            <span className="text-slate-400 text-[10px]">Distance to Target:</span>
            <div className="text-amber-300 font-bold text-xs">
              {approachMetrics
                ? `${approachMetrics.distanceKm.toFixed(1)} km`
                : "Calculating..."}
            </div>
          </div>

          <div>
            <span className="text-slate-400 text-[10px]">Time to Nadir (ETA):</span>
            <div className="text-cyan-300 font-bold text-xs">
              {approachMetrics && !isCompleted
                ? `${approachMetrics.etaSeconds.toFixed(1)} s`
                : isCompleted
                ? "ACQUIRED"
                : "--"}
            </div>
          </div>

          <div className="col-span-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">MPC Gimbal: <span className="text-white font-bold">LOCKED NADIR</span></span>
            <span className="text-slate-400">Progress: <span className="text-emerald-400 font-bold">{progress.toFixed(0)}%</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
