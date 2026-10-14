"use client";

import React, { useState, useMemo } from "react";
import { Radio, AlertTriangle, ShieldCheck, ShieldAlert, Crosshair, ChevronRight, Info } from "lucide-react";

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
  active_links?: number;
  is_faulty?: boolean;
  is_busy?: boolean;
}

interface LeoProximityRadarProps {
  satellites: SatelliteData[];
  selectedSatelliteId?: string;
  onSelectSatellite?: (satId: string) => void;
  activeLinks?: Array<{ source: string; target: string; distance_km: number; link_quality: number }>;
}

export default function LeoProximityRadar({
  satellites = [],
  selectedSatelliteId,
  onSelectSatellite,
  activeLinks = [],
}: LeoProximityRadarProps) {
  // Configurable LEO parameters
  const [minAltitude] = useState<number>(160.0); // km
  const [maxAltitude] = useState<number>(2000.0); // km
  const [warningThresholdKm, setWarningThresholdKm] = useState<number>(850.0); // km
  const [criticalThresholdKm, setCriticalThresholdKm] = useState<number>(350.0); // km
  const [radarRangeKm, setRadarRangeKm] = useState<number>(8000.0); // Viewport diameter scale

  // Filter satellites inside LEO altitude boundaries
  const leoSatellites = useMemo(() => {
    return satellites.filter(
      (s) => s.altitude >= minAltitude && s.altitude <= maxAltitude
    );
  }, [satellites, minAltitude, maxAltitude]);

  // Calculate pairwise Euclidean distances d(i,j) = ||p_i - p_j||
  const { proximityPairs, criticalPairs, warningPairs, closestPair } = useMemo(() => {
    const pairs: Array<{
      satA: SatelliteData;
      satB: SatelliteData;
      distanceKm: number;
      riskLevel: "CRITICAL" | "WARNING" | "SAFE";
    }> = [];

    for (let i = 0; i < leoSatellites.length; i++) {
      for (let j = i + 1; j < leoSatellites.length; j++) {
        const s1 = leoSatellites[i];
        const s2 = leoSatellites[j];
        const dx = s1.position[0] - s2.position[0];
        const dy = s1.position[1] - s2.position[1];
        const dz = s1.position[2] - s2.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        let riskLevel: "CRITICAL" | "WARNING" | "SAFE" = "SAFE";
        if (dist <= criticalThresholdKm) {
          riskLevel = "CRITICAL";
        } else if (dist <= warningThresholdKm) {
          riskLevel = "WARNING";
        }

        pairs.push({
          satA: s1,
          satB: s2,
          distanceKm: dist,
          riskLevel,
        });
      }
    }

    pairs.sort((a, b) => a.distanceKm - b.distanceKm);

    const critical = pairs.filter((p) => p.riskLevel === "CRITICAL");
    const warning = pairs.filter((p) => p.riskLevel === "WARNING");
    const closest = pairs.length > 0 ? pairs[0] : null;

    return {
      proximityPairs: pairs,
      criticalPairs: critical,
      warningPairs: warning,
      closestPair: closest,
    };
  }, [leoSatellites, warningThresholdKm, criticalThresholdKm]);

  // Polar radar projection (XY orbit plane projection)
  const radarRadiusPx = 105; // radius of SVG radar circle
  const centerPx = 120;

  // Selected satellite or closest satellite
  const focusSat = leoSatellites.find((s) => s.id === selectedSatelliteId) || leoSatellites[0];

  return (
    <div className="hud-panel rounded-2xl p-4 border border-cyan-500/30 bg-space-950/95 flex flex-col gap-3 font-mono shadow-xl relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>LEO PROXIMITY RADAR</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                160 - 2,000 KM
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              LEO Proximity &amp; Conjunction Monitor • 20 SATS
            </p>
          </div>
        </div>

        {/* Global Proximity Indicator */}
        <div className="flex items-center gap-1.5 text-[10px]">
          {criticalPairs.length > 0 ? (
            <span className="px-2 py-0.5 rounded bg-red-950/80 border border-red-500 text-red-300 font-bold flex items-center gap-1 animate-pulse">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              <span>COLLISION RISK</span>
            </span>
          ) : warningPairs.length > 0 ? (
            <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500 text-amber-300 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>PROXIMITY ALERT</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>NOMINAL SEPARATION</span>
            </span>
          )}
        </div>
      </div>

      {/* Radar SVG Visual Display */}
      <div className="relative flex items-center justify-center py-1">
        <svg
          width={centerPx * 2}
          height={centerPx * 2}
          className="overflow-visible select-none"
        >
          <defs>
            {/* Radar Sweep Gradient */}
            <linearGradient id="radarSweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.35" className="radar-sweep-stop-0" />
              <stop offset="100%" stopColor="#00f2fe" stopOpacity="0.0" className="radar-sweep-stop-1" />
            </linearGradient>
            {/* Glow Filter */}
            <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Outer Ring */}
          <circle
            cx={centerPx}
            cy={centerPx}
            r={radarRadiusPx}
            fill="#030814"
            stroke="#0e3a59"
            strokeWidth="1.5"
            className="radar-scope-bg"
          />

          {/* Concentric Distance Range Rings */}
          {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const ringDistKm = Math.round(radarRangeKm * frac);
            return (
              <g key={idx}>
                <circle
                  cx={centerPx}
                  cy={centerPx}
                  r={radarRadiusPx * frac}
                  fill="none"
                  stroke="#0f3c5c"
                  strokeWidth="0.75"
                  strokeDasharray={idx === 3 ? "none" : "3,3"}
                  opacity={0.65}
                  className="radar-concentric-ring"
                />
                <text
                  x={centerPx + 2}
                  y={centerPx - radarRadiusPx * frac + 8}
                  fill="#00f2fe"
                  fontSize="7"
                  fontFamily="monospace"
                  opacity={0.7}
                  className="radar-ring-text"
                >
                  {ringDistKm} km
                </text>
              </g>
            );
          })}

          {/* Crosshair Axes & Unit Labels */}
          <line
            x1={centerPx - radarRadiusPx}
            y1={centerPx}
            x2={centerPx + radarRadiusPx}
            y2={centerPx}
            stroke="#0f3c5c"
            strokeWidth="0.75"
            strokeDasharray="2,2"
            className="radar-crosshair"
          />
          <line
            x1={centerPx}
            y1={centerPx - radarRadiusPx}
            x2={centerPx}
            y2={centerPx + radarRadiusPx}
            stroke="#0f3c5c"
            strokeWidth="0.75"
            strokeDasharray="2,2"
            className="radar-crosshair"
          />
          <text x={centerPx + radarRadiusPx - 26} y={centerPx - 4} fill="#64748b" fontSize="6.5" fontFamily="monospace" className="radar-axis-label">+X [km]</text>
          <text x={centerPx + 4} y={centerPx - radarRadiusPx + 10} fill="#64748b" fontSize="6.5" fontFamily="monospace" className="radar-axis-label">+Y [km]</text>

          {/* Animated 360° Rotating Radar Sweep Line */}
          <g className="animate-spin origin-center" style={{ animationDuration: "5s", transformOrigin: `${centerPx}px ${centerPx}px` }}>
            <line
              x1={centerPx}
              y1={centerPx}
              x2={centerPx + radarRadiusPx * Math.cos(-Math.PI / 4)}
              y2={centerPx + radarRadiusPx * Math.sin(-Math.PI / 4)}
              stroke="#00f2fe"
              strokeWidth="1.5"
              opacity="0.8"
              className="radar-sweep-line"
            />
            <path
              d={`M ${centerPx} ${centerPx} L ${centerPx + radarRadiusPx * Math.cos(-Math.PI / 4)} ${centerPx + radarRadiusPx * Math.sin(-Math.PI / 4)} A ${radarRadiusPx} ${radarRadiusPx} 0 0 0 ${centerPx + radarRadiusPx * Math.cos(-Math.PI / 2)} ${centerPx + radarRadiusPx * Math.sin(-Math.PI / 2)} Z`}
              fill="url(#radarSweepGrad)"
            />
          </g>

          {/* Center Earth Marker */}
          <circle cx={centerPx} cy={centerPx} r="7" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
          <circle cx={centerPx} cy={centerPx} r="2" fill="#ffffff" />

          {/* Proximity / Conjunction Warning Lines between close satellites */}
          {proximityPairs.slice(0, 4).map((p, idx) => {
            if (p.riskLevel === "SAFE") return null;
            // Calculate coords
            const scale = radarRadiusPx / radarRangeKm;
            const x1 = centerPx + p.satA.position[0] * scale;
            const y1 = centerPx - p.satA.position[1] * scale;
            const x2 = centerPx + p.satB.position[0] * scale;
            const y2 = centerPx - p.satB.position[1] * scale;
            return (
              <line
                key={`line-${idx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={p.riskLevel === "CRITICAL" ? "#ef4444" : "#f59e0b"}
                strokeWidth={p.riskLevel === "CRITICAL" ? "1.8" : "1.0"}
                strokeDasharray="3,2"
                opacity="0.9"
              />
            );
          })}

          {/* Satellite Dots on Radar */}
          {leoSatellites.map((sat) => {
            const scale = radarRadiusPx / radarRangeKm;
            const cx = centerPx + sat.position[0] * scale;
            const cy = centerPx - sat.position[1] * scale;
            const isSelected = sat.id === selectedSatelliteId;

            // Determine if sat is in a critical or warning pair
            const isCritical = criticalPairs.some(
              (p) => p.satA.id === sat.id || p.satB.id === sat.id
            );
            const isWarning = warningPairs.some(
              (p) => p.satA.id === sat.id || p.satB.id === sat.id
            );

            let dotColor = "#00f2fe"; // Nominal Safe
            if (sat.is_faulty) dotColor = "#f43f5e";
            else if (isCritical) dotColor = "#ef4444";
            else if (isWarning) dotColor = "#f59e0b";
            else if (sat.is_busy) dotColor = "#10b981";

            return (
              <g
                key={sat.id}
                className="cursor-pointer transition-transform hover:scale-125"
                onClick={() => onSelectSatellite && onSelectSatellite(sat.id)}
              >
                {/* Selection Reticle Ring */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="9"
                    fill="none"
                    stroke="#00f2fe"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                    className="animate-spin origin-center"
                    style={{ animationDuration: "3s", transformOrigin: `${cx}px ${cy}px` }}
                  />
                )}

                {/* Critical Conjunction Pulse */}
                {isCritical && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="8"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    className="animate-ping"
                  />
                )}

                {/* Satellite Core Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? "4" : "3"}
                  fill={dotColor}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? "1.2" : "0.5"}
                />

                {/* Satellite ID Label */}
                <text
                  x={cx + 5}
                  y={cy - 4}
                  fill={isSelected ? "#00f2fe" : "#94a3b8"}
                  fontSize={isSelected ? "8.5" : "7"}
                  fontWeight={isSelected ? "bold" : "normal"}
                  fontFamily="monospace"
                >
                  {sat.id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Range Legend in corner */}
        <div className="absolute bottom-1 right-2 text-[9px] text-slate-500 flex flex-col items-end">
          <span>Range: {radarRangeKm.toFixed(0)} km</span>
          <span className="text-cyan-400">Center: Earth Nadir</span>
        </div>
      </div>

      {/* Dynamic Proximity Alert Card */}
      {closestPair && (
        <div
          className={`p-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
            closestPair.riskLevel === "CRITICAL"
              ? "bg-red-950/40 border-red-500/70 text-red-200"
              : closestPair.riskLevel === "WARNING"
              ? "bg-amber-950/40 border-amber-500/70 text-amber-200"
              : "bg-space-900/80 border-slate-800 text-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold flex items-center gap-1.5">
              {closestPair.riskLevel === "CRITICAL" && (
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              )}
              {closestPair.riskLevel === "WARNING" && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
              {closestPair.riskLevel === "SAFE" && (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>
                {closestPair.riskLevel === "CRITICAL"
                  ? "COLLISION RISK DETECTED"
                  : closestPair.riskLevel === "WARNING"
                  ? "PROXIMITY ALERT"
                  : "CLOSEST CONJUNCTION"}
              </span>
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                closestPair.riskLevel === "CRITICAL"
                  ? "bg-red-900 text-red-100"
                  : closestPair.riskLevel === "WARNING"
                  ? "bg-amber-900 text-amber-100"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {closestPair.riskLevel}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono mt-0.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSelectSatellite && onSelectSatellite(closestPair.satA.id)}
                className="font-bold text-white hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
              >
                {closestPair.satA.id}
              </button>
              <span className="text-slate-400">↔</span>
              <button
                onClick={() => onSelectSatellite && onSelectSatellite(closestPair.satB.id)}
                className="font-bold text-white hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
              >
                {closestPair.satB.id}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[10px]">Distance:</span>
              <span className="font-bold text-white text-xs">
                {closestPair.distanceKm.toFixed(1)} km
              </span>
            </div>
          </div>

          <div className="text-[9px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-800/60">
            <span>Critical &lt; {criticalThresholdKm} km</span>
            <span>Warning &lt; {warningThresholdKm} km</span>
          </div>
        </div>
      )}
    </div>
  );
}
