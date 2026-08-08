const CHECK_IN_TIME_ZONE = "America/Sao_Paulo";

export function isWeeklyCheckInAvailable(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: CHECK_IN_TIME_ZONE }).format(date) === "Mon";
}

export function nextCheckInDateLabel(date = new Date()) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(date.getTime() + offset * 86400000);
    if (isWeeklyCheckInAvailable(candidate)) {
      return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: CHECK_IN_TIME_ZONE }).format(candidate);
    }
  }
  return "segunda-feira";
}
