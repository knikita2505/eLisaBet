/** Все даты на сайте — по московскому времени (участники в РФ) */
const APP_TIMEZONE = "Europe/Moscow";

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date(iso));
}

export function formatTime(iso: string | null) {
  if (!iso) return null;
  return formatDateTime(iso);
}

/** Для input[type=datetime-local] в московском поясе */
export function toDatetimeLocalValue(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Парсит datetime-local как московское время → ISO UTC */
export function fromDatetimeLocalValue(value: string) {
  return new Date(`${value}:00+03:00`).toISOString();
}

