import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "./api/client";
import {
  AdminDashboard,
  AdminCmsPage,
  AdminEmailPage,
  AdminHelmetsPage,
  AdminIncidentsPage,
  AdminMaintenancePage,
  AdminSecurityPage,
  AdminSettingsPage,
  AdminUsersPage,
  UserAccidentsPage,
  UserContactsPage,
  UserDashboard,
  UserHelmetPage,
  UserNotificationsPage,
  UserProfilePage
} from "./dashboard-pages";

const THEME_KEY = "smartHelmetTheme";
const themeColors = {
  dark: {
    background: "#07111f",
    panel: "#0d1a2d",
    panelSoft: "#13233a",
    text: "#eaf2ff"
  },
  light: {
    background: "#f4f8ff",
    panel: "#ffffff",
    panelSoft: "#eef4ff",
    text: "#10213f"
  }
};

const publicNav = [["Home", "/"], ["Features", "/features"], ["How It Works", "/how-it-works"], ["About", "/about"], ["Contact", "/contact"]];
const defaults = {
  homepageContent: {
    heroTitle: "Ride Safer with AI-Powered Smart Helmet Protection",
    heroSubtitle: "Automatic accident detection, GPS tracking, emergency alerts, SOS activation, and live helmet monitoring in one smart helmet ecosystem.",
    sections: {
      ctaTitle: "Protect Every Ride with Smart Helmet Technology",
      ctaSubtitle: "Automatic detection, live monitoring, and instant alerts for safer travel."
    }
  },
  banners: [],
  branding: { siteName: "SmartHelmet", headerLogoText: "SmartHelmet", footerLogoText: "SmartHelmet" },
  configuration: {
    companyName: "SmartHelmet",
    email1: "support@smarthelmet.com",
    email2: "sales@smarthelmet.com",
    phone1: "+92 300 1234567",
    phone2: "+92 321 7654321",
    address: "",
    copyrights: "Copyright 2026 SmartHelmet. All rights reserved."
  },
  maintenance: { enabled: false, visitorMessage: "Website under maintenance" }
  ,
  faqs: [],
  blogs: []
};

const getStoredSession = () => {
  try {
    return JSON.parse(localStorage.getItem("smartHelmetSession") || "null");
  } catch {
    return null;
  }
};

const getStoredTheme = () => localStorage.getItem(THEME_KEY) || "light";
const applyTheme = (theme) => {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.setProperty("--app-bg", themeColors[nextTheme].background);
  document.documentElement.style.setProperty("--app-panel", themeColors[nextTheme].panel);
  document.documentElement.style.setProperty("--app-panel-soft", themeColors[nextTheme].panelSoft);
  document.documentElement.style.setProperty("--app-text", themeColors[nextTheme].text);
  localStorage.setItem(THEME_KEY, nextTheme);
  return nextTheme;
};

const storeSession = (session) => localStorage.setItem("smartHelmetSession", JSON.stringify(session));
const clearSession = () => localStorage.removeItem("smartHelmetSession");

const useSession = () => {
  const [session, setSession] = useState(() => getStoredSession());
  return {
    session,
    saveSession: (next) => {
      setSession(next);
      storeSession(next);
    },
    logout: () => {
      setSession(null);
      clearSession();
    }
  };
};

const useThemeMode = () => {
  const [theme, setTheme] = useState(() => {
    const initial = getStoredTheme();
    return applyTheme(initial);
  });

  useEffect(() => {
    const sync = () => setTheme(applyTheme(getStoredTheme()));
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggleTheme = () => {
    setTheme((current) => applyTheme(current === "dark" ? "light" : "dark"));
  };

  return { theme, toggleTheme };
};

const Icon = ({ children, tone = "blue" }) => <span className={`icon-badge ${tone}`}>{children}</span>;
const SectionHeading = ({ title, text }) => <div className="section-heading"><h2>{title}</h2><p>{text}</p></div>;
const FormStatus = ({ status }) => status?.text ? <div className={`form-status ${status.type}`}>{status.text}</div> : null;
const LogoMark = ({ compact = false }) => <img className={compact ? "brand-logo compact" : "brand-logo"} src="/logo.png" alt="Helzion logo" />;
const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeMode();
  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
};

const usePublicSite = () => {
  const [site, setSite] = useState(defaults);
  useEffect(() => {
    let active = true;
    apiGet("/public/site")
      .then((data) => {
        if (!active) return;
        setSite({
          ...defaults,
          ...data,
          homepageContent: {
            ...defaults.homepageContent,
            ...(data.homepageContent || {}),
            sections: { ...defaults.homepageContent.sections, ...(data.homepageContent?.sections || {}) }
          },
          branding: { ...defaults.branding, ...(data.branding || {}) },
          configuration: { ...defaults.configuration, ...(data.configuration || {}) },
          maintenance: { ...defaults.maintenance, ...(data.maintenance || {}) },
          banners: data.banners || [],
          faqs: data.faqs || [],
          blogs: data.blogs || []
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return site;
};

const SiteHeader = ({ site = defaults }) => (
  <>
    <div className="topbar" />
    {site?.maintenance?.enabled ? <div className="maintenance-strip">{site.maintenance.visitorMessage}</div> : null}
    <header className="site-header">
      <Link className="brand" to="/"><LogoMark compact /><span>{site?.branding?.headerLogoText || site?.branding?.siteName || "Helzion"}</span></Link>
      <nav className="site-nav">{publicNav.map(([label, href]) => <Link key={href} to={href}>{label}</Link>)}</nav>
      <div className="site-actions"><ThemeToggle /><Link to="/login">Login</Link><Link className="cta-pill" to="/register">Register</Link></div>
    </header>
  </>
);

const Footer = ({ site = defaults }) => (
  <footer className="footer">
    <div className="footer-grid">
      <div><h3>{site?.branding?.footerLogoText || site?.branding?.siteName || "SmartHelmet"}</h3><p>AI-powered smart helmet technology protecting riders with automatic accident detection and emergency response.</p></div>
      <div><h4>Quick Links</h4>{publicNav.map(([label, href]) => <Link key={href} to={href}>{label}</Link>)}</div>
      <div><h4>Legal</h4><a href="/">Privacy Policy</a><a href="/">Terms & Conditions</a><a href="/">Return Policy</a><a href="/">Warranty</a></div>
      <div><h4>Contact Info</h4><p>{site?.configuration?.email1 || "support@smarthelmet.com"}</p><p>{site?.configuration?.phone1 || "+92 300 1234567"}</p><p>{site?.configuration?.address || ""}</p></div>
    </div>
    <div className="footer-bottom">{site?.configuration?.copyrights || defaults.configuration.copyrights}</div>
  </footer>
);

const PageHero = ({ title, text }) => <section className="page-hero"><h1>{title}</h1><p>{text}</p></section>;

const HeroCard = () => (
  <div className="hero-card">
    <div className="hero-top-grid">
      <div className="mini-card"><span>GP</span><small>GPS</small></div>
      <div className="mini-card alert"><span>AL</span><small>Alert</small></div>
      <div className="mini-card"><span>BT</span><small>Bluetooth</small></div>
    </div>
    <div className="helmet-panel">
      <div className="shield-mark">SH</div>
      <h3>Smart Helmet</h3>
      <p>AI safety core online</p>
      <div className="chip-row"><span className="chip success">Shock Detection</span><span className="chip">Battery 85%</span></div>
    </div>
  </div>
);

const HomePage = () => {
  const site = usePublicSite();
  const homepage = site.homepageContent;
  const faqItems = site.faqs.length ? site.faqs : ["How does accident detection work?", "How are alerts sent?", "What happens if internet is unavailable?", "Can I add multiple emergency contacts?", "How do I connect helmet to WiFi?"];

  return (
    <>
      <SiteHeader site={site} />
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <h1>{homepage.heroTitle}</h1>
            <p>{homepage.heroSubtitle}</p>
            <div className="hero-actions"><Link className="btn danger" to="/register">Register Your Helmet</Link><Link className="btn ghost" to="/dashboard">View Dashboard</Link></div>
            <div className="pill-grid"><span>Accident Detection</span><span>Emergency Alerts</span><span>Live Notifications</span><span>Admin Analytics</span></div>
          </div>
          <HeroCard />
        </section>
        <section className="section">
          <SectionHeading title="Key Features" text="Everything you need for smart rider safety." />
          <div className="feature-grid">
            {[["Automatic Accident Detection", "Instantly detects major impact and starts the alert workflow."], ["Emergency SMS & WhatsApp", "Notify emergency contacts through Twilio-powered channels."], ["Live GPS Tracking", "Track rider location with map-based monitoring."], ["Bluetooth Calling", "Answer calls and route audio through the helmet."], ["Helmet Wear Detection", "FSR-based logic activates monitoring only when worn."], ["Manual SOS Button", "Hold the SOS button for immediate manual emergency alerts."], ["Battery Monitoring", "Track battery health and low-battery warning events."], ["WiFi Captive Setup", "Provision helmet WiFi through captive portal onboarding."], ["Real-Time Helmet Status", "See connectivity, battery, GPS, and activity in real time."]].map(([title, text]) => <article key={title} className="feature-card"><Icon>{title.slice(0, 2).toUpperCase()}</Icon><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>
        <section className="section muted">
          <SectionHeading title="How It Works" text="Simple workflow, real-time protection." />
          <div className="steps-grid">
            {[["Wear Helmet", "Helmet activation begins when pressure sensor confirms it is worn."], ["Accident Detection", "Shock sensor detects major impact and starts countdown."], ["15-Second Confirmation", "Rider can cancel false alarms using the helmet button."], ["Emergency Alert Sent", "Location and alert messages are sent to contacts and admin."]].map(([title, text], index) => <article key={title} className="step-card"><div className="step-number">{index + 1}</div><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>
        <section className="section">
          <SectionHeading title="Dashboard Preview" text="Manage everything from one place." />
          <div className="preview-grid">{[["User Dashboard", "blue"], ["Helmet Status", "indigo"], ["Emergency Contacts", "red"], ["Accident History", "purple"], ["Live GPS Map", "green"]].map(([title, tone]) => <div key={title} className={`preview-card ${tone}`}>{title}</div>)}</div>
        </section>
        <section className="section muted">
          <SectionHeading title="Frequently Asked Questions" text="Everything you need to know." />
          <div className="faq-list">{faqItems.map((item) => <details key={typeof item === "string" ? item : item._id} className="faq-item"><summary>{typeof item === "string" ? item : item.question}</summary><p>{typeof item === "string" ? "These values and alert rules are managed from the platform and can be updated from the admin portal." : item.answer}</p></details>)}</div>
        </section>
        {site.blogs?.length ? <section className="section"><SectionHeading title="Latest Updates" text="Recent articles and safety insights from the SmartHelmet team." /><div className="feature-grid compact">{site.blogs.slice(0, 3).map((post) => <article key={post._id} className="feature-card"><h3>{post.title}</h3><p>{post.excerpt || "SmartHelmet platform update."}</p></article>)}</div></section> : null}
        <section className="cta-band">
          <h2>{homepage.sections?.ctaTitle || defaults.homepageContent.sections.ctaTitle}</h2>
          <p>{homepage.sections?.ctaSubtitle || defaults.homepageContent.sections.ctaSubtitle}</p>
          <div className="hero-actions"><Link className="btn light" to="/register">Register Now</Link><Link className="btn outline-light" to="/contact">Contact Us</Link></div>
        </section>
      </main>
      <Footer site={site} />
    </>
  );
};

const AboutPage = () => {
  const site = usePublicSite();
  return (
  <>
    <SiteHeader site={site} />
    <PageHero title="About SmartHelmet" text="We're on a mission to make every ride safer with cutting-edge AI-powered helmet technology that protects riders through automatic accident detection and emergency response." />
    <section className="section split-two">
      <article className="story-card"><Icon>MI</Icon><h2>Our Mission</h2><p>To revolutionize rider safety by providing intelligent helmet technology that automatically detects accidents and alerts emergency contacts instantly.</p></article>
      <article className="story-card"><Icon>VS</Icon><h2>Our Vision</h2><p>To create a world where motorcycle accidents have minimal impact on riders and their families through connected, responsive safety systems.</p></article>
    </section>
    <section className="section muted">
      <SectionHeading title="Our Core Values" text="The principles that guide everything we do." />
      <div className="feature-grid compact">{[["Safety First", "Every decision prioritizes rider well-being and reliability."], ["User-Centric Design", "Products designed for real riders and real emergencies."], ["Innovation Excellence", "AI, IoT, and connected telemetry working together."]].map(([title, text]) => <article key={title} className="feature-card"><Icon>{title.slice(0, 2).toUpperCase()}</Icon><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
    <section className="section narrow">
      <SectionHeading title="Our Story" text="How SmartHelmet came to be." />
      <div className="story-copy"><p>SmartHelmet was born from a personal experience where precious minutes were lost before help arrived. That moment sparked a vision: what if helmets could automatically detect accidents and alert emergency contacts instantly?</p><p>After years of research and testing, SmartHelmet evolved into a connected rider safety platform with intelligent devices, dashboards, and real-time emergency workflows.</p></div>
    </section>
    <section className="metrics-strip"><div><strong>5,000+</strong><span>Active Users</span></div><div><strong>500+</strong><span>Accidents Detected</span></div><div><strong>99.9%</strong><span>Uptime</span></div><div><strong>15 sec</strong><span>Average Response Time</span></div></section>
    <Footer site={site} />
  </>
  );
};

const ContactPage = () => {
  const site = usePublicSite();
  const [form, setForm] = useState({ name: "", email: "", phoneNumber: "", subject: "General", message: "" });
  const [status, setStatus] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);

  const onChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: "", text: "" });
    try {
      await apiPost("/auth/contact", form);
      setStatus({ type: "success", text: "Message submitted successfully." });
      setForm({ name: "", email: "", phoneNumber: "", subject: "General", message: "" });
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SiteHeader site={site} />
      <PageHero title="Get In Touch" text="Have questions about SmartHelmet? We're here to help. Reach out to us and we'll respond as soon as possible." />
      <section className="section contact-layout">
        <div className="contact-side">{[["Phone", `${site.configuration.phone1 || ""}\n${site.configuration.phone2 || ""}`.trim()], ["Email", `${site.configuration.email1 || ""}\n${site.configuration.email2 || ""}`.trim()], ["Address", site.configuration.address || ""], ["Business Hours", "Monday - Friday: 9:00 AM - 6:00 PM\nSaturday: 10:00 AM - 4:00 PM\nSunday: Closed"]].map(([title, text]) => <article key={title} className="info-card"><Icon>{title.slice(0, 2).toUpperCase()}</Icon><h3>{title}</h3>{String(text).split("\n").filter(Boolean).map((line) => <p key={line}>{line}</p>)}</article>)}</div>
        <form className="contact-form-card" onSubmit={onSubmit}>
          <h2>Send Us a Message</h2>
          <p>Fill out the form below and we'll get back to you within 24 hours.</p>
          <FormStatus status={status} />
          <div className="form-grid">
            <label><span>Full Name *</span><input name="name" value={form.name} onChange={onChange} required /></label>
            <label><span>Email Address *</span><input name="email" value={form.email} onChange={onChange} required /></label>
            <label><span>Phone Number</span><input name="phoneNumber" value={form.phoneNumber} onChange={onChange} /></label>
            <label><span>Subject *</span><select name="subject" value={form.subject} onChange={onChange}><option>General</option><option>Sales</option><option>Support</option></select></label>
            <label className="full"><span>Message *</span><textarea name="message" value={form.message} onChange={onChange} rows="6" required /></label>
          </div>
          <button className="btn primary full-btn" disabled={submitting}>{submitting ? "Sending..." : "Send Message"}</button>
        </form>
      </section>
      <section className="map-placeholder">Map View<br /><small>{site.configuration.address || ""}</small></section>
      <Footer site={site} />
    </>
  );
};

const LoginPage = ({ saveSession }) => {
  const [mode, setMode] = useState("user");
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const site = usePublicSite();

  const onChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: "", text: "" });
    try {
      const data = await apiPost(mode === "admin" ? "/auth/admin/login" : "/auth/login", form);
      saveSession({ token: data.accessToken, refreshToken: data.refreshToken, role: mode, actor: mode === "admin" ? data.admin : data.user });
      navigate(mode === "admin" ? "/admin" : "/dashboard");
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SiteHeader site={site} />
      <section className="auth-shell">
        <div className="auth-promo">
          <LogoMark />
          <h2>Helzion</h2>
          <h3>Welcome Back!</h3>
          <p>Sign in to access your live dashboard and monitor your smart helmet in real time.</p>
          <ul><li>Real-Time Monitoring</li><li>Emergency Contacts</li><li>Accident History</li></ul>
        </div>
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="mode-tabs"><button type="button" className={mode === "user" ? "tab active" : "tab"} onClick={() => setMode("user")}>User</button><button type="button" className={mode === "admin" ? "tab active" : "tab"} onClick={() => setMode("admin")}>Admin</button></div>
          <h1>Sign In</h1>
          <p>Enter your credentials to access your account</p>
          <FormStatus status={status} />
          <div className="form-grid single">
            <label><span>Email Address</span><input name="email" value={form.email} onChange={onChange} required /></label>
            <label><span>Password</span><input name="password" value={form.password} onChange={onChange} type="password" required /></label>
          </div>
          <div className="row-between auth-meta"><label className="check"><input type="checkbox" /> Remember me</label><Link to="/forgot-password">Forgot password?</Link></div>
          <button className="btn primary full-btn" disabled={submitting}>{submitting ? "Signing In..." : "Sign In"}</button>
          <p className="auth-switch">Don't have an account? <Link to="/register">Register now</Link></p>
          <div className="demo-note">All authentication is handled by the live backend at helzion-server.onrender.com.</div>
        </form>
      </section>
    </>
  );
};

const RegistrationSidebar = () => <aside className="register-side"><div className="shield-mark large">SH</div><h2>Join SmartHelmet</h2><p>Register your helmet and get instant access to life-saving features.</p><ul><li>Automatic Accident Detection</li><li>Real-Time GPS Tracking</li><li>Emergency Alerts</li><li>24/7 Monitoring</li></ul></aside>;
const Stepper = ({ active }) => <div className="stepper">{["Personal Info", "Helmet Info", "Emergency Contact", "Review"].map((label, index) => <div key={label} className="stepper-item"><div className={`step-dot ${index + 1 <= active ? "active" : ""}`}>{index + 1}</div><span>{label}</span></div>)}</div>;

const RegisterPage = ({ saveSession }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fullName: "", cnicNumber: "", email: "", phoneNumber: "", password: "", confirmPassword: "", helmetId: "", secretKey: "", emergencyContacts: [{ name: "", relation: "", phoneNumber: "", whatsappNumber: "" }] });

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const updateContact = (index, field, value) => setForm((current) => ({ ...current, emergencyContacts: current.emergencyContacts.map((contact, contactIndex) => contactIndex === index ? { ...contact, [field]: value } : contact) }));
  const addContact = () => setForm((current) => current.emergencyContacts.length >= 5 ? current : ({ ...current, emergencyContacts: [...current.emergencyContacts, { name: "", relation: "", phoneNumber: "", whatsappNumber: "" }] }));
  const reviewItems = useMemo(() => [["Full Name", form.fullName], ["Email", form.email], ["Phone", form.phoneNumber], ["CNIC", form.cnicNumber], ["Helmet ID", form.helmetId], ["Secret Key", form.secretKey], ["Contacts", `${form.emergencyContacts.filter((contact) => contact.name).length} added`]], [form]);
  const next = () => setStep((current) => Math.min(current + 1, 4));
  const back = () => setStep((current) => Math.max(current - 1, 1));

  const onSubmit = async (event) => {
    event.preventDefault();
    if (step < 4) {
      if (step === 1 && form.password !== form.confirmPassword) {
        setStatus({ type: "error", text: "Password and confirm password must match." });
        return;
      }
      setStatus({ type: "", text: "" });
      next();
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiPost("/auth/register", {
        fullName: form.fullName,
        cnicNumber: form.cnicNumber,
        email: form.email,
        phoneNumber: form.phoneNumber,
        password: form.password,
        helmetId: form.helmetId,
        secretKey: form.secretKey,
        emergencyContacts: form.emergencyContacts.filter((contact) => contact.name && contact.relation && contact.phoneNumber)
      });
      saveSession({ token: data.accessToken, refreshToken: data.refreshToken, role: "user", actor: data.user });
      navigate("/dashboard");
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <section className="register-shell">
        <Stepper active={step} />
        <div className="register-layout">
          <RegistrationSidebar />
          <form className="register-card" onSubmit={onSubmit}>
            <FormStatus status={status} />
            {step === 1 ? <><h1>Personal Information</h1><p>Tell us about yourself</p><div className="form-grid"><label className="full"><span>Full Name *</span><input name="fullName" value={form.fullName} onChange={updateField} required /></label><label><span>Email Address *</span><input name="email" value={form.email} onChange={updateField} required /></label><label><span>Phone Number *</span><input name="phoneNumber" value={form.phoneNumber} onChange={updateField} required /></label><label className="full"><span>CNIC Number *</span><input name="cnicNumber" value={form.cnicNumber} onChange={updateField} required /></label><label className="full"><span>Password *</span><input name="password" type="password" value={form.password} onChange={updateField} required /></label><label className="full"><span>Confirm Password *</span><input name="confirmPassword" type="password" value={form.confirmPassword} onChange={updateField} required /></label></div></> : null}
            {step === 2 ? <><h1>Helmet Information</h1><p>Connect your SmartHelmet device</p><div className="form-grid"><label><span>Helmet ID *</span><input name="helmetId" value={form.helmetId} onChange={updateField} required /></label><label><span>Secret Key *</span><input name="secretKey" value={form.secretKey} onChange={updateField} required /></label></div></> : null}
            {step === 3 ? <><h1>Emergency Contacts</h1><p>Add up to 5 emergency contacts</p>{form.emergencyContacts.map((contact, index) => <div className="contact-block" key={index}><h3>Contact {index + 1}</h3><div className="form-grid"><label><span>Contact Name *</span><input value={contact.name} onChange={(event) => updateContact(index, "name", event.target.value)} /></label><label><span>Relationship *</span><input value={contact.relation} onChange={(event) => updateContact(index, "relation", event.target.value)} /></label><label><span>Phone Number *</span><input value={contact.phoneNumber} onChange={(event) => updateContact(index, "phoneNumber", event.target.value)} /></label><label><span>WhatsApp Number</span><input value={contact.whatsappNumber} onChange={(event) => updateContact(index, "whatsappNumber", event.target.value)} /></label></div></div>)}<button type="button" className="add-contact" onClick={addContact}>+ Add Another Contact</button></> : null}
            {step === 4 ? <><h1>Review</h1><p>Confirm your details before creating your account.</p><div className="review-list">{reviewItems.map(([label, value]) => <div className="review-row" key={label}><strong>{label}</strong><span>{value || "Not provided"}</span></div>)}</div></> : null}
            <div className={`wizard-actions ${step === 1 ? "end" : ""}`}>{step > 1 ? <button type="button" className="btn back-btn" onClick={back}>Back</button> : null}<button className="btn muted-btn" type="submit" disabled={submitting}>{step === 4 ? (submitting ? "Creating Account..." : "Create Account") : "Next"}</button></div>
            <p className="auth-switch">Already have an account? <Link to="/login">Login here</Link></p>
          </form>
        </div>
      </section>
    </>
  );
};

const PlaceholderPage = ({ title }) => {
  const site = usePublicSite();
  return <><SiteHeader site={site} /><PageHero title={title} text="This page follows the same SmartHelmet design system and is ready to connect with live content." /><Footer site={site} /></>;
};

const AppRoutes = () => {
  const { session, saveSession, logout } = useSession();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/features" element={<PlaceholderPage title="Features" />} />
      <Route path="/how-it-works" element={<PlaceholderPage title="How It Works" />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/login" element={<LoginPage saveSession={saveSession} />} />
      <Route path="/register" element={<RegisterPage saveSession={saveSession} />} />
      <Route path="/forgot-password" element={<PlaceholderPage title="Forgot Password" />} />
      <Route path="/dashboard" element={<UserDashboard session={session} logout={logout} />} />
      <Route path="/dashboard/helmet" element={<UserHelmetPage session={session} logout={logout} />} />
      <Route path="/dashboard/contacts" element={<UserContactsPage session={session} logout={logout} />} />
      <Route path="/dashboard/accidents" element={<UserAccidentsPage session={session} logout={logout} />} />
      <Route path="/dashboard/notifications" element={<UserNotificationsPage session={session} logout={logout} />} />
      <Route path="/dashboard/profile" element={<UserProfilePage session={session} logout={logout} />} />
      <Route path="/admin" element={<AdminDashboard session={session} logout={logout} />} />
      <Route path="/admin/users" element={<AdminUsersPage session={session} logout={logout} />} />
      <Route path="/admin/helmets" element={<AdminHelmetsPage session={session} logout={logout} />} />
      <Route path="/admin/incidents" element={<AdminIncidentsPage session={session} logout={logout} />} />
      <Route path="/admin/settings" element={<AdminSettingsPage session={session} logout={logout} />} />
      <Route path="/admin/cms" element={<AdminCmsPage session={session} logout={logout} />} />
      <Route path="/admin/email" element={<AdminEmailPage session={session} logout={logout} />} />
      <Route path="/admin/maintenance" element={<AdminMaintenancePage session={session} logout={logout} />} />
      <Route path="/admin/security" element={<AdminSecurityPage session={session} logout={logout} />} />
    </Routes>
  );
};

export default function App() {
  useThemeMode();
  return <AppRoutes />;
}
