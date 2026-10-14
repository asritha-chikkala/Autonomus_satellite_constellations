"use client";

import React, { useState, useEffect } from "react";
import { PlusCircle, X, MapPin, Globe, Rocket, Shield, Layers, Compass, CheckCircle } from "lucide-react";
import DeliveryMapPicker from "./DeliveryMapPicker";

export function resolvePlaceName(lat: number, lon: number): string {
  const knownLocations = [
    { name: "Vijayawada / AP, India", lat: 16.50, lon: 80.60, radius: 2.0 },
    { name: "Visakhapatnam, India", lat: 17.68, lon: 83.21, radius: 1.5 },
    { name: "Hyderabad, India", lat: 17.38, lon: 78.48, radius: 1.5 },
    { name: "Bengaluru, India", lat: 12.97, lon: 77.59, radius: 1.5 },
    { name: "Chennai, India", lat: 13.08, lon: 80.27, radius: 1.5 },
    { name: "Mumbai, India", lat: 19.07, lon: 72.87, radius: 1.5 },
    { name: "New Delhi, India", lat: 28.61, lon: 77.20, radius: 1.5 },
    { name: "Kolkata, India", lat: 22.57, lon: 88.36, radius: 1.5 },
    { name: "San Francisco, USA", lat: 37.77, lon: -122.41, radius: 2.0 },
    { name: "Los Angeles, USA", lat: 34.05, lon: -118.24, radius: 2.0 },
    { name: "New York City, USA", lat: 40.71, lon: -74.00, radius: 2.0 },
    { name: "Washington DC, USA", lat: 38.90, lon: -77.03, radius: 1.5 },
    { name: "Chicago, USA", lat: 41.87, lon: -87.62, radius: 2.0 },
    { name: "London, United Kingdom", lat: 51.50, lon: -0.12, radius: 2.0 },
    { name: "Paris, France", lat: 48.85, lon: 2.35, radius: 2.0 },
    { name: "Berlin, Germany", lat: 52.52, lon: 13.40, radius: 2.0 },
    { name: "Rome, Italy", lat: 41.90, lon: 12.49, radius: 2.0 },
    { name: "Tokyo, Japan", lat: 35.67, lon: 139.65, radius: 2.0 },
    { name: "Osaka, Japan", lat: 34.69, lon: 135.50, radius: 1.5 },
    { name: "Singapore", lat: 1.35, lon: 103.82, radius: 1.5 },
    { name: "Dubai, UAE", lat: 25.20, lon: 55.27, radius: 1.5 },
    { name: "Sydney, Australia", lat: -33.86, lon: 151.20, radius: 2.0 },
    { name: "Melbourne, Australia", lat: -37.81, lon: 144.96, radius: 2.0 },
    { name: "Cairo, Egypt", lat: 30.04, lon: 31.23, radius: 2.0 },
    { name: "Cape Town, South Africa", lat: -33.92, lon: 18.42, radius: 2.0 },
    { name: "Rio de Janeiro, Brazil", lat: -22.90, lon: -43.17, radius: 2.0 },
  ];

  for (const loc of knownLocations) {
    const dLat = lat - loc.lat;
    const dLon = lon - loc.lon;
    if (Math.sqrt(dLat * dLat + dLon * dLon) <= loc.radius) {
      return loc.name;
    }
  }

  if (lat > 66) return "Arctic Region";
  if (lat < -60) return "Antarctic Region";
  if (lat >= 8 && lat <= 37 && lon >= 68 && lon <= 97) return "Indian Subcontinent";
  if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -65) return "North America";
  if (lat >= 35 && lat <= 70 && lon >= -10 && lon <= 40) return "Europe Region";
  if (lat >= 10 && lat <= 55 && lon >= 100 && lon <= 150) return "East Asia";
  if (lat >= -45 && lat <= -10 && lon >= 110 && lon <= 160) return "Australasia";
  if (lat >= -55 && lat <= 15 && lon >= -85 && lon <= -35) return "South America";
  if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) return "Africa Continent";
  return `Target Coordinates (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;
}

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: {
    name: string;
    place_name: string;
    latitude: number;
    longitude: number;
    type: string;
    priority: string;
    action: string;
  }) => void;
  nextTaskNumber?: number;
}

export default function AddTaskModal({
  isOpen,
  onClose,
  onSubmit,
  nextTaskNumber = 2,
}: AddTaskModalProps) {
  const [lat, setLat] = useState<number>(37.77);
  const [lon, setLon] = useState<number>(-122.41);
  const [placeName, setPlaceName] = useState<string>("San Francisco, USA");
  const [taskName, setTaskName] = useState<string>(`TASK-${nextTaskNumber}`);
  const [missionType, setMissionType] = useState<string>("Earth Observation");
  const [priority, setPriority] = useState<string>("HIGH");
  const [action, setAction] = useState<string>("CAPTURE HIGH-RES MULTISPECTRAL IMAGE");

  // Automatically update place name when coordinates change
  useEffect(() => {
    const detected = resolvePlaceName(lat, lon);
    setPlaceName(detected);
  }, [lat, lon]);

  useEffect(() => {
    setTaskName(`TASK-${nextTaskNumber}`);
  }, [nextTaskNumber]);

  if (!isOpen) return null;

  const handlePreset = (name: string, pLat: number, pLon: number) => {
    setLat(pLat);
    setLon(pLon);
    setPlaceName(name);
    setAction(`CAPTURE ${name.toUpperCase()}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: taskName,
      place_name: placeName,
      latitude: Number(lat),
      longitude: Number(lon),
      type: missionType,
      priority,
      action,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Click outside to close */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Slide-over Right Side Panel */}
      <div className="relative w-full max-w-xl md:max-w-2xl h-full bg-[#0b1220]/95 border-l border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.85)] p-5 sm:p-6 flex flex-col gap-4 text-slate-100 overflow-y-auto custom-scrollbar animate-slide-in-right font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800/80 text-white border border-white/10">
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 font-sans">
                <span>Mission Task Dispatch</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10 font-mono">
                  {taskName}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Interactive Pin-Drop Target Selection &amp; Autonomous Payload Deployment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full glass-pill flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Delivery Pin Drop Map Picker */}
        <div className="bg-space-900/60 p-3.5 rounded-xl border border-cyan-500/30">
          <DeliveryMapPicker
            initialLat={lat}
            initialLon={lon}
            initialPlaceName={placeName}
            onCancel={onClose}
            onLocationSelect={(selected) => {
              setLat(selected.latitude);
              setLon(selected.longitude);
              setPlaceName(selected.place_name);
              onSubmit({
                name: taskName,
                place_name: selected.place_name,
                latitude: Number(selected.latitude),
                longitude: Number(selected.longitude),
                type: selected.type,
                priority: selected.priority,
                action: selected.action,
              });
              onClose();
            }}
          />
        </div>

        {/* Task Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Coordinates Summary */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 text-[11px] mb-1 block">Latitude (° N)</label>
              <input
                type="number"
                step="0.01"
                required
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                className="w-full bg-space-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-white font-mono outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[11px] mb-1 block">Longitude (° E)</label>
              <input
                type="number"
                step="0.01"
                required
                value={lon}
                onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                className="w-full bg-space-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-white font-mono outline-none"
              />
            </div>
          </div>

          {/* Place Name (Reverse Geocoded & Editable) */}
          <div>
            <label className="text-slate-400 text-[11px] mb-1 flex items-center justify-between">
              <span>Target Place / City Name (Displayed on 3D Globe &amp; HUD)</span>
              <span className="text-[10px] text-emerald-400 font-bold">✓ Location Pin Locked</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="e.g. Visakhapatnam Port, India"
                className="w-full bg-space-900 border border-cyan-500/50 focus:border-cyan-400 rounded-xl pl-8 pr-3 py-2 text-cyan-200 font-bold font-mono outline-none"
              />
              <MapPin className="w-4 h-4 text-emerald-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Mission Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
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
                <option value="CRITICAL">CRITICAL (Immediate Dispatch)</option>
                <option value="HIGH">HIGH (Standard Priority)</option>
                <option value="MEDIUM">MEDIUM (Next Pass)</option>
                <option value="LOW">LOW (Opportunistic)</option>
              </select>
            </div>
          </div>

          {/* Action / Sensor Command */}
          <div>
            <label className="text-slate-400 text-[11px] mb-1 block">Payload Sensor Action</label>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full bg-space-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-space-900 hover:bg-space-800 border border-slate-700 text-xs text-slate-300 font-mono transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-space-950 font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer border border-emerald-200"
            >
              <Rocket className="w-4 h-4 fill-space-950 text-emerald-200" />
              <span>DISPATCH MISSION TASK</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
