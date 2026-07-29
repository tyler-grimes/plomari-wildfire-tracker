const FIRMS_ENDPOINT = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const FIRMS_DOCS =
  "https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html";
const FIRMS_MAP_KEY_SIGNUP = "https://firms.modaps.eosdis.nasa.gov/api/map_key/";

// Whole-island Lesvos bounding box (west, south, east, north) so the feed
// covers the Plomari incident plus any new starts elsewhere on the island.
const LESVOS_BBOX = "25.80,38.75,26.75,39.45";
const DAY_RANGE = 1;

// Near-real-time sources with distinct overpass schedules. MODIS is coarser
// but adds Terra/Aqua passes between VIIRS overpasses.
const SOURCES = [
  "VIIRS_SNPP_NRT",
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
  "MODIS_NRT",
] as const;

type FirmsSource = (typeof SOURCES)[number];

export type FirmsDetection = {
  id: string;
  lat: number;
  lon: number;
  /** ISO 8601 UTC acquisition time; format client-side for Greece local. */
  acquiredAt: string;
  sensor: string;
  source: FirmsSource;
  /** "low" | "nominal" | "high" for VIIRS, "NN%" for MODIS. */
  confidence: string;
  /** Fire radiative power in MW; null when the field is missing. */
  frp: number | null;
  /** Approximate pixel footprint, e.g. "0.54 × 0.51 km". */
  footprint: string;
  daynight: "day" | "night" | null;
};

class UpstreamHttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = "UpstreamHttpError";
    this.status = status;
  }
}

function sensorLabel(instrument: string, satellite: string): string {
  if (instrument === "VIIRS") {
    if (satellite === "N") return "Suomi-NPP VIIRS";
    if (satellite === "1" || satellite === "N20") return "NOAA-20 VIIRS";
    if (satellite === "2" || satellite === "N21") return "NOAA-21 VIIRS";
    return `${satellite} VIIRS`;
  }
  if (instrument === "MODIS") {
    if (satellite === "T" || satellite === "Terra") return "Terra MODIS";
    if (satellite === "A" || satellite === "Aqua") return "Aqua MODIS";
    return `${satellite} MODIS`;
  }
  return `${satellite} ${instrument}`.trim();
}

function confidenceLabel(raw: string, instrument: string): string {
  if (instrument === "VIIRS") {
    if (raw === "l" || raw === "low") return "low";
    if (raw === "n" || raw === "nominal") return "nominal";
    if (raw === "h" || raw === "high") return "high";
    return raw;
  }
  const percent = Number(raw);
  return Number.isFinite(percent) ? `${Math.round(percent)}%` : raw;
}

function isoAcquisitionTime(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const hhmm = time.padStart(4, "0");
  if (!/^\d{4}$/.test(hhmm)) return null;
  const iso = `${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((column) => column.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((column, index) => {
      row[column] = (cells[index] ?? "").trim();
    });
    return row;
  });
}

function normalizeRows(
  rows: Array<Record<string, string>>,
  source: FirmsSource,
): FirmsDetection[] {
  const detections: FirmsDetection[] = [];
  rows.forEach((row, index) => {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    const acquiredAt = isoAcquisitionTime(row.acq_date ?? "", row.acq_time ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !acquiredAt) return;

    const instrument = row.instrument ?? "";
    const scan = Number(row.scan);
    const track = Number(row.track);
    const frp = Number(row.frp);
    const daynight =
      row.daynight === "D" ? "day" : row.daynight === "N" ? "night" : null;

    detections.push({
      id: `${source}-${row.acq_date}-${row.acq_time}-${index}`,
      lat,
      lon,
      acquiredAt,
      sensor: sensorLabel(instrument, row.satellite ?? ""),
      source,
      confidence: confidenceLabel(row.confidence ?? "", instrument),
      frp: Number.isFinite(frp) ? frp : null,
      footprint:
        Number.isFinite(scan) && Number.isFinite(track)
          ? `${scan.toFixed(2)} × ${track.toFixed(2)} km`
          : "unknown",
      daynight,
    });
  });
  return detections;
}

async function fetchSource(
  mapKey: string,
  source: FirmsSource,
): Promise<FirmsDetection[]> {
  const url = `${FIRMS_ENDPOINT}/${mapKey}/${source}/${LESVOS_BBOX}/${DAY_RANGE}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new UpstreamHttpError(response.status);
    }
    const body = await response.text();
    // FIRMS reports key/parameter problems as a 200 with a plain-text message.
    if (/invalid/i.test(body.slice(0, 200)) && !body.includes("latitude")) {
      throw new Error(body.slice(0, 200));
    }
    return normalizeRows(parseCsv(body), source);
  } finally {
    clearTimeout(timeout);
  }
}

function safeError(source: string, error: unknown): string {
  if (error instanceof UpstreamHttpError) {
    return `${source}: upstream returned HTTP ${error.status}`;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return `${source}: upstream request timed out`;
  }
  if (error instanceof Error && /invalid/i.test(error.message)) {
    return `${source}: FIRMS rejected the request (check FIRMS_MAP_KEY)`;
  }
  return `${source}: upstream data is temporarily unavailable`;
}

export async function GET() {
  const mapKey = process.env.FIRMS_MAP_KEY;

  if (!mapKey) {
    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        configured: false,
        detections: [],
        errors: [
          `FIRMS_MAP_KEY is not set. Request a free key at ${FIRMS_MAP_KEY_SIGNUP} and add it to the server environment.`,
        ],
        sources: { documentation: FIRMS_DOCS },
      },
      { status: 200 },
    );
  }

  const errors: string[] = [];
  const results = await Promise.allSettled(
    SOURCES.map((source) => fetchSource(mapKey, source)),
  );

  const detections: FirmsDetection[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      detections.push(...result.value);
    } else {
      errors.push(safeError(`FIRMS ${SOURCES[index]}`, result.reason));
    }
  });

  detections.sort(
    (a, b) => Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt),
  );

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      configured: true,
      bbox: LESVOS_BBOX,
      dayRange: DAY_RANGE,
      detections,
      errors,
      sources: { data: FIRMS_ENDPOINT, documentation: FIRMS_DOCS },
    },
    {
      headers: {
        // FIRMS refreshes roughly every few minutes after processing; a short
        // shared cache keeps the app near-real-time while respecting the
        // 5000-transactions-per-10-minutes MAP_KEY limit.
        "Cache-Control":
          "public, max-age=60, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
