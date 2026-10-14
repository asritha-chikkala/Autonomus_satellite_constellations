"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  MapPin,
  Search,
  Crosshair,
  Navigation,
  Check,
  Sparkles,
  Globe,
  Compass,
  ArrowRight,
  Shield,
  AlertTriangle,
  Camera,
  Radio,
  Zap,
  Layers,
  Thermometer,
  Rocket
} from "lucide-react";

interface DeliveryMapPickerProps {
  initialLat?: number;
  initialLon?: number;
  initialPlaceName?: string;
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    place_name: string;
    type: string;
    priority: string;
    action: string;
  }) => void;
  onCancel?: () => void;
}

// Built-in worldwide city gazetteer for instant offline delivery location detection
const GLOBAL_LOCATIONS = [
  { name: "Vijayawada / AP, India", country: "India", lat: 16.506, lon: 80.648, radius: 2.5 },
  { name: "Visakhapatnam, India", country: "India", lat: 17.686, lon: 83.218, radius: 2.0 },
  { name: "Hyderabad, India", country: "India", lat: 17.385, lon: 78.486, radius: 2.0 },
  { name: "Bengaluru, India", country: "India", lat: 12.971, lon: 77.594, radius: 2.0 },
  { name: "Chennai, India", country: "India", lat: 13.082, lon: 80.270, radius: 2.0 },
  { name: "Mumbai, India", country: "India", lat: 19.076, lon: 72.877, radius: 2.0 },
  { name: "New Delhi, India", country: "India", lat: 28.613, lon: 77.209, radius: 2.0 },
  { name: "Kolkata, India", country: "India", lat: 22.572, lon: 88.363, radius: 2.0 },
  { name: "San Francisco, USA", country: "USA", lat: 37.774, lon: -122.419, radius: 2.5 },
  { name: "Los Angeles, USA", country: "USA", lat: 34.052, lon: -118.243, radius: 2.5 },
  { name: "New York City, USA", country: "USA", lat: 40.712, lon: -74.006, radius: 2.5 },
  { name: "Washington DC, USA", country: "USA", lat: 38.907, lon: -77.036, radius: 2.0 },
  { name: "Chicago, USA", country: "USA", lat: 41.878, lon: -87.629, radius: 2.0 },
  { name: "Miami, Florida, USA", country: "USA", lat: 25.761, lon: -80.191, radius: 2.0 },
  { name: "London, United Kingdom", country: "UK", lat: 51.507, lon: -0.127, radius: 2.5 },
  { name: "Paris, France", country: "France", lat: 48.856, lon: 2.352, radius: 2.5 },
  { name: "Berlin, Germany", country: "Germany", lat: 52.520, lon: 13.405, radius: 2.5 },
  { name: "Rome, Italy", country: "Italy", lat: 41.902, lon: 12.496, radius: 2.0 },
  { name: "Tokyo, Japan", country: "Japan", lat: 35.676, lon: 139.650, radius: 2.5 },
  { name: "Osaka, Japan", country: "Japan", lat: 34.693, lon: 135.502, radius: 2.0 },
  { name: "Seoul, South Korea", country: "South Korea", lat: 37.566, lon: 126.978, radius: 2.0 },
  { name: "Beijing, China", country: "China", lat: 39.904, lon: 116.407, radius: 2.5 },
  { name: "Singapore", country: "Singapore", lat: 1.352, lon: 103.819, radius: 1.5 },
  { name: "Dubai, UAE", country: "UAE", lat: 25.204, lon: 55.270, radius: 2.0 },
  { name: "Sydney, Australia", country: "Australia", lat: -33.868, lon: 151.209, radius: 2.5 },
  { name: "Melbourne, Australia", country: "Australia", lat: -37.813, lon: 144.963, radius: 2.5 },
  { name: "Cairo, Egypt", country: "Egypt", lat: 30.044, lon: 31.235, radius: 2.5 },
  { name: "Cape Town, South Africa", country: "South Africa", lat: -33.924, lon: 18.424, radius: 2.0 },
  { name: "Rio de Janeiro, Brazil", country: "Brazil", lat: -22.906, lon: -43.172, radius: 2.5 },
];

const MISSION_OBJECTIVES = [
  {
    id: "Earth Observation",
    title: "Earth Observation",
    desc: "0.50m GSD Optical & Multispectral Imaging",
    icon: Globe,
    color: "border-cyan-500/60 bg-cyan-950/40 text-cyan-200",
  },
  {
    id: "Disaster Monitoring",
    title: "Disaster Monitoring",
    desc: "Rapid Flood, Wildfire & Cyclone Emergency Mapping",
    icon: AlertTriangle,
    color: "border-amber-500/60 bg-amber-950/40 text-amber-200",
  },
  {
    id: "Reconnaissance",
    title: "Reconnaissance",
    desc: "Border, Port & Maritime Asset Surveillance",
    icon: Shield,
    color: "border-red-500/60 bg-red-950/40 text-red-200",
  },
  {
    id: "Climate & Agriculture",
    title: "Climate & NDVI",
    desc: "Forest Canopy, Drought & Crop Yield Analysis",
    icon: Sparkles,
    color: "border-emerald-500/60 bg-emerald-950/40 text-emerald-200",
  },
];

const PRIORITY_LEVELS = [
  { id: "CRITICAL", label: "CRITICAL", desc: "Immediate Emergency Overflight", style: "border-red-500 bg-red-950/60 text-red-200" },
  { id: "HIGH", label: "HIGH", desc: "Next Available Orbit Pass", style: "border-amber-500 bg-amber-950/60 text-amber-200" },
  { id: "ROUTINE", label: "ROUTINE", desc: "Standard Scheduled Overpass", style: "border-emerald-500 bg-emerald-950/60 text-emerald-200" },
];

const PAYLOAD_SENSORS = [
  { id: "0.50m GSD Multispectral Optical (RGB/NIR)", label: "0.50m Multispectral (RGB/NIR)" },
  { id: "SAR Synthetic Aperture Radar (All-Weather)", label: "SAR Radar (All-Weather Cloud-Penetrating)" },
  { id: "Thermal Infrared Sensor (Surface Temperature & Night)", label: "Thermal Infrared Radiometer" },
  { id: "Hyperspectral Environmental Sounder (400-1000nm)", label: "Hyperspectral Environmental Sounder" },
];

export default function DeliveryMapPicker({
  initialLat = 16.50,
  initialLon = 80.60,
  initialPlaceName = "Vijayawada / AP, India",
  onLocationSelect,
  onCancel,
}: DeliveryMapPickerProps) {
  const [lat, setLat] = useState<number>(initialLat);
  const [lon, setLon] = useState<number>(initialLon);
  const [placeName, setPlaceName] = useState<string>(initialPlaceName);
  const [missionType, setMissionType] = useState<string>("Earth Observation");
  const [priority, setPriority] = useState<string>("HIGH");
  const [payloadSensor, setPayloadSensor] = useState<string>("0.50m GSD Multispectral Optical (RGB/NIR)");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<typeof GLOBAL_LOCATIONS>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const reverseGeocodeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fast offline place resolution based on coordinates
  const lookupPlace = useCallback((latitude: number, longitude: number): string => {
    let closestLoc: string | null = null;
    let minDist = Infinity;

    for (const loc of GLOBAL_LOCATIONS) {
      const dLat = latitude - loc.lat;
      const dLon = longitude - loc.lon;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      if (dist <= loc.radius && dist < minDist) {
        minDist = dist;
        closestLoc = loc.name;
      }
    }

    if (closestLoc) return closestLoc;

    if (latitude > 66) return "Arctic Ocean / Polar Region";
    if (latitude < -60) return "Antarctica";
    if (latitude >= 8 && latitude <= 37 && longitude >= 68 && longitude <= 97) return "Indian Subcontinent";
    if (latitude >= 24 && latitude <= 50 && longitude >= -125 && longitude <= -65) return "United States / North America";
    if (latitude >= 35 && latitude <= 70 && longitude >= -10 && longitude <= 40) return "Western Europe";
    if (latitude >= 10 && latitude <= 55 && longitude >= 100 && longitude <= 150) return "East Asia Pacific";
    if (latitude >= -45 && latitude <= -10 && longitude >= 110 && longitude <= 160) return "Australasia";
    if (latitude >= -55 && latitude <= 15 && longitude >= -85 && longitude <= -35) return "South America";
    if (latitude >= -35 && latitude <= 37 && longitude >= -20 && longitude <= 55) return "African Continent";

    return `Coordinates (${latitude.toFixed(2)}° N, ${longitude.toFixed(2)}° E)`;
  }, []);

  // Update pin position from click or drag on map
  const updatePinFromMouseEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    // Convert pixel position (Equirectangular projection) to Lat/Lon
    const newLon = (x / rect.width) * 360 - 180;
    const newLat = 90 - (y / rect.height) * 180;

    const clampedLat = Math.round(newLat * 100) / 100;
    const clampedLon = Math.round(newLon * 100) / 100;

    setLat(clampedLat);
    setLon(clampedLon);

    const fastName = lookupPlace(clampedLat, clampedLon);
    setPlaceName(fastName);

    // Debounced reverse geocoding
    if (reverseGeocodeTimeout.current) clearTimeout(reverseGeocodeTimeout.current);
    reverseGeocodeTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${clampedLat}&lon=${clampedLon}&zoom=10&addressdetails=1`,
          { headers: { "User-Agent": "AutonomousSatelliteConstellation/1.0" } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            const parts = data.display_name.split(", ");
            const shortName = parts.slice(0, 3).join(", ");
            setPlaceName(shortName);
          }
        }
      } catch (err) {
        // Fallback remains the offline lookup
      }
    }, 600);
  };

  const pinXPercent = ((lon + 180) / 360) * 100;
  const pinYPercent = ((90 - lat) / 180) * 100;

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const lower = query.toLowerCase();
    const filtered = GLOBAL_LOCATIONS.filter(
      (l) =>
        l.name.toLowerCase().includes(lower) ||
        l.country.toLowerCase().includes(lower)
    ).slice(0, 5);
    setSearchResults(filtered);
  };

  const selectSearchResult = (loc: (typeof GLOBAL_LOCATIONS)[0]) => {
    setLat(loc.lat);
    setLon(loc.lon);
    setPlaceName(loc.name);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleConfirmAndDeploy = () => {
    onLocationSelect({
      latitude: lat,
      longitude: lon,
      place_name: placeName,
      type: missionType,
      priority: priority,
      action: `${missionType.toUpperCase()} LOCK - ${payloadSensor}`,
    });
  };

  return (
    <div className="flex flex-col gap-4 font-mono select-none">
      {/* Search Bar - Online delivery app style with autocomplete */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-space-900/90 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs backdrop-blur-md shadow-lg">
          <Search className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search delivery location (e.g. Tokyo, London, Paris, Hyderabad)..."
            className="bg-transparent border-none outline-none text-white placeholder-slate-500 w-full text-xs font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-11 bg-space-950/95 border border-cyan-500/50 rounded-xl shadow-2xl z-30 overflow-hidden backdrop-blur-xl">
            {searchResults.map((item, idx) => (
              <div
                key={idx}
                onClick={() => selectSearchResult(item)}
                className="px-3 py-2 hover:bg-cyan-500/20 text-xs text-slate-200 hover:text-white cursor-pointer flex items-center justify-between border-b border-slate-800/80 last:border-b-0 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold">{item.name}</span>
                </div>
                <span className="text-[10px] text-cyan-300">
                  {item.lat.toFixed(1)}°, {item.lon.toFixed(1)}°
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preset Fast-Pick Delivery Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10.5px] custom-scrollbar">
        <span className="text-slate-500 text-[10px] uppercase font-bold flex-shrink-0">Presets:</span>
        {[
          { name: "AP, India", lat: 16.50, lon: 80.60 },
          { name: "San Francisco, USA", lat: 37.77, lon: -122.41 },
          { name: "Paris, France", lat: 48.85, lon: 2.35 },
          { name: "Tokyo, Japan", lat: 35.67, lon: 139.65 },
          { name: "Sydney, Australia", lat: -33.86, lon: 151.20 },
          { name: "London, UK", lat: 51.50, lon: -0.12 },
          { name: "Dubai, UAE", lat: 25.20, lon: 55.27 },
        ].map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setLat(chip.lat);
              setLon(chip.lon);
              setPlaceName(chip.name);
            }}
            className="px-2 py-0.5 rounded-full bg-space-900 border border-slate-800 hover:border-cyan-400 hover:text-cyan-300 text-slate-300 flex-shrink-0 transition-all cursor-pointer"
          >
            {chip.name}
          </button>
        ))}
      </div>

      {/* Interactive Map Canvas Container (Point & Drop Pin) */}
      <div className="relative w-full h-56 rounded-xl overflow-hidden border border-cyan-500/40 bg-[#060b17] select-none shadow-inner group">
        <div
          ref={mapContainerRef}
          onClick={updatePinFromMouseEvent}
          onMouseDown={(e) => {
            setIsDragging(true);
            updatePinFromMouseEvent(e);
          }}
          onMouseMove={(e) => {
            if (isDragging) updatePinFromMouseEvent(e);
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          className="relative w-full h-full cursor-crosshair overflow-hidden"
          style={{
            backgroundImage: "url('/textures/earth_day.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Subtle Dark Vignette & Grid Lines */}
          <div className="absolute inset-0 bg-gradient-to-t from-space-950/70 via-transparent to-space-950/40 pointer-events-none" />
          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-cyan-400/30 border-b border-dashed border-cyan-400/40 pointer-events-none" />
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-cyan-400/30 border-r border-dashed border-cyan-400/40 pointer-events-none" />

          {/* Interactive Delivery Location Dropped Pin 📍 */}
          <div
            className="absolute transform -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-75"
            style={{
              left: `${pinXPercent}%`,
              top: `${pinYPercent}%`,
            }}
          >
            {/* Delivery Location Floating Badge */}
            <div className="mb-1 transform -translate-x-1/2 left-1/2 relative bg-space-950/95 border border-cyan-400 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-2xl flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-cyan-300">{placeName}</span>
            </div>

            {/* Glowing 3D Location Marker Pin */}
            <div className="relative flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 animate-ping absolute" />
              <div className="p-1 rounded-full bg-emerald-500 text-space-950 shadow-lg shadow-emerald-500/50">
                <MapPin className="w-5 h-5 fill-space-950 text-white stroke-2" />
              </div>
            </div>

            {/* Reticle on Ground */}
            <div className="w-6 h-3 border border-cyan-400 rounded-full mx-auto -mt-1 opacity-80" />
          </div>

          <div className="absolute top-2 left-2 bg-space-950/85 border border-slate-800 backdrop-blur-md px-2 py-0.5 rounded text-[9px] text-slate-300 pointer-events-none">
            Point or drag pin to choose target
          </div>

          <div className="absolute bottom-2 left-2 bg-space-950/85 border border-cyan-500/40 backdrop-blur-md px-2.5 py-1 rounded text-[10px] text-cyan-300 font-bold pointer-events-none">
            📍 {lat.toFixed(2)}° N, {lon.toFixed(2)}° E
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MISSION DETAILS CONFIRMATION SECTION (User requested: Earth Observation,  */}
      {/* Priority, Sensor Payload, and Mission Objectives details)                 */}
      {/* ========================================================================= */}
      <div className="bg-space-900/80 border border-cyan-500/30 rounded-2xl p-4 flex flex-col gap-3.5 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
              MISSION SPECIFICATION &amp; PAYLOAD DETAILS
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
            AUTONOMOUS 6-DOF MPC
          </span>
        </div>

        {/* 1. Mission Type Selection (Earth Observation, Disaster, Reconnaissance, etc.) */}
        <div>
          <label className="text-[11px] text-slate-400 font-bold mb-1.5 block">
            1. Select Mission Task Type:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MISSION_OBJECTIVES.map((obj) => {
              const isSelected = missionType === obj.id;
              const Icon = obj.icon;
              return (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => setMissionType(obj.id)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(0,242,254,0.25)] ring-1 ring-cyan-400"
                      : "border-slate-800 bg-space-950/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className={`w-4 h-4 ${isSelected ? "text-cyan-300" : "text-slate-400"}`} />
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-300" />}
                  </div>
                  <div className="text-xs font-bold text-white leading-tight font-sans">
                    {obj.title}
                  </div>
                  <div className="text-[9.5px] text-slate-400 leading-tight">
                    {obj.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Priority & Payload Sensor Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Priority */}
          <div>
            <label className="text-[11px] text-slate-400 font-bold mb-1.5 block">
              2. Priority Level:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRIORITY_LEVELS.map((p) => {
                const isSelected = priority === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                      isSelected
                        ? `${p.style} font-bold ring-1`
                        : "border-slate-800 bg-space-950 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="text-xs">{p.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payload Sensor */}
          <div>
            <label className="text-[11px] text-slate-400 font-bold mb-1.5 block">
              3. Sensor Payload Gimbal Mode:
            </label>
            <select
              value={payloadSensor}
              onChange={(e) => setPayloadSensor(e.target.value)}
              className="w-full bg-space-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none"
            >
              {PAYLOAD_SENSORS.map((s, idx) => (
                <option key={idx} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Delivery Confirmation Summary Card */}
        <div className="bg-space-950/80 border border-cyan-500/40 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
              <Navigation className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase">Target Location:</div>
              <div className="text-white font-bold truncate text-xs">{placeName}</div>
              <div className="text-[10px] text-cyan-400 font-mono">
                {lat.toFixed(2)}° N, {lon.toFixed(2)}° E • {missionType} ({priority})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 rounded-xl bg-space-900 hover:bg-space-800 border border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                CANCEL
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirmAndDeploy}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-space-950 font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,136,0.35)] active:scale-95 transition-all cursor-pointer font-sans"
            >
              <Rocket className="w-4 h-4 fill-space-950 text-cyan-100" />
              <span>CONFIRM &amp; DEPLOY MISSION</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
