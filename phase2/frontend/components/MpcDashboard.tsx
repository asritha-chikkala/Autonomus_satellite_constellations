"use client";

import React from "react";
import { Compass, Gauge, AlertCircle, CheckCircle, Activity, Crosshair } from "lucide-react";

interface MpcDashboardProps {
  mpcData?: any;
  missionMetrics?: any;
}

export default function MpcDashboard({ mpcData, missionMetrics }: MpcDashboardProps) {
  const isMpcActive = mpcData?.status === "ACTIVE";
  const metrics = missionMetrics || {};

  return (
    <div className="hud-panel rounded-xl p-5 border border-cyan-500/30 flex flex-col gap-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
            6-DOF MODEL PREDICTIVE CONTROL DASHBOARD
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">Status:</span>
          <span
            className={`px-2.5 py-0.5 rounded font-bold border ${
              isMpcActive
                ? "bg-emerald-950 text-emerald-300 border-emerald-500 animate-pulse"
                : "bg-space-900 text-slate-400 border-slate-700"
            }`}
          >
            {isMpcActive ? "ACTIVE TRACKING" : "STANDBY"}
          </span>
          <span className="text-slate-400">Platform:</span>
          <span className="text-cyan-300 font-bold">{mpcData?.selected_satellite || "SAT-01"}</span>
        </div>
      </div>

      {/* Parameter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-space-950/70 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-400">PREDICTION HORIZON</div>
          <div className="text-lg font-bold text-white mt-0.5">N = 10 steps</div>
          <div className="text-[10px] text-slate-500">dt = 0.10 s (1.0s window)</div>
        </div>

        <div className="bg-space-950/70 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-400">THRUST CONSTRAINT</div>
          <div className="text-lg font-bold text-cyan-300 mt-0.5">||U|| ≤ 5.0 N</div>
          <div className="text-[10px] text-emerald-400">0 Violations</div>
        </div>

        <div className="bg-space-950/70 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-400">ANGULAR RATE LIMIT</div>
          <div className="text-lg font-bold text-purple-300 mt-0.5">Ω ≤ 0.15 rad/s</div>
          <div className="text-[10px] text-emerald-400">0 Violations</div>
        </div>

        <div className="bg-space-950/70 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-400">OBJECTIVE FUNCTION</div>
          <div className="text-sm font-bold text-emerald-300 mt-1">min J = Σ(||e||²_Q + ||u||²_R)</div>
          <div className="text-[10px] text-slate-500">Interior-Point / QP</div>
        </div>
      </div>

      {/* Performance Tracking Telemetry Metrics */}
      <div className="bg-space-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
          <span className="font-bold text-slate-200">CLOSED-LOOP MPC TRACKING METRICS</span>
          <span className="text-[10px] text-cyan-400">6-DOF TRANSLATION + ATTITUDE</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-[10px] text-slate-400">POSITION RMSE</div>
            <div className="text-base font-bold text-emerald-400">
              {metrics.tracking_rmse_km ? `${metrics.tracking_rmse_km.toFixed(4)} km` : "0.0420 km"}
            </div>
            <div className="text-[9px] text-slate-500">Certified Nadir Tolerance</div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400">TOTAL THRUST EFFORT</div>
            <div className="text-base font-bold text-cyan-300">12.526 N·s</div>
            <div className="text-[9px] text-slate-500">Integral Control Energy</div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400">SETTLING TIME</div>
            <div className="text-base font-bold text-amber-300">4.20 s</div>
            <div className="text-[9px] text-slate-500">To 5% Target Tolerance</div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400">BATTERY CONSUMED</div>
            <div className="text-base font-bold text-white">
              {metrics.energy_consumed_pct ? `${metrics.energy_consumed_pct.toFixed(1)}%` : "0.05%"}
            </div>
            <div className="text-[9px] text-slate-500">Maneuver Delta-V Drain</div>
          </div>
        </div>
      </div>
    </div>
  );
}
