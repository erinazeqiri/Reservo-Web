"use client";

import { useMemo, useState } from "react";

type Service = { id: number; name: string; category: string; duration: string; price: number; rating: string; reviews: number; description: string; color: string; };
type Booking = { id: number; service: string; customer: string; date: string; time: string; status: "Confirmed" | "Pending"; price: number; };

const services: Service[] = [
  { id: 1, name: "Signature haircut", category: "Hair", duration: "45 min", price: 28, rating: "4.9", reviews: 128, description: "A tailored cut, wash and finish.", color: "lavender" },
  { id: 2, name: "Classic manicure", category: "Beauty", duration: "50 min", price: 24, rating: "4.8", reviews: 96, description: "A clean, polished look that lasts.", color: "peach" },
  { id: 3, name: "Deep tissue massage", category: "Wellness", duration: "60 min", price: 55, rating: "5.0", reviews: 74, description: "Unwind with a restorative treatment.", color: "mint" },
  { id: 4, name: "Skin refresh facial", category: "Skincare", duration: "40 min", price: 42, rating: "4.9", reviews: 83, description: "A fresh, hydrated glow in one visit.", color: "blue" },
];

const initialBookings: Booking[] = [
  { id: 1048, service: "Signature haircut", customer: "Mia Thompson", date: "Today", time: "10:30 AM", status: "Confirmed", price: 28 },
  { id: 1049, service: "Classic manicure", customer: "Olivia Martin", date: "Today", time: "12:00 PM", status: "Pending", price: 24 },
  { id: 1050, service: "Deep tissue massage", customer: "Noah Williams", date: "Today", time: "2:15 PM", status: "Confirmed", price: 55 },
  { id: 1051, service: "Skin refresh facial", customer: "Ava Johnson", date: "Tomorrow", time: "9:00 AM", status: "Confirmed", price: 42 },
];

const times = ["9:00 AM", "10:30 AM", "12:00 PM", "1:30 PM", "2:15 PM", "4:00 PM"];

export default function ReservoApp() {
  const [view, setView] = useState<"home" | "booking" | "dashboard">("home");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Service>(services[0]);
  const [date, setDate] = useState("2026-11-10");
  const [time, setTime] = useState("10:30 AM");
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [confirmed, setConfirmed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => services.filter(s =>
    (category === "All" || s.category === category) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()))
  ), [category, search]);

  function startBooking(service: Service) {
    setSelected(service); setConfirmed(false); setView("booking"); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function confirmBooking() {
    if (!customer.trim() || !email.trim()) return;
    setBookings(prev => [{ id: 1052 + prev.length, service: selected.name, customer, date: "Nov 10", time, status: "Confirmed", price: selected.price }, ...prev]);
    setConfirmed(true);
  }

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="Reservo home"><span className="brand-mark">r</span><span>re<span className="brand-blue">servo</span></span></button>
        <nav className={mobileMenu ? "nav nav-open" : "nav"}>
          <button className={view === "home" ? "nav-link active" : "nav-link"} onClick={() => {setView("home");setMobileMenu(false);}}>Explore</button>
          <button className="nav-link" onClick={() => {setView("dashboard");setMobileMenu(false);}}>For businesses</button>
          <a className="nav-link" href="#how">How it works</a>
        </nav>
        <div className="top-actions"><button className="text-button" onClick={() => setView("dashboard")}>Sign in</button><button className="primary small" onClick={() => setView("dashboard")}>Business portal <span>↗</span></button></div>
        <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">☰</button>
      </header>

      {view === "home" && <>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="spark">✳</span> THE BETTER WAY TO BOOK</div>
            <h1>Your time,<br /><em>beautifully</em> booked.</h1>
            <p className="hero-sub">Discover trusted local businesses and book the services you love — without the back-and-forth.</p>
            <div className="hero-search"><span className="search-icon">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="What are you looking for?" /><button onClick={() => document.getElementById("discover")?.scrollIntoView({behavior:"smooth"})}>Explore <span>→</span></button></div>
            <div className="trust-row"><div className="avatar-stack"><i>J</i><i>M</i><i>A</i><i>+</i></div><span><b>1,200+</b> happy appointments booked</span></div>
          </div>
          <div className="hero-art">
            <div className="art-glow"></div><div className="art-card main-art"><div className="art-top"><span className="art-pill">YOUR NEXT APPOINTMENT</span><span className="dots">•••</span></div><div className="art-date"><span>MON</span><b>10</b><span>NOVEMBER</span></div><div className="art-rule"></div><div className="art-service"><div className="service-avatar">✂</div><div><b>Signature haircut</b><small>Studio Form · 45 min</small></div><span className="check">✓</span></div><div className="art-bottom"><span>10:30 AM</span><b>Confirmed</b></div></div>
            <div className="floating-note"><span className="note-icon">✦</span><div><b>All set!</b><small>Your booking is confirmed.</small></div></div>
            <div className="floating-stats"><span className="stats-icon">↗</span><div><b>Easy booking</b><small>In just a few clicks</small></div></div>
            <div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div>
          </div>
        </section>

        <section className="metrics"><div><b>01</b><span>Find your service</span></div><div><b>02</b><span>Choose your time</span></div><div><b>03</b><span>You're all booked</span></div><div className="metric-note">Less planning. More living.</div></section>

        <section className="discover section" id="discover">
          <div className="section-head"><div><div className="eyebrow">GOOD THINGS ARE CLOSE</div><h2>Find your <em>next</em> favourite.</h2><p>Little moments of self-care, made easy to schedule.</p></div><button className="view-all" onClick={() => setCategory("All")}>View all services <span>↗</span></button></div>
          <div className="filters">{["All", "Hair", "Beauty", "Wellness", "Skincare"].map(c => <button key={c} className={category === c ? "filter selected" : "filter"} onClick={() => setCategory(c)}>{c}</button>)}</div>
          <div className="service-grid">{filtered.map((s, i) => <article className="service-card" key={s.id}><div className={`service-visual ${s.color}`}><span className="visual-number">0{i+1}</span><span className="visual-symbol">{["✂","✳","☼","❋"][services.indexOf(s)]}</span><span className="visual-category">{s.category}</span></div><div className="service-info"><div className="service-title-row"><h3>{s.name}</h3><span className="rating">★ {s.rating}</span></div><p>{s.description}</p><div className="service-meta"><span>◷ {s.duration}</span><b>€{s.price}</b></div><button className="book-link" onClick={() => startBooking(s)}>Book appointment <span>→</span></button></div></article>)}</div>
          {filtered.length === 0 && <div className="empty">No services match that search. Try another keyword.</div>}
        </section>

        <section className="how section" id="how"><div className="how-intro"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>Good plans.<br /><em>No phone calls.</em></h2><p>From finding the right service to getting your confirmation, Reservo keeps the whole process refreshingly simple.</p></div><div className="how-steps"><div><span>01</span><div><h3>Discover</h3><p>Browse services and find a business that feels right for you.</p></div><b>↗</b></div><div><span>02</span><div><h3>Pick a time</h3><p>See available slots and choose what works with your day.</p></div><b>↗</b></div><div><span>03</span><div><h3>You're booked</h3><p>Get your appointment details, all in one place.</p></div><b>↗</b></div></div></section>
        <section className="business-cta"><div><div className="eyebrow light">FOR THE PEOPLE BEHIND THE BUSINESS</div><h2>Your business.<br /><em>Less busywork.</em></h2><p>Keep your appointments, team and day moving in one clear place.</p><button className="light-button" onClick={() => setView("dashboard")}>Explore the business portal <span>→</span></button></div><div className="cta-decoration"><div className="cta-ring"></div><div className="mini-dashboard"><div className="mini-head"><span>THIS WEEK</span><b>↗</b></div><strong>24 <small>appointments</small></strong><div className="mini-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div className="mini-foot"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div></section>
      </>}

      {view === "booking" && <section className="booking-page section"><button className="back-link" onClick={() => setView("home")}>← Back to explore</button>{confirmed ? <div className="success-card"><div className="success-mark">✓</div><div className="eyebrow">YOU'RE ON THE CALENDAR</div><h1>It's a <em>date.</em></h1><p>Your demo appointment has been added. In a live Reservo account, you'd receive a confirmation by email.</p><div className="confirmation-details"><b>{selected.name}</b><span>November 10, 2026 · {time}</span><span>{customer} · {email}</span><strong>€{selected.price}</strong></div><button className="primary" onClick={() => setView("home")}>Back to exploring →</button></div> : <div className="booking-layout"><div className="booking-main"><div className="eyebrow">MAKE IT OFFICIAL</div><h1>Book your <em>moment.</em></h1><p className="muted">A few details and you're all set.</p><div className="booking-block"><div className="block-title"><span>01</span><h3>Your service</h3></div><div className="chosen-service"><div className={`chosen-icon ${selected.color}`}>{["✂","✳","☼","❋"][services.indexOf(selected)]}</div><div><b>{selected.name}</b><small>{selected.duration} · {selected.category}</small></div><strong>€{selected.price}</strong></div></div><div className="booking-block"><div className="block-title"><span>02</span><h3>Choose a date & time</h3></div><label className="field-label">DATE</label><input className="field" type="date" value={date} onChange={e => setDate(e.target.value)} min="2026-11-08" /><label className="field-label time-label">AVAILABLE TIMES</label><div className="time-grid">{times.map(t => <button key={t} className={time === t ? "time-slot picked" : "time-slot"} onClick={() => setTime(t)}>{t}</button>)}</div></div><div className="booking-block"><div className="block-title"><span>03</span><h3>Your details</h3></div><label className="field-label">FULL NAME</label><input className="field" placeholder="e.g. Alex Morgan" value={customer} onChange={e => setCustomer(e.target.value)} /><label className="field-label">EMAIL ADDRESS</label><input className="field" type="email" placeholder="alex@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div></div><aside className="booking-summary"><div className="eyebrow">YOUR APPOINTMENT</div><h3>One less thing<br />to think about.</h3><div className="summary-line"><span>Service</span><b>{selected.name}</b></div><div className="summary-line"><span>Duration</span><b>{selected.duration}</b></div><div className="summary-line"><span>Date</span><b>{new Date(date + "T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</b></div><div className="summary-line"><span>Time</span><b>{time}</b></div><div className="summary-total"><span>Total</span><strong>€{selected.price}</strong></div><button className="primary full" onClick={confirmBooking} disabled={!customer.trim() || !email.trim()}>Confirm booking <span>→</span></button><small className="secure-note">✦ This is a local demo. No payment is collected.</small></aside></div>}</section>}

      {view === "dashboard" && <section className="dashboard section"><div className="dash-top"><div><div className="eyebrow">STUDIO FORM · BUSINESS PORTAL</div><h1>Your day, <em>in view.</em></h1><p className="muted">A calm overview of what's happening at your business.</p></div><button className="primary" onClick={() => setView("home")}>View customer site ↗</button></div><div className="dash-stats"><div><span>Today's appointments</span><b>{bookings.filter(b=>b.date==="Today" || b.date==="Nov 10").length}<small>+2 this week</small></b></div><div><span>Expected revenue</span><b>€286<small>Across 8 bookings</small></b></div><div><span>New customers</span><b>12<small>This month</small></b></div><div><span>Completion rate</span><b>96%<small>Great work</small></b></div></div><div className="dash-content"><div className="appointments-panel"><div className="panel-head"><div><h2>Appointments</h2><p>Your latest bookings</p></div><span className="today-tag">● LIVE DEMO</span></div><div className="appointment-table"><div className="table-head"><span>CLIENT</span><span>SERVICE</span><span>TIME</span><span>STATUS</span></div>{bookings.map(b=><div className="table-row" key={b.id}><div className="client-cell"><i>{b.customer.split(" ").map(n=>n[0]).join("").slice(0,2)}</i><b>{b.customer}</b></div><span>{b.service}</span><span>{b.time}</span><span><em className={b.status==="Confirmed"?"status confirmed-status":"status pending-status"}>{b.status}</em></span></div>)}</div></div><aside className="quick-panel"><div className="eyebrow">QUICK ACTIONS</div><h3>Keep things<br />moving.</h3><button onClick={() => startBooking(services[0])}>＋ Create a test booking <span>→</span></button><button onClick={() => setView("home")}>↗ Preview customer page <span>→</span></button><div className="tip-box"><span>✦</span><p><b>Good to know</b><br />This dashboard uses sample data. Connect Supabase to enable real accounts and synced appointments.</p></div></aside></div></section>}

      <footer className="footer"><button className="brand footer-brand" onClick={() => setView("home")}><span className="brand-mark">r</span><span>re<span className="brand-blue">servo</span></span></button><span>Make room for what matters.</span><span>© 2026 Reservo</span></footer>
    </main>
  );
}
