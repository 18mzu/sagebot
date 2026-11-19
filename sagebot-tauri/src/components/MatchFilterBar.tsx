import React, { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, Filter, MapPin, X } from "lucide-react";
import { MAP_SPLASHES } from "../constants/valorant";

export type ResultFilter = "ALL" | "VICTORY" | "DEFEAT" | "DRAW";
export type DatePreset = "all" | "today" | "7d" | "30d" | "custom";

export interface MatchFilters {
  maps: string[]; // lowercased map names
  datePreset: DatePreset;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  result: ResultFilter;
}

export const DEFAULT_MATCH_FILTERS: MatchFilters = {
  maps: [],
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
  result: "ALL",
};

export function loadSavedFilters(storageKey: string): MatchFilters {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...DEFAULT_MATCH_FILTERS };
    const parsed = JSON.parse(raw);
    return {
      maps: Array.isArray(parsed?.maps) ? parsed.maps.map((m: any) => String(m).toLowerCase()) : [],
      datePreset: ["all", "today", "7d", "30d", "custom"].includes(parsed?.datePreset)
        ? parsed.datePreset
        : "all",
      dateFrom: typeof parsed?.dateFrom === "string" ? parsed.dateFrom : "",
      dateTo: typeof parsed?.dateTo === "string" ? parsed.dateTo : "",
      result: ["ALL", "VICTORY", "DEFEAT", "DRAW"].includes(parsed?.result) ? parsed.result : "ALL",
    };
  } catch {
    return { ...DEFAULT_MATCH_FILTERS };
  }
}

export function saveFilters(storageKey: string, filters: MatchFilters) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(filters));
  } catch {
    // Ignore storage errors
  }
}

export function hasActiveFilters(filters: MatchFilters): boolean {
  if (filters.maps.length > 0) return true;
  if (filters.result !== "ALL") return true;
  if (filters.datePreset === "custom") {
    return Boolean(filters.dateFrom || filters.dateTo);
  }
  return filters.datePreset !== "all";
}

function normalizeTimestampMs(ts: number): number {
  if (!ts || !Number.isFinite(ts)) return 0;
  return ts < 1e12 ? ts * 1000 : ts;
}

export function matchesFilterCriteria(
  item: { map_name: string; timestamp: number; result: string },
  filters: MatchFilters
): boolean {
  // 1. Map filter
  if (filters.maps.length > 0) {
    const mapLower = (item.map_name || "").trim().toLowerCase();
    if (!filters.maps.includes(mapLower)) return false;
  }

  // 2. Result filter
  if (filters.result !== "ALL") {
    const resUpper = (item.result || "").trim().toUpperCase();
    if (resUpper !== filters.result) return false;
  }

  // 3. Date filter
  if (filters.datePreset !== "all") {
    const tsMs = normalizeTimestampMs(item.timestamp);
    if (tsMs <= 0) return false;
    const now = Date.now();

    if (filters.datePreset === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      if (tsMs < start.getTime()) return false;
    } else if (filters.datePreset === "7d") {
      if (tsMs < now - 7 * 86_400_000) return false;
    } else if (filters.datePreset === "30d") {
      if (tsMs < now - 30 * 86_400_000) return false;
    } else if (filters.datePreset === "custom") {
      if (filters.dateFrom) {
        const fromMs = new Date(`${filters.dateFrom}T00:00:00`).getTime();
        if (!Number.isNaN(fromMs) && tsMs < fromMs) return false;
      }
      if (filters.dateTo) {
        const toMs = new Date(`${filters.dateTo}T23:59:59.999`).getTime();
        if (!Number.isNaN(toMs) && tsMs > toMs) return false;
      }
    }
  }

  return true;
}

interface MatchFilterBarProps {
  filters: MatchFilters;
  onChange: (next: MatchFilters) => void;
  availableMaps: string[];
  shownCount: number;
  totalCount: number;
  itemLabel: string; // "matches" | "players"
}

export const MatchFilterBar: React.FC<MatchFilterBarProps> = ({
  filters,
  onChange,
  availableMaps,
  shownCount,
  totalCount,
  itemLabel,
}) => {
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const mapPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (mapPopoverRef.current && !mapPopoverRef.current.contains(e.target as Node)) {
        setMapMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [mapMenuOpen]);

  const toggleMap = (mapLower: string) => {
    const exists = filters.maps.includes(mapLower);
    const nextMaps = exists
      ? filters.maps.filter((m) => m !== mapLower)
      : [...filters.maps, mapLower];
    onChange({ ...filters, maps: nextMaps });
  };

  const active = hasActiveFilters(filters);

  return (
    <div className="match-filter-bar">
      <div className="match-filter-controls">
        {/* Result Pills */}
        <div className="match-filter-group">
          {(["ALL", "VICTORY", "DEFEAT", "DRAW"] as ResultFilter[]).map((res) => {
            const label =
              res === "ALL" ? "All" : res === "VICTORY" ? "Victory" : res === "DEFEAT" ? "Defeat" : "Draw";
            return (
              <button
                key={res}
                type="button"
                className={`match-filter-pill res-${res.toLowerCase()} ${filters.result === res ? "active" : ""}`}
                onClick={() => onChange({ ...filters, result: res })}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Date Filter */}
        <div className="match-filter-date-wrap">
          <Calendar size={13} className="match-filter-icon" />
          <select
            className="match-filter-select"
            value={filters.datePreset}
            onChange={(e) => {
              const preset = e.target.value as DatePreset;
              onChange({
                ...filters,
                datePreset: preset,
                ...(preset !== "custom" ? { dateFrom: "", dateTo: "" } : {}),
              });
            }}
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {filters.datePreset === "custom" && (
            <div className="match-filter-custom-dates">
              <input
                type="date"
                className="match-date-input"
                value={filters.dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                title="From date"
              />
              <span className="match-date-sep">to</span>
              <input
                type="date"
                className="match-date-input"
                value={filters.dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                title="To date"
              />
            </div>
          )}
        </div>

        {/* Map Multi-Select Dropdown */}
        <div className="match-filter-map-wrap" ref={mapPopoverRef}>
          <button
            type="button"
            className={`match-filter-map-btn ${filters.maps.length > 0 ? "active" : ""}`}
            onClick={() => setMapMenuOpen((v) => !v)}
          >
            <MapPin size={13} />
            <span>
              {filters.maps.length === 0 ? "Maps: All" : `Maps (${filters.maps.length})`}
            </span>
            <ChevronDown size={13} />
          </button>

          {mapMenuOpen && (
            <div className="match-filter-map-popover">
              <div className="map-popover-header">
                <span className="map-popover-title">Filter by Maps</span>
                {filters.maps.length > 0 && (
                  <button
                    type="button"
                    className="map-popover-all-btn"
                    onClick={() => onChange({ ...filters, maps: [] })}
                  >
                    All Maps
                  </button>
                )}
              </div>
              {availableMaps.length === 0 ? (
                <div className="map-popover-empty">No maps recorded yet</div>
              ) : (
                <div className="map-popover-grid">
                  {availableMaps.map((mapName) => {
                    const lower = mapName.toLowerCase();
                    const selected = filters.maps.includes(lower);
                    const thumb = MAP_SPLASHES[lower];
                    return (
                      <button
                        key={lower}
                        type="button"
                        className={`map-popover-item ${selected ? "selected" : ""}`}
                        onClick={() => toggleMap(lower)}
                      >
                        {thumb && <img src={thumb} alt="" className="map-popover-thumb" />}
                        <span className="map-popover-name">{mapName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="match-filter-status">
        <span className="match-filter-count">
          <Filter size={11} />
          Showing {shownCount} of {totalCount} {itemLabel}
        </span>
        {active && (
          <button
            type="button"
            className="match-filter-clear-btn"
            onClick={() => onChange({ ...DEFAULT_MATCH_FILTERS })}
          >
            <X size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>
    </div>
  );
};
