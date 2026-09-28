export const toUtcDate = (dateStr?: string | number | null): Date => {
  if (!dateStr) return new Date();

  if (typeof dateStr === "number") {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  let str = String(dateStr).trim();
  if (!str || str === "undefined" || str === "null" || str === "Invalid Date") return new Date();

  if (/^\d+$/.test(str)) {
    const d = new Date(Number(str));
    if (!isNaN(d.getTime())) return d;
  }

  // Handle SQLite "YYYY-MM-DD HH:MM:SS" format
  if (str.includes(" ") && !str.includes("T")) {
    str = str.replace(" ", "T");
  }
  if (!str.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str += "Z";
  }

  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  d = new Date(String(dateStr));
  return isNaN(d.getTime()) ? new Date() : d;
};

export const formatDate = (
  dateStr?: string | number | null,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }
): string => {
  const d = toUtcDate(dateStr);
  return d.toLocaleDateString("en-IN", options);
};

export const formatDateTime = (
  dateStr?: string | number | null,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }
): string => {
  const d = toUtcDate(dateStr);
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
};

