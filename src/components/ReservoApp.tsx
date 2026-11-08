"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { translations, type Language } from "@/lib/i18n";

type Category = "all" | "hair" | "beauty" | "wellness" | "skincare";
type Service = { id: number; category: Exclude<Category, "all">; duration: number; price: number; rating: string; reviews: number; color: string };
type Booking = { id: number; serviceId: number; customer: string; date: string; time: string; status: "confirmed" | "pending"; price: number };
type View = "home" | "booking" | "dashboard";

const services: Service[] = [
  { id: 1, category: "hair", duration: 45, price: 28, rating: "4.9", reviews: 128, color: "lavender" },
  { id: 2, category: "beauty", duration: 50, price: 24, rating: "4.8", reviews: 96, color: "peach" },
  { id: 3, category: "wellness", duration: 60, price: 55, rating: "5.0", reviews: 74, color: "mint" },
  { id: 4, category: "skincare", duration: 40, price: 42, rating: "4.9", reviews: 83, color: "blue" },
];

const initialBookings: Booking[] = [
  { id: 1048, serviceId: 1, customer: "Mia Thompson", date: "today", time: "10:30 AM", status: "confirmed", price: 28 },
  { id: 1049, serviceId: 2, customer: "Olivia Martin", date: "today", time: "12:00 PM", status: "pending", price: 24 },
  { id: 1050, serviceId: 3, customer: "Noah Williams", date: "today", time: "2:15 PM", status: "confirmed", price: 55 },
  { id: 1051, serviceId: 4, customer: "Ava Johnson", date: "tomorrow", time: "9:00 AM", status: "confirmed", price: 42 },
];

const times = ["9:00 AM", "10:30 AM", "12:00 PM", "1:30 PM", "2:15 PM", "4:00 PM"];
const categories: Category[] = ["all", "hair", "beauty", "wellness", "skincare"];
const serviceSymbols = ["✂", "✳", "☼", "❋"];

function formatPrice(price: number, language: Language) {
  return language === "al" ? `${price} €` : `€${price}`;
}

function formatDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === "al" ? "sq-AL" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export default function ReservoApp() {
  const [language, setLanguage] = useState<Language>("al");
  const [languageReady, setLanguageReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [category, setCategory] = useState<Category>("all");
  const [selectedId, setSelectedId] = useState(services[0].id);
  const [date, setDate] = useState("2026-11-10");
  const [time, setTime] = useState(times[1]);
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [confirmed, setConfirmed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [sectionToScroll, setSectionToScroll] = useState<string | null>(null);
  const languageInitialized = useRef(false);

  const t = translations[language];
  const selected = services.find((service) => service.id === selectedId) ?? services[0];
  const selectedCopy = t.services[selected.id - 1];

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

  useEffect(() => {
    if (!sectionToScroll) return;
    document.getElementById(sectionToScroll)?.scrollIntoView({ behavior: "smooth" });
    setSectionToScroll(null);
  }, [sectionToScroll, view]);

  const filtered = useMemo(() => services.filter((service, index) => {
    const copy = translations[language].services[index];
    const matchesCategory = category === "all" || service.category === category;
    const searchText = `${copy.name} ${copy.description} ${translations[language].categories[service.category]}`.toLocaleLowerCase(language === "al" ? "sq-AL" : "en-US");
    return matchesCategory && searchText.includes(search.toLocaleLowerCase(language === "al" ? "sq-AL" : "en-US"));
  }), [category, language, search]);

  function navigate(nextView: View) {
    setView(nextView);
    setMobileMenu(false);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateToSection(sectionId: string) {
    setMobileMenu(false);
    if (view === "home") {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setSectionToScroll(sectionId);
    setView("home");
  }

  function chooseLanguage(option: Language) {
    languageInitialized.current = true;
    setLanguageReady(true);
    setLanguage(option);
  }

  function startBooking(service: Service) {
    setSelectedId(service.id);
    setConfirmed(false);
    navigate("booking");
  }

  function confirmBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer.trim() || !email.trim()) {
      setFormError(t.booking.formError);
      return;
    }
    setBookings((previous) => [{
      id: 1052 + previous.length,
      serviceId: selected.id,
      customer: customer.trim(),
      date,
      time,
      status: "confirmed",
      price: selected.price,
    }, ...previous]);
    setFormError("");
    setConfirmed(true);
  }

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} aria-label={t.nav.home}>
          <span className="brand-mark">r</span>
          <span>re<span className="brand-blue">servo</span></span>
        </button>
        <nav className={mobileMenu ? "nav nav-open" : "nav"} aria-label={t.nav.primaryNavigation}>
          <button className={view === "home" ? "nav-link active" : "nav-link"} onClick={() => navigate("home")}>{t.nav.explore}</button>
          <button className={view === "dashboard" ? "nav-link active" : "nav-link"} onClick={() => navigate("dashboard")}>{t.nav.forBusinesses}</button>
          <button className="nav-link" onClick={() => navigateToSection("how")}>{t.nav.howItWorks}</button>
        </nav>
        <div className="language-switcher" role="group" aria-label={t.nav.chooseLanguage}>
          {(["al", "en"] as const).map((option) => (
            <button key={option} type="button" className={language === option ? "language-option selected" : "language-option"} onClick={() => chooseLanguage(option)} aria-pressed={language === option}>
              {option.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="top-actions">
          <button className="text-button" onClick={() => navigate("dashboard")}>{t.nav.signIn}</button>
          <button className="primary small" onClick={() => navigate("dashboard")}>{t.nav.businessPortal}<span>↗</span></button>
        </div>
        <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label={t.nav.toggleMenu} aria-expanded={mobileMenu}>☰</button>
      </header>

      {view === "home" && <>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="spark">✳</span>{t.hero.eyebrow}</div>
            <h1>{t.hero.titleLine}<br /><em>{t.hero.titleEmphasis}</em>{t.hero.titleEnding}</h1>
            <p className="hero-sub">{t.hero.description}</p>
            <div className="hero-search">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input aria-label={t.hero.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.hero.searchPlaceholder} />
              <button onClick={() => navigateToSection("discover")}>{t.hero.searchButton}<span>→</span></button>
            </div>
            <div className="trust-row">
              <div className="avatar-stack" aria-hidden="true"><i>J</i><i>M</i><i>A</i><i>+</i></div>
              <span><b>1,200+</b> {t.hero.socialProof}</span>
            </div>
          </div>
          <div className="hero-art" aria-label={t.hero.illustrationLabel}>
            <div className="art-glow" />
            <div className="art-card main-art">
              <div className="art-top"><span className="art-pill">{t.hero.appointmentPreview}</span><span className="dots">•••</span></div>
              <div className="art-date"><span>{t.hero.previewWeekday}</span><b>10</b><span>{t.hero.previewMonth}</span></div>
              <div className="art-rule" />
              <div className="art-service">
                <div className="service-avatar">✂</div>
                <div><b>{t.services[0].name}</b><small>{t.hero.previewBusiness} · {t.services[0].duration}</small></div>
                <span className="check">✓</span>
              </div>
              <div className="art-bottom"><span>10:30 AM</span><b>{t.booking.confirmed}</b></div>
            </div>
            <div className="floating-note"><span className="note-icon">✦</span><div><b>{t.hero.allSet}</b><small>{t.hero.bookingConfirmed}</small></div></div>
            <div className="floating-stats"><span className="stats-icon">↗</span><div><b>{t.hero.easyBooking}</b><small>{t.hero.fewClicks}</small></div></div>
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          </div>
        </section>

        <section className="metrics" aria-label={t.home.stepsHeading}>
          {t.home.steps.map((step, index) => <div key={step}><b>0{index + 1}</b><span>{step}</span></div>)}
          <div className="metric-note">{t.home.metricNote}</div>
        </section>

        <section className="discover section" id="discover">
          <div className="section-head">
            <div><div className="eyebrow">{t.home.discoverEyebrow}</div><h2>{t.home.discoverTitle} <em>{t.home.discoverTitleEmphasis}</em>.</h2><p>{t.home.discoverDescription}</p></div>
            <button className="view-all" onClick={() => { setCategory("all"); setSearch(""); }}>{t.home.viewAll}<span>↗</span></button>
          </div>
          <div className="filters" role="group" aria-label={t.home.categoriesHeading}>
            {categories.map((item) => <button key={item} className={category === item ? "filter selected" : "filter"} onClick={() => setCategory(item)} aria-pressed={category === item}>{t.categories[item]}</button>)}
          </div>
          <div className="service-grid">
            {filtered.map((service) => {
              const copy = t.services[service.id - 1];
              return <article className="service-card" key={service.id}>
                <div className={`service-visual ${service.color}`}>
                  <span className="visual-number">0{service.id}</span><span className="visual-symbol">{serviceSymbols[service.id - 1]}</span><span className="visual-category">{t.categories[service.category]}</span>
                </div>
                <div className="service-info">
                  <div className="service-title-row"><h3>{copy.name}</h3><span className="rating">★ {service.rating}</span></div>
                  <p>{copy.description}</p>
                  <div className="service-meta"><span>◷ {copy.duration}</span><b>{formatPrice(service.price, language)}</b></div>
                  <button className="book-link" onClick={() => startBooking(service)}>{t.home.bookAppointment}<span>→</span></button>
                </div>
              </article>;
            })}
          </div>
          {filtered.length === 0 && <div className="empty">{t.home.noServices}</div>}
        </section>

        <section className="how section" id="how">
          <div className="how-intro"><div className="eyebrow">{t.home.howEyebrow}</div><h2>{t.home.howTitle}<br /><em>{t.home.howTitleEmphasis}</em></h2><p>{t.home.howDescription}</p></div>
          <div className="how-steps">
            {t.home.howSteps.map((step, index) => <div key={step.title}><span>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div><b>↗</b></div>)}
          </div>
        </section>

        <section className="benefits section">
          <div className="benefits-heading"><div className="eyebrow">{t.home.benefitsEyebrow}</div><h2>{t.home.benefitsTitle}<br /><em>{t.home.benefitsTitleEmphasis}</em></h2></div>
          <div className="benefits-grid">
            <article className="benefit-card customer-benefit"><span className="benefit-icon">✦</span><div className="eyebrow">{t.home.customerBenefitsLabel}</div><h3>{t.home.customerBenefitsTitle}</h3><p>{t.home.customerBenefitsDescription}</p><ul>{t.home.customerBenefits.map((benefit) => <li key={benefit}><span>✓</span>{benefit}</li>)}</ul></article>
            <article className="benefit-card business-benefit"><span className="benefit-icon">↗</span><div className="eyebrow">{t.home.businessBenefitsLabel}</div><h3>{t.home.businessBenefitsTitle}</h3><p>{t.home.businessBenefitsDescription}</p><ul>{t.home.businessBenefits.map((benefit) => <li key={benefit}><span>✓</span>{benefit}</li>)}</ul></article>
          </div>
        </section>

        <section className="business-cta">
          <div>
            <div className="eyebrow light">{t.home.businessCtaEyebrow}</div>
            <h2>{t.home.businessCtaTitle}<br /><em>{t.home.businessCtaTitleEmphasis}</em></h2>
            <p>{t.home.businessCtaDescription}</p>
            <button className="light-button" onClick={() => navigate("dashboard")}>{t.home.businessCtaButton}<span>→</span></button>
          </div>
          <div className="cta-decoration"><div className="cta-ring" /><div className="mini-dashboard">
            <div className="mini-head"><span>{t.home.weekPreview}</span><b>↗</b></div>
            <strong>24 <small>{t.home.appointments}</small></strong>
            <div className="mini-bars">{[1, 2, 3, 4, 5, 6, 7].map((day) => <i key={day} />)}</div>
            <div className="mini-foot">{t.home.weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          </div></div>
        </section>
      </>}

      {view === "booking" && <section className="booking-page section">
        <button className="back-link" onClick={() => navigate("home")}>← {t.booking.back}</button>
        {confirmed ? <div className="success-card">
          <div className="success-mark">✓</div><div className="eyebrow">{t.booking.successEyebrow}</div><h1>{t.booking.successTitle}<br /><em>{t.booking.successTitleEmphasis}</em></h1>
          <p>{t.booking.successDescription}</p>
          <div className="confirmation-details"><b>{selectedCopy.name}</b><span>{formatDate(date, language)} · {time}</span><span>{customer} · {email}</span><strong>{formatPrice(selected.price, language)}</strong></div>
          <button className="primary" onClick={() => navigate("home")}>{t.booking.backToExplore} →</button>
        </div> : <form className="booking-layout" onSubmit={confirmBooking}>
          <div className="booking-main">
            <div className="eyebrow">{t.booking.eyebrow}</div><h1>{t.booking.title}<br /><em>{t.booking.titleEmphasis}</em></h1><p className="muted">{t.booking.description}</p>
            <div className="booking-block">
              <div className="block-title"><span>01</span><h3>{t.booking.yourService}</h3></div>
              <div className="chosen-service"><div className={`chosen-icon ${selected.color}`}>{serviceSymbols[selected.id - 1]}</div><div><b>{selectedCopy.name}</b><small>{selectedCopy.duration} · {t.categories[selected.category]}</small></div><strong>{formatPrice(selected.price, language)}</strong></div>
            </div>
            <div className="booking-block">
              <div className="block-title"><span>02</span><h3>{t.booking.dateTime}</h3></div>
              <label className="field-label" htmlFor="booking-date">{t.booking.date}</label>
              <input className="field" id="booking-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} min="2026-11-08" required />
              <label className="field-label time-label">{t.booking.availableTimes}</label>
              <div className="time-grid">{times.map((option) => <button key={option} type="button" className={time === option ? "time-slot picked" : "time-slot"} onClick={() => setTime(option)} aria-pressed={time === option}>{option}</button>)}</div>
            </div>
            <div className="booking-block">
              <div className="block-title"><span>03</span><h3>{t.booking.yourDetails}</h3></div>
              <label className="field-label" htmlFor="customer-name">{t.booking.fullName}</label>
              <input className="field" id="customer-name" autoComplete="name" placeholder={t.booking.namePlaceholder} value={customer} onChange={(event) => setCustomer(event.target.value)} required />
              <label className="field-label" htmlFor="customer-email">{t.booking.emailAddress}</label>
              <input className="field" id="customer-email" type="email" autoComplete="email" placeholder={t.booking.emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
          </div>
          <aside className="booking-summary">
            <div className="eyebrow">{t.booking.summaryEyebrow}</div><h3>{t.booking.summaryTitle}<br />{t.booking.summaryTitleEnding}</h3>
            <div className="summary-line"><span>{t.booking.service}</span><b>{selectedCopy.name}</b></div>
            <div className="summary-line"><span>{t.booking.duration}</span><b>{selectedCopy.duration}</b></div>
            <div className="summary-line"><span>{t.booking.date}</span><b>{formatDate(date, language)}</b></div>
            <div className="summary-line"><span>{t.booking.time}</span><b>{time}</b></div>
            <div className="summary-total"><span>{t.booking.total}</span><strong>{formatPrice(selected.price, language)}</strong></div>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button className="primary full" type="submit">{t.booking.confirmBooking}<span>→</span></button>
            <small className="secure-note">✦ {t.booking.demoNote}</small>
          </aside>
        </form>}
      </section>}

      {view === "dashboard" && <section className="dashboard section">
        <div className="dash-top">
          <div><div className="eyebrow">{t.dashboard.eyebrow}</div><h1>{t.dashboard.title}<br /><em>{t.dashboard.titleEmphasis}</em></h1><p className="muted">{t.dashboard.description}</p></div>
          <button className="primary" onClick={() => navigate("home")}>{t.dashboard.customerSite} ↗</button>
        </div>
        <div className="dash-stats">
          <div><span>{t.dashboard.todayAppointments}</span><b>{bookings.filter((booking) => booking.date === "today" || booking.date === date).length}<small>{t.dashboard.appointmentsThisWeek}</small></b></div>
          <div><span>{t.dashboard.expectedRevenue}</span><b>{formatPrice(286, language)}<small>{t.dashboard.acrossBookings}</small></b></div>
          <div><span>{t.dashboard.newCustomers}</span><b>12<small>{t.dashboard.thisMonth}</small></b></div>
          <div><span>{t.dashboard.completionRate}</span><b>96%<small>{t.dashboard.greatWork}</small></b></div>
        </div>
        <div className="dash-content">
          <div className="appointments-panel">
            <div className="panel-head"><div><h2>{t.dashboard.appointments}</h2><p>{t.dashboard.latestBookings}</p></div><span className="today-tag">● {t.dashboard.liveDemo}</span></div>
            <div className="appointment-table">
              <div className="table-head"><span>{t.dashboard.client}</span><span>{t.dashboard.service}</span><span>{t.dashboard.time}</span><span>{t.dashboard.status}</span></div>
              {bookings.map((booking) => <div className="table-row" key={booking.id}>
                <div className="client-cell"><i>{booking.customer.split(" ").map((name) => name[0]).join("").slice(0, 2)}</i><b>{booking.customer}</b></div>
                <span>{t.services[booking.serviceId - 1].name}</span><span>{booking.time}</span>
                <span><em className={booking.status === "confirmed" ? "status confirmed-status" : "status pending-status"}>{t.booking[booking.status]}</em></span>
              </div>)}
            </div>
          </div>
          <aside className="quick-panel">
            <div className="eyebrow">{t.dashboard.quickActions}</div><h3>{t.dashboard.keepMoving}</h3>
            <button onClick={() => startBooking(services[0])}>＋ {t.dashboard.createBooking}<span>→</span></button>
            <button onClick={() => navigate("home")}>↗ {t.dashboard.previewCustomerPage}<span>→</span></button>
            <div className="tip-box"><span>✦</span><p><b>{t.dashboard.goodToKnow}</b><br />{t.dashboard.demoTip}</p></div>
          </aside>
        </div>
      </section>}

      <footer className="footer">
        <button className="brand footer-brand" onClick={() => navigate("home")}><span className="brand-mark">r</span><span>re<span className="brand-blue">servo</span></span></button>
        <span>{t.footer.tagline}</span><span>© 2026 Reservo</span>
      </footer>
    </main>
  );
}
