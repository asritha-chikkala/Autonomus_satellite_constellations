"use client";

import React from "react";
import { Table, Sparkles, CheckCircle2 } from "lucide-react";

interface CostMatrixHeatmapProps {
  costMatrix?: number[][];
  costDetails?: any[][];
  selectedSatelliteId?: string | null;
  satellites?: any[];
}

export default function CostMatrixHeatmap({
  costMatrix = [],
  costDetails = [],
  selectedSatelliteId,
  satellites = [],
}: CostMatrixHeatmapProps) {
  if (!costMatrix || costMatrix.length === 0) {
    return (
      <div className="hud-panel rounded-xl p-5 border border-cyan-500/30 text-center font-mono text-xs text-slate-400">
        Awaiting mission parameters to compute multi-agent cost matrix C(i, j)...
      </div>
    );
  }

  // Find min and max cost for color scale
  const allCosts = costMatrix.flat();
  const minCost = Math.min(...allCosts);
  const maxCost = Math.max(...allCosts);

  const getHeatmapColor = (cost: number, isSelected: boolean) => {
    if (isSelected) return "bg-cyan-500/30 border-2 border-cyan-400 text-cyan-200 font-bold shadow-lg shadow-cyan-500/20";
    // Green (low cost) to Red (high cost)
    const ratio = Math.max(0, Math.min(1, (cost - minCost) / (maxCost - minCost + 1e-4)));
    if (ratio < 0.25) return "bg-emerald-950/40 text-emerald-300 border border-emerald-800/40";
    if (ratio < 0.5)  return "bg-teal-950/40 text-teal-300 border border-teal-800/40";
    if (ratio < 0.75) return "bg-amber-950/40 text-amber-300 border border-amber-800/40";
    return "bg-red-950/40 text-red-300 border border-red-800/40";
  };

  const targetLabels = ["Target 1 (16.50° N, 80.60° E)", "Target 2 (28.61° N, 77.20° E)", "Target 3 (12.97° N, 77.59° E)"];

  return (
    <div className="hud-panel rounded-xl p-5 border border-cyan-500/30 flex flex-col gap-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Table className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
            COST MATRIX HEATMAP: C(i,j) = α·Dist + β·Risk - γ·Batt + δ·Delay
          </h2>
        </div>
        <div className="text-[11px] text-slate-400">
          α=0.40 | β=0.25 | γ=0.25 | δ=0.10
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
              <th className="py-2 px-3">SATELLITE [ID]</th>
              <th className="py-2 px-3">BATT [%]</th>
              <th className="py-2 px-3">RISK [0-1]</th>
              {targetLabels.slice(0, costMatrix[0]?.length || 3).map((lbl, idx) => (
                <th key={idx} className="py-2 px-3 text-center">
                  {lbl} [C(i,{idx+1})]
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {costMatrix.map((row, satIdx) => {
              const satId = `SAT-0${satIdx + 1}`;
              const isSatSelected = satId === selectedSatelliteId;
              const sat = satellites.find((s) => s.id === satId) || { battery: 80, risk: 0.1 };

              return (
                <tr
                  key={satId}
                  className={`border-b border-slate-900 transition-colors ${
                    isSatSelected ? "bg-cyan-950/20" : "hover:bg-space-900/40"
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isSatSelected ? "bg-cyan-400" : "bg-slate-500"}`} />
                    <span>{satId}</span>
                    {isSatSelected && (
                      <span className="text-[10px] text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-500/50">
                        ASSIGNED
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-amber-300 font-bold">{sat.battery?.toFixed(0)}%</td>
                  <td className="py-2.5 px-3 text-cyan-300 font-bold">{sat.risk?.toFixed(2)}</td>

                  {row.map((costVal, tgtIdx) => {
                    const isCellSelected = isSatSelected && tgtIdx === 0;
                    return (
                      <td key={tgtIdx} className="py-2 px-2 text-center">
                        <div
                          className={`py-1.5 px-3 rounded-lg font-mono text-center font-bold transition-all ${getHeatmapColor(
                            costVal,
                            isCellSelected
                          )}`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{costVal.toFixed(3)}</span>
                            {isCellSelected && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <span>Cost Intensity C(i,j) [Dimless]:</span>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-950 border border-emerald-500" />
            <span>Optimal (&lt;0.35)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-950 border border-amber-500" />
            <span>Moderate (0.35-0.60)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-950 border border-red-500" />
            <span>High (&gt;0.60)</span>
          </div>
        </div>
        <div className="text-cyan-300 font-semibold">
          ★ Highlighted: Kuhn-Munkres Minimum Global Cost Assignment
        </div>
      </div>
    </div>
  );
}
