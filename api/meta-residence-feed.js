const SITE_URL = "https://www.reskonnect.org";

const COLUMNS = [
  "Residence ID",
  "Residence Name",
  "Slug",
  "Campus",
  "Area / City",
  "Address",
  "Student Segment",
  "Accreditation / Verification",
  "NSFAS Accepted",
  "Private Accepted",
  "TVET Accepted",
  "University Accepted",
  "Room Type",
  "Single Rooms Available",
  "Sharing Rooms Available",
  "Monthly Price (R)",
  "NSFAS Price (R)",
  "Private Price (R)",
  "Available Spots",
  "2027 Reservations Open",
  "Application URL",
  "Residence Page URL",
  "Image URL",
  "Virtual Tour URL",
  "Current Status",
  "Published to Meta",
  "Last Updated",
  "Source of Truth",
];

const FALLBACK_SUPABASE_URL = "https://mefjzkhobkltlbmhusdh.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZmp6a2hvYmtsdGxibWh1c2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE5ODYsImV4cCI6MjA3NTg4Nzk4Nn0.h9VlKqtA4QMidLh_FbIiNviZRzeLe4OsBs1omh3Jy6U";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  return { url, key };
}

async function fetchResidences() {
  const { url, key } = getSupabaseConfig();
  const select = [
    "id",
    "name",
    "slug",
    "campus",
    "city",
    "address",
    "price",
    "private_price",
    "nsfas_price",
    "available_spots",
    "accepts_tvet",
    "accepts_university",
    "accepts_private",
    "accepts_nsfas",
    "is_tut_accredited",
    "verification_level",
    "reservations_2027_open",
    "cover_image_url",
    "image_url",
    "room_type",
    "room_types",
    "singles_available",
    "updated_at",
  ].join(",");

  const endpoint = new URL(`${url}/rest/v1/residences`);
  endpoint.searchParams.set("select", select);
  endpoint.searchParams.set("is_visible", "eq.true");
  endpoint.searchParams.set("order", "campus.asc.nullslast,name.asc");
  endpoint.searchParams.set("limit", "5000");

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase residence feed query failed: ${response.status} ${detail.slice(0, 240)}`);
  }
  return response.json();
}

const asText = (value) => value == null ? "" : String(value).trim();
const yesNo = (value) => value === true ? "Yes" : value === false ? "No" : "";

function audience(row) {
  const student = row.accepts_tvet === true || row.accepts_university === true || row.accepts_nsfas === true;
  const privateTenant = row.accepts_private === true;
  if (student && privateTenant) return "Both";
  if (privateTenant) return "Private Tenant";
  return "Student";
}

function accreditation(row) {
  if (row.is_tut_accredited === true) return "TUT Accredited";
  const level = asText(row.verification_level).toLowerCase();
  if (/(verified|trusted|premium|partner)/.test(level)) return "Verified Partner";
  return "";
}

function roomType(row) {
  if (Array.isArray(row.room_types) && row.room_types.length) {
    return row.room_types.map(asText).filter(Boolean).join(", ");
  }
  return asText(row.room_type);
}

function singleAvailability(row) {
  if (typeof row.singles_available === "boolean") return yesNo(row.singles_available);
  if (typeof row.singles_available === "number") return row.singles_available > 0 ? "Yes" : "No";
  return "";
}

function status(row) {
  if (row.available_spots !== null && row.available_spots !== undefined && row.available_spots !== "") {
    const spots = Number(row.available_spots);
    if (Number.isFinite(spots) && spots <= 0) return "Full";
  }
  return "Active";
}

function publicUrl(row) {
  const slug = asText(row.slug);
  return slug ? `${SITE_URL}/find-my-res/${encodeURIComponent(slug)}` : "";
}

function imageUrl(row) {
  return asText(row.cover_image_url || row.image_url);
}

function toFeedRow(row) {
  const page = publicUrl(row);
  return [
    asText(row.id),
    asText(row.name),
    asText(row.slug),
    asText(row.campus),
    asText(row.city),
    asText(row.address),
    audience(row),
    accreditation(row),
    yesNo(row.accepts_nsfas),
    yesNo(row.accepts_private),
    yesNo(row.accepts_tvet),
    yesNo(row.accepts_university),
    roomType(row),
    singleAvailability(row),
    "",
    row.price ?? "",
    row.nsfas_price ?? "",
    row.private_price ?? "",
    row.available_spots ?? "",
    yesNo(row.reservations_2027_open),
    page,
    page,
    imageUrl(row),
    "",
    status(row),
    "Yes",
    asText(row.updated_at),
    "Supabase residences table",
  ];
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows, includeHeader) {
  const output = includeHeader ? [COLUMNS, ...rows] : rows;
  return output.map((row) => row.map(csvCell).join(",")).join("\n");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=900");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-ResKonnect-Feed-Source", "Supabase residences");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const residences = await fetchResidences();
    const rows = residences.map(toFeedRow);
    const format = typeof req.query?.format === "string" ? req.query.format.toLowerCase() : "csv";
    const includeHeader = String(req.query?.header || "") === "1";

    if (format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({
        source: "Supabase residences",
        generated_at: new Date().toISOString(),
        row_count: rows.length,
        columns: COLUMNS,
        rows,
      });
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="reskonnect-live-residence-feed.csv"');
    return res.status(200).send(toCsv(rows, includeHeader));
  } catch (error) {
    console.error("meta residence feed failed", error);
    const message = error instanceof Error ? error.message : "Feed unavailable";
    if ((req.query?.format || "").toString().toLowerCase() === "json") {
      return res.status(503).json({ error: "Residence feed unavailable", detail: message });
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(503).send("");
  }
}
