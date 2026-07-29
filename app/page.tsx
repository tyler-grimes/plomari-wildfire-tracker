"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LayerGroup,
  Map as LeafletMap,
  TileLayer,
} from "leaflet";
import "leaflet/dist/leaflet.css";

type LatLngTuple = [number, number];
type Confidence = "official" | "observed" | "reported" | "modeled";
type LayerKey =
  | "official"
  | "satellite"
  | "local"
  | "wind"
  | "smoke"
  | "simulation";
type BaseMode = "dark" | "satellite" | "terrain";

type WindVector = {
  speedKmh: number;
  directionDeg: number;
};

type WindCurrent = {
  time: string;
  tempC: number;
  rhPct: number;
  dewpointC: number;
  pressureHpa: number;
  pblM: number;
  wind10: WindVector;
  gustKmh: number;
  wind80: WindVector;
  wind120: WindVector;
  wind180: WindVector;
};

type WindPayload = {
  generatedAt: string;
  locations: Array<{
    id: string;
    label: string;
    lat: number;
    lon: number;
    provider: string;
    current: WindCurrent;
  }>;
  metar: {
    station: string;
    observedAt: string;
    raw: string;
    directionDeg: number;
    speedKt: number;
    gustKt: number | null;
    variableFromDeg?: number;
    variableToDeg?: number;
    tempC: number;
    dewpointC: number;
    pressureHpa: number;
  } | null;
  errors: string[];
};

type IntelItem = {
  id: string;
  time: string;
  label: string;
  detail: string;
  confidence: Confidence;
};

type ThermalDetection = {
  id: string;
  point: LatLngTuple;
  sensor: string;
  pass: string;
  confidence: string;
  frp: number | null;
  footprint: string;
};

type FirmsDetection = {
  id: string;
  lat: number;
  lon: number;
  acquiredAt: string;
  sensor: string;
  source: string;
  confidence: string;
  frp: number | null;
  footprint: string;
  daynight: "day" | "night" | null;
};

type FirmsPayload = {
  generatedAt: string;
  configured: boolean;
  detections: FirmsDetection[];
  errors: string[];
};

const INCIDENT: LatLngTuple = [38.989013, 26.382489];
const PLOMARI_BEACH: LatLngTuple = [38.9752, 26.3714];
const AGIOS_ISIDOROS: LatLngTuple = [38.9702, 26.3927];
const MELINTA: LatLngTuple = [38.9875, 26.3131];
const MILIES: LatLngTuple = [38.998, 26.4109];
const PLAGIA: LatLngTuple = [38.98234, 26.39769];
const PERAMA: LatLngTuple = [39.0429, 26.50556];
const AGIOS_ANTONIOS: LatLngTuple = [38.9817634, 26.4073025];
const MEGALOCHORI: LatLngTuple = [39.0173137, 26.3687164];

const WIND_FALLBACK: WindCurrent = {
  time: "2026-07-29T22:00",
  tempC: 25.3,
  rhPct: 41,
  dewpointC: 11.1,
  pressureHpa: 1002.8,
  pblM: 950,
  wind10: { speedKmh: 39.8, directionDeg: 42 },
  gustKmh: 120.2,
  wind80: { speedKmh: 65, directionDeg: 42 },
  wind120: { speedKmh: 74, directionDeg: 41 },
  wind180: { speedKmh: 80.4, directionDeg: 41 },
};

const LANDFILL_FOOTPRINT: LatLngTuple[] = [
  [38.9895777, 26.3815427],
  [38.9896611, 26.3826692],
  [38.9894318, 26.3841981],
  [38.9890774, 26.3842678],
  [38.9887021, 26.3833129],
  [38.9879933, 26.3826156],
  [38.9881392, 26.3818645],
  [38.9887438, 26.3815963],
  [38.9895777, 26.3815427],
];

// Labeled fallback only: the 29 July 2026 afternoon passes. The map renders
// live NASA FIRMS detections from /api/firms whenever the feed is available.
const SNAPSHOT_DETECTIONS: ThermalDetection[] = [
  {
    id: "snpp-1",
    point: [38.99092, 26.38489],
    sensor: "Suomi-NPP VIIRS",
    pass: "14:57",
    confidence: "Nominal",
    frp: 5.08,
    footprint: "0.54 × 0.51 km",
  },
  {
    id: "snpp-2",
    point: [38.9858, 26.37997],
    sensor: "Suomi-NPP VIIRS",
    pass: "14:57",
    confidence: "Nominal",
    frp: 19.92,
    footprint: "0.54 × 0.51 km",
  },
  {
    id: "snpp-3",
    point: [38.98624, 26.38598],
    sensor: "Suomi-NPP VIIRS",
    pass: "14:57",
    confidence: "Nominal",
    frp: 19.92,
    footprint: "0.54 × 0.51 km",
  },
  {
    id: "snpp-4",
    point: [38.98112, 26.38098],
    sensor: "Suomi-NPP VIIRS",
    pass: "14:57",
    confidence: "Nominal",
    frp: 19.92,
    footprint: "0.54 × 0.51 km",
  },
  {
    id: "snpp-5",
    point: [38.98936, 26.38072],
    sensor: "Suomi-NPP VIIRS",
    pass: "14:57",
    confidence: "Nominal",
    frp: 11.7,
    footprint: "0.54 × 0.51 km",
  },
  {
    id: "snpp-6",
    point: [38.98982, 26.38652],
    sensor: "Suomi-NPP VIIRS",
    pass: "14:57",
    confidence: "Nominal",
    frp: 24.48,
    footprint: "0.54 × 0.51 km",
  },
  {
    id: "snpp-7",
    point: [38.98468, 26.38161],
    sensor: "Suomi-NPP VIIRS",
    pass: "14:57",
    confidence: "Nominal",
    frp: 10.97,
    footprint: "0.54 × 0.51 km",
  },
  {
    id: "snpp-8",
    point: [38.98516, 26.38771],
    sensor: "Suomi-NPP VIIRS",
    pass: "14:57",
    confidence: "High",
    frp: 17.66,
    footprint: "0.54 × 0.51 km",
  },
  {
    id: "noaa20-1",
    point: [38.98045, 26.3883],
    sensor: "NOAA-20 VIIRS",
    pass: "15:17",
    confidence: "High",
    frp: 22.38,
    footprint: "0.60 × 0.70 km",
  },
  {
    id: "noaa20-2",
    point: [38.98028, 26.38137],
    sensor: "NOAA-20 VIIRS",
    pass: "15:17",
    confidence: "Nominal",
    frp: 31.26,
    footprint: "0.60 × 0.70 km",
  },
  {
    id: "noaa20-3",
    point: [38.98696, 26.38648],
    sensor: "NOAA-20 VIIRS",
    pass: "15:17",
    confidence: "High",
    frp: 22.38,
    footprint: "0.60 × 0.70 km",
  },
  {
    id: "noaa20-4",
    point: [38.97919, 26.38359],
    sensor: "NOAA-20 VIIRS",
    pass: "15:17",
    confidence: "Nominal",
    frp: 20.63,
    footprint: "0.60 × 0.70 km",
  },
  {
    id: "noaa20-5",
    point: [38.98586, 26.38887],
    sensor: "NOAA-20 VIIRS",
    pass: "15:17",
    confidence: "High",
    frp: 32.26,
    footprint: "0.60 × 0.71 km",
  },
  {
    id: "noaa20-6",
    point: [38.98572, 26.38212],
    sensor: "NOAA-20 VIIRS",
    pass: "15:17",
    confidence: "Nominal",
    frp: 20.63,
    footprint: "0.60 × 0.70 km",
  },
  {
    id: "modis-1",
    point: [38.98641, 26.3782],
    sensor: "Aqua MODIS",
    pass: "16:06",
    confidence: "63%",
    frp: 32.94,
    footprint: "1.22 × 1.10 km",
  },
];

const intel: IntelItem[] = [
  {
    id: "overnight-hotspots",
    time: "20:50",
    label: "Aerial drops ended; scattered hotspots remain",
    detail:
      "Local field reporting says aerial operations ended for the night, with scattered active hotspots around Agios Antonios and toward Megalochori. Strong winds are hampering ground crews. This is not an official containment statement.",
    confidence: "reported",
  },
  {
    id: "no-active-front",
    time: "19:55",
    label: "No continuous front reported; rekindling risk",
    detail:
      "The deputy regional governor reported no active continuous front, but numerous scattered hotspots remained in difficult terrain. Crews stayed alert for rekindling. This was a local official statement, not a Fire Service all-clear.",
    confidence: "reported",
  },
  {
    id: "homes",
    time: "19:25",
    label: "Hotspots reported near holiday homes",
    detail:
      "Local reporting said hotspots remained above Plomari near holiday homes. Residents and volunteers reportedly prevented flames from reaching houses.",
    confidence: "reported",
  },
  {
    id: "smoke",
    time: "17:50",
    label: "Regional satellite smoke observed",
    detail:
      "Satellite imagery showed smoke from the Plomari incident and a major Turkish fire transported across Lesvos. This is a regional smoke snapshot, not a ground-level PM2.5 measurement.",
    confidence: "observed",
  },
  {
    id: "evacuation",
    time: "16:58",
    label: "Latest official 112 instruction",
    detail:
      "People in the Plomari area were instructed to move to Plomari beach and continue toward Agios Isidoros. No official cancellation or all-clear had been found by the 22:00 review.",
    confidence: "official",
  },
  {
    id: "reinforced",
    time: "16:34",
    label: "Fire Service response reinforced",
    detail:
      "Fire Service reported 50 firefighters, two 12th EMODE teams, volunteers, 13 vehicles, three aircraft and three helicopters.",
    confidence: "official",
  },
  {
    id: "modis",
    time: "16:06",
    label: "Latest satellite heat",
    detail:
      "Aqua MODIS detected active heat near Chalkelia. A satellite point is an observed hot pixel, not a fire perimeter.",
    confidence: "observed",
  },
  {
    id: "viirs",
    time: "15:17",
    label: "NOAA-20 pass",
    detail:
      "Six VIIRS hot pixels were detected near the incident, including three high-confidence detections.",
    confidence: "observed",
  },
  {
    id: "ignition",
    time: "14:00",
    label: "Fire reported",
    detail:
      "The incident was reported around the restored Chalkelia landfill, north-east of Plomari.",
    confidence: "official",
  },
];

const sources = [
  {
    label: "112 Greece",
    href: "https://x.com/112Greece/status/2082468150189167080",
    kind: "Latest official instruction · 16:58",
  },
  {
    label: "Protective guidance",
    href: "https://civilprotection.gov.gr/112/odigies-prostasias",
    kind: "Official safety instructions",
  },
  {
    label: "Fire Service",
    href: "https://x.com/pyrosvestiki/status/2082459852350066823",
    kind: "Official response · 16:34",
  },
  {
    label: "StoNisi overnight",
    href: "https://www.stonisi.gr/post/114624/stamathsan-oi-ripseis-apo-aeros-sthn-fwtia-toy-plwmarioy",
    kind: "Local field report · 20:50",
  },
  {
    label: "Aeolos",
    href: "https://aeolos.tv/140029/kalyteri-i-eikona-sti-fotia-tou-plomariou-synechizetai-i-machi-me-tis-anazopyroseis/",
    kind: "Local reporting · repeated rekindling",
  },
  {
    label: "Satellite smoke",
    href: "https://www.stonisi.gr/post/115334/kapnos-apo-thn-toyrkia-skepazei-lesvo-kai-xio",
    kind: "Regional smoke report · 17:50",
  },
  {
    label: "NASA FIRMS",
    href: "https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html",
    kind: "Live thermal hotspots · 5-min poll",
  },
  {
    label: "Open-Meteo",
    href: "https://open-meteo.com/en/docs",
    kind: "Detailed point wind model",
  },
  {
    label: "AviationWeather",
    href: "https://aviationweather.gov/data/api/",
    kind: "Measured LGMT airport METAR",
  },
];

const spreadRates: Record<number, number> = {
  3: 0.28,
  4: 0.42,
  5: 0.58,
  6: 0.78,
  7: 1.02,
};

const BASEMAPS: Record<
  BaseMode,
  { url: string; attribution: string; maxZoom: number }
> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    maxZoom: 17,
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, contours &copy; OpenTopoMap',
  },
};

function destination(
  origin: LatLngTuple,
  bearingDegrees: number,
  distanceKm: number,
): LatLngTuple {
  const radius = 6371;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const angularDistance = distanceKm / radius;
  const latitude = (origin[0] * Math.PI) / 180;
  const longitude = (origin[1] * Math.PI) / 180;
  const nextLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const nextLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(nextLatitude),
    );
  return [
    (nextLatitude * 180) / Math.PI,
    (nextLongitude * 180) / Math.PI,
  ];
}

function scenarioShape(
  origin: LatLngTuple,
  heading: number,
  distanceKm: number,
  halfAngle = 58,
): LatLngTuple[] {
  if (distanceKm <= 0) return [origin, origin, origin];
  const points: LatLngTuple[] = [origin];
  const step = Math.max(4, Math.round((halfAngle * 2) / 14));
  for (let offset = -halfAngle; offset <= halfAngle; offset += step) {
    const taper =
      0.38 +
      0.62 * Math.cos((Math.abs(offset) / halfAngle) * (Math.PI / 2));
    points.push(destination(origin, heading + offset, distanceKm * taper));
  }
  points.push(origin);
  return points;
}

function markerHtml(
  kind: "fire" | "settlement" | "arrow" | "wind",
  label: string,
) {
  return `<div class="map-marker map-marker--${kind}"><span></span><b>${label}</b></div>`;
}

function confidenceLabel(confidence: Confidence) {
  if (confidence === "official") return "OFFICIAL";
  if (confidence === "observed") return "OBSERVED";
  if (confidence === "reported") return "LOCAL REPORT";
  return "MODELED";
}

function midpoint(a: LatLngTuple, b: LatLngTuple): LatLngTuple {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function formatGreeceTime(value: string | undefined) {
  if (!value) return "—";
  if (
    value.includes("T") &&
    !value.endsWith("Z") &&
    !/[+-]\d{2}:\d{2}$/.test(value)
  ) {
    return value.split("T")[1]?.slice(0, 5) ?? value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.includes("T") ? value.split("T")[1]?.slice(0, 5) ?? value : value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Athens",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function compass(degrees: number) {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

export default function Home() {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const operationalGroup = useRef<LayerGroup | null>(null);
  const baseLayerRef = useRef<TileLayer | null>(null);

  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState("");
  const [baseMode, setBaseMode] = useState<BaseMode>("satellite");
  const [compact, setCompact] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [intelOpen, setIntelOpen] = useState(true);
  const [activeIntel, setActiveIntel] = useState("overnight-hotspots");
  const [windData, setWindData] = useState<WindPayload | null>(null);
  const [windError, setWindError] = useState(false);
  const [firmsData, setFirmsData] = useState<FirmsPayload | null>(null);
  const [firmsError, setFirmsError] = useState(false);
  const [online, setOnline] = useState(true);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    official: true,
    satellite: true,
    local: true,
    wind: true,
    smoke: true,
    simulation: false,
  });
  const [hour, setHour] = useState(2);
  const [beaufort, setBeaufort] = useState(6);
  const [heading, setHeading] = useState(218);
  const [smokeMinutes, setSmokeMinutes] = useState(15);

  const scenarioDistance = useMemo(
    () => Number((spreadRates[beaufort] * hour).toFixed(1)),
    [beaufort, hour],
  );
  const active = intel.find((item) => item.id === activeIntel) ?? intel[0];
  const fireWind =
    windData?.locations.find((location) => location.id === "fire")?.current ??
    WIND_FALLBACK;
  const downwindHeading = (fireWind.wind10.directionDeg + 180) % 360;
  const smokeDistance = Math.max(
    2,
    Math.min(18, fireWind.wind10.speedKmh * (smokeMinutes / 60)),
  );
  const windObservedTime = formatGreeceTime(fireWind.time);
  const retrievedTime = formatGreeceTime(windData?.generatedAt);

  const liveDetections = useMemo(
    () => (firmsData?.configured ? firmsData.detections : []),
    [firmsData],
  );
  const usingLiveThermal = liveDetections.length > 0;
  const thermalDetections: ThermalDetection[] = useMemo(() => {
    if (!usingLiveThermal) return SNAPSHOT_DETECTIONS;
    return liveDetections.map((detection) => ({
      id: detection.id,
      point: [detection.lat, detection.lon] as LatLngTuple,
      sensor: detection.sensor,
      pass: formatGreeceTime(detection.acquiredAt),
      confidence:
        detection.confidence.charAt(0).toUpperCase() +
        detection.confidence.slice(1),
      frp: detection.frp,
      footprint: detection.footprint,
    }));
  }, [usingLiveThermal, liveDetections]);
  const latestThermalTime = usingLiveThermal
    ? formatGreeceTime(liveDetections[0]?.acquiredAt)
    : "16:06";
  const thermalStatus = usingLiveThermal
    ? firmsError
      ? "LIVE / RETRYING"
      : "LIVE"
    : firmsData && !firmsData.configured
      ? "KEY NOT SET"
      : firmsData && firmsData.errors.length > 0
        ? "FEED ERROR / SNAPSHOT"
        : firmsError
          ? "SNAPSHOT / RETRYING"
          : "SNAPSHOT";

  useEffect(() => {
    const format = () =>
      setClock(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Athens",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    format();
    const timer = window.setInterval(format, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const sync = () => {
      setCompact(query.matches);
      if (query.matches) setIntelOpen(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshWind = async () => {
      try {
        const response = await fetch("/api/wind", { cache: "no-store" });
        if (!response.ok) throw new Error("wind request failed");
        const payload = (await response.json()) as WindPayload;
        if (!cancelled) {
          setWindData(payload);
          setWindError(false);
        }
      } catch {
        if (!cancelled) setWindError(true);
      }
    };
    const initial = window.setTimeout(() => void refreshWind(), 0);
    const timer = window.setInterval(() => void refreshWind(), 300_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshFirms = async () => {
      try {
        const response = await fetch("/api/firms", { cache: "no-store" });
        if (!response.ok) throw new Error("firms request failed");
        const payload = (await response.json()) as FirmsPayload;
        if (!cancelled) {
          setFirmsData(payload);
          setFirmsError(false);
        }
      } catch {
        if (!cancelled) setFirmsError(true);
      }
    };
    const initial = window.setTimeout(() => void refreshFirms(), 0);
    const timer = window.setInterval(() => void refreshFirms(), 300_000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function createMap() {
      if (!mapElement.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapElement.current) return;
      leafletRef.current = L;
      const map = L.map(mapElement.current, {
        zoomControl: false,
        attributionControl: true,
        minZoom: 10,
        maxZoom: 19,
      }).setView([38.988, 26.383], 13);
      mapRef.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      operationalGroup.current = L.layerGroup().addTo(map);
      map.on("click", (event) => {
        const coordinate = `${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`;
        L.popup()
          .setLatLng(event.latlng)
          .setContent(
            `<div class="popup-copy"><strong>MAP INSPECT</strong><br>${coordinate}<br><span>Coordinate only · not an incident observation</span></div>`,
          )
          .openOn(map);
      });
      setReady(true);
    }
    createMap();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    if (baseLayerRef.current) {
      mapRef.current.removeLayer(baseLayerRef.current);
    }
    const config = BASEMAPS[baseMode];
    baseLayerRef.current = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      attribution: config.attribution,
      subdomains: baseMode === "dark" || baseMode === "terrain" ? "abc" : "",
    });
    baseLayerRef.current.addTo(mapRef.current);
    baseLayerRef.current.bringToBack();
  }, [baseMode, ready]);

  useEffect(() => {
    if (
      !ready ||
      !mapRef.current ||
      !leafletRef.current ||
      !operationalGroup.current
    ) {
      return;
    }
    const L = leafletRef.current;
    const group = operationalGroup.current;
    group.clearLayers();

    const settlements: Array<[string, LatLngTuple]> = [
      ["MELINTA", MELINTA],
      ["PLOMARI BEACH", PLOMARI_BEACH],
      ["MILIES", MILIES],
      ["PLAGIA", PLAGIA],
      ["AGIOS ISIDOROS", AGIOS_ISIDOROS],
      ["AGIOS ANTONIOS", AGIOS_ANTONIOS],
      ["MEGALOCHORI", MEGALOCHORI],
      ["PERAMA", PERAMA],
    ];
    settlements.forEach(([name, point]) => {
      L.marker(point, {
        interactive: false,
        icon: L.divIcon({
          className: "marker-shell",
          html: markerHtml("settlement", name),
          iconSize: [150, 26],
          iconAnchor: [8, 13],
        }),
      }).addTo(group);
    });

    if (layers.official) {
      L.polygon(LANDFILL_FOOTPRINT, {
        color: "#f59e0b",
        weight: 1.5,
        fillColor: "#f59e0b",
        fillOpacity: 0.1,
        dashArray: "6 5",
      })
        .bindTooltip(
          "Restored Chalkelia landfill footprint · not the fire perimeter",
          { sticky: true },
        )
        .addTo(group);

      L.circle(INCIDENT, {
        radius: 340,
        color: "#ff4d32",
        weight: 2,
        fillColor: "#ff4d32",
        fillOpacity: 0.08,
        dashArray: "8 7",
      })
        .bindPopup(
          '<div class="popup-copy"><strong>REPORTED INCIDENT AREA</strong><br>Restored Chalkelia landfill.<br><span>Site location only · perimeter not published.</span></div>',
        )
        .addTo(group);
      L.marker(INCIDENT, {
        icon: L.divIcon({
          className: "marker-shell",
          html: markerHtml("fire", "INCIDENT"),
          iconSize: [120, 34],
          iconAnchor: [14, 17],
        }),
      }).addTo(group);

      L.polyline([PLOMARI_BEACH, AGIOS_ISIDOROS], {
        color: "#55ddff",
        weight: 8,
        opacity: 0.18,
        lineCap: "round",
      }).addTo(group);
      L.polyline([PLOMARI_BEACH, AGIOS_ISIDOROS], {
        color: "#55ddff",
        weight: 3,
        opacity: 0.95,
        dashArray: "10 8",
      })
        .bindTooltip(
          "112 direction: Plomari beach → Agios Isidoros · follow authorities on the ground",
          { sticky: true },
        )
        .addTo(group);
      L.marker(midpoint(PLOMARI_BEACH, AGIOS_ISIDOROS), {
        interactive: false,
        icon: L.divIcon({
          className: "marker-shell route-arrow-shell",
          html: markerHtml("arrow", "112 ROUTE →"),
          iconSize: [130, 30],
          iconAnchor: [18, 15],
        }),
      }).addTo(group);
    }

    if (layers.satellite) {
      const feedLabel = usingLiveThermal
        ? "Live NASA FIRMS"
        : "Snapshot · 29 Jul afternoon passes";
      thermalDetections.forEach((detection) => {
        const high =
          detection.confidence === "High" || (detection.frp ?? 0) >= 30;
        L.circleMarker(detection.point, {
          radius: high ? 7 : 5,
          color: high ? "#ff3b24" : "#ff9f1c",
          weight: high ? 2 : 1.5,
          fillColor: high ? "#ff3b24" : "#ffb23f",
          fillOpacity: high ? 0.72 : 0.52,
        })
          .bindPopup(
            `<div class="popup-copy"><strong>${detection.sensor}</strong><br>${detection.pass} Greece · ${detection.confidence}<br>FRP ${detection.frp === null ? "—" : `${detection.frp.toFixed(2)} MW`}<br><span>${feedLabel} · pixel ${detection.footprint} · not a perimeter</span></div>`,
          )
          .addTo(group);
      });
    }

    if (layers.local) {
      L.polyline([AGIOS_ANTONIOS, MEGALOCHORI], {
        color: "#ffb347",
        weight: 2,
        opacity: 0.86,
        dashArray: "7 10",
      })
        .bindTooltip(
          "20:50 local report: scattered hotspots near Agios Antonios and in the direction of Megalochori · not a continuous fire perimeter",
          { sticky: true },
        )
        .addTo(group);
      [AGIOS_ANTONIOS, midpoint(AGIOS_ANTONIOS, MEGALOCHORI)].forEach(
        (point, index) => {
          L.circle(point, {
            radius: index === 0 ? 420 : 650,
            color: "#ffb347",
            weight: 2,
            fillColor: "#ff6a32",
            fillOpacity: 0.08,
            dashArray: "5 8",
          })
            .bindPopup(
              '<div class="popup-copy"><strong>REPORTED HOTSPOT AREA</strong><br>Observed in local field reporting at 20:50.<br><span>Approximate only · not an official perimeter or live flame location.</span></div>',
            )
            .addTo(group);
        },
      );
      L.marker(AGIOS_ANTONIOS, {
        interactive: false,
        icon: L.divIcon({
          className: "marker-shell",
          html: markerHtml("arrow", "HOTSPOTS · 20:50"),
          iconSize: [170, 30],
          iconAnchor: [16, 15],
        }),
      }).addTo(group);
    }

    if (layers.wind) {
      const windVectors = [
        { label: "10 m", vector: fireWind.wind10, length: 2, opacity: 1 },
        { label: "80 m", vector: fireWind.wind80, length: 2.4, opacity: 0.72 },
        { label: "120 m", vector: fireWind.wind120, length: 2.8, opacity: 0.55 },
        { label: "180 m", vector: fireWind.wind180, length: 3.2, opacity: 0.38 },
      ];
      windVectors.forEach(({ label, vector, length, opacity }) => {
        const toward = (vector.directionDeg + 180) % 360;
        const windStart = destination(INCIDENT, vector.directionDeg, 0.85);
        const windEnd = destination(INCIDENT, toward, length);
        L.polyline([windStart, INCIDENT, windEnd], {
          color: "#55ddff",
          weight: label === "10 m" ? 3 : 2,
          opacity,
          dashArray: label === "10 m" ? "5 7" : "3 9",
        })
          .bindTooltip(
            `${label} Open-Meteo point model: from ${String(Math.round(vector.directionDeg)).padStart(3, "0")}° (${compass(vector.directionDeg)}) toward ${compass(toward)} · ${vector.speedKmh.toFixed(1)} km/h · valid ${windObservedTime} Greece`,
            { sticky: true },
          )
          .addTo(group);
      });
      const windEnd = destination(INCIDENT, downwindHeading, 2);
      L.marker(windEnd, {
        interactive: false,
        icon: L.divIcon({
          className: "marker-shell",
          html: markerHtml(
            "wind",
            `10 m → ${compass(downwindHeading)} · ${fireWind.wind10.speedKmh.toFixed(0)} km/h`,
          ),
          iconSize: [190, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(group);

      if (windData?.metar) {
        const metar = windData.metar;
        L.marker([39.054, 26.604], {
          icon: L.divIcon({
            className: "marker-shell",
            html: markerHtml(
              "wind",
              `LGMT ${metar.speedKt}G${metar.gustKt ?? "—"} kt`,
            ),
            iconSize: [170, 30],
            iconAnchor: [15, 15],
          }),
        })
          .bindPopup(
            `<div class="popup-copy"><strong>LGMT MEASURED WIND</strong><br>${Math.round(metar.directionDeg)}° · ${metar.speedKt} kt · gust ${metar.gustKt ?? "—"} kt<br><span>Observed ${formatGreeceTime(metar.observedAt)} Greece at Mytilene airport; conditions at the fire can differ.<br>${metar.raw}</span></div>`,
          )
          .addTo(group);
      }
    }

    if (layers.smoke) {
      const outer = scenarioShape(
        INCIDENT,
        downwindHeading,
        smokeDistance,
        34,
      );
      const core = scenarioShape(
        INCIDENT,
        downwindHeading,
        smokeDistance * 0.68,
        17,
      );
      L.polygon(outer, {
        color: "#b9a4ff",
        weight: 2,
        fillColor: "#b9a4ff",
        fillOpacity: 0.08,
        dashArray: "7 8",
      })
        .bindTooltip(
          `Modeled smoke-transport proxy · ${smokeMinutes} min · ${smokeDistance.toFixed(1)} km at 10 m model wind · not measured PM2.5 or fire spread`,
          { sticky: true },
        )
        .addTo(group);
      L.polygon(core, {
        color: "#d4c7ff",
        weight: 1.5,
        fillColor: "#b9a4ff",
        fillOpacity: 0.13,
        dashArray: "4 7",
      })
        .bindTooltip(
          "Higher-confidence centerline of an illustrative wind-driven envelope · terrain and fire behavior are not modeled",
          { sticky: true },
        )
        .addTo(group);
    }

    if (layers.simulation && hour > 0) {
      const polygon = scenarioShape(INCIDENT, heading, scenarioDistance);
      L.polygon(polygon, {
        color: "#ffcf4a",
        weight: 2,
        fillColor: "#ff6a32",
        fillOpacity: 0.15,
        dashArray: "5 7",
      })
        .bindTooltip(
          `WHAT-IF ONLY · +${hour}h · ${beaufort} Bft · not a forecast`,
          { sticky: true },
        )
        .addTo(group);
    }

  }, [
    ready,
    layers,
    hour,
    heading,
    beaufort,
    scenarioDistance,
    fireWind,
    windData,
    windObservedTime,
    downwindHeading,
    smokeDistance,
    smokeMinutes,
    thermalDetections,
    usingLiveThermal,
  ]);

  const toggleLayer = (key: LayerKey) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  };

  const focusPoint = (point: LatLngTuple, zoom = 15) => {
    mapRef.current?.flyTo(point, zoom, { duration: 0.65 });
  };

  const showOperationalView = () => {
    mapRef.current?.fitBounds(
      [MELINTA, MEGALOCHORI, MILIES, PLOMARI_BEACH, AGIOS_ISIDOROS],
      {
        padding: [42, 42],
        animate: true,
        duration: 0.65,
      },
    );
  };

  return (
    <main className="command-shell">
      <div className="map-stage">
        <div
          ref={mapElement}
          className={`map map--${baseMode}`}
          aria-label="Interactive Plomari wildfire operational map"
        />
        {!ready && <div className="map-loading">ACQUIRING MAP…</div>}
        <div className="scanline" aria-hidden="true" />
        <div className="reticle" aria-hidden="true">
          <span />
        </div>
      </div>

      {!online && (
        <div className="offline-banner">
          OFFLINE — DISPLAYING THE LAST AVAILABLE SNAPSHOT
        </div>
      )}

      <header className="top-hud">
        <div className="brand-lockup">
          <div className="brand-line">
            <span className="live-dot" aria-hidden="true" />
            <h1>FIREWATCH // PLOMARI</h1>
          </div>
          <p>LOCAL INCIDENT PICTURE · MULTISOURCE OSINT</p>
        </div>

        <div className="classification">PUBLIC SAFETY // NO OFFICIAL ALL-CLEAR</div>

        <div className="clock-block">
          <span>GREECE LOCAL</span>
          <strong>{clock || "--:--:--"}</strong>
          <small>STATUS REVIEW 22:00</small>
        </div>
      </header>

      <section className="evacuation-banner" aria-label="Official evacuation order">
        <div className="evacuation-code">112</div>
        <div>
          <strong>LATEST 112: PLOMARI BEACH → AGIOS ISIDOROS</strong>
          <span>
            Issued 16:58 · no official cancellation found at 22:00. Follow
            authorities on the ground; this map does not certify a route.{" "}
            <a
              className="official-alert-link"
              href="https://x.com/112Greece/status/2082468150189167080"
              target="_blank"
              rel="noreferrer"
            >
              Official alert ↗
            </a>
          </span>
        </div>
        <a href="tel:112">CALL 112</a>
      </section>

      <nav className="view-controls" aria-label="Map style">
        {(["dark", "satellite", "terrain"] as BaseMode[]).map((mode) => (
          <button
            type="button"
            key={mode}
            className={baseMode === mode ? "is-active" : ""}
            onClick={() => setBaseMode(mode)}
          >
            {mode}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="panel-toggle panel-toggle--left"
        onClick={() =>
          setPanelOpen((value) => {
            const next = !value;
            if (next && compact) setIntelOpen(false);
            return next;
          })
        }
        aria-expanded={panelOpen}
      >
        {panelOpen ? "HIDE LAYERS" : "LAYERS"}
      </button>

      {panelOpen && (
        <aside className="layer-hud">
          <div className="hud-heading">
            <div>
              <span>DATA LAYERS</span>
              <small>6 LAYERS // SOURCE + FRESHNESS VISIBLE</small>
            </div>
            <button type="button" onClick={showOperationalView}>
              FRAME
            </button>
          </div>

          <div className="layer-stack">
            {[
              {
                key: "official" as LayerKey,
                icon: "→",
                label: "112 evacuation",
                detail: "Official · 16:58",
                count: "1",
              },
              {
                key: "satellite" as LayerKey,
                icon: "✦",
                label: "Thermal detections",
                detail: usingLiveThermal
                  ? `NASA FIRMS live · latest ${latestThermalTime} · polls 5 min`
                  : `NASA FIRMS ${thermalStatus.toLowerCase()} · latest ${latestThermalTime}`,
                count: String(thermalDetections.length),
              },
              {
                key: "local" as LayerKey,
                icon: "△",
                label: "Reported hotspots",
                detail: "Local field report · 20:50",
                count: "2",
              },
              {
                key: "wind" as LayerKey,
                icon: "↙",
                label: "Wind profile",
                detail: `Model valid ${windObservedTime} · polls 5 min`,
                count: "4",
              },
              {
                key: "smoke" as LayerKey,
                icon: "≈",
                label: "Smoke transport proxy",
                detail: "Modeled wind envelope · not PM2.5",
                count: `${smokeMinutes}m`,
              },
              {
                key: "simulation" as LayerKey,
                icon: "◇",
                label: "What-if envelope",
                detail: "Simulation · never route from this",
                count: "SIM",
              },
            ].map((layer) => (
              <button
                type="button"
                className={`layer-control ${layers[layer.key] ? "is-enabled" : ""}`}
                key={layer.key}
                onClick={() => toggleLayer(layer.key)}
                aria-pressed={layers[layer.key]}
              >
                <span className="layer-icon">{layer.icon}</span>
                <span className="layer-copy">
                  <strong>{layer.label}</strong>
                  <small>{layer.detail}</small>
                </span>
                <span className="layer-count">{layer.count}</span>
                <span className="switch" aria-hidden="true">
                  <i />
                </span>
              </button>
            ))}
          </div>

          <div className="position-actions">
            <button type="button" onClick={() => focusPoint(INCIDENT, 15)}>
              INCIDENT
            </button>
            <button type="button" onClick={() => focusPoint(PLOMARI_BEACH, 15)}>
              PLOMARI
            </button>
            <button type="button" onClick={() => focusPoint(PERAMA, 15)}>
              PERAMA
            </button>
          </div>

          <div className="wind-readout">
            <div className="wind-readout__head">
              <span>FIRE-GRID WIND MODEL</span>
              <strong className={windError ? "is-stale" : ""}>
                {windError ? "SNAPSHOT / RETRYING" : `VALID ${windObservedTime}`}
              </strong>
            </div>
            {[
              ["10 m", fireWind.wind10],
              ["80 m", fireWind.wind80],
              ["120 m", fireWind.wind120],
              ["180 m", fireWind.wind180],
            ].map(([height, vector]) => {
              const typedVector = vector as WindVector;
              return (
                <div className="wind-row" key={height as string}>
                  <span>{height as string}</span>
                  <b>
                    FROM {String(Math.round(typedVector.directionDeg)).padStart(3, "0")}°
                  </b>
                  <strong>{typedVector.speedKmh.toFixed(1)} km/h</strong>
                </div>
              );
            })}
            <div className="wind-row wind-row--hazard">
              <span>GUST</span>
              <b>MODEL</b>
              <strong>{fireWind.gustKmh.toFixed(1)} km/h</strong>
            </div>
            <div className="wind-row">
              <span>RH / PBL</span>
              <b>{fireWind.rhPct}%</b>
              <strong>{Math.round(fireWind.pblM)} m</strong>
            </div>
            {windData?.metar && (
              <div className="metar-line">
                <span>LGMT MEASURED · {formatGreeceTime(windData.metar.observedAt)}</span>
                <strong>
                  {windData.metar.directionDeg}° {windData.metar.speedKt}G
                  {windData.metar.gustKt ?? "—"} kt
                </strong>
              </div>
            )}
            <label className="smoke-horizon">
              <span>
                Smoke proxy horizon <b>{smokeMinutes} min</b>
              </span>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={smokeMinutes}
                onChange={(event) => setSmokeMinutes(Number(event.target.value))}
              />
            </label>
            <p>
              From {compass(fireWind.wind10.directionDeg)} toward{" "}
              {compass(downwindHeading)}. Point-model wind is not fire spread;
              terrain and gusts can change local flow. Retrieved{" "}
              {retrievedTime === "—" ? "pending" : `${retrievedTime} Greece`}.
            </p>
          </div>
        </aside>
      )}

      <button
        type="button"
        className="panel-toggle panel-toggle--right"
        onClick={() =>
          setIntelOpen((value) => {
            const next = !value;
            if (next && compact) setPanelOpen(false);
            return next;
          })
        }
        aria-expanded={intelOpen}
      >
        {intelOpen ? "HIDE INTEL" : "INTEL"}
      </button>

      {intelOpen && (
        <aside className="intel-hud">
          <div className="hud-heading">
            <div>
              <span>INCIDENT WIRE</span>
              <small>GREECE TIME // NEWEST FIRST</small>
            </div>
            <span className="recording-dot">REC</span>
          </div>

          <div className="intel-list">
            {intel.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === activeIntel ? "intel-item is-active" : "intel-item"}
                onClick={() => setActiveIntel(item.id)}
              >
                <time>{item.time}</time>
                <span>
                  <strong>{item.label}</strong>
                  <small>{confidenceLabel(item.confidence)}</small>
                </span>
              </button>
            ))}
          </div>

          <div className={`intel-detail intel-detail--${active.confidence}`}>
            <span>{confidenceLabel(active.confidence)}</span>
            <strong>{active.label}</strong>
            <p>{active.detail}</p>
          </div>

          <div className="source-links">
            {sources.map((source) => (
              <a
                key={source.label}
                href={source.href}
                target="_blank"
                rel="noreferrer"
              >
                <span>{source.label}</span>
                <small>{source.kind} ↗</small>
              </a>
            ))}
          </div>
        </aside>
      )}

      {layers.simulation && (
        <section className="scenario-hud" aria-label="What-if simulation controls">
          <div className="scenario-title">
            <span>SCENARIO ENGINE</span>
            <strong>WHAT-IF ONLY · NOT A FORECAST</strong>
          </div>
          <label>
            <span>
              Horizon <b>+{hour}h</b>
            </span>
            <input
              type="range"
              min="0"
              max="6"
              step="1"
              value={hour}
              onChange={(event) => setHour(Number(event.target.value))}
            />
          </label>
          <label>
            <span>
              Wind <b>{beaufort} Bft</b>
            </span>
            <input
              type="range"
              min="3"
              max="7"
              step="1"
              value={beaufort}
              onChange={(event) => setBeaufort(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Heading</span>
            <select
              value={heading}
              onChange={(event) => setHeading(Number(event.target.value))}
            >
              <option value="218">SW · modeled downwind</option>
              <option value="180">S · Plomari</option>
              <option value="270">W · Melinta</option>
              <option value="135">SE · Agios Isidoros</option>
            </select>
          </label>
          <div className="scenario-distance">
            <span>Illustrative head</span>
            <b>{scenarioDistance} km</b>
          </div>
        </section>
      )}

      <section className="mission-hud" aria-label="Current operating picture">
        <div className="mission-primary">
          <span>OFFICIAL STATUS</span>
          <strong>NO OFFICIAL ALL-CLEAR</strong>
          <small>Latest 112 instruction 16:58 · reviewed 22:00</small>
        </div>
        <div>
          <span>THERMAL · {thermalStatus}</span>
          <strong>
            {thermalDetections.length} {usingLiveThermal ? "LIVE" : "SNAPSHOT"}{" "}
            PIXELS
          </strong>
          <small>
            Latest pass {latestThermalTime} Greece ·{" "}
            {usingLiveThermal ? "auto-refresh 5 min" : "live feed unavailable"}
          </small>
        </div>
        <div>
          <span>FIRE-GRID MODEL · {windObservedTime}</span>
          <strong>
            {compass(fireWind.wind10.directionDeg)} → {compass(downwindHeading)} ·{" "}
            {fireWind.wind10.speedKmh.toFixed(0)} km/h
          </strong>
          <small>Gust {fireWind.gustKmh.toFixed(0)} km/h · model, not sensor</small>
        </div>
        <div>
          <span>NIGHT OPERATIONS · LOCAL REPORT</span>
          <strong>SCATTERED HOTSPOTS</strong>
          <small>Agios Antonios → Megalochori · aerial drops ended</small>
        </div>
      </section>

      <div className="confidence-legend" aria-label="Confidence legend">
        <span><i className="official-dot" />OFFICIAL</span>
        <span><i className="observed-dot" />OBSERVED</span>
        <span><i className="reported-dot" />REPORTED</span>
        <span><i className="modeled-dot" />MODELED / SIM</span>
      </div>

      <footer className="system-footer">
        <span>NOT AN OFFICIAL EMERGENCY PRODUCT</span>
        <span>
          Interface baseline inspired by{" "}
          <a
            href="https://github.com/VrushankPatel/godseye"
            target="_blank"
            rel="noreferrer"
          >
            Godseye
          </a>
          . Authorities override every map layer.
        </span>
      </footer>
    </main>
  );
}
