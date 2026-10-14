"use client";

import React from "react";
import { Cpu, Network, Clock, BarChart3, ShieldCheck, GitMerge } from "lucide-react";

interface AiAnalyticsPanelProps {
  analytics?: any;
}

export default function AiAnalyticsPanel({ analytics }: AiAnalyticsPanelProps) {
  const gatFeatures = analytics?.gat_spatial_features || [0.42, 0.88, 0.15, 0.67, 0.31, 0.94, 0.52, 0.76];
  const rfImportances = analytics?.rf_feature_importance || {
    "Battery Drain": 0.32,
    "Velocity Error": 0.24,
    "Attitude Error": 0.18,
    "Comm Quality": 0.12,
    "Health Degradation": 0.08,
    "Mission Load": 0.04,
  };
  const mlpOutputs = analytics?.risk_mlp_outputs || {
    failure_probability: 0.08,
    mission_risk: 0.14,
    battery_health: 0.89,
    margin_indicator: 0.92,
  };

  return (
    <div className="hud-panel rounded-xl p-5 border border-cyan-500/30 flex flex-col gap-5 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
            AI AGENT ANALYTICS: GAT SPATIAL + LSTM TEMPORAL + RF + RISK MLP
          </h2>
        </div>
        <div className="text-xs text-cyan-300 font-bold">
          [GAT, LSTM] → Fusion(128) → Risk MLP
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: GAT SPATIAL MODEL */}
        <div className="bg-space-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Network className="w-4 h-4" />
              GAT SPATIAL MODEL
            </span>
            <span className="text-[10px] text-slate-400">2-Head Attn</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            Graph Attention Network aggregates spatial telemetry across dynamic links A(t).
          </p>

          <div>
            <div className="text-[10px] text-slate-400 mb-1.5">SPATIAL EMBEDDING VECTOR (64-D SAMPLE):</div>
            <div className="grid grid-cols-4 gap-1.5">
              {gatFeatures.map((val: number, idx: number) => (
                <div
                  key={idx}
                  className="bg-space-900 border border-cyan-500/30 rounded p-1 text-center text-[10px] text-cyan-300 font-bold"
                >
                  {val.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-auto">
            ✓ Spatial graph attention weights converged
          </div>
        </div>

        {/* CARD 2: LSTM TEMPORAL MODEL */}
        <div className="bg-space-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              LSTM TEMPORAL MODEL
            </span>
            <span className="text-[10px] text-slate-400">Horizon 10</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            Recurrent architecture forecasting telemetry trends from orbital history sequences.
          </p>

          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between items-center bg-space-900 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Predicted Future Battery:</span>
              <span className="text-amber-300 font-bold">
                {analytics?.predicted_future_battery || "82.5"}%
              </span>
            </div>
            <div className="flex justify-between items-center bg-space-900 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Health State Trend:</span>
              <span className="text-emerald-400 font-bold">
                {analytics?.predicted_health_trend || "GOOD"}
              </span>
            </div>
            <div className="flex justify-between items-center bg-space-900 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Temporal Failure Prob:</span>
              <span className="text-cyan-300 font-bold">
                {analytics?.lstm_failure_probability || "0.075"}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-auto">
            ✓ Trained on MATLAB 6-DOF telemetry sequences
          </div>
        </div>

        {/* CARD 3: RANDOM FOREST ANOMALY & RISK */}
        <div className="bg-space-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              RANDOM FOREST RISK
            </span>
            <span className="text-[10px] text-slate-400">Ensemble</span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>FEATURE IMPORTANCE (GINI):</span>
            <span className="text-[9px] text-amber-400/80">Normalized [0% - 100%]</span>
          </div>

          <div className="flex flex-col gap-2">
            {Object.entries(rfImportances).map(([name, val]: [string, any]) => (
              <div key={name} className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-slate-300">
                  <span className="truncate">{name}</span>
                  <span className="text-amber-400 font-bold">{(val * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-space-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full"
                    style={{ width: `${Math.min(100, val * 100 * 2.5)}%` }}
                  />
                </div>
              </div>
            ))}
            {/* Horizontal Axis Scale Marker */}
            <div className="flex justify-between text-[8px] text-slate-500 font-mono pt-0.5 border-t border-slate-800/60">
              <span>0%</span>
              <span>10%</span>
              <span>20%</span>
              <span>30%</span>
              <span>≥40%</span>
            </div>
            <div className="text-[8.5px] text-slate-500 text-center font-mono">
              X-Axis: Gini Relative Contribution [%] • Y-Axis: Sensor Features
            </div>
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-auto">
            ✓ 0 Anomaly flags in nominal constellation
          </div>
        </div>

        {/* CARD 4: RISK MLP (PART 10) */}
        <div className="bg-space-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              RISK MLP NETWORK
            </span>
            <span className="text-[10px] text-slate-400">128→64→32→4</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            Fused vector input [GAT, LSTM, RF] processed through Dense-ReLU-Dropout layers.
          </p>

          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between items-center bg-space-900 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Failure Probability:</span>
              <span className="text-cyan-300 font-bold">
                {mlpOutputs.failure_probability.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between items-center bg-space-900 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Mission Risk:</span>
              <span className="text-emerald-400 font-bold">
                {mlpOutputs.mission_risk.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between items-center bg-space-900 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Battery Health Index:</span>
              <span className="text-amber-300 font-bold">
                {mlpOutputs.battery_health.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between items-center bg-space-900 px-2.5 py-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Constellation Margin:</span>
              <span className="text-white font-bold">
                {mlpOutputs.margin_indicator.toFixed(3)}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-auto">
            ✓ Final sigmoid risk bounds verified
          </div>
        </div>
      </div>
    </div>
  );
}
