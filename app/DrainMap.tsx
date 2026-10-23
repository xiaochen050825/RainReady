"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

export type MapSite = {
  id: string;
  place: string;
  risk: number;
  status: string;
  lat: number;
  lon: number;
  rainfall?: number;
  weatherStatus?: string;
  blockage?: number;
  litter?: number;
  environmentalRisk?: number;
  environmentalLevel?: string;
  environmentalContext?: string;
  environmentalDistanceMeters?: number | null;
  recommendedAction?: string;
  photo?: string;
  isDemo?: boolean;
};

type LeafletModule = typeof import("leaflet");

function markerColor(site: MapSite) {
  if (site.status === "Verified clear") return "#dfff68";
  const concern = site.environmentalRisk ?? site.risk;
  if (concern >= 80) return "#ff745f";
  if (concern >= 60) return "#f5bd4e";
  if (concern >= 40) return "#89c9c0";
  return "#dfff68";
}

function markerSymbol(site: MapSite) {
  if (site.status === "Verified clear") return "✓";
  if (site.status === "Needs review") return "!";
  if ((site.environmentalRisk ?? site.risk) >= 60) return "▲";
  return "●";
}

export function DrainMap({
  sites,
  selectedId,
  onSelect,
  connections,
  routes,
  facilities,
}: {
  sites: MapSite[];
  selectedId: string;
  onSelect: (site: MapSite) => void;
  connections?: { from: string; to: string }[];
  routes?: { id: string; ids: string[]; depot?: {lat: number; lon: number} }[];
  facilities?: { lat: number; lon: number; label: string }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const initialSiteRef = useRef(sites.find((site) => site.id === selectedId) ?? sites[0]);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const selected = initialSiteRef.current;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([selected.lat, selected.lon], 13);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).on("tileerror", () => { if (!cancelled) setTileError(true); }).addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    }

    void initialize();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      leafletRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!L || !map || !markerLayer) return;

    markerLayer.clearLayers();
    for (const edge of connections ?? []) {
      const from = sites.find(s => s.id === edge.from);
      const to = sites.find(s => s.id === edge.to);
      if (!from || !to) continue;
      L.polyline([[from.lat, from.lon], [to.lat, to.lon]], { color: "#078b90", weight: 3, opacity: 0.8 }).addTo(markerLayer);
      const angle = Math.atan2(to.lon - from.lon, to.lat - from.lat) * 180 / Math.PI;
      L.marker([(from.lat + to.lat) / 2, (from.lon + to.lon) / 2], { interactive: false, icon: L.divIcon({ className: "rr-flow-arrow", html: `<span style="display:block;transform:rotate(${angle}deg)">▲</span>`, iconSize: [14,14] }) }).addTo(markerLayer);
    }
    (routes ?? []).forEach((route, i) => {
      const points = route.ids.flatMap(id => { const a = sites.find(s => s.id === id); return a ? [[a.lat, a.lon] as [number,number]] : []; });
      if (points.length && route.depot) { points.unshift([route.depot.lat, route.depot.lon]); points.push([route.depot.lat, route.depot.lon]); }
      if (points.length > 1) L.polyline(points, { color: ["#15b7b0", "#8263df", "#d98c23", "#2897da", "#d5569b", "#6f9226"][i % 6], weight: 4, dashArray: "7 8" }).addTo(markerLayer);
    });
    for (const facility of facilities ?? []) {
      const label = document.createElement("span"); label.textContent = facility.label;
      L.marker([facility.lat, facility.lon], { icon: L.divIcon({ className: "rr-facility", html: "◆", iconSize: [18,18] }) }).bindTooltip(label).addTo(markerLayer);
    }
    for (const site of sites) {
      const selected = site.id === selectedId;
      const marker = L.circleMarker([site.lat, site.lon], {
        radius: selected ? 14 : 11,
        color: selected ? "#0b1713" : "#ffffff",
        weight: selected ? 4 : 3,
        fillColor: markerColor(site),
        fillOpacity: 1,
      });
      const environmentalRisk = site.environmentalRisk ?? site.risk;
      marker.bindTooltip(connections ? `${environmentalRisk}` : `${markerSymbol(site)} ${environmentalRisk}`, {
        permanent: true,
        direction: "center",
        className: "garbage-risk-tooltip",
      });
      const popup = document.createElement("div");
      const identifier = document.createElement("strong");
      identifier.textContent = site.id;
      popup.appendChild(identifier); popup.appendChild(document.createElement("br"));
      if (site.photo) {
        const photo = document.createElement("img");
        photo.src = site.photo;
        photo.alt = `Inspection evidence for ${site.id}`;
        photo.width = 220;
        photo.height = 120;
        photo.className = "map-popup-photo";
        popup.appendChild(photo);
      }
      popup.appendChild(document.createTextNode(site.place)); popup.appendChild(document.createElement("br"));
      popup.appendChild(document.createTextNode(`Coordinates ${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}`)); popup.appendChild(document.createElement("br"));
      popup.appendChild(document.createTextNode(`${connections ? "Relative intervention priority" : "Cleanup priority"} ${site.risk}/100`)); popup.appendChild(document.createElement("br"));
      if (!connections) popup.appendChild(document.createTextNode(`Environmental concern ${environmentalRisk}/100`)); popup.appendChild(document.createElement("br"));
      popup.appendChild(document.createTextNode(`Blockage ${site.blockage ?? "—"}/100 · litter ${site.litter ?? "—"}/100`)); popup.appendChild(document.createElement("br"));
      popup.appendChild(document.createTextNode(`Rainfall ${site.rainfall?.toFixed(1) ?? "—"} mm`)); popup.appendChild(document.createElement("br"));
      popup.appendChild(document.createTextNode(site.environmentalContext ?? "Environmental context unavailable")); popup.appendChild(document.createElement("br"));
      popup.appendChild(document.createTextNode(`Status: ${site.status}`)); popup.appendChild(document.createElement("br"));
      popup.appendChild(document.createTextNode(site.recommendedAction ?? "Open the report for the recommended action."));
      marker.bindPopup(popup);
      marker.on("click", () => onSelectRef.current(site));
      marker.addTo(markerLayer);
      marker.getElement()?.setAttribute("aria-label", `${site.id}, ${site.place}, environmental concern ${environmentalRisk} out of 100, ${site.status}`);
    }

    const selected = sites.find((site) => site.id === selectedId);
    if (connections && sites.length) map.fitBounds(sites.map(s => [s.lat, s.lon] as [number,number]), { padding: [35,35], maxZoom: 16 });
    else if (selected) map.flyTo([selected.lat, selected.lon], Math.max(map.getZoom(), 14), { duration: 0.75 });
  }, [ready, selectedId, sites, connections, routes, facilities]);

  return (
    <div className="map-live-wrap">
      {tileError && <p role="status">Some basemap tiles are unavailable. Asset markers and supplied network connections remain usable; reload to retry tiles.</p>}
      <div ref={containerRef} className="real-map" aria-label="OpenStreetMap showing reported garbage locations" />
      <div className="map-key">
        <span><i className="key-critical" /> ▲ {connections ? "High relative priority" : "High concern"}</span>
        <span><i className="key-watch" /> ● Moderate</span>
        <span><i className="key-low" /> {connections ? "● Lower priority" : "✓ Verified"}</span>
        <span><i className="key-review" /> ! Review</span>
      </div>
    </div>
  );
}

