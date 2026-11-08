export const businessCategoryIds = [
  "hair_salon",
  "barber",
  "beauty_salon",
  "nail_studio",
  "spa_wellness",
  "dental_clinic",
  "medical_clinic",
  "fitness",
  "photography",
  "automotive",
  "other",
] as const;

export type BusinessCategory = typeof businessCategoryIds[number];
export type LocalizedText = { al: string; en: string };
export type Service = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  price: number;
  durationMinutes: number;
  active: boolean;
};
export type WorkingDay = {
  weekday: number;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};
export type Business = {
  id: string;
  ownerEmail: string | null;
  name: LocalizedText;
  category: BusinessCategory;
  phone: string;
  city: string;
  address: string;
  email: string;
  description: LocalizedText;
  imageUrl: string;
  schedule: WorkingDay[];
  closures: string[];
  services: Service[];
  featured: boolean;
  isPublished: boolean;
  isActive: boolean;
  createdAt: string;
};
export type AppointmentStatus = "confirmed" | "cancelled" | "completed";
export type Appointment = {
  id: string;
  businessId: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: string;
  time: string;
  price: number;
  status: AppointmentStatus;
};

export const weekdays = [
  { al: "E diel", en: "Sunday" },
  { al: "E hënë", en: "Monday" },
  { al: "E martë", en: "Tuesday" },
  { al: "E mërkurë", en: "Wednesday" },
  { al: "E enjte", en: "Thursday" },
  { al: "E premte", en: "Friday" },
  { al: "E shtunë", en: "Saturday" },
] as const;

export const defaultSchedule: WorkingDay[] = weekdays.map((_, weekday) => ({
  weekday,
  isClosed: weekday === 0,
  opensAt: weekday === 6 ? "10:00" : "09:00",
  closesAt: weekday === 6 ? "14:00" : "17:00",
}));

function localized(al: string, en: string): LocalizedText {
  return { al, en };
}

function makeService(
  id: string,
  nameAl: string,
  nameEn: string,
  descriptionAl: string,
  descriptionEn: string,
  price: number,
  durationMinutes: number,
): Service {
  return {
    id,
    name: localized(nameAl, nameEn),
    description: localized(descriptionAl, descriptionEn),
    price,
    durationMinutes,
    active: true,
  };
}

function makeBusiness(
  id: string,
  nameAl: string,
  nameEn: string,
  category: BusinessCategory,
  phone: string,
  city: string,
  descriptionAl: string,
  descriptionEn: string,
  createdAt: string,
  services: Service[],
): Business {
  return {
    id,
    ownerEmail: null,
    name: localized(nameAl, nameEn),
    category,
    phone,
    city,
    address: city,
    email: "",
    description: localized(descriptionAl, descriptionEn),
    imageUrl: "",
    schedule: defaultSchedule,
    closures: [],
    services,
    featured: id !== "sample-urban-dental",
    isPublished: true,
    isActive: true,
    createdAt,
  };
}

export const sampleBusinesses: Business[] = [
  makeBusiness(
    "sample-studio-form",
    "Studio Form",
    "Studio Form",
    "hair_salon",
    "+383 38 555 101",
    "Prishtinë",
    "Prerje flokësh me stil dhe kujdes profesional.",
    "Thoughtful haircuts and expert styling.",
    "2026-10-24T09:00:00.000Z",
    [
      makeService("sample-studio-cut", "Prerje dhe stilim", "Cut & style", "Larje, prerje dhe stilim sipas dëshirës.", "A tailored wash, cut and finish.", 28, 45),
      makeService("sample-studio-color", "Ngjyrosje flokësh", "Hair colour", "Ngjyrë profesionale dhe rezultat natyral.", "Professional colour for a natural finish.", 65, 90),
    ],
  ),
  makeBusiness(
    "sample-atolye-nails",
    "Atolye Nails",
    "Atolye Nails",
    "nail_studio",
    "+383 38 555 102",
    "Prishtinë",
    "Manikyr i kujdesshëm dhe ngjyra për çdo ditë.",
    "Considered manicures and colour for every day.",
    "2026-10-29T09:00:00.000Z",
    [makeService("sample-atolye-mani", "Manikyr klasik", "Classic manicure", "Thonj të rregulluar bukur, me rezultat afatgjatë.", "A clean, polished look that lasts.", 24, 50)],
  ),
  makeBusiness(
    "sample-vita-wellness",
    "Vita Wellness",
    "Vita Wellness",
    "spa_wellness",
    "+383 38 555 103",
    "Prizren",
    "Trajtime rigjeneruese për trupin dhe mendjen.",
    "Restorative treatments for body and mind.",
    "2026-11-02T09:00:00.000Z",
    [makeService("sample-vita-massage", "Masazh relaksues", "Relaxation massage", "Një masazh i plotë për t'u çlodhur.", "A restorative full-body massage.", 55, 60)],
  ),
  makeBusiness(
    "sample-urban-dental",
    "Urban Dental",
    "Urban Dental",
    "dental_clinic",
    "+383 38 555 104",
    "Prishtinë",
    "Kujdes i besueshëm dentar me takime të lehta.",
    "Trusted dental care with straightforward appointments.",
    "2026-11-05T09:00:00.000Z",
    [makeService("sample-urban-checkup", "Kontroll dentar", "Dental check-up", "Kontroll rutinë dhe këshilla për kujdesin dentar.", "A routine examination and personalised advice.", 30, 30)],
  ),
];

export const sampleAppointments: Appointment[] = [];

export function makeId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getAvailableSlots(
  business: Business,
  service: Service,
  date: string,
  appointments: Appointment[],
): string[] {
  if (!business.isActive || !business.isPublished || business.closures.includes(date)) return [];
  const day = new Date(`${date}T12:00:00`).getDay();
  const hours = business.schedule.find((schedule) => schedule.weekday === day);
  if (!hours || hours.isClosed) return [];

  const opensAt = toMinutes(hours.opensAt);
  const closesAt = toMinutes(hours.closesAt);
  if (opensAt === null || closesAt === null || closesAt <= opensAt) return [];

  const existingAppointments = appointments.filter(
    (appointment) => appointment.businessId === business.id
      && appointment.date === date
      && appointment.status !== "cancelled",
  );
  const isToday = date === getLocalDateString();
  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const slots: string[] = [];
  for (let startsAt = opensAt; startsAt + service.durationMinutes <= closesAt; startsAt += 30) {
    if (isToday && startsAt <= currentMinute) continue;
    const endsAt = startsAt + service.durationMinutes;
    const hasConflict = existingAppointments.some((appointment) => {
      const bookedStart = toMinutes(appointment.time);
      if (bookedStart === null) return false;
      const bookedEnd = bookedStart + appointment.durationMinutes;
      return startsAt < bookedEnd && endsAt > bookedStart;
    });
    if (!hasConflict) slots.push(toTime(startsAt));
  }
  return slots;
}

export function toMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatTime(time: string, language: "al" | "en"): string {
  const minutes = toMinutes(time);
  if (minutes === null) return time;
  const hours24 = Math.floor(minutes / 60);
  const hours12 = hours24 % 12 || 12;
  const formattedMinutes = String(minutes % 60).padStart(2, "0");
  if (language === "al") return `${String(hours12).padStart(2, "0")}:${formattedMinutes}`;
  return `${hours12}:${formattedMinutes} ${hours24 < 12 ? "AM" : "PM"}`;
}
