"use client";

import React, { useState } from "react";
import { Image as ImageIcon, ChevronLeft, ChevronRight, ZoomIn, Download } from "lucide-react";

interface MatlabFiguresGalleryProps {
  activeTask?: any;
  selectedSatellite?: any;
  currentPhase?: string;
  onRefreshSimulation?: (taskId?: string, controllerType?: string) => void | Promise<any>;
  tasks?: any[];
  onSelectTask?: (taskId: string) => void;
}

export default function MatlabFiguresGallery({
  activeTask,
  selectedSatellite,
  currentPhase,
  onRefreshSimulation,
  tasks = [],
  onSelectTask,
}: MatlabFiguresGalleryProps) {
  const [selectedFig, setSelectedFig] = useState<number>(0);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [cacheBuster, setCacheBuster] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Local task selection state allowing user to toggle between Task 1, Task 2, Task 3...
  const [viewingTaskId, setViewingTaskId] = useState<string>(activeTask?.id || "TASK-1");
  const [selectedControllerType, setSelectedControllerType] = useState<"LMPC" | "NMPC" | "PID">("LMPC");

  // Keep viewingTaskId in sync if parent changes activeTask
  React.useEffect(() => {
    if (activeTask?.id) {
      setViewingTaskId(activeTask.id);
    }
  }, [activeTask?.id]);

  // Determine current viewing task object
  const currentTask = (tasks && tasks.length > 0)
    ? (tasks.find((t: any) => t.id === viewingTaskId) || activeTask || tasks[0])
    : (activeTask || { id: "TASK-1", name: "Visakhapatnam Observation", assigned_satellite: "SAT-06", phase: "NOMINAL", target: { latitude: 16.50, longitude: 80.60 } });

  const viewingTaskNum = currentTask?.id ? currentTask.id.replace(/[^0-9]/g, "") || "1" : "1";
  const viewingTaskFolder = `TASK-${viewingTaskNum}`;

  // Auto-refresh image cache whenever active task or execution phase changes
  React.useEffect(() => {
    setCacheBuster(Date.now());
  }, [viewingTaskId, activeTask?.id, activeTask?.phase, activeTask?.assigned_satellite, currentPhase, selectedControllerType]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (onRefreshSimulation) {
      await onRefreshSimulation(currentTask?.id, selectedControllerType);
    }
    setCacheBuster(Date.now());
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const handleManualRefreshWithController = async (ctrl: "LMPC" | "NMPC" | "PID") => {
    setIsRefreshing(true);
    if (onRefreshSimulation) {
      await onRefreshSimulation(currentTask?.id, ctrl);
    }
    setCacheBuster(Date.now());
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const figures = [
    { id: 1, file: "graph_01_3d_trajectories.png", title: "Graph 1: 3D Satellite Trajectories & 6-DOF MPC Arc", cat: "TRAJECTORY" },
    { id: 2, file: "graph_02_ref_vs_actual.png", title: "Graph 2: Reference vs Actual Trajectory Tracking", cat: "MPC" },
    { id: 3, file: "graph_03_mpc_tracking_error.png", title: "Graph 3: MPC Position Tracking Error vs Time", cat: "MPC" },
    { id: 4, file: "graph_04_control_inputs.png", title: "Graph 4: Control Inputs (Thrust & Torque) vs Time", cat: "MPC" },
    { id: 5, file: "graph_05_angular_velocity.png", title: "Graph 5: Angular Velocity (Roll/Pitch/Yaw) vs Time", cat: "ATTITUDE" },
    { id: 6, file: "graph_06_battery_vs_time.png", title: "Graph 6: Constellation Battery Percentage vs Time", cat: "SUBSYSTEMS" },
    { id: 7, file: "graph_07_health_vs_time.png", title: "Graph 7: Constellation Subsystem Health vs Time", cat: "SUBSYSTEMS" },
    { id: 8, file: "graph_08_failure_prob_vs_time.png", title: "Graph 8: Failure Probability vs Time", cat: "AI_RISK" },
    { id: 9, file: "graph_09_mission_risk_vs_time.png", title: "Graph 9: Dynamic Mission Risk Index vs Time", cat: "AI_RISK" },
    { id: 10, file: "graph_10_comm_network.png", title: "Graph 10: Dynamic Communication Network Topology A(t)", cat: "COMM" },
    { id: 11, file: "graph_11_link_quality_vs_time.png", title: "Graph 11: Inter-Satellite Link Quality vs Time", cat: "COMM" },
    { id: 12, file: "graph_12_cost_matrix_heatmap.png", title: "Graph 12: Cost Matrix Heatmap C(i, j)", cat: "ALLOCATION" },
    { id: 13, file: "graph_13_algorithm_comparison.png", title: "Graph 13: Hungarian vs Auction vs Greedy Benchmark", cat: "ALLOCATION" },
    { id: 14, file: "graph_14_task_allocation_distance.png", title: "Graph 14: Mission Allocation Distance Comparison", cat: "ALLOCATION" },
    { id: 15, file: "graph_15_rf_feature_importance.png", title: "Graph 15: Random Forest Anomaly Feature Importance", cat: "AI_RISK" },
    { id: 16, file: "graph_16_mpc_metrics.png", title: "Graph 16: Model Predictive Control Performance Metrics", cat: "MPC" },
    { id: 17, file: "graph_17_position_error.png", title: "Graph 17: Rendezvous Position Error to Target Point", cat: "MPC" },
    { id: 18, file: "graph_18_battery_consumption_rate.png", title: "Graph 18: Battery Consumption Rate vs Time", cat: "SUBSYSTEMS" },
    { id: 19, file: "graph_19_active_comm_links.png", title: "Graph 19: Constellation Active Inter-Satellite Links", cat: "COMM" },
    { id: 20, file: "graph_20_mission_summary.png", title: "Graph 20: Autonomous Satellite Mission Verification Summary", cat: "VERIFICATION" },
  ];

  const categories = ["ALL", "MPC", "ALLOCATION", "COMM", "AI_RISK", "SUBSYSTEMS", "TRAJECTORY", "VERIFICATION"];

  const filtered = filterCategory === "ALL" ? figures : figures.filter((f) => f.cat === filterCategory);
  const currentFigure = figures[selectedFig];

  // Effective image URLs: Task+Controller preferred -> Controller folder -> Task folder -> Root figures
  const taskCtrlFigureUrl = `http://localhost:8000/results/figures/${viewingTaskFolder}_${selectedControllerType}/${currentFigure.file}?t=${cacheBuster}`;
  const ctrlFigureUrl = `http://localhost:8000/results/figures/${selectedControllerType}/${currentFigure.file}?t=${cacheBuster}`;
  const taskFigureUrl = `http://localhost:8000/results/figures/${viewingTaskFolder}/${currentFigure.file}?t=${cacheBuster}`;
  const fallbackFigureUrl = `http://localhost:8000/results/figures/${currentFigure.file}?t=${cacheBuster}`;

  return (
    <div className="hud-panel rounded-xl p-5 border border-cyan-500/30 flex flex-col gap-4 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
              MATLAB SIMULATION RESULTS GALLERY (20 SCIENTIFIC FIGURES)
            </h2>
            <div className="text-[11px] text-slate-400">
              Generated via MATLAB R2024b Dynamic Mission Execution Engine
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentTask ? (
            <div className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-[11px] flex items-center gap-2">
              <span className="text-slate-400">Viewing:</span>
              <span className="text-amber-300 font-bold">{currentTask.id}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Sat:</span>
              <span className="text-cyan-300 font-bold">{currentTask.assigned_satellite || "ALLOCATING"}</span>
              <span className="text-slate-500">•</span>
              <span className={currentTask.phase === "FAILED" ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                {currentTask.phase || "NOMINAL"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">Baseline Constellation Telemetry</span>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-2.5 py-1 rounded bg-space-900 hover:bg-space-800 border border-slate-700 hover:border-cyan-400 text-xs text-cyan-300 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            title={`Re-run and refresh MATLAB graphs for ${currentTask.id}`}
          >
            <span>{isRefreshing ? "Calculating..." : `↻ Run MATLAB for ${currentTask.id}`}</span>
          </button>
        </div>
      </div>

      {/* TASK HEADINGS SELECTOR BAR (Task 1 | Task 2 | Task 3 ...) */}
      <div className="bg-space-950/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>MISSION TASK HEADINGS (SELECT TASK TO VIEW DEDICATED GRAPHS):</span>
          </span>
          <span className="text-[10px] text-slate-500">
            {tasks.length > 0 ? `${tasks.length} Mission Tasks Registered` : "1 Baseline Mission Task"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(tasks && tasks.length > 0 ? tasks : [
            { id: "TASK-1", name: "Visakhapatnam Observation", assigned_satellite: "SAT-06", phase: "NOMINAL", target: { latitude: 16.50, longitude: 80.60 } }
          ]).map((t: any) => {
            const isSelected = viewingTaskId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setViewingTaskId(t.id);
                  if (onSelectTask) onSelectTask(t.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-r from-cyan-950 to-blue-950 border-cyan-400 text-white shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-400"
                    : "bg-space-900/60 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  t.phase === "FAILED" ? "bg-red-400" : isSelected ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                }`} />
                <span className="text-amber-300 font-bold">{t.id}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-200">
                  {t.place_name || t.name || `Target (${t.target?.latitude?.toFixed(1)}°, ${t.target?.longitude?.toFixed(1)}°)`}
                </span>
                <span className="text-cyan-300 text-[10px] bg-space-950 px-1.5 py-0.5 rounded border border-slate-800">
                  {t.assigned_satellite || "ALLOCATING"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTROLLER SELECTOR BAR FOR SCIENTIFIC SIMULATION (LMPC | NMPC | PID) */}
      <div className="bg-space-950/90 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 font-bold uppercase tracking-wider">
            6-DOF CONTROLLER ENGINE:
          </span>
          <span className="text-slate-500 text-[10px]">
            (Reruns 20 figures reflecting controller-specific error, effort &amp; behavior)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(["LMPC", "NMPC", "PID"] as const).map((ctrl) => (
            <button
              key={ctrl}
              onClick={() => {
                setSelectedControllerType(ctrl);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                selectedControllerType === ctrl
                  ? ctrl === "LMPC"
                    ? "bg-cyan-500/25 text-cyan-300 border-cyan-400 shadow-md shadow-cyan-950/50"
                    : ctrl === "NMPC"
                    ? "bg-amber-500/25 text-amber-300 border-amber-400 shadow-md shadow-amber-950/50"
                    : "bg-purple-500/25 text-purple-300 border-purple-400 shadow-md shadow-purple-950/50"
                  : "bg-space-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span>{ctrl === "LMPC" ? "Linear MPC (QP)" : ctrl === "NMPC" ? "Nonlinear MPC (SQP)" : "6-DOF PID"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all ${
              filterCategory === cat
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md"
                : "bg-space-950 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Figure Display Viewer */}
      <div className="bg-space-950/90 border border-slate-800 rounded-xl p-4 flex flex-col items-center gap-3">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-amber-300 text-xs font-bold">
              {currentTask?.id || "TASK-1"}
            </span>
            <h3 className="text-sm font-bold text-cyan-300">
              {currentFigure.title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Figure {selectedFig + 1} of {figures.length}
            </span>
            <a
              href={taskFigureUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded bg-space-900 border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-400 transition-all text-xs"
              title="Open full resolution"
            >
              <ZoomIn className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Image Frame with Dual URL Resolution (Task subfolder with fallback) */}
        <div className="relative w-full max-h-[520px] rounded-lg overflow-hidden border border-slate-800 bg-space-900 flex items-center justify-center p-2 figure-display-frame">
          <img
            key={`${viewingTaskId}-${selectedControllerType}-${currentFigure.id}-${cacheBuster}`}
            src={taskCtrlFigureUrl}
            alt={`${currentFigure.title} (${currentTask.id} - ${selectedControllerType})`}
            className="max-h-[500px] w-auto object-contain rounded matlab-figure-img"
            onError={(e: any) => {
              // Graceful cascade: Task+Controller -> Controller -> Task -> Root
              const currentSrc = e.target.src;
              if (currentSrc.includes(`${viewingTaskFolder}_${selectedControllerType}`)) {
                e.target.src = ctrlFigureUrl;
              } else if (currentSrc.includes(`/${selectedControllerType}/`)) {
                e.target.src = taskFigureUrl;
              } else if (currentSrc.includes(`/${viewingTaskFolder}/`)) {
                e.target.src = fallbackFigureUrl;
              } else {
                e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><text x='50%' y='50%' fill='%23666' text-anchor='middle'>Rendering MATLAB Figure...</text></svg>";
              }
            }}
          />
        </div>

        {/* Carousel Navigation */}
        <div className="flex items-center justify-between w-full pt-2">
          <button
            onClick={() => setSelectedFig((prev) => (prev > 0 ? prev - 1 : figures.length - 1))}
            className="px-3 py-1.5 bg-space-900 hover:bg-space-800 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Figure</span>
          </button>

          <button
            onClick={() => setSelectedFig((prev) => (prev < figures.length - 1 ? prev + 1 : 0))}
            className="px-3 py-1.5 bg-space-900 hover:bg-space-800 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition-all"
          >
            <span>Next Figure</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thumbnails Strip */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-h-36 overflow-y-auto pr-1">
        {filtered.map((fig) => {
          const originalIdx = figures.findIndex((f) => f.id === fig.id);
          const isSelected = originalIdx === selectedFig;
          return (
            <button
              key={fig.id}
              onClick={() => setSelectedFig(originalIdx)}
              className={`p-1 rounded-lg border text-center transition-all ${
                isSelected
                  ? "bg-cyan-950 border-cyan-400 text-cyan-200 shadow-md"
                  : "bg-space-950/70 border-slate-800 hover:border-slate-700 text-slate-400"
              }`}
            >
              <div className="text-[10px] font-bold">G{fig.id}</div>
              <div className="text-[8px] truncate">{fig.cat}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
