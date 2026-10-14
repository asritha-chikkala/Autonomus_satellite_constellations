"use client";

import React, { useState } from "react";
import { Terminal, Clock, ShieldAlert, Cpu, Radio, CheckCircle, Flame, ArrowRight, Layers, Filter } from "lucide-react";

interface EventLogEntry {
  timestamp: string;
  category: string;
  message: string;
  task_id?: string;
}

interface LiveEventLogProps {
  logs?: EventLogEntry[];
  activeTasks?: Array<{ id: string }>;
}

export default function LiveEventLog({ logs = [], activeTasks = [] }: LiveEventLogProps) {
  const [selectedTask, setSelectedTask] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "SYSTEM_BOOT":
      case "RESET":
        return "bg-slate-800 text-slate-300 border-slate-700 badge-system-boot";
      case "TASK_RECEIVED":
        return "bg-cyan-950 text-cyan-300 border-cyan-500 badge-task-received";
      case "COMMUNICATION":
        return "bg-blue-950 text-blue-300 border-blue-500 badge-communication";
      case "AI_ANALYSIS":
        return "bg-purple-950 text-purple-300 border-purple-500 badge-ai-analysis";
      case "ALLOCATION":
        return "bg-amber-950 text-amber-300 border-amber-500 badge-allocation";
      case "MPC_ACTIVATE":
      case "MANEUVER":
        return "bg-emerald-950 text-emerald-300 border-emerald-500 badge-mpc";
      case "TARGET_LOCK":
      case "IMAGING":
        return "bg-teal-950 text-teal-300 border-teal-400 badge-imaging";
      case "COMPLETED":
        return "bg-emerald-900 text-emerald-200 border-emerald-400 badge-completed";
      case "ANOMALY":
      case "REALLOCATION":
        return "bg-red-950 text-red-300 border-red-500 animate-pulse badge-anomaly";
      case "TASK_WAITING":
        return "bg-orange-950 text-orange-300 border-orange-500 animate-pulse badge-waiting";
      default:
        return "bg-space-900 text-slate-300 border-slate-800 badge-default";
    }
  };

  const defaultLogs: EventLogEntry[] = [
    { timestamp: "22:15:02.105", category: "SYSTEM_BOOT", message: "Autonomous Constellation Coordination Core active with 20 Satellites + 1 ISS." },
    { timestamp: "22:15:03.450", category: "COMMUNICATION", message: "Inter-satellite laser optical cross-links established (3500 km range threshold)." },
    { timestamp: "22:15:04.882", category: "AI_ANALYSIS", message: "GAT spatial topology embedding initialized. LSTM trajectory horizon synchronized." },
    { timestamp: "22:15:05.102", category: "ALLOCATION", message: "Multi-Agent auction mechanism active on standby. Cost matrices online." },
  ];

  // Merge real logs with baseline system logs so the log feed is rich immediately upon boot
  const allLogs: EventLogEntry[] = React.useMemo(() => {
    if (!logs || logs.length === 0) return defaultLogs;
    if (logs.length <= 2) {
      const existingTimestamps = new Set(logs.map((l) => l.timestamp));
      const neededDefaults = defaultLogs.filter((d) => !existingTimestamps.has(d.timestamp));
      return [...logs, ...neededDefaults];
    }
    return logs;
  }, [logs]);

  // Extract unique tasks from logs + active tasks
  const loggedTasks = Array.from(
    new Set([
      ...activeTasks.map((t) => t.id),
      ...allLogs.map((l) => l.task_id).filter(Boolean) as string[],
    ])
  ).sort();

  // Filter logs by selected task and category (case-insensitive)
  const filteredLogs = allLogs.filter((log) => {
    const matchesTask =
      selectedTask === "ALL" ||
      (log.task_id && log.task_id.toLowerCase() === selectedTask.toLowerCase()) ||
      (!log.task_id && selectedTask === "ALL");
    const matchesCat = categoryFilter === "ALL" || log.category === categoryFilter;
    return matchesTask && matchesCat;
  });

  return (
    <div className="rounded-2xl p-5 border border-white/10 flex flex-col gap-3 font-mono bg-slate-950/90 shadow-2xl backdrop-blur-xl live-event-log-panel">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 event-log-icon">
            <Terminal className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2 event-log-title">
              <span>MISSION CONTROL LIVE EVENT LOG</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 event-log-counter">
                {filteredLogs.length} Events
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 event-log-subtitle">Microsecond Multi-Agent Flight & Autonomous Decision Log</p>
          </div>
        </div>

        {/* Task-Specific Filter Buttons (User Requested: "keep button as event log for task 1 like that") */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Task Log:</span>
          </span>
          <button
            onClick={() => setSelectedTask("ALL")}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              selectedTask === "ALL"
                ? "bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/20 event-task-btn-active"
                : "bg-space-900 border-slate-800 text-slate-400 hover:text-white event-task-btn-inactive"
            }`}
          >
            ALL EVENTS
          </button>
          {loggedTasks.map((tId) => (
            <button
              key={tId}
              onClick={() => setSelectedTask(tId)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                selectedTask === tId
                  ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-sm shadow-emerald-500/20 event-task-btn-active"
                  : "bg-space-900 border-slate-800 text-slate-400 hover:text-white event-task-btn-inactive"
              }`}
            >
              LOG FOR {tId.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {["ALL", "TASK_RECEIVED", "COMMUNICATION", "ALLOCATION", "MPC_ACTIVATE", "IMAGING", "ANOMALY"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                categoryFilter === cat
                  ? "bg-cyan-500/25 border-cyan-400 text-cyan-200 font-bold event-cat-pill-active"
                  : "bg-space-900 border-slate-800 text-slate-400 hover:border-slate-700 event-cat-pill-inactive"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-500">
          Showing logs for: <strong className="text-cyan-300 font-bold">{selectedTask}</strong>
        </span>
      </div>

      {/* Log Feed */}
      <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-1.5 text-xs">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500 text-center py-6 text-xs">
            No events found for {selectedTask}. Launch a task to observe autonomous coordination.
          </div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div
              key={idx}
              className="event-log-item bg-space-900/70 border border-slate-800/80 hover:border-cyan-500/40 rounded-lg p-2.5 flex items-start gap-3 transition-all"
            >
              <span className="text-[10px] text-slate-500 flex-shrink-0 mt-0.5 font-bold event-log-time">
                [{log.timestamp}]
              </span>

              <span
                className={`text-[9px] px-1.5 py-0.5 rounded border font-bold flex-shrink-0 uppercase event-category-badge ${getCategoryBadge(
                  log.category
                )}`}
              >
                {log.category}
              </span>

              {log.task_id && (
                <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.2 rounded font-bold flex-shrink-0 event-log-task-id">
                  {log.task_id}
                </span>
              )}

              <span className="text-slate-200 text-[11px] leading-snug flex-1 event-log-message">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
