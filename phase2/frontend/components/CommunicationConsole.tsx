"use client";

import React from "react";
import { Radio, Wifi, Send, ArrowRight, ShieldCheck, Activity } from "lucide-react";

interface CommunicationConsoleProps {
  communication?: any;
  negotiationLogs?: Array<{
    from: string;
    to: string;
    content: string;
    timestamp: string;
    type: string;
  }>;
}

export default function CommunicationConsole({
  communication,
  negotiationLogs = [],
}: CommunicationConsoleProps) {
  const activeLinks = communication?.active_links || [];
  const totalLinks = communication?.total_active_links || activeLinks.length;

  return (
    <div className="hud-panel rounded-xl p-5 border border-cyan-500/30 flex flex-col gap-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
            DYNAMIC INTER-SATELLITE COMMUNICATION & MULTI-AGENT NEGOTIATION
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">Topology:</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5" />
            {totalLinks} Active Links
          </span>
          <span className="text-slate-400">Model:</span>
          <span className="text-cyan-300">A(t) = f(LOS, Dist, LQ)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Active Links Table */}
        <div className="bg-space-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-1.5">
            <span className="font-bold text-slate-300">ACTIVE CROSSLINK CHANNELS (ISL)</span>
            <span>Range &lt; 3500 km</span>
          </div>

          <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5 pr-1">
            {activeLinks.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-6">
                Scanning constellation line-of-sight channels...
              </div>
            ) : (
              activeLinks.map((link: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-space-900/80 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex items-center gap-2 font-bold text-cyan-300">
                    <span>{link.source}</span>
                    <span className="text-slate-500">↔</span>
                    <span>{link.target}</span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="text-slate-400">{link.distance_km} km</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">LQ:</span>
                      <span className="text-emerald-400 font-bold">{(link.link_quality * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Multi-Agent Algorithmic Negotiation Console */}
        <div className="bg-space-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-1.5">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              MULTI-AGENT PROTOCOL NEGOTIATION CONSOLE
            </span>
            <span className="text-[10px] text-cyan-400">ALGORITHMIC (NO LLM)</span>
          </div>

          <div className="max-h-56 overflow-y-auto flex flex-col gap-2 pr-1 font-mono text-[11px]">
            {negotiationLogs.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-6">
                Constellation agents standing by. Click "INITIALIZE TASK" to trigger multi-agent negotiation.
              </div>
            ) : (
              negotiationLogs.map((log, idx) => {
                const isAlert = log.type === "HIGH_COST_ALERT";
                const isBid = log.type === "BID_AVAILABLE";
                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border flex flex-col gap-1 transition-all ${
                      isAlert
                        ? "bg-red-950/20 border-red-500/30 text-red-200"
                        : isBid
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                        : "bg-space-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1 font-bold text-cyan-400">
                        <span>{log.from}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span>{log.to}</span>
                      </div>
                      <span className="text-slate-500">{log.timestamp}</span>
                    </div>
                    <div className="text-[11px] leading-tight text-white font-mono">
                      "{log.content}"
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
