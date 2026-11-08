"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { translations, type Language } from "@/lib/i18n";
import {
  businessCategoryIds,
  defaultSchedule,
  formatTime,
  getAvailableSlots,
  getLocalDateString,
  makeId,
  toMinutes,
  weekdays,
  type Appointment,
  type Business,
  type BusinessCategory,
  type Service,
  type WorkingDay,
} from "@/lib/platform";

type View = "home" | "profile" | "booking" | "register" | "onboarding" | "dashboard";
type BusinessFilter = BusinessCategory | "all";
type DashboardTab = "overview" | "upcoming" | "history" | "services" | "hours" | "profile";
type NavigationEntry = {
  view: View;
  businessId: string | null;
  serviceId: string | null;
  scrollY: number;
  index: number;
};
type BookingScrollTarget = "date-time" | "details" | "confirmation";
type DraftService = { id: string; name: string; description: string; price: string; duration: string };
type BusinessDraft = {
  name: string;
  category: BusinessCategory | "";
  phone: string;
  city: string;
  address: string;
  email: string;
  description: string;
  imageUrl: string;
  schedule: WorkingDay[];
  closures: string[];
  services: DraftService[];
};

const serviceSymbols = ["✂", "✳", "☼", "❋"];
const dashboardTabs: DashboardTab[] = ["overview", "upcoming", "history", "services", "hours", "profile"];
const BUSINESS_SELECT = "id,name,slug,business_type,phone,email,description,city,address,image_url,featured,is_published,is_active,schedule,closures,created_at,locations(id,business_id,name,address,phone,is_active),services(id,business_id,location_id,name,description,price,duration_minutes,is_active)";

type PersistedService = {
  id: string;
  business_id: string;
  location_id: string;
  name: unknown;
  description: unknown;
  price: number;
  duration_minutes: number;
  is_active: boolean;
};
type PersistedLocation = {
  id: string;
  business_id: string;
  address: string | null;
  phone: string;
  is_active: boolean;
};
type PersistedBusiness = {
  id: string;
  name: unknown;
  business_type: string;
  phone: string;
  email: string | null;
  description: unknown;
  city: string;
  address: string;
  image_url: string | null;
  schedule: unknown;
  closures: unknown;
  featured: boolean;
  is_published: boolean;
  is_active: boolean;
  created_at: string;
  locations?: PersistedLocation[];
  services?: PersistedService[];
};
type PersistedAppointment = {
  id: string;
  business_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  service_name: string;
  duration_minutes: number;
  price: number;
  appointment_date: string;
  start_time: string;
  status: string;
};

function blankDraftService(): DraftService {
  return { id: makeId("service"), name: "", description: "", price: "", duration: "" };
}

function blankBusinessDraft(): BusinessDraft {
  return {
    name: "",
    category: "",
    phone: "",
    city: "",
    address: "",
    email: "",
    description: "",
    imageUrl: "",
    schedule: defaultSchedule.map((day) => ({ ...day })),
    closures: [],
    services: [blankDraftService()],
  };
}

function sameText(value: string) {
  return { al: value, en: value };
}

function localizedText(value: unknown) {
  if (typeof value === "string") return sameText(value);
  if (value && typeof value === "object" && "al" in value && "en" in value) {
    const localized = value as { al: unknown; en: unknown };
    return {
      al: typeof localized.al === "string" ? localized.al : "",
      en: typeof localized.en === "string" ? localized.en : "",
    };
  }
  return sameText("");
}

function mapBusiness(row: PersistedBusiness, ownerEmail: string | null = null): Business {
  const location = row.locations?.find((item) => item.is_active) ?? row.locations?.[0];
  const savedSchedule = Array.isArray(row.schedule) ? row.schedule as WorkingDay[] : [];
  const schedule = defaultSchedule.map((fallback) => savedSchedule.find((item) => item.weekday === fallback.weekday) ?? fallback);
  const category = row.business_type === "barber" ? "barbershop" : row.business_type;

  return {
    id: row.id,
    ownerEmail,
    name: localizedText(row.name),
    category: businessCategoryIds.includes(category as BusinessCategory) ? category as BusinessCategory : "other",
    phone: row.phone,
    city: row.city ?? "",
    address: row.address || location?.address || "",
    email: row.email ?? "",
    description: localizedText(row.description),
    imageUrl: row.image_url ?? "",
    schedule,
    closures: Array.isArray(row.closures) ? row.closures.filter((date): date is string => typeof date === "string") : [],
    activeLocationIds: (row.locations ?? []).filter((item) => item.is_active && item.business_id === row.id).map((item) => item.id),
    services: (row.services ?? []).map((service) => ({
      id: service.id,
      businessId: service.business_id,
      locationId: service.location_id,
      name: localizedText(service.name),
      description: localizedText(service.description),
      price: Number(service.price),
      durationMinutes: Number(service.duration_minutes),
      active: service.is_active,
    })),
    featured: row.featured,
    isPublished: row.is_published,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function mapAppointment(row: PersistedAppointment): Appointment {
  const status: Appointment["status"] = row.status === "pending" || row.status === "cancelled" || row.status === "completed"
    ? row.status
    : "confirmed";
  return {
    id: row.id,
    businessId: row.business_id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMinutes: row.duration_minutes,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email ?? "",
    date: row.appointment_date,
    time: row.start_time.slice(0, 5),
    price: Number(row.price),
    status,
  };
}

function formatPrice(price: number, language: Language) {
  return language === "al" ? `${price} €` : `€${price}`;
}

function addMinutesToTime(time: string, duration: number) {
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + duration;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatDate(
  date: string,
  language: Language,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const day = parsed.getUTCDate();
  const monthIndex = parsed.getUTCMonth();
  const year = parsed.getUTCFullYear();
  const fullMonths = language === "al"
    ? ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const shortMonths = language === "al"
    ? ["jan", "shk", "mar", "pri", "maj", "qer", "kor", "gus", "sht", "tet", "nën", "dhj"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = options.month === "long" ? fullMonths[monthIndex] : shortMonths[monthIndex];
  if (!options.month) return String(day);
  if (!options.year) return `${month} ${day}`;
  return language === "al" ? `${day}. ${fullMonths[monthIndex]} ${year}` : `${month} ${day}, ${year}`;
}

function formatService(service: Service, language: Language) {
  return {
    name: service.name[language],
    description: service.description[language],
    duration: `${service.durationMinutes} min`,
  };
}

function safeImageStyle(imageUrl: string): CSSProperties {
  return imageUrl ? { backgroundImage: `url("${imageUrl.replace(/["\\\n\r]/g, "")}")` } : {};
}

export default function ReservoApp() {
  const [language, setLanguage] = useState<Language>("al");
  const [languageReady, setLanguageReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("all");
  const [search, setSearch] = useState("");
  const [bookingDate, setBookingDate] = useState(getLocalDateString());
  const [bookingTime, setBookingTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingAvailabilityLoading, setBookingAvailabilityLoading] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [registrationPasswordConfirm, setRegistrationPasswordConfirm] = useState("");
  const [accountMode, setAccountMode] = useState<"register" | "login">("register");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [draft, setDraft] = useState<BusinessDraft>(blankBusinessDraft);
  const [draftError, setDraftError] = useState("");
  const [newClosureDate, setNewClosureDate] = useState("");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("overview");
  const [serviceEditor, setServiceEditor] = useState<DraftService | null>(null);
  const [dashboardDraft, setDashboardDraft] = useState<Business | null>(null);
  const [dashboardMessage, setDashboardMessage] = useState("");
  const languageInitialized = useRef(false);
  const authenticatedUserId = useRef<string | null>(null);
  const navigationRef = useRef<NavigationEntry>({
    view: "home",
    businessId: null,
    serviceId: null,
    scrollY: 0,
    index: 0,
  });
  const pendingScrollRef = useRef<{
    type: "view" | "restore" | "section" | "booking";
    scrollY?: number;
    sectionId?: string;
    bookingTarget?: BookingScrollTarget;
  } | null>(null);
  const bookingDetailsRef = useRef<HTMLDivElement>(null);
  const bookingConfirmationRef = useRef<HTMLDivElement>(null);
  const bookingDateTimeRef = useRef<HTMLDivElement>(null);
  const [navigationVersion, setNavigationVersion] = useState(0);

  const t = translations[language];
  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId);
  const currentBusiness = businesses.find((business) => business.id === activeBusinessId);
  const selectedService = selectedBusiness?.services.find((service) => service.id === selectedServiceId);
  const today = getLocalDateString();
  const availableSlots = useMemo(() => selectedBusiness && selectedService
    ? getAvailableSlots(selectedBusiness, selectedService, bookingDate, appointments)
    : [], [selectedBusiness, selectedService, bookingDate, appointments]);

  function routeTo(
    nextView: View,
    options: {
      businessId?: string | null;
      serviceId?: string | null;
      history?: "push" | "replace";
      scrollTo?: string;
      scroll?: "top";
    } = {},
  ) {
    const current = navigationRef.current;
    const next: NavigationEntry = {
      view: nextView,
      businessId: options.businessId !== undefined ? options.businessId : nextView === "home" ? null : current.businessId,
      serviceId: options.serviceId !== undefined ? options.serviceId : nextView === "booking" ? current.serviceId : null,
      scrollY: 0,
      index: current.index,
    };
    const changed = next.view !== current.view
      || next.businessId !== current.businessId
      || next.serviceId !== current.serviceId
      || options.scrollTo !== undefined
      || (options.scroll === "top" && window.scrollY > 1);

    if (changed && options.history !== "replace") {
      const savedCurrent = { ...current, scrollY: window.scrollY };
      navigationRef.current = savedCurrent;
      window.history.replaceState({ ...window.history.state, reservoRoute: savedCurrent }, "");
      next.index = current.index + 1;
      window.history.pushState({ ...window.history.state, reservoRoute: next }, "");
    } else if (options.history === "replace") {
      window.history.replaceState({ ...window.history.state, reservoRoute: next }, "");
    }

    navigationRef.current = next;
    setView(nextView);
    setSelectedBusinessId(next.businessId);
    setSelectedServiceId(next.serviceId);
    const shouldScroll = changed || options.scrollTo !== undefined || options.scroll === "top";
    pendingScrollRef.current = shouldScroll
      ? options.scrollTo
        ? { type: "section", sectionId: options.scrollTo }
        : { type: "view" }
      : null;
    if (shouldScroll) setNavigationVersion((version) => version + 1);
  }

  function scrollBookingTo(target: BookingScrollTarget) {
    pendingScrollRef.current = { type: "booking", bookingTarget: target };
    setNavigationVersion((version) => version + 1);
  }

  useEffect(() => {
    if (!languageInitialized.current) {
      languageInitialized.current = true;
      const savedLanguage = window.localStorage.getItem("reservo-language");
      if (savedLanguage === "al" || savedLanguage === "en") setLanguage(savedLanguage);
    }
    setLanguageReady(true);
  }, []);

  useEffect(() => {
    if (!languageReady) return;
    window.localStorage.setItem("reservo-language", language);
    document.documentElement.lang = language === "al" ? "sq" : "en";
    document.title = t.metadata.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.metadata.description);
  }, [language, languageReady, t]);

  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;

    if (pending.type === "restore") {
      window.scrollTo({ top: pending.scrollY ?? 0, behavior: "instant" });
      return;
    }

    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (pending.type === "section") {
      document.getElementById(pending.sectionId ?? "")?.scrollIntoView({ behavior, block: "start" });
      return;
    }
    if (pending.type === "booking") {
      const targets: Record<BookingScrollTarget, HTMLDivElement | null> = {
        "date-time": bookingDateTimeRef.current,
        details: bookingDetailsRef.current,
        confirmation: bookingConfirmationRef.current,
      };
      targets[pending.bookingTarget ?? "details"]?.scrollIntoView({ behavior, block: "start" });
      return;
    }
    if (view === "home") {
      window.scrollTo({ top: 0, behavior });
      return;
    }

    const viewSelectors: Record<Exclude<View, "home">, string> = {
      profile: ".business-profile",
      booking: ".booking-page",
      register: ".account-page",
      onboarding: ".onboarding-page",
      dashboard: ".dashboard",
    };
    document.querySelector<HTMLElement>(viewSelectors[view])?.scrollIntoView({ behavior, block: "start" });
  }, [navigationVersion, view]);

  useEffect(() => {
    const current = navigationRef.current;
    window.history.replaceState({ ...window.history.state, reservoRoute: current }, "");
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    let scrollSaveFrame = 0;

    function saveCurrentScrollPosition() {
      if (scrollSaveFrame) return;
      scrollSaveFrame = window.requestAnimationFrame(() => {
        scrollSaveFrame = 0;
        const updatedEntry = { ...navigationRef.current, scrollY: window.scrollY };
        navigationRef.current = updatedEntry;
        window.history.replaceState({ ...window.history.state, reservoRoute: updatedEntry }, "");
      });
    }

    function restoreRoute(event: PopStateEvent) {
      const entry = (event.state as { reservoRoute?: NavigationEntry } | null)?.reservoRoute;
      if (!entry || !["home", "profile", "booking", "register", "onboarding", "dashboard"].includes(entry.view)) return;
      const restoredEntry = entry;
      function applyEntry() {
        navigationRef.current = restoredEntry;
        setView(restoredEntry.view);
        setSelectedBusinessId(restoredEntry.businessId);
        setSelectedServiceId(restoredEntry.serviceId);
        pendingScrollRef.current = { type: "restore", scrollY: restoredEntry.scrollY };
        setNavigationVersion((version) => version + 1);
      }

      if (restoredEntry.view === "dashboard" || restoredEntry.view === "onboarding") {
        void supabase.auth.getSession().then(({ data, error }) => {
          if (error) {
            setLoadError(error.message);
            return;
          }
          if (!data.session?.user) {
            setAccountMode("login");
            routeTo("register", { history: "replace", businessId: null, serviceId: null });
            return;
          }
          applyEntry();
        });
        return;
      }
      applyEntry();
    }

    window.addEventListener("popstate", restoreRoute);
    window.addEventListener("scroll", saveCurrentScrollPosition, { passive: true });
    return () => {
      window.removeEventListener("popstate", restoreRoute);
      window.removeEventListener("scroll", saveCurrentScrollPosition);
      if (scrollSaveFrame) window.cancelAnimationFrame(scrollSaveFrame);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    if (bookingConfirmed) return;
    if (bookingTime && !availableSlots.includes(bookingTime)) setBookingTime("");
  }, [availableSlots, bookingConfirmed, bookingTime]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        authenticatedUserId.current = null;
        setActiveBusinessId(null);
        setDashboardDraft(null);
        setAppointments([]);
        setBusinesses((previous) => previous.filter((business) => business.isActive && business.isPublished));
        setRegistrationEmail("");
        setRegistrationPassword("");
        setRegistrationPasswordConfirm("");
        routeTo("home", { history: "replace", businessId: null, serviceId: null });
        return;
      }
      if (session?.user && (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED")) {
        window.setTimeout(() => {
          if (authenticatedUserId.current && authenticatedUserId.current !== session.user.id) {
            setActiveBusinessId(null);
            setDashboardDraft(null);
            setAppointments([]);
            setBusinesses((previous) => previous.filter((business) => business.isActive && business.isPublished));
          }
          authenticatedUserId.current = session.user.id;
          void openOwnerWorkspace(session.user.id, session.user.email ?? null);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPublicBusinesses() {
      const { data, error } = await supabase
        .from("businesses")
        .select(BUSINESS_SELECT)
        .eq("is_published", true)
        .eq("is_active", true);
      if (!active) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setLoadError("");
      setBusinesses((previous) => {
        const owned = previous.filter((business) => business.id === activeBusinessId);
        const publicListings = ((data ?? []) as unknown as PersistedBusiness[]).map((row) => mapBusiness(row));
        return [...publicListings.filter((item) => !owned.some((owner) => owner.id === item.id)), ...owned];
      });
    }
    void loadPublicBusinesses();
    return () => { active = false; };
  }, [activeBusinessId]);

  useEffect(() => {
    if (view !== "booking" || !selectedBusiness || bookingConfirmed) return;
    const business = selectedBusiness;
    let active = true;
    setBookingAvailabilityLoading(true);
    async function loadBookedTimes() {
      const { data, error } = await supabase
        .rpc("get_public_appointment_availability", {
          p_business_id: business.id,
          p_appointment_date: bookingDate,
        });
      if (!active) return;
      if (error) {
        console.error("Could not load public appointment availability:", error);
        setFormError(t.booking.availabilityError);
        setBookingAvailabilityLoading(false);
        return;
      }
      const reservations = ((data ?? []) as { start_time: string; duration_minutes: number }[]).map((item) => ({
        id: `reserved-${business.id}-${bookingDate}-${item.start_time}`,
        businessId: business.id,
        serviceId: "",
        serviceName: "",
        durationMinutes: item.duration_minutes,
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        date: bookingDate,
        time: item.start_time.slice(0, 5),
        price: 0,
        status: "pending" as const,
      }));
      setAppointments((previous) => [
        ...previous.filter((appointment) =>
          appointment.businessId !== business.id || !appointment.id.startsWith("reserved-")
        ),
        ...reservations,
      ]);
      setBookingAvailabilityLoading(false);
    }
    void loadBookedTimes();
    return () => { active = false; };
  }, [bookingDate, bookingConfirmed, selectedBusiness, t.booking.availabilityError, view]);

  const publicBusinesses = useMemo(() => businesses.filter(
    (business) => business.isActive && business.isPublished,
  ), [businesses]);
  const matchingBusinesses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(language === "al" ? "sq-AL" : "en-US");
    return publicBusinesses.filter((business) => {
      const categoryMatches = businessFilter === "all" || business.category === businessFilter;
      const serviceNames = business.services.flatMap((service) => [service.name.al, service.name.en]).join(" ");
      const searchable = [
        business.name.al,
        business.name.en,
        business.description.al,
        business.description.en,
        business.city,
        business.address,
        serviceNames,
        t.businessCategories[business.category],
      ].join(" ").toLocaleLowerCase(language === "al" ? "sq-AL" : "en-US");
      return categoryMatches && searchable.includes(query);
    });
  }, [businessFilter, language, publicBusinesses, search, t.businessCategories]);
  const recentlyAdded = [...matchingBusinesses.filter((business) => !business.featured)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const featuredBusinesses = matchingBusinesses.filter((business) => business.featured).slice(0, 3);

  function navigate(nextView: View) {
    if (nextView === "dashboard") {
      setMobileMenu(false);
      void goToDashboard();
      return;
    }
    setMobileMenu(false);
    setFormError("");
    setDraftError("");
    setDashboardMessage("");
    routeTo(nextView, nextView === "home" ? { scroll: "top" } : {});
  }

  function goBack(fallback: View) {
    if (navigationRef.current.index > 0) {
      window.history.back();
      return;
    }
    routeTo(fallback, {
      businessId: fallback === "home" ? null : navigationRef.current.businessId,
      serviceId: null,
      history: "replace",
    });
  }

  function navigateToSection(id: string) {
    setMobileMenu(false);
    routeTo("home", { scrollTo: id });
  }

  async function openOwnerWorkspace(userId: string, email: string | null, destination: "dashboard" | "onboarding" = "dashboard") {
    setAuthBusy(true);
    setLoadError("");
    const { data, error } = await supabase
      .from("businesses")
      .select(BUSINESS_SELECT)
      .eq("created_by", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      setAuthBusy(false);
      setLoadError(error.message);
      return;
    }
    authenticatedUserId.current = userId;

    const businessRow = data as unknown as PersistedBusiness | null;
    if (!businessRow) {
      setActiveBusinessId(null);
      setDashboardDraft(null);
      setRegistrationEmail(email ?? "");
      setDraft(blankBusinessDraft());
      setOnboardingStep(0);
      routeTo("onboarding", { businessId: null, serviceId: null });
      setAuthBusy(false);
      return;
    }

    const business = mapBusiness(businessRow, email);
    const { data: bookingRows, error: bookingError } = await supabase
      .from("appointments")
      .select("id,business_id,service_id,customer_name,customer_phone,customer_email,service_name,duration_minutes,price,appointment_date,start_time,status")
      .eq("business_id", business.id)
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (bookingError) setLoadError(bookingError.message);
    else setAppointments(((bookingRows ?? []) as unknown as PersistedAppointment[]).map(mapAppointment));
    setBusinesses((previous) => [...previous.filter((item) => item.id !== business.id), business]);
    setActiveBusinessId(business.id);
    setDashboardDraft(business);
    if (navigationRef.current.view !== "dashboard" || navigationRef.current.businessId !== business.id) {
      setDashboardTab("overview");
    }
    setRegistrationEmail(email ?? "");
    routeTo(destination, { businessId: business.id, serviceId: null });
    setAuthBusy(false);
  }

  async function goToDashboard() {
    setLoadError("");
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setLoadError(error.message);
      return;
    }
    if (!data.session?.user) {
      setAccountMode("login");
      setAuthNotice("");
      setFormError("");
      routeTo("register");
      return;
    }
    await openOwnerWorkspace(data.session.user.id, data.session.user.email ?? null);
  }

  function chooseLanguage(option: Language) {
    languageInitialized.current = true;
    setLanguageReady(true);
    setLanguage(option);
  }

  function openBusiness(business: Business) {
    setMobileMenu(false);
    setFormError("");
    routeTo("profile", { businessId: business.id, serviceId: null });
  }

  function startBooking(business: Business, service: Service) {
    if (!business.isActive || !business.isPublished || !service.active) {
      setFormError(t.booking.noBusiness);
      return;
    }
    setBookingDate(today);
    setBookingTime("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setBookingConfirmed(false);
    setConfirmedAppointment(null);
    setFormError("");
    routeTo("booking", { businessId: business.id, serviceId: service.id });
  }

  async function confirmBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBusiness || !selectedService || !selectedBusiness.isPublished || !selectedBusiness.isActive) {
      setFormError(t.booking.noBusiness);
      return;
    }
    const appointmentDate = new Date(`${bookingDate}T00:00:00`);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(bookingDate)
      && !Number.isNaN(appointmentDate.getTime())
      && getLocalDateString(appointmentDate) === bookingDate
      && bookingDate >= today;
    const startMinutes = toMinutes(bookingTime);
    const endTime = addMinutesToTime(bookingTime, selectedService.durationMinutes);
    const endMinutes = toMinutes(endTime);
    const validService = selectedService.businessId === selectedBusiness.id
      && selectedService.active
      && Number.isFinite(selectedService.price)
      && selectedService.price >= 0
      && Number.isInteger(selectedService.durationMinutes)
      && selectedService.durationMinutes > 0
      && selectedBusiness.activeLocationIds.includes(selectedService.locationId);

    if (!validDate || !validService || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      setFormError(t.booking.invalidSelection);
      return;
    }
    if (!customerName.trim() || customerPhone.replace(/\D/g, "").length < 7 || !bookingTime) {
      setFormError(t.booking.phoneError);
      return;
    }
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setFormError(t.booking.formError);
      return;
    }
    if (!getAvailableSlots(selectedBusiness, selectedService, bookingDate, appointments).includes(bookingTime)) {
      setFormError(t.booking.unavailable);
      return;
    }
    setBookingBusy(true);
    const { data: currentService, error: serviceError } = await supabase.from("services")
      .select("id,business_id,location_id,price,duration_minutes,is_active")
      .eq("id", selectedService.id)
      .eq("business_id", selectedBusiness.id)
      .maybeSingle();
    if (serviceError || !currentService || !currentService.is_active
      || currentService.location_id !== selectedService.locationId
      || !selectedBusiness.activeLocationIds.includes(currentService.location_id)) {
      if (serviceError) console.error("Could not verify the selected booking service:", serviceError);
      setFormError(t.booking.invalidSelection);
      setBookingBusy(false);
      return;
    }
    const { data: currentLocation, error: locationError } = await supabase.from("locations")
      .select("id,business_id,is_active")
      .eq("id", currentService.location_id)
      .eq("business_id", selectedBusiness.id)
      .maybeSingle();
    if (locationError || !currentLocation?.is_active) {
      if (locationError) console.error("Could not verify the selected booking location:", locationError);
      setFormError(t.booking.invalidSelection);
      setBookingBusy(false);
      return;
    }

    const currentPrice = Number(currentService.price);
    const currentDuration = Number(currentService.duration_minutes);
    if (!Number.isFinite(currentPrice) || currentPrice < 0
      || !Number.isInteger(currentDuration) || currentDuration <= 0
      || currentPrice !== selectedService.price || currentDuration !== selectedService.durationMinutes) {
      setFormError(t.booking.invalidSelection);
      setBookingBusy(false);
      return;
    }
    if (!getAvailableSlots(selectedBusiness, selectedService, bookingDate, appointments).includes(bookingTime)) {
      setFormError(t.booking.unavailable);
      setBookingBusy(false);
      return;
    }

    const { error } = await supabase.from("appointments").insert({
      business_id: selectedBusiness.id,
      service_id: selectedService.id,
      location_id: currentLocation.id,
      service_name: selectedService.name.en,
      duration_minutes: currentDuration,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_email: customerEmail.trim() || null,
      appointment_date: bookingDate,
      start_time: bookingTime,
      end_time: endTime,
      price: currentPrice,
      status: "pending",
    });
    if (error) {
      console.error("Could not save guest appointment:", error);
      setFormError(error.code === "42501" || error.message.toLowerCase().includes("row-level security")
        ? t.booking.policyError
        : t.booking.bookingFailed);
      setBookingBusy(false);
      return;
    }
    const appointment: Appointment = {
      id: makeId("appointment"),
      businessId: selectedBusiness.id,
      serviceId: selectedService.id,
      serviceName: selectedService.name.en,
      durationMinutes: currentDuration,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      date: bookingDate,
      time: bookingTime,
      price: currentPrice,
      status: "pending",
    };
    setAppointments((previous) => [...previous, appointment]);
    setConfirmedAppointment(appointment);
    setBookingConfirmed(true);
    setFormError("");
    setBookingBusy(false);
    scrollBookingTo("confirmation");
  }

 
async function registerBusiness(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (registrationPassword.length < 8) {
    setFormError(t.registration.passwordTooShort);
    return;
  }

  if (registrationPassword !== registrationPasswordConfirm) {
    setFormError(t.registration.passwordMismatch);
    return;
  }

  setFormError("");
  setAuthNotice("");
  setAuthBusy(true);

  const { data, error } = await supabase.auth.signUp({
    email: registrationEmail.trim().toLowerCase(),
    password: registrationPassword,
    options: { emailRedirectTo: window.location.origin },
  });

  if (error) {
    setFormError(error.message);
    setAuthBusy(false);
    return;
  }

  if (!data.session || !data.user) {
    setRegistrationPassword("");
    setRegistrationPasswordConfirm("");
    setAuthNotice(t.registration.confirmationSent);
    setAccountMode("login");
    setAuthBusy(false);
    return;
  }

  setRegistrationPassword("");
  setRegistrationPasswordConfirm("");
  await openOwnerWorkspace(data.user.id, data.user.email ?? null);
}

async function signInBusiness(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setFormError("");
  setAuthNotice("");
  setAuthBusy(true);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: registrationEmail.trim().toLowerCase(),
    password: registrationPassword,
  });
  if (error) {
    setFormError(error.message);
    setAuthBusy(false);
    return;
  }
  setRegistrationPassword("");
  await openOwnerWorkspace(data.user.id, data.user.email ?? null);
}


  function setDraftField<K extends keyof BusinessDraft>(key: K, value: BusinessDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function setDraftSchedule(weekday: number, change: Partial<WorkingDay>) {
    setDraft((previous) => ({
      ...previous,
      schedule: previous.schedule.map((day) => day.weekday === weekday ? { ...day, ...change } : day),
    }));
  }

  function updateDraftService(id: string, change: Partial<DraftService>) {
    setDraft((previous) => ({
      ...previous,
      services: previous.services.map((service) => service.id === id ? { ...service, ...change } : service),
    }));
  }

  function updateDashboardBusiness(change: Partial<Business>) {
    setDashboardDraft((previous) => previous ? { ...previous, ...change } : previous);
  }

  async function saveDashboardProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dashboardDraft || !activeBusinessId) return;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setDashboardMessage(authError?.message ?? t.dashboard.accessDenied);
      return;
    }
    const { error: businessError } = await supabase.from("businesses").update({
      name: sameText(dashboardDraft.name[language]),
      business_type: dashboardDraft.category === "barbershop" ? "barber" : dashboardDraft.category,
      phone: dashboardDraft.phone,
      email: dashboardDraft.email || null,
      description: sameText(dashboardDraft.description[language]),
      image_url: dashboardDraft.imageUrl || null,
      city: dashboardDraft.city,
      address: dashboardDraft.address || dashboardDraft.city,
    }).eq("id", activeBusinessId).eq("created_by", user.id).select("id").single();
    if (businessError) {
      setDashboardMessage(businessError.message);
      return;
    }
    await openOwnerWorkspace(activeBusinessId, registrationEmail);
    setDashboardMessage(t.dashboard.saved);
  }

  async function saveDashboardHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dashboardDraft || !activeBusinessId) return;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setDashboardMessage(authError?.message ?? t.dashboard.accessDenied);
      return;
    }
    const { error } = await supabase.from("businesses").update({
      schedule: dashboardDraft.schedule,
      closures: dashboardDraft.closures,
    }).eq("id", activeBusinessId).eq("created_by", user.id).select("id").single();
    if (error) {
      setDashboardMessage(error.message);
      return;
    }
    await openOwnerWorkspace(activeBusinessId, registrationEmail);
    setDashboardMessage(t.dashboard.saved);
  }

  async function changeAppointmentStatus(appointmentId: string, status: Appointment["status"]) {
    const { error } = await supabase.from("appointments").update({ status })
      .eq("id", appointmentId).eq("business_id", activeBusinessId).select("id").single();
    if (error) {
      setDashboardMessage(error.message);
      return;
    }
    setAppointments((previous) => previous.map((appointment) => appointment.id === appointmentId ? { ...appointment, status } : appointment));
  }

  async function saveDashboardService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceEditor || !activeBusinessId || !serviceEditor.name.trim()) return;
    const price = Number(serviceEditor.price);
    const durationMinutes = Number(serviceEditor.duration);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(durationMinutes) || durationMinutes < 1) return;
    const existing = currentBusiness?.services.some((service) => service.id === serviceEditor.id);
    let error: { message: string } | null = null;
    if (existing) {
      const { error: updateError } = await supabase.from("services").update({
        name: sameText(serviceEditor.name.trim()),
        description: sameText(serviceEditor.description.trim()),
        price,
        duration_minutes: durationMinutes,
      }).eq("id", serviceEditor.id).eq("business_id", activeBusinessId).select("id").single();
      error = updateError;
    } else {
      const { data: location, error: locationError } = await supabase.from("locations")
        .select("id").eq("business_id", activeBusinessId).eq("is_active", true).limit(1).single();
      if (locationError) {
        setDashboardMessage(locationError.message);
        return;
      }
      const { error: insertError } = await supabase.from("services").insert({
        business_id: activeBusinessId,
        location_id: location.id,
        name: sameText(serviceEditor.name.trim()),
        description: sameText(serviceEditor.description.trim()),
        price,
        duration_minutes: durationMinutes,
        is_active: true,
      }).select("id").single();
      error = insertError;
    }
    if (error) {
      setDashboardMessage(error.message);
      return;
    }
    setServiceEditor(null);
    await openOwnerWorkspace(activeBusinessId, registrationEmail);
    setDashboardMessage(t.dashboard.saved);
  }

  async function deleteDashboardService(serviceId: string) {
    if (!activeBusinessId) return;
    const { error } = await supabase.from("services").update({ is_active: false })
      .eq("business_id", activeBusinessId).eq("id", serviceId).select("id").single();
    if (error) {
      setDashboardMessage(error.message);
      return;
    }
    await openOwnerWorkspace(activeBusinessId, registrationEmail);
    setDashboardMessage(t.dashboard.saved);
  }

  async function toggleBusinessPublication() {
    if (!currentBusiness) return;
    const publish = !currentBusiness.isPublished;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setDashboardMessage(authError?.message ?? t.dashboard.accessDenied);
      return;
    }
    const { error } = await supabase.from("businesses")
      .update({ is_published: publish })
      .eq("id", currentBusiness.id).eq("created_by", user.id).select("id").single();
    if (error) {
      setDashboardMessage(error.message);
      return;
    }
    await openOwnerWorkspace(currentBusiness.id, registrationEmail);
    setDashboardMessage(t.dashboard.saved);
  }

  async function publishOnboarding() {
    if (!draft.category || draft.services.some((service) =>
      !service.name.trim() || !service.duration || Number(service.duration) < 1 || Number(service.price) < 0
    )) {
      setDraftError(t.onboarding.serviceRequired);
      setOnboardingStep(2);
      return;
    }

    setDraftError("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setDraftError(authError?.message ?? t.dashboard.accessDenied);
      return;
    }

    const slugBase = draft.name.trim().toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let createdBusinessId: string | null = null;
    try {
      const { data: savedBusiness, error: businessError } = await supabase
        .from("businesses")
        .insert({
          name: sameText(draft.name.trim()),
          slug: `${slugBase || "business"}-${crypto.randomUUID().slice(0, 8)}`,
          business_type: draft.category === "barbershop" ? "barber" : draft.category,
          phone: draft.phone.trim(),
          email: draft.email.trim() || null,
          description: sameText(draft.description.trim()),
          created_by: authData.user.id,
          is_active: true,
          city: draft.city.trim(),
          address: draft.address.trim() || draft.city.trim(),
          image_url: draft.imageUrl.trim(),
          featured: false,
          is_published: false,
          schedule: draft.schedule,
          closures: draft.closures,
        })
        .select("id")
        .single();
      if (businessError) throw businessError;
      createdBusinessId = savedBusiness.id;

      const { data: savedLocation, error: locationError } = await supabase
        .from("locations")
        .insert({
          business_id: savedBusiness.id,
          name: draft.name.trim(),
          address: draft.address.trim() || draft.city.trim(),
          phone: draft.phone.trim(),
          is_active: true,
        })
        .select("id")
        .single();
      if (locationError) throw locationError;

      const { error: serviceError } = await supabase.from("services").insert(
        draft.services.map((service) => ({
          business_id: savedBusiness.id,
          location_id: savedLocation.id,
          name: sameText(service.name.trim()),
          description: sameText(service.description.trim()),
          price: Number(service.price),
          duration_minutes: Number(service.duration),
          is_active: true,
        })),
      );
      if (serviceError) throw serviceError;

      const { error: publishError } = await supabase
        .from("businesses")
        .update({ is_published: true })
        .eq("id", savedBusiness.id)
        .eq("created_by", authData.user.id)
        .select("id")
        .single();
      if (publishError) throw publishError;

      await openOwnerWorkspace(authData.user.id, authData.user.email ?? null, "onboarding");
      setOnboardingStep(4);
      setDashboardMessage(t.onboarding.published);
    } catch (error) {
      if (createdBusinessId) {
        const { error: cleanupError } = await supabase.from("businesses").delete()
          .eq("id", createdBusinessId).eq("created_by", authData.user.id);
        if (cleanupError) console.error("Could not remove incomplete business setup:", cleanupError);
      }
      setDraftError(error instanceof Error ? error.message : "Something went wrong while saving your business.");
    }
  }

  async function signOutOwner() {
    const { error } = await supabase.auth.signOut();
    if (error) setLoadError(error.message);
  }

  function serviceEditorField(field: keyof DraftService, value: string) {
    setServiceEditor((previous) => previous ? { ...previous, [field]: value } : previous);
  }

  function renderBusinessCard(business: Business, index: number, isNew = false) {
    const name = business.name[language];
    const description = business.description[language] || t.profile.noDescription;
    const category = t.businessCategories[business.category];
    return (
      <article className="business-card" key={business.id}>
        <button className={`business-card-image business-image-${index % 4}`} style={safeImageStyle(business.imageUrl)} onClick={() => openBusiness(business)} aria-label={`${t.home.viewProfile}: ${name}`} type="button">
          {!business.imageUrl && <span className="business-initials">{name.trim().slice(0, 2).toLocaleUpperCase()}</span>}
          <span className="business-card-tag">{isNew ? t.home.newBusiness : t.home.featured}</span>
        </button>
        <div className="business-card-content">
          <div className="business-card-heading"><div><span className="business-category">{category}</span><h3>{name}</h3></div><span className="business-service-count">{business.services.filter((service) => service.active).length} {t.home.serviceCount}</span></div>
          <p>{description}</p>
          <div className="business-card-location">⌖ {business.city || business.address}</div>
          <button className="business-view-link" onClick={() => openBusiness(business)} type="button">{t.home.viewProfile}<span>→</span></button>
        </div>
      </article>
    );
  }

  function renderHours(schedule: WorkingDay[], onChange: (weekday: number, change: Partial<WorkingDay>) => void, editable: boolean) {
    return (
      <div className="hours-list">
        {weekdays.map((day, weekday) => {
          const hours = schedule.find((item) => item.weekday === weekday) ?? { weekday, isClosed: true, opensAt: "09:00", closesAt: "17:00" };
          return (
            <div className="hours-row" key={weekday}>
              <span className="hours-day">{day[language]}</span>
              {editable ? <label className="hours-open-toggle"><input type="checkbox" checked={!hours.isClosed} onChange={(event) => onChange(weekday, { isClosed: !event.target.checked })} /><span>{hours.isClosed ? t.onboarding.closed : t.onboarding.open}</span></label>
                : <span className={hours.isClosed ? "hours-status closed" : "hours-status"}>{hours.isClosed ? t.profile.closed : `${hours.opensAt} – ${hours.closesAt}`}</span>}
              {editable && !hours.isClosed && <>
                <label className="hours-time">{t.onboarding.opensAt}<input type="time" value={hours.opensAt} onChange={(event) => onChange(weekday, { opensAt: event.target.value })} required /></label>
                <label className="hours-time">{t.onboarding.closesAt}<input type="time" value={hours.closesAt} min={hours.opensAt} onChange={(event) => onChange(weekday, { closesAt: event.target.value })} required /></label>
              </>}
            </div>
          );
        })}
      </div>
    );
  }

  function renderAppointments(items: Appointment[], showActions: boolean) {
    if (items.length === 0) return <div className="dashboard-empty">{t.dashboard.noAppointments}</div>;
    return (
      <div className="appointments-list">
        {items.map((appointment) => {
          const service = currentBusiness?.services.find((item) => item.id === appointment.serviceId);
          const statusLabel = appointment.status === "completed" ? t.dashboard.statusCompleted
            : appointment.status === "cancelled" ? t.dashboard.statusCancelled
              : appointment.status === "pending" ? t.dashboard.statusPending
                : t.booking.confirmed;
          return (
            <article className="appointment-item" key={appointment.id}>
              <div className="appointment-date-block"><b>{formatDate(appointment.date, language, { day: "numeric" })}</b><span>{formatDate(appointment.date, language, { month: "short" })}</span></div>
              <div className="appointment-main"><b>{appointment.customerName}</b><span>{service?.name[language] ?? appointment.serviceName} · {formatTime(appointment.time, language)}</span><small>{appointment.customerPhone}{appointment.customerEmail ? ` · ${appointment.customerEmail}` : ""}</small></div>
              <span className={`status ${appointment.status === "confirmed" ? "confirmed-status" : appointment.status === "completed" ? "completed-status" : "pending-status"}`}>{statusLabel}</span>
              {showActions && (appointment.status === "pending" || appointment.status === "confirmed") && <div className="appointment-actions">
                {appointment.status === "pending" && <button type="button" onClick={() => changeAppointmentStatus(appointment.id, "confirmed")}>{t.dashboard.statusConfirmed}</button>}
                {appointment.status === "confirmed" && <button type="button" onClick={() => changeAppointmentStatus(appointment.id, "completed")}>{t.dashboard.statusCompleted}</button>}
                <button type="button" onClick={() => changeAppointmentStatus(appointment.id, "cancelled")}>{t.dashboard.statusCancelled}</button>
              </div>}
            </article>
          );
        })}
      </div>
    );
  }

  const dashboardTabLabels: Record<DashboardTab, string> = {
    overview: t.dashboard.overview,
    upcoming: t.dashboard.upcoming,
    history: t.dashboard.history,
    services: t.dashboard.servicesTab,
    hours: t.dashboard.hoursTab,
    profile: t.dashboard.profileTab,
  };

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} aria-label={t.nav.home} type="button"><span className="brand-mark">r</span><span>re<span className="brand-blue">servo</span></span></button>
        <nav className={mobileMenu ? "nav nav-open" : "nav"} aria-label={t.nav.primaryNavigation}>
          <button className={view === "home" || view === "profile" ? "nav-link active" : "nav-link"} onClick={() => navigate("home")} type="button">{t.nav.explore}</button>
          <button className={view === "dashboard" || view === "onboarding" ? "nav-link active" : "nav-link"} onClick={() => navigate("dashboard")} type="button">{t.nav.forBusinesses}</button>
          <button type="button" className="nav-link" onClick={() => navigateToSection("how")}>{t.nav.howItWorks}</button>
        </nav>
        <div className="language-switcher" role="group" aria-label={t.nav.chooseLanguage}>
          {(["al", "en"] as const).map((option) => <button key={option} type="button" className={language === option ? "language-option selected" : "language-option"} onClick={() => chooseLanguage(option)} aria-pressed={language === option}>{option.toUpperCase()}</button>)}
        </div>
        <div className="top-actions">
          {activeBusinessId ? <button className="text-button" onClick={() => navigate("dashboard")} type="button">{t.nav.businessPortal}</button> : <button className="primary small" onClick={() => navigate("register")} type="button">{t.nav.registerBusiness}<span>↗</span></button>}
        </div>
        <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label={t.nav.toggleMenu} aria-expanded={mobileMenu} type="button">☰</button>
      </header>
      {loadError && <p className="form-error global-error" role="alert">{loadError}</p>}

      {view === "home" && <>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="spark">✳</span>{t.hero.eyebrow}</div>
            <h1>{t.hero.titleLine}<br /><em>{t.hero.titleEmphasis}</em>{t.hero.titleEnding}</h1>
            <p className="hero-sub">{t.hero.description}</p>
            <div className="hero-search">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input aria-label={t.home.businessSearchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.home.businessSearchPlaceholder} />
              <button type="button" onClick={() => navigateToSection("discover")}>{t.hero.searchButton}<span>→</span></button>
            </div>
            <div className="trust-row"><div className="avatar-stack" aria-hidden="true"><i>J</i><i>M</i><i>A</i><i>+</i></div><span><b>{publicBusinesses.length}</b> {t.home.businessCount}</span></div>
          </div>
          <div className="hero-art" aria-label={t.hero.illustrationLabel}>
            <div className="art-glow" /><div className="art-card main-art">
              <div className="art-top"><span className="art-pill">{t.hero.appointmentPreview}</span><span className="dots">•••</span></div>
              <div className="art-date"><span>{t.hero.previewWeekday}</span><b>10</b><span>{t.hero.previewMonth}</span></div>
              <div className="art-rule" />
              <div className="art-service"><div className="service-avatar">✂</div><div><b>{t.services[0].name}</b><small>{t.hero.previewBusiness} · {t.services[0].duration}</small></div><span className="check">✓</span></div>
              <div className="art-bottom"><span>10:30</span><b>{t.booking.confirmed}</b></div>
            </div>
            <div className="floating-note"><span className="note-icon">✦</span><div><b>{t.hero.allSet}</b><small>{t.hero.bookingConfirmed}</small></div></div>
            <div className="floating-stats"><span className="stats-icon">↗</span><div><b>{t.hero.easyBooking}</b><small>{t.hero.fewClicks}</small></div></div>
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          </div>
        </section>

        <section className="metrics"><div><b>01</b><span>{t.home.steps[0]}</span></div><div><b>02</b><span>{t.home.steps[1]}</span></div><div><b>03</b><span>{t.home.steps[2]}</span></div><div className="metric-note">{t.home.metricNote}</div></section>

        <section className="discover section" id="discover">
          <div className="section-head"><div><div className="eyebrow">{t.home.businessesEyebrow}</div><h2>{t.home.businessesTitle}<br /><em>{t.home.businessesTitleEmphasis}</em></h2><p>{t.home.businessesDescription}</p></div><button className="view-all" onClick={() => { setBusinessFilter("all"); setSearch(""); }} type="button">{t.home.viewAll}<span>↗</span></button></div>
          <div className="business-search-row"><label className="category-select-label">{t.home.categoriesHeading}<select value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value as BusinessFilter)}><option value="all">{t.categories.all}</option>{businessCategoryIds.map((category) => <option key={category} value={category}>{t.businessCategories[category]}</option>)}</select></label>
            <div className="filters" role="group" aria-label={t.home.categoriesHeading}><button className={businessFilter === "all" ? "filter selected" : "filter"} onClick={() => setBusinessFilter("all")} type="button">{t.categories.all}</button>{businessCategoryIds.map((category) => <button key={category} className={businessFilter === category ? "filter selected" : "filter"} onClick={() => setBusinessFilter(category)} aria-pressed={businessFilter === category} type="button">{t.businessCategories[category]}</button>)}</div>
          </div>
          {matchingBusinesses.length === 0 ? <div className="empty business-empty"><span className="empty-icon">⌕</span><h3>{t.home.noBusinesses}</h3><p>{businessFilter === "all" ? t.home.registerPrompt : t.home.noCategoryBusinesses}</p>{businessFilter !== "all" && <button className="view-all" onClick={() => setBusinessFilter("all")} type="button">{t.home.viewAll}</button>}</div> : <>
            {featuredBusinesses.length > 0 && <><div className="business-section-heading"><div><div className="eyebrow">{t.home.featured}</div><h3>{t.home.featuredBusinesses}</h3></div><span>{featuredBusinesses.length} {t.home.businessCount}</span></div><div className="business-grid">{featuredBusinesses.map((business, index) => renderBusinessCard(business, index))}</div></>}
            {recentlyAdded.length > 0 && <><div className="business-section-heading recent-heading"><div><div className="eyebrow">{t.home.newBusiness}</div><h3>{t.home.recentlyAdded}</h3></div><span>{recentlyAdded.length} {t.home.businessCount}</span></div><div className="business-grid">{recentlyAdded.slice(0, 4).map((business, index) => renderBusinessCard(business, index, true))}</div></>}
          </>}
        </section>

        <section className="how section" id="how">
          <div className="how-intro"><div className="eyebrow">{t.home.howEyebrow}</div><h2>{t.home.howTitle}<br /><em>{t.home.howTitleEmphasis}</em></h2><p>{t.home.howDescription}</p></div>
          <div className="how-steps">{t.home.howSteps.map((step, index) => <div key={step.title}><span>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div><b>↗</b></div>)}</div>
        </section>

        <section className="benefits section">
          <div className="benefits-heading"><div className="eyebrow">{t.home.benefitsEyebrow}</div><h2>{t.home.benefitsTitle}<br /><em>{t.home.benefitsTitleEmphasis}</em></h2></div>
          <div className="benefits-grid">
            <article className="benefit-card customer-benefit"><span className="benefit-icon">✦</span><div className="eyebrow">{t.home.customerBenefitsLabel}</div><h3>{t.home.customerBenefitsTitle}</h3><p>{t.home.customerBenefitsDescription}</p><ul>{t.home.customerBenefits.map((benefit) => <li key={benefit}><span>✓</span>{benefit}</li>)}</ul></article>
            <article className="benefit-card business-benefit"><span className="benefit-icon">↗</span><div className="eyebrow">{t.home.businessBenefitsLabel}</div><h3>{t.home.businessBenefitsTitle}</h3><p>{t.home.businessBenefitsDescription}</p><ul>{t.home.businessBenefits.map((benefit) => <li key={benefit}><span>✓</span>{benefit}</li>)}</ul></article>
          </div>
        </section>

        <section className="business-cta">
          <div><div className="eyebrow light">{t.home.businessCtaEyebrow}</div><h2>{t.home.businessCtaTitle}<br /><em>{t.home.businessCtaTitleEmphasis}</em></h2><p>{t.home.businessCtaDescription}</p><button className="light-button" onClick={() => navigate("register")} type="button">{t.nav.registerBusiness}<span>→</span></button></div>
          <div className="cta-decoration"><div className="cta-ring" /><div className="mini-dashboard"><div className="mini-head"><span>{t.home.weekPreview}</span><b>↗</b></div><strong>24 <small>{t.home.appointments}</small></strong><div className="mini-bars">{[1, 2, 3, 4, 5, 6, 7].map((day) => <i key={day} />)}</div><div className="mini-foot">{t.home.weekdays.map((day) => <span key={day}>{day}</span>)}</div></div></div>
        </section>
      </>}

      {view === "profile" && selectedBusiness && <>
        <section className="business-profile section">
          <button type="button" className="back-link" onClick={() => goBack("home")}>← {t.profile.back}</button>
          <div className="profile-hero">
            <div className="profile-cover" style={safeImageStyle(selectedBusiness.imageUrl)}>{!selectedBusiness.imageUrl && <span>{selectedBusiness.name[language].slice(0, 1)}</span>}</div>
            <div className="profile-intro"><span className="business-category">{t.businessCategories[selectedBusiness.category]}</span><h1>{selectedBusiness.name[language]}</h1><p>{selectedBusiness.description[language] || t.profile.noDescription}</p><div className="profile-location">⌖ {selectedBusiness.city}{selectedBusiness.address && selectedBusiness.address !== selectedBusiness.city ? ` · ${selectedBusiness.address}` : ""}</div></div>
          </div>
          <div className="profile-layout"><div className="profile-services">
            <div className="business-section-heading"><div><div className="eyebrow">{t.profile.services}</div><h2>{t.profile.services}</h2></div></div>
            {selectedBusiness.services.filter((service) => service.active).length === 0 ? <div className="empty">{t.profile.noServices}</div> : selectedBusiness.services.filter((service) => service.active).map((service, index) => {
              const copy = formatService(service, language);
              return <article className="profile-service-card" key={service.id}><div className={`profile-service-icon service-visual-${index % 4}`}>{serviceSymbols[index % serviceSymbols.length]}</div><div className="profile-service-copy"><h3>{copy.name}</h3><p>{copy.description || t.profile.noDescription}</p><span>◷ {copy.duration}</span></div><div className="profile-service-action"><strong>{formatPrice(service.price, language)}</strong><button className="primary small" onClick={() => startBooking(selectedBusiness, service)} type="button">{t.profile.bookService}<span>→</span></button></div></article>;
            })}
          </div><aside className="profile-sidebar"><div className="profile-info-card"><div className="eyebrow">{t.profile.hours}</div>{renderHours(selectedBusiness.schedule, () => {}, false)}{selectedBusiness.closures.length > 0 && <p className="profile-closures">{t.onboarding.closures}: {selectedBusiness.closures.map((day) => formatDate(day, language)).join(", ")}</p>}</div><div className="profile-info-card"><div className="eyebrow">{t.profile.contact}</div><a href={`tel:${selectedBusiness.phone}`}>{selectedBusiness.phone}</a>{selectedBusiness.email && <a href={`mailto:${selectedBusiness.email}`}>{selectedBusiness.email}</a>}<p>{selectedBusiness.address || t.profile.noAddress}</p></div></aside></div>
        </section>
      </>}

      {view === "booking" && <section className="booking-page section">
        <button type="button" className="back-link" onClick={() => goBack(selectedBusiness ? "profile" : "home")}>← {t.booking.back}</button>
        {bookingConfirmed && selectedBusiness && selectedService ? <div className="success-card" ref={bookingConfirmationRef}>
          <div className="success-mark">✓</div><div className="eyebrow">{t.booking.successEyebrow}</div><h1>{t.booking.successTitle}<br /><em>{t.booking.successTitleEmphasis}</em></h1>
          <p>{t.booking.successDescription}</p>
          <div className="confirmation-details"><b>{selectedBusiness.name[language]}</b><span>{formatService(selectedService, language).name}</span><span>{formatDate(confirmedAppointment?.date ?? bookingDate, language)} · {formatTime(confirmedAppointment?.time ?? bookingTime, language)}</span><span>{t.booking.pending}</span><span>{confirmedAppointment?.customerName ?? customerName} · {confirmedAppointment?.customerPhone ?? customerPhone}</span>{(confirmedAppointment?.customerEmail || customerEmail) && <span>{confirmedAppointment?.customerEmail ?? customerEmail}</span>}<strong>{formatPrice(confirmedAppointment?.price ?? selectedService.price, language)}</strong><small>{t.booking.guestNote}</small></div>
          <button className="primary" onClick={() => navigate("home")} type="button">{t.booking.backToExplore} →</button>
        </div> : !selectedBusiness || !selectedService ? <div className="empty"><h2>{t.booking.noBusiness}</h2><button className="primary" onClick={() => navigate("home")} type="button">{t.booking.backToExplore}</button></div> : <form className="booking-layout" onSubmit={confirmBooking}>
          <div className="booking-main"><div className="eyebrow">{t.booking.eyebrow}</div><h1>{t.booking.title}<br /><em>{t.booking.titleEmphasis}</em></h1><p className="muted">{t.booking.description}</p><p className="guest-note">{t.booking.guestNote}</p>
            <div className="booking-block"><div className="block-title"><span>01</span><h3>{t.booking.business}</h3></div><div className="chosen-service"><div className="chosen-icon lavender">✦</div><div><b>{selectedBusiness.name[language]}</b><small>{t.businessCategories[selectedBusiness.category]} · {selectedBusiness.city}</small></div></div><div className="chosen-service"><div className="chosen-icon lavender">{serviceSymbols[0]}</div><div><b>{formatService(selectedService, language).name}</b><small>{formatService(selectedService, language).duration}</small></div><strong>{formatPrice(selectedService.price, language)}</strong></div><label className="field-label" htmlFor="booking-service">{t.booking.service}</label><select className="field" id="booking-service" value={selectedService.id} onChange={(event) => { setSelectedServiceId(event.target.value); setBookingTime(""); scrollBookingTo("date-time"); }}>{selectedBusiness.services.filter((service) => service.active && service.businessId === selectedBusiness.id && selectedBusiness.activeLocationIds.includes(service.locationId)).map((service) => <option key={service.id} value={service.id}>{formatService(service, language).name} · {formatPrice(service.price, language)}</option>)}</select></div>
            <div className="booking-block" id="booking-date-time" ref={bookingDateTimeRef}><div className="block-title"><span>02</span><h3>{t.booking.dateTime}</h3></div><label className="field-label" htmlFor="booking-date">{t.booking.date}</label><input className="field" id="booking-date" type="date" value={bookingDate} min={today} onChange={(event) => { setBookingDate(event.target.value); setBookingTime(""); }} required /><label className="field-label time-label">{t.booking.availableTimes}</label>
              {bookingAvailabilityLoading ? <div className="empty slots-empty">{t.booking.loadingSlots}</div> : availableSlots.length === 0 ? <div className="empty slots-empty">{t.booking.noSlots}</div> : <div className="time-grid">{availableSlots.map((slot) => <button key={slot} type="button" className={bookingTime === slot ? "time-slot picked" : "time-slot"} onClick={() => { setBookingTime(slot); scrollBookingTo("details"); }} aria-pressed={bookingTime === slot}>{formatTime(slot, language)}</button>)}</div>}
            </div>
            <div className="booking-block" id="booking-customer-details" ref={bookingDetailsRef}><div className="block-title"><span>03</span><h3>{t.booking.yourDetails}</h3></div><label className="field-label" htmlFor="customer-name">{t.booking.fullName}</label><input className="field" id="customer-name" autoComplete="name" placeholder={t.booking.namePlaceholder} value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /><label className="field-label" htmlFor="customer-phone">{t.booking.phoneNumber}</label><input className="field" id="customer-phone" type="tel" autoComplete="tel" inputMode="tel" minLength={7} pattern=".{7,}" placeholder={t.booking.phonePlaceholder} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required /><label className="field-label" htmlFor="customer-email">{t.booking.customerEmailOptional}</label><input className="field" id="customer-email" type="email" autoComplete="email" placeholder={t.booking.emailPlaceholder} value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></div>
          </div>
          <aside className="booking-summary"><div className="eyebrow">{t.booking.summaryEyebrow}</div><h3>{t.booking.summaryTitle}<br />{t.booking.summaryTitleEnding}</h3><div className="summary-line"><span>{t.booking.business}</span><b>{selectedBusiness.name[language]}</b></div><div className="summary-line"><span>{t.booking.service}</span><b>{formatService(selectedService, language).name}</b></div><div className="summary-line"><span>{t.booking.duration}</span><b>{formatService(selectedService, language).duration}</b></div><div className="summary-line"><span>{t.booking.date}</span><b>{formatDate(bookingDate, language)}</b></div><div className="summary-line"><span>{t.booking.time}</span><b>{bookingTime ? formatTime(bookingTime, language) : "—"}</b></div><div className="summary-total"><span>{t.booking.total}</span><strong>{formatPrice(selectedService.price, language)}</strong></div>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary full" type="submit" disabled={!bookingTime || bookingBusy || bookingAvailabilityLoading}>{bookingBusy ? t.booking.booking : t.booking.confirmBooking}<span>→</span></button><small className="secure-note">{t.booking.guestNote}</small></aside>
        </form>}
      </section>}

      {view === "register" && <section className="account-page section">
        <div className="account-card"><div className="eyebrow">{t.registration.eyebrow}</div><h1>{accountMode === "login" ? <>{t.registration.loginTitle}<br /><em>{t.registration.titleEmphasis}</em></> : <>{t.registration.title}<br /><em>{t.registration.titleEmphasis}</em></>}</h1><p className="muted">{accountMode === "login" ? t.registration.loginDescription : t.registration.description}</p>
          <form onSubmit={accountMode === "login" ? signInBusiness : registerBusiness}><label className="field-label" htmlFor="registration-email">{t.registration.email}</label><input className="field" id="registration-email" type="email" autoComplete="email" value={registrationEmail} onChange={(event) => setRegistrationEmail(event.target.value)} required /><label className="field-label" htmlFor="registration-password">{t.registration.password}</label><input className="field" id="registration-password" type="password" autoComplete={accountMode === "login" ? "current-password" : "new-password"} minLength={accountMode === "register" ? 8 : undefined} value={registrationPassword} onChange={(event) => setRegistrationPassword(event.target.value)} required />{accountMode === "register" && <><small className="field-hint">{t.registration.passwordHint}</small><label className="field-label" htmlFor="registration-password-confirm">{t.registration.confirmPassword}</label><input className="field" id="registration-password-confirm" type="password" autoComplete="new-password" minLength={8} value={registrationPasswordConfirm} onChange={(event) => setRegistrationPasswordConfirm(event.target.value)} required /></>}{formError && <p className="form-error" role="alert">{formError}</p>}{authNotice && <p className="success-notice" role="status">{authNotice}</p>}<button className="primary full" type="submit" disabled={authBusy}>{authBusy ? t.registration.working : accountMode === "login" ? t.registration.login : t.registration.submit}<span>→</span></button></form>
          <p className="account-switch">{accountMode === "login" ? t.registration.noAccount : t.registration.hasAccount} <button className="text-button" type="button" onClick={() => { setAccountMode(accountMode === "login" ? "register" : "login"); setFormError(""); setAuthNotice(""); setRegistrationPassword(""); setRegistrationPasswordConfirm(""); }}>{accountMode === "login" ? t.registration.createAccount : t.registration.login}</button></p>
        </div>
      </section>}

      {view === "onboarding" && <section className="onboarding-page section">
        <div className="onboarding-header"><div className="eyebrow">{onboardingStep === 4 ? t.onboarding.published : t.onboarding.eyebrow}</div><h1>{onboardingStep === 4 ? t.onboarding.successTitle : <>{t.onboarding.title}<br /><em>{t.onboarding.titleEmphasis}</em></>}</h1><p className="muted">{onboardingStep === 4 ? t.onboarding.successDescription : t.onboarding.description}</p></div>
        {onboardingStep === 4 ? <div className="success-card onboarding-success"><div className="success-mark">✓</div><div className="eyebrow">{t.onboarding.published}</div><p>{t.onboarding.publishingNote}</p><button className="primary" onClick={() => navigate("dashboard")} type="button">{t.onboarding.openDashboard}<span>→</span></button></div> : <>
          <div className="onboarding-steps">{t.onboarding.steps.map((step, index) => <button key={step} type="button" className={index === onboardingStep ? "onboarding-step current" : index < onboardingStep ? "onboarding-step complete" : "onboarding-step"} onClick={() => index < onboardingStep && setOnboardingStep(index)} disabled={index >= onboardingStep}><span>{index < onboardingStep ? "✓" : `0${index + 1}`}</span><b>{step}</b></button>)}</div>
          <form className="onboarding-card" onSubmit={(event) => { event.preventDefault(); if (onboardingStep < 3) { setOnboardingStep((step) => step + 1); setDraftError(""); } }}>
            <div className="onboarding-card-heading"><div className="eyebrow">{t.onboarding.stepLabel} 0{onboardingStep + 1} · {t.onboarding.steps[onboardingStep]}</div><p>{t.onboarding.account}: <b>{registrationEmail}</b></p></div>
            {onboardingStep === 0 && <div className="onboarding-grid">
              <label className="form-field span-two"><span>{t.onboarding.businessName}</span><input className="field" autoComplete="organization" placeholder={t.onboarding.businessNamePlaceholder} value={draft.name} onChange={(event) => setDraftField("name", event.target.value)} required /></label>
              <label className="form-field"><span>{t.onboarding.category}</span><select className="field" value={draft.category} onChange={(event) => setDraftField("category", event.target.value as BusinessCategory)} required><option value="">{t.onboarding.chooseCategory}</option>{businessCategoryIds.map((category) => <option key={category} value={category}>{t.businessCategories[category]}</option>)}</select></label>
              <label className="form-field"><span>{t.onboarding.phone}</span><input className="field" type="tel" autoComplete="tel" value={draft.phone} onChange={(event) => setDraftField("phone", event.target.value)} required /></label>
              <label className="form-field"><span>{t.onboarding.city}</span><input className="field" autoComplete="address-level2" placeholder={t.onboarding.cityPlaceholder} value={draft.city} onChange={(event) => setDraftField("city", event.target.value)} required /></label>
              <label className="form-field"><span>{t.onboarding.address}</span><input className="field" autoComplete="street-address" value={draft.address} onChange={(event) => setDraftField("address", event.target.value)} /></label>
              <label className="form-field"><span>{t.onboarding.businessEmail}</span><input className="field" type="email" autoComplete="email" value={draft.email} onChange={(event) => setDraftField("email", event.target.value)} /></label>
              <label className="form-field span-two"><span>{t.onboarding.descriptionLabel}</span><textarea className="field textarea" rows={3} placeholder={t.onboarding.descriptionPlaceholder} value={draft.description} onChange={(event) => setDraftField("description", event.target.value)} /></label>
              <label className="form-field span-two"><span>{t.onboarding.imageUrl}</span><input className="field" type="url" placeholder="https://" value={draft.imageUrl} onChange={(event) => setDraftField("imageUrl", event.target.value)} /><small>{t.onboarding.imageUrlHint}</small></label>
            </div>}
            {onboardingStep === 1 && <div className="schedule-editor"><p className="muted">{t.profile.hours}</p>{renderHours(draft.schedule, setDraftSchedule, true)}<div className="closures-editor"><h3>{t.onboarding.closures}</h3><p>{t.onboarding.closuresHint}</p><div className="closure-input"><input className="field" aria-label={t.onboarding.closures} type="date" min={today} value={newClosureDate} onChange={(event) => setNewClosureDate(event.target.value)} /><button className="secondary-button" type="button" onClick={() => { if (newClosureDate && !draft.closures.includes(newClosureDate)) setDraftField("closures", [...draft.closures, newClosureDate].sort()); setNewClosureDate(""); }}>{t.onboarding.addClosure}</button></div>{draft.closures.length === 0 ? <small>{t.onboarding.noClosures}</small> : <ul>{draft.closures.map((date) => <li key={date}>{formatDate(date, language)}<button type="button" aria-label={`${t.onboarding.removeClosure}: ${date}`} onClick={() => setDraftField("closures", draft.closures.filter((item) => item !== date))}>×</button></li>)}</ul>}</div></div>}
            {onboardingStep === 2 && <div className="service-editor-list">{draft.services.map((service, index) => <fieldset className="service-editor-card" key={service.id}><legend>{t.onboarding.serviceName} {index + 1}</legend>{draft.services.length > 1 && <button type="button" className="remove-service" onClick={() => setDraftField("services", draft.services.filter((item) => item.id !== service.id))}>{t.onboarding.removeService}</button>}<label className="form-field"><span>{t.onboarding.serviceName}</span><input className="field" placeholder={t.onboarding.serviceNamePlaceholder} value={service.name} onChange={(event) => updateDraftService(service.id, { name: event.target.value })} required /></label><label className="form-field"><span>{t.onboarding.serviceDescription}</span><input className="field" value={service.description} onChange={(event) => updateDraftService(service.id, { description: event.target.value })} /></label><div className="onboarding-grid service-numbers"><label className="form-field"><span>{t.onboarding.price}</span><input className="field" type="number" min="0" step="0.01" value={service.price} onChange={(event) => updateDraftService(service.id, { price: event.target.value })} required /></label><label className="form-field"><span>{t.onboarding.duration}</span><input className="field" type="number" min="1" step="1" value={service.duration} onChange={(event) => updateDraftService(service.id, { duration: event.target.value })} required /></label></div></fieldset>)}<button type="button" className="secondary-button" onClick={() => setDraftField("services", [...draft.services, blankDraftService()])}>＋ {t.onboarding.addService}</button></div>}
            {onboardingStep === 3 && <div className="review-content"><h2>{t.onboarding.reviewTitle}</h2><p className="muted">{t.onboarding.reviewDescription}</p><section className="review-section"><div className="review-section-heading"><h3>{t.onboarding.reviewBusiness}</h3><button type="button" onClick={() => setOnboardingStep(0)}>{t.onboarding.reviewEdit}</button></div><dl className="review-grid"><dt>{t.dashboard.businessName}</dt><dd>{draft.name}</dd><dt>{t.dashboard.category}</dt><dd>{draft.category ? t.businessCategories[draft.category] : ""}</dd><dt>{t.dashboard.phone}</dt><dd>{draft.phone}</dd><dt>{t.dashboard.city}</dt><dd>{draft.city}</dd><dt>{t.dashboard.address}</dt><dd>{draft.address || draft.city}</dd><dt>{t.dashboard.email}</dt><dd>{draft.email || "—"}</dd></dl></section><section className="review-section"><div className="review-section-heading"><h3>{t.onboarding.reviewHours}</h3><button type="button" onClick={() => setOnboardingStep(1)}>{t.onboarding.reviewEdit}</button></div>{renderHours(draft.schedule, () => {}, false)}<p>{t.onboarding.closures}: {draft.closures.length ? draft.closures.map((date) => formatDate(date, language)).join(", ") : t.onboarding.noClosures}</p></section><section className="review-section"><div className="review-section-heading"><h3>{t.onboarding.reviewServices}</h3><button type="button" onClick={() => setOnboardingStep(2)}>{t.onboarding.reviewEdit}</button></div>{draft.services.map((service) => <div className="review-service" key={service.id}><b>{service.name}</b><span>{service.duration} min</span><strong>{service.price} €</strong></div>)}</section><div className="notice-box">{t.onboarding.publishingNote}</div></div>}
            {draftError && <p className="form-error" role="alert">{draftError}</p>}
            <div className="onboarding-actions">{onboardingStep > 0 && <button type="button" className="secondary-button" onClick={() => { setOnboardingStep((step) => step - 1); setDraftError(""); }}>← {t.onboarding.previous}</button>}{onboardingStep < 3 ? <button type="submit" className="primary">{t.onboarding.next}<span>→</span></button> : <button type="button" className="primary" onClick={publishOnboarding}>{t.onboarding.publish}<span>→</span></button>}</div>
          </form>
        </>}
      </section>}

      {view === "dashboard" && currentBusiness && <>
        <section className="dashboard section">
          <div className="dashboard-notice"><span>{registrationEmail}</span><button onClick={() => { void signOutOwner(); }} type="button">{t.dashboard.signOut}</button></div>
          <div className="dash-top"><div><div className="eyebrow">{t.dashboard.eyebrow} · {currentBusiness.name[language]}</div><h1>{t.dashboard.title}<br /><em>{t.dashboard.titleEmphasis}</em></h1><p className="muted">{t.dashboard.description}</p></div><button className="primary" onClick={() => openBusiness(currentBusiness)} type="button">{t.dashboard.customerSite}<span>↗</span></button></div>
          <div className="dashboard-toolbar"><nav className="dashboard-tabs" aria-label={t.dashboard.quickActions}>{dashboardTabs.map((tab) => <button key={tab} type="button" className={dashboardTab === tab ? "dashboard-tab selected" : "dashboard-tab"} onClick={() => { setDashboardTab(tab); setDashboardDraft(currentBusiness); setDashboardMessage(""); }}>{dashboardTabLabels[tab]}</button>)}</nav><div className="publish-controls"><span className={currentBusiness.isPublished ? "publish-status published" : "publish-status"}>{currentBusiness.isPublished ? t.dashboard.published : t.dashboard.unpublished}</span><button className="secondary-button" disabled={!currentBusiness.isPublished && !currentBusiness.services.some((service) => service.active)} onClick={() => { void toggleBusinessPublication(); }} type="button">{currentBusiness.isPublished ? t.dashboard.unpublish : t.dashboard.publish}</button></div></div>
          {!currentBusiness.services.some((service) => service.active) && <p className="form-error">{t.dashboard.publishNeedsService}</p>}
          {dashboardMessage && <p className="success-notice" role="status">{dashboardMessage}</p>}
          {dashboardTab === "overview" && <><div className="dash-stats"><div><span>{t.dashboard.appointmentsCount}</span><b>{appointments.filter((appointment) => appointment.businessId === currentBusiness.id).length}<small>{t.dashboard.businessMetric}</small></b></div><div><span>{t.dashboard.upcoming}</span><b>{appointments.filter((appointment) => appointment.businessId === currentBusiness.id && appointment.date >= today && (appointment.status === "pending" || appointment.status === "confirmed")).length}<small>{t.dashboard.appointmentsThisWeek}</small></b></div><div><span>{t.dashboard.servicesTab}</span><b>{currentBusiness.services.filter((service) => service.active).length}<small>{t.dashboard.servicesTab}</small></b></div><div><span>{t.dashboard.completionRate}</span><b>{currentBusiness.isPublished ? t.dashboard.active : t.dashboard.unpublished}<small>{currentBusiness.city}</small></b></div></div><div className="dash-content"><div className="appointments-panel"><div className="panel-head"><div><h2>{t.dashboard.upcoming}</h2><p>{t.dashboard.latestBookings}</p></div></div>{renderAppointments(appointments.filter((appointment) => appointment.businessId === currentBusiness.id && appointment.date >= today && (appointment.status === "pending" || appointment.status === "confirmed")).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 5), true)}</div><aside className="quick-panel"><div className="eyebrow">{t.dashboard.quickActions}</div><h3>{t.dashboard.keepMoving}</h3><button onClick={() => { setDashboardTab("services"); setServiceEditor({ ...blankDraftService(), price: "0", duration: "30" }); }} type="button">＋ {t.dashboard.addService}<span>→</span></button><button onClick={() => openBusiness(currentBusiness)} type="button">↗ {t.dashboard.previewCustomerPage}<span>→</span></button><div className="tip-box"><span>✦</span><p><b>{t.dashboard.goodToKnow}</b><br />{t.dashboard.manageDescription}</p></div></aside></div></>}
          {dashboardTab === "upcoming" && <section className="dashboard-panel"><div className="panel-head"><div><h2>{t.dashboard.upcoming}</h2><p>{t.dashboard.latestBookings}</p></div></div>{renderAppointments(appointments.filter((appointment) => appointment.businessId === currentBusiness.id && appointment.date >= today && (appointment.status === "pending" || appointment.status === "confirmed")).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), true)}</section>}
          {dashboardTab === "history" && <section className="dashboard-panel"><div className="panel-head"><div><h2>{t.dashboard.history}</h2><p>{t.dashboard.latestBookings}</p></div></div>{renderAppointments(appointments.filter((appointment) => appointment.businessId === currentBusiness.id && (appointment.date < today || appointment.status === "completed" || appointment.status === "cancelled")), false)}</section>}
          {dashboardTab === "services" && <section className="dashboard-panel"><div className="panel-head"><div><h2>{t.dashboard.servicesTab}</h2><p>{t.dashboard.manageDescription}</p></div><button className="primary small" onClick={() => setServiceEditor({ ...blankDraftService(), price: "0", duration: "30" })} type="button">＋ {t.dashboard.addService}</button></div>{currentBusiness.services.length === 0 && <div className="dashboard-empty">{t.dashboard.noServices}</div>}{currentBusiness.services.map((service) => <div className="dashboard-service-row" key={service.id}><div><b>{service.name[language]}</b><small>{service.description[language]}</small></div><span>{service.durationMinutes} min</span><strong>{formatPrice(service.price, language)}</strong><button className="text-button" onClick={() => setServiceEditor({ id: service.id, name: service.name[language], description: service.description[language], price: String(service.price), duration: String(service.durationMinutes) })} type="button">{t.onboarding.reviewEdit}</button><button className="text-button danger-text" onClick={() => { void deleteDashboardService(service.id); }} type="button">×</button></div>)}
            {serviceEditor && <form className="service-edit-form" onSubmit={saveDashboardService}><h3>{t.dashboard.addService}</h3><div className="onboarding-grid"><label className="form-field"><span>{t.onboarding.serviceName}</span><input className="field" value={serviceEditor.name} onChange={(event) => serviceEditorField("name", event.target.value)} required /></label><label className="form-field"><span>{t.onboarding.serviceDescription}</span><input className="field" value={serviceEditor.description} onChange={(event) => serviceEditorField("description", event.target.value)} /></label><label className="form-field"><span>{t.onboarding.price}</span><input className="field" type="number" min="0" step="0.01" value={serviceEditor.price} onChange={(event) => serviceEditorField("price", event.target.value)} required /></label><label className="form-field"><span>{t.onboarding.duration}</span><input className="field" type="number" min="1" value={serviceEditor.duration} onChange={(event) => serviceEditorField("duration", event.target.value)} required /></label></div><div className="onboarding-actions"><button type="button" className="secondary-button" onClick={() => setServiceEditor(null)}>{t.onboarding.previous}</button><button className="primary" type="submit">{t.dashboard.save}</button></div></form>}
          </section>}
          {dashboardTab === "hours" && dashboardDraft && <form className="dashboard-panel" onSubmit={saveDashboardHours}><div className="panel-head"><div><h2>{t.dashboard.hoursTab}</h2><p>{t.onboarding.closuresHint}</p></div></div>{renderHours(dashboardDraft.schedule, (weekday, change) => setDashboardDraft((previous) => previous ? { ...previous, schedule: previous.schedule.map((day) => day.weekday === weekday ? { ...day, ...change } : day) } : previous), true)}<div className="closures-editor"><h3>{t.onboarding.closures}</h3><div className="closure-input"><input className="field" aria-label={t.onboarding.closures} type="date" min={today} value={newClosureDate} onChange={(event) => setNewClosureDate(event.target.value)} /><button type="button" className="secondary-button" onClick={() => { if (newClosureDate && !dashboardDraft.closures.includes(newClosureDate)) updateDashboardBusiness({ closures: [...dashboardDraft.closures, newClosureDate].sort() }); setNewClosureDate(""); }}>{t.onboarding.addClosure}</button></div>{dashboardDraft.closures.map((date) => <span className="closure-chip" key={date}>{formatDate(date, language)}<button type="button" onClick={() => updateDashboardBusiness({ closures: dashboardDraft.closures.filter((item) => item !== date) })}>×</button></span>)}</div><button className="primary" type="submit">{t.dashboard.save}</button></form>}
          {dashboardTab === "profile" && dashboardDraft && <form className="dashboard-panel dashboard-profile-form" onSubmit={saveDashboardProfile}><div className="panel-head"><div><h2>{t.dashboard.profileTab}</h2><p>{t.dashboard.manageDescription}</p></div></div><div className="onboarding-grid"><label className="form-field"><span>{t.onboarding.businessName}</span><input className="field" value={dashboardDraft.name[language]} onChange={(event) => updateDashboardBusiness({ name: sameText(event.target.value) })} required /></label><label className="form-field"><span>{t.onboarding.category}</span><select className="field" value={dashboardDraft.category} onChange={(event) => updateDashboardBusiness({ category: event.target.value as BusinessCategory })}>{businessCategoryIds.map((category) => <option value={category} key={category}>{t.businessCategories[category]}</option>)}</select></label><label className="form-field"><span>{t.onboarding.phone}</span><input className="field" type="tel" value={dashboardDraft.phone} onChange={(event) => updateDashboardBusiness({ phone: event.target.value })} required /></label><label className="form-field"><span>{t.onboarding.businessEmail}</span><input className="field" type="email" value={dashboardDraft.email} onChange={(event) => updateDashboardBusiness({ email: event.target.value })} /></label><label className="form-field"><span>{t.onboarding.city}</span><input className="field" value={dashboardDraft.city} onChange={(event) => updateDashboardBusiness({ city: event.target.value })} required /></label><label className="form-field"><span>{t.onboarding.address}</span><input className="field" value={dashboardDraft.address} onChange={(event) => updateDashboardBusiness({ address: event.target.value })} /></label><label className="form-field span-two"><span>{t.onboarding.descriptionLabel}</span><textarea className="field textarea" rows={3} value={dashboardDraft.description[language]} onChange={(event) => updateDashboardBusiness({ description: sameText(event.target.value) })} /></label><label className="form-field span-two"><span>{t.onboarding.imageUrl}</span><input className="field" type="url" value={dashboardDraft.imageUrl} onChange={(event) => updateDashboardBusiness({ imageUrl: event.target.value })} /></label></div><button className="primary" type="submit">{t.dashboard.save}</button></form>}
        </section>
      </>}
      {view === "dashboard" && !currentBusiness && <section className="account-page section"><div className="account-card"><div className="eyebrow">{t.dashboard.accessDenied}</div><h1>{t.registration.loginTitle}</h1><p>{t.dashboard.accessDenied}</p><button className="primary" disabled={authBusy} onClick={() => { void goToDashboard(); }} type="button">{authBusy ? t.registration.working : t.registration.openDashboard}<span>→</span></button></div></section>}

      <footer className="footer"><button className="brand footer-brand" onClick={() => navigate("home")} type="button"><span className="brand-mark">r</span><span>re<span className="brand-blue">servo</span></span></button><span>{t.footer.tagline}</span><span>© 2026 Reservo</span></footer>
    </main>
  );
}
