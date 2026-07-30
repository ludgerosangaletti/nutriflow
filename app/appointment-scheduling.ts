const DAY_SLOTS: Record<number, string[]> = {
  1: ["13:30", "14:30", "15:30", "16:30"],
  2: ["13:30", "14:30", "15:30", "16:30"],
  3: ["07:00", "08:00", "09:00", "10:00", "11:00"],
  4: ["13:30", "14:30", "15:30", "16:30"],
  5: ["13:30", "14:30"],
};

export function normalizeBrazilPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return digits ? `55${digits}` : "";
}

export function formatAppointment(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function availableAppointmentSlots(
  occupied: string[],
  now = new Date(),
  limit = 10,
) {
  const occupiedTimes = occupied.map((value) => new Date(value).getTime());
  const slots: string[] = [];
  const minimum = now.getTime() + 48 * 3_600_000;

  for (let offset = 0; offset < 28 && slots.length < limit; offset += 1) {
    const localDay = new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(now.getTime() + offset * 86_400_000)),
    );
    const day = localDay.getUTCDay();
    for (const time of DAY_SLOTS[day] || []) {
      const [hour, minute] = time.split(":").map(Number);
      const candidate = new Date(
        Date.UTC(
          localDay.getUTCFullYear(),
          localDay.getUTCMonth(),
          localDay.getUTCDate(),
          hour + 3,
          minute,
        ),
      );
      if (candidate.getTime() < minimum) continue;
      const overlaps = occupiedTimes.some(
        (used) => Math.abs(used - candidate.getTime()) < 3_600_000,
      );
      if (!overlaps) slots.push(candidate.toISOString());
      if (slots.length >= limit) break;
    }
  }
  return slots;
}

export function slotId(value: string) {
  return `retorno_slot_${new Date(value).getTime()}`;
}

export function slotFromId(value: string) {
  const match = /^retorno_slot_(\d{13})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
