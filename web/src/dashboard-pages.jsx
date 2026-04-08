import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from './api/client';
import { useRealtimeSocket } from './api/realtime';

const Icon = ({ children, tone = "blue" }) => <span className={`icon-badge ${tone}`}>{children}</span>;
const StatCard = ({ icon, tone, hint, title, value, hintClass = "" }) => <div className="stat-card"><Icon tone={tone}>{icon}</Icon><small className={hintClass}>{hint}</small><h3>{title}</h3><strong>{value}</strong></div>;
const FormStatus = ({ status }) => status?.text ? <div className={`form-status ${status.type}`}>{status.text}</div> : null;
const DashboardGate = ({ message }) => <div className="panel-card"><h2>Access Required</h2><p>{message}</p><Link className="btn primary" to="/login">Go to Login</Link></div>;
const SimpleBarChart = ({ items }) => (
  <div className="bar-chart">
    {items.map((item) => (
      <div key={item.label} className="bar-row">
        <span>{item.label}</span>
        <div className="bar-track"><div className="bar-fill" style={{ width: `${item.value}%` }} /></div>
        <strong>{item.display || item.value}</strong>
      </div>
    ))}
  </div>
);

const userSidebarItems = [
  ["Dashboard", "/dashboard"],
  ["My Helmet", "/dashboard/helmet"],
  ["Emergency Contacts", "/dashboard/contacts"],
  ["Accident History", "/dashboard/accidents"],
  ["Notifications", "/dashboard/notifications"],
  ["Profile Settings", "/dashboard/profile"]
];

const adminSidebarItems = [
  ["Dashboard", "/admin"],
  ["Users", "/admin/users"],
  ["Helmets", "/admin/helmets"],
  ["Incidents", "/admin/incidents"],
  ["Settings", "/admin/settings"],
  ["CMS", "/admin/cms"],
  ["Email Integration", "/admin/email"],
  ["Maintenance", "/admin/maintenance"],
  ["Security", "/admin/security"]
];

export const DashboardSidebar = ({ admin = false, actorName = "Ahmed Khan", logout }) => {
  const items = admin ? adminSidebarItems : userSidebarItems;
  return (
    <aside className={`dashboard-sidebar ${admin ? "admin" : "user"}`}>
      <div className="sidebar-profile">
        <div className="avatar-circle">{admin ? "AD" : actorName.slice(0, 2).toUpperCase()}</div>
        <div>
          <strong>{admin ? "Admin Panel" : actorName}</strong>
          <span>{admin ? "SmartHelmet" : "Rider"}</span>
        </div>
      </div>
      <nav>
        {items.map(([label, href]) => (
          <NavLink key={href} to={href} end={href === "/dashboard" || href === "/admin"} className={({ isActive }) => isActive ? "active" : ""}>
            {label}
          </NavLink>
        ))}
      </nav>
      <button type="button" className="logout-link button-link" onClick={logout}>Logout</button>
    </aside>
  );
};

const useUserData = (session) => {
  const [state, setState] = useState({ profile: null, statusData: null, contacts: [], accidents: [], notifications: [], error: "" });
  useEffect(() => {
    if (!session?.token || session.role !== "user") return;
    let active = true;
    Promise.all([
      apiGet("/user/me", session.token),
      apiGet("/user/status", session.token),
      apiGet("/user/contacts", session.token),
      apiGet("/user/accidents", session.token),
      apiGet("/user/notifications", session.token)
    ]).then(([profile, statusData, contacts, accidents, notifications]) => {
      if (!active) return;
      setState({ profile, statusData, contacts, accidents, notifications, error: "" });
    }).catch((error) => setState((current) => ({ ...current, error: error.message })));
    return () => { active = false; };
  }, [session]);
  return state;
};

const useAdminBundle = (session, endpoint = "/admin/dashboard") => {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const load = async () => {
    if (!session?.token || session.role !== "admin") return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await apiGet(endpoint, session.token);
      setState({ data, error: "", loading: false });
    } catch (error) {
      setState({ data: null, error: error.message, loading: false });
    }
  };
  useEffect(() => { load(); }, [session, endpoint]);
  return { ...state, reload: load };
};

const UserShell = ({ session, logout, title, children }) => {
  const { profile, error } = useUserData(session);
  if (!session?.token || session.role !== "user") return <div className="dashboard-shell"><DashboardSidebar actorName="Guest" logout={logout} /><section className="dashboard-content"><DashboardGate message="Sign in with a user account to load live helmet data." /></section></div>;
  return <div className="dashboard-shell"><DashboardSidebar actorName={profile?.fullName || session.actor?.fullName || "Ahmed Khan"} logout={logout} /><section className="dashboard-content"><h1>{title}</h1><FormStatus status={error ? { type: "error", text: error } : null} />{children}</section></div>;
};

const AdminShell = ({ session, logout, title, children, status }) => {
  if (!session?.token || session.role !== "admin") return <div className="dashboard-shell"><DashboardSidebar admin actorName="Admin" logout={logout} /><section className="dashboard-content"><DashboardGate message="Sign in with an admin account to load live admin data." /></section></div>;
  return <div className="dashboard-shell"><DashboardSidebar admin actorName={session.actor?.name || "Admin"} logout={logout} /><section className="dashboard-content"><h1>{title}</h1><FormStatus status={status} />{children}</section></div>;
};

const normalizeSettingMap = (settings) => Object.fromEntries((settings || []).map((item) => [item.key, item.value]));

export const UserDashboard = ({ session, logout }) => {
  const { profile, statusData, contacts, accidents, error } = useUserData(session);
  const { connection, events, send } = useRealtimeSocket(session);
  const [requestStatus, setRequestStatus] = useState({ type: "", text: "" });
  if (!session?.token || session.role !== "user") return <div className="dashboard-shell"><DashboardSidebar actorName="Guest" logout={logout} /><section className="dashboard-content"><DashboardGate message="Sign in with a user account to load live helmet data." /></section></div>;
  const lastStatus = statusData?.status || {};
  const helmet = statusData?.helmet || {};
  const latestResolved = events.find((item) => item.type === "location_request:resolved");

  const requestLocation = async () => {
    try {
      if (connection === "connected") {
        send({ type: "location_request:create", sourceChannel: "web", reason: "user_live_location_check", message: "User requested current helmet location" });
      } else {
        await apiPost("/user/location-requests", { sourceChannel: "web", reason: "user_live_location_check", message: "User requested current helmet location" }, session.token);
      }
      setRequestStatus({ type: "success", text: "Live location request sent to the helmet." });
    } catch (requestError) {
      setRequestStatus({ type: "error", text: requestError.message });
    }
  };

  return <div className="dashboard-shell"><DashboardSidebar actorName={profile?.fullName || session.actor?.fullName || "Ahmed Khan"} logout={logout} /><section className="dashboard-content"><h1>Dashboard</h1><FormStatus status={error ? { type: "error", text: error } : requestStatus.text ? requestStatus : null} /><div className="stats-grid four riding-grid"><StatCard icon="ST" tone="green" hint={helmet.isActive ? "Active" : "Inactive"} title="Helmet Status" value={lastStatus.online ? "Online" : "Offline"} /><StatCard icon="RM" tone="green" hint={helmet.ridingModeActive ? `Helmet ID: ${helmet.helmetId || helmet.espId || "--"}` : "Helmet idle"} title="Riding Mode" value={helmet.ridingModeActive ? "ON" : "OFF"} /><StatCard icon="BT" hint={helmet.firmwareVersion || "No firmware"} title="Battery" value={`${lastStatus.batteryPercentage ?? "--"}%`} /><StatCard icon="GP" tone="red" hint={lastStatus.gpsSignal ? "Live" : "No lock"} title="GPS Location" value={helmet.label || "Karachi, PK"} /><StatCard icon="LS" tone="purple" hint={connection} title="Realtime Socket" value={connection === "connected" ? "Connected" : "Waiting"} /></div><div className="highlight-grid"><div className="highlight-card blue"><h3>Emergency Contacts</h3><strong>{contacts.length}</strong></div><div className="highlight-card orange"><h3>Accident Logs</h3><strong>{accidents.length}</strong></div><div className="highlight-card green"><h3>Connection</h3><strong>{lastStatus.online ? "Stable" : "Waiting"}</strong></div></div><div className="panel-card"><div className="row-between"><div><h2>Emergency SOS</h2><p>Use the helmet button or app workflow to trigger an immediate emergency alert to your configured contacts.</p></div><button className="btn back-btn" type="button" onClick={requestLocation}>Request Live Location</button></div><button className="btn danger sos-btn" type="button">SOS - Send Emergency Alert</button>{latestResolved?.request?.lastKnownLocation ? <div className="detail-stack"><small>Latest realtime location</small><strong>{latestResolved.request.lastKnownLocation.mapUrl || `${latestResolved.request.lastKnownLocation.lat}, ${latestResolved.request.lastKnownLocation.lng}`}</strong></div> : null}</div><div className="panel-card tall"><h2>Live Helmet Activity</h2><div className="map-box">Real-time GPS Map<br /><small>{lastStatus.gpsSignal ? "GPS signal available" : "Waiting for GPS signal"}</small><small>{helmet.ridingModeActive ? "Riding mode active for this helmet" : "Riding mode is currently off"}</small></div></div></section></div>;
};

export const UserHelmetPage = ({ session, logout }) => {
  const { statusData } = useUserData(session);
  const { connection, events, send } = useRealtimeSocket(session);
  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });
  const helmet = statusData?.helmet || {};
  const status = statusData?.status || {};
  const latestResolved = events.find((item) => item.type === "location_request:resolved");

  const requestLocation = async () => {
    try {
      if (connection === "connected") {
        send({ type: "location_request:create", helmetId: helmet._id, sourceChannel: "web", reason: "helmet_page_location_request", message: "User requested current helmet location from helmet page" });
      } else {
        await apiPost("/user/location-requests", { helmetId: helmet._id, sourceChannel: "web", reason: "helmet_page_location_request", message: "User requested current helmet location from helmet page" }, session.token);
      }
      setStatusMessage({ type: "success", text: "Location request sent to helmet." });
    } catch (error) {
      setStatusMessage({ type: "error", text: error.message });
    }
  };

  return <UserShell session={session} logout={logout} title="My Helmet"><FormStatus status={statusMessage.text ? statusMessage : null} /><div className="row-between"><div className="subtle">Realtime socket: {connection}</div><button className="btn primary" type="button" onClick={requestLocation}>Request Live Location</button></div><div className="split-panels"><div className="panel-card"><h2>Helmet Information</h2><div className="info-table"><div><span>Helmet ID</span><strong>{helmet.helmetId || helmet.espId || "--"}</strong></div><div><span>Model</span><strong>SmartHelmet Pro v2</strong></div><div><span>Name</span><strong>{helmet.label || "My Helmet"}</strong></div><div><span>Status</span><strong>{helmet.isActive ? "Active" : "Inactive"}</strong></div><div><span>Battery</span><strong>{status.batteryPercentage ?? "--"}%</strong></div><div><span>WiFi Connected</span><strong>{status.online ? "Yes" : "No"}</strong></div><div><span>Last Updated</span><strong>{status.createdAt ? new Date(status.createdAt).toLocaleTimeString() : "--"}</strong></div><div><span>Latest Location</span><strong>{latestResolved?.request?.lastKnownLocation?.mapUrl || "No realtime location yet"}</strong></div></div></div><div className="panel-card"><h2>Sensor Status</h2><div className="sensor-list"><div className="sensor-row"><span>Shock Sensor</span><strong>Active</strong></div><div className="sensor-row"><span>GPS Tracker</span><strong>{status.gpsSignal ? "Active" : "Waiting"}</strong></div><div className="sensor-row"><span>Bluetooth</span><strong>{status.sensors?.bluetooth ? "Connected" : "Connected"}</strong></div><div className="sensor-row"><span>Wear Detection</span><strong>{status.helmetWorn ? "On" : "Off"}</strong></div></div></div></div></UserShell>;
};

export const UserContactsPage = ({ session, logout }) => {
  const { contacts } = useUserData(session);
  const [contactList, setContactList] = useState([]);
  const [form, setForm] = useState({ name: "", relation: "", phoneNumber: "", whatsappNumber: "" });
  const [status, setStatus] = useState({ type: "", text: "" });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");

  useEffect(() => { setContactList(contacts); }, [contacts]);

  const saveContact = async () => {
    try {
      if (editingId) {
        const updated = await apiPut(`/user/contacts/${editingId}`, form, session.token);
        setContactList((current) => current.map((item) => item._id === editingId ? updated : item));
        setStatus({ type: "success", text: "Contact updated successfully." });
      } else {
        const created = await apiPost("/user/contacts", form, session.token);
        setContactList((current) => [...current, created]);
        setStatus({ type: "success", text: "Contact added successfully." });
      }
      setForm({ name: "", relation: "", phoneNumber: "", whatsappNumber: "" });
      setShowForm(false);
      setEditingId("");
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    }
  };

  const editContact = (contact) => {
    setForm({ name: contact.name || "", relation: contact.relation || "", phoneNumber: contact.phoneNumber || "", whatsappNumber: contact.whatsappNumber || "" });
    setEditingId(contact._id);
    setShowForm(true);
    setStatus({ type: "", text: "" });
  };

  const removeContact = async (contactId) => {
    try {
      await apiDelete(`/user/contacts/${contactId}`, session.token);
      setContactList((current) => current.filter((item) => item._id !== contactId));
      setStatus({ type: "success", text: "Contact removed successfully." });
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    }
  };

  return <UserShell session={session} logout={logout} title="Emergency Contacts"><div className="row-between"><div /><button className="btn primary" type="button" onClick={() => { setShowForm((current) => !current); if (showForm) { setEditingId(""); setForm({ name: "", relation: "", phoneNumber: "", whatsappNumber: "" }); } }}>{showForm ? "Close" : "Add Contact"}</button></div><FormStatus status={status} />{showForm ? <div className="panel-card"><div className="form-grid"><label><span>Name</span><input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} /></label><label><span>Relation</span><input value={form.relation} onChange={(e) => setForm((c) => ({ ...c, relation: e.target.value }))} /></label><label><span>Phone</span><input value={form.phoneNumber} onChange={(e) => setForm((c) => ({ ...c, phoneNumber: e.target.value }))} /></label><label><span>WhatsApp</span><input value={form.whatsappNumber} onChange={(e) => setForm((c) => ({ ...c, whatsappNumber: e.target.value }))} /></label></div><button className="btn primary" type="button" onClick={saveContact}>{editingId ? "Update Contact" : "Save Contact"}</button></div> : null}<div className="cards-grid">{contactList.map((contact) => <div key={contact._id} className="contact-card"><div className="contact-head"><span className="avatar-small">{contact.name.slice(0, 1).toUpperCase()}</span><div><strong>{contact.name}</strong><small>{contact.relation}</small></div></div><p>{contact.phoneNumber}</p><div className="contact-actions"><button className="btn back-btn" type="button" onClick={() => editContact(contact)}>Edit</button><button className="btn muted-danger" type="button" onClick={() => removeContact(contact._id)}>Remove</button></div></div>)}</div></UserShell>;
};

export const UserAccidentsPage = ({ session, logout }) => {
  const { accidents } = useUserData(session);
  return <UserShell session={session} logout={logout} title="Accident History"><div className="panel-card"><table className="data-table"><thead><tr><th>Date</th><th>Time</th><th>Location</th><th>Severity</th><th>Status</th></tr></thead><tbody>{accidents.map((item) => <tr key={item._id}><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td><td>{item.location?.mapUrl ? "Karachi, Pakistan" : "Unknown"}</td><td><span className={`status-pill ${item.severity === "severe" ? "danger" : item.severity === "medium" ? "warn" : "ok"}`}>{item.canceled ? "False Alarm" : item.severity}</span></td><td>{item.responseStatus}</td></tr>)}</tbody></table></div></UserShell>;
};

export const UserNotificationsPage = ({ session, logout }) => {
  const { notifications } = useUserData(session);
  const tones = ["warn-note", "ok-note", "danger-note"];
  return <UserShell session={session} logout={logout} title="Notifications"><div className="notification-list">{notifications.map((item, index) => <div key={item._id} className={`notification-card ${tones[index % tones.length]}`}><div><strong>{item.message}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><span>Bell</span></div>)}</div></UserShell>;
};

export const UserProfilePage = ({ session, logout }) => {
  const { profile } = useUserData(session);
  const [form, setForm] = useState({ fullName: "", email: "", phoneNumber: "", cnicNumber: "" });
  const [status, setStatus] = useState({ type: "", text: "" });
  useEffect(() => { if (profile) setForm({ fullName: profile.fullName || "", email: profile.email || "", phoneNumber: profile.phoneNumber || "", cnicNumber: profile.cnicNumber || "" }); }, [profile]);
  const save = async () => {
    try {
      await apiPut("/user/me", form, session.token);
      setStatus({ type: "success", text: "Profile updated successfully." });
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    }
  };
  return <UserShell session={session} logout={logout} title="Profile Settings"><div className="panel-card narrow-panel"><FormStatus status={status} /><div className="form-grid single"><label><span>Full Name</span><input value={form.fullName} onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} /></label><label><span>Email</span><input value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} /></label><label><span>Phone</span><input value={form.phoneNumber} onChange={(e) => setForm((c) => ({ ...c, phoneNumber: e.target.value }))} /></label><label><span>CNIC</span><input value={form.cnicNumber} onChange={(e) => setForm((c) => ({ ...c, cnicNumber: e.target.value }))} /></label></div><button className="btn primary full-btn" type="button" onClick={save}>Save Changes</button></div></UserShell>;
};

export const AdminDashboard = ({ session, logout }) => {
  const { data: dashboard, error, reload } = useAdminBundle(session, "/admin/dashboard");
  const { connection } = useRealtimeSocket(session);
  const recentUsers = dashboard?.recentUsers || [];
  const recentAccidents = dashboard?.recentAccidents || [];
  const metrics = dashboard?.metrics || {};
  const incidentBars = [
    { label: "Minor", value: Math.max(10, recentAccidents.filter((item) => item.severity === "low").length * 20) },
    { label: "Medium", value: Math.max(10, recentAccidents.filter((item) => item.severity === "medium").length * 25) },
    { label: "Severe", value: Math.max(10, recentAccidents.filter((item) => item.severity === "severe").length * 30) }
  ];
  const userBars = [
    { label: "Users", value: Math.min(100, (metrics.totalUsers || 0) * 10), display: metrics.totalUsers || 0 },
    { label: "Helmets", value: Math.min(100, (metrics.totalHelmets || 0) * 10), display: metrics.totalHelmets || 0 },
    { label: "Online", value: Math.min(100, (metrics.onlineHelmets || 0) * 10), display: metrics.onlineHelmets || 0 }
  ];
  return <AdminShell session={session} logout={logout} title="Dashboard Overview" status={error ? { type: "error", text: error } : null}><p className="subtle">Welcome back, Admin. Here's what's happening today.</p><div className="row-between"><div className="subtle">Realtime socket: {connection}</div><button className="btn back-btn" type="button" onClick={reload}>Refresh</button></div><div className="stats-grid four riding-grid"><StatCard icon="US" hint="Live" hintClass="up" title="Total Users" value={metrics.totalUsers ?? 0} /><StatCard icon="HM" tone="green" hint="Live" hintClass="up" title="Active Helmets" value={metrics.onlineHelmets ?? 0} /><StatCard icon="RD" tone="green" hint="Live rides" hintClass="up" title="Riding Mode Active" value={metrics.activeRides ?? 0} /><StatCard icon="IN" tone="red" hint="Today" hintClass="down" title="Incidents Today" value={recentAccidents.length} /><StatCard icon="RS" tone="purple" hint={connection} hintClass="down" title="Realtime Status" value={connection === "connected" ? "Connected" : "Waiting"} /></div><div className="split-panels"><div className="panel-card"><h2>User Growth</h2><SimpleBarChart items={userBars} /></div><div className="panel-card"><h2>Incident Distribution</h2><SimpleBarChart items={incidentBars} /></div></div><div className="split-panels"><div className="panel-card list-panel"><h2>Recent Users</h2>{(recentUsers.length ? recentUsers : [{ fullName: "No users yet", email: "--", isActive: false }]).map((user) => <div className="list-row" key={user.email}><div className="row-user"><span className="avatar-small">{(user.fullName || "NA").slice(0, 1).toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{user.email}</small></div></div><span className={`status-pill ${user.isActive ? "ok" : "neutral"}`}>{user.isActive ? "Active" : "Inactive"}</span></div>)}</div><div className="panel-card list-panel"><h2>Recent Incidents</h2>{(recentAccidents.length ? recentAccidents : [{ helmetId: "No incidents", severity: "low", createdAt: new Date().toISOString(), responseStatus: "pending" }]).map((incident) => <div className="incident-row" key={`${incident._id || incident.helmetId}-${incident.createdAt}`}><div><strong>{incident.user?.fullName || incident.helmetId}</strong><small>{incident.location?.mapUrl ? "Location captured" : "Location pending"}</small><small>{new Date(incident.createdAt).toLocaleString()}</small></div><span className={`status-pill ${incident.severity === "severe" ? "danger" : incident.severity === "medium" ? "warn" : "ok"}`}>{incident.responseStatus || incident.severity}</span></div>)}</div></div></AdminShell>;
};

export const AdminUsersPage = ({ session, logout }) => {
  const { data: users, error, reload } = useAdminBundle(session, "/admin/users");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ fullName: "", cnicNumber: "", email: "", phoneNumber: "", password: "User@12345", isActive: true });

  const openNew = () => { setEditingUser(null); setForm({ fullName: "", cnicNumber: "", email: "", phoneNumber: "", password: "User@12345", isActive: true }); setShowForm(true); };
  const openEdit = (user) => { setEditingUser(user); setForm({ fullName: user.fullName || "", cnicNumber: user.cnicNumber || "", email: user.email || "", phoneNumber: user.phoneNumber || "", password: "User@12345", isActive: !!user.isActive }); setShowForm(true); };

  const save = async () => {
    try {
      if (editingUser) {
        await apiPut(`/admin/users/${editingUser._id}`, { fullName: form.fullName, cnicNumber: form.cnicNumber, email: form.email, phoneNumber: form.phoneNumber, isActive: form.isActive }, session.token);
        setStatus({ type: "success", text: "User updated successfully." });
      } else {
        await apiPost("/admin/users", form, session.token);
        setStatus({ type: "success", text: "User created successfully." });
      }
      setShowForm(false);
      await reload();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  return <AdminShell session={session} logout={logout} title="Users Management" status={error ? { type: "error", text: error } : status}><div className="row-between"><div /><button className="btn primary" type="button" onClick={openNew}>Add User</button></div>{showForm ? <div className="panel-card"><div className="form-grid"><label><span>Full Name</span><input value={form.fullName} onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} /></label><label><span>Email</span><input value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} /></label><label><span>Phone</span><input value={form.phoneNumber} onChange={(e) => setForm((c) => ({ ...c, phoneNumber: e.target.value }))} /></label><label><span>CNIC</span><input value={form.cnicNumber} onChange={(e) => setForm((c) => ({ ...c, cnicNumber: e.target.value }))} /></label>{!editingUser ? <label className="full"><span>Password</span><input type="password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} /></label> : null}</div><div className="row-between"><label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} /> Active</label><button className="btn primary" type="button" onClick={save}>{editingUser ? "Save User" : "Create User"}</button></div></div> : null}<div className="panel-card"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{(users || []).map((user) => <tr key={user._id}><td><div className="row-user"><span className="avatar-small">{user.fullName?.slice(0, 1).toUpperCase()}</span><strong>{user.fullName}</strong></div></td><td>{user.email}</td><td><span className={`status-pill ${user.isActive ? "ok" : "neutral"}`}>{user.isActive ? "Active" : "Inactive"}</span></td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td><div className="table-actions"><button className="btn back-btn" type="button" onClick={() => openEdit(user)}>Edit</button></div></td></tr>)}</tbody></table></div></AdminShell>;
};

export const AdminHelmetsPage = ({ session, logout }) => {
  const { data: helmets, error, reload } = useAdminBundle(session, "/admin/helmets");
  const { data: users } = useAdminBundle(session, "/admin/users");
  const { connection, send } = useRealtimeSocket(session);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [showForm, setShowForm] = useState(false);
  const [editingHelmet, setEditingHelmet] = useState(null);
  const [form, setForm] = useState({ espId: "", secretKey: "", label: "", serialNumber: "", firmwareVersion: "1.0.0", isActive: true, isBlacklisted: false, bluetoothEnabled: true, user: "" });

  const openNew = () => { setEditingHelmet(null); setForm({ espId: "", secretKey: "", label: "", serialNumber: "", firmwareVersion: "1.0.0", isActive: true, isBlacklisted: false, bluetoothEnabled: true, user: "" }); setShowForm(true); };
  const openEdit = (helmet) => { setEditingHelmet(helmet); setForm({ espId: helmet.espId || "", secretKey: "", label: helmet.label || "", serialNumber: helmet.serialNumber || "", firmwareVersion: helmet.firmwareVersion || "1.0.0", isActive: !!helmet.isActive, isBlacklisted: !!helmet.isBlacklisted, bluetoothEnabled: !!helmet.bluetoothEnabled, user: helmet.user?._id || "" }); setShowForm(true); };

  const save = async () => {
    try {
      if (editingHelmet) {
        await apiPut(`/admin/helmets/${editingHelmet._id}`, { label: form.label, serialNumber: form.serialNumber, firmwareVersion: form.firmwareVersion, isActive: form.isActive, isBlacklisted: form.isBlacklisted, bluetoothEnabled: form.bluetoothEnabled, user: form.user || null }, session.token);
        setStatus({ type: "success", text: "Helmet updated successfully." });
      } else {
        await apiPost("/admin/helmets", { helmetId: form.espId, secretKey: form.secretKey, label: form.label, serialNumber: form.serialNumber, firmwareVersion: form.firmwareVersion, user: form.user || null }, session.token);
        setStatus({ type: "success", text: "Helmet created successfully." });
      }
      setShowForm(false);
      await reload();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  const requestLocation = async (helmet) => {
    try {
      if (connection === "connected") {
        send({ type: "location_request:create", helmetId: helmet._id, reason: "admin_live_location_check", message: `Admin requested live location for ${helmet.helmetId || helmet.espId}` });
      } else {
        await apiPost("/admin/location-requests", { helmetId: helmet._id, reason: "admin_live_location_check", message: `Admin requested live location for ${helmet.helmetId || helmet.espId}` }, session.token);
      }
      setStatus({ type: "success", text: `Location request sent to ${helmet.helmetId || helmet.espId}.` });
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  return <AdminShell session={session} logout={logout} title="Helmets Management" status={error ? { type: "error", text: error } : status}><div className="row-between"><div className="subtle">Realtime socket: {connection}</div><button className="btn primary" type="button" onClick={openNew}>Add Helmet</button></div>{showForm ? <div className="panel-card"><div className="form-grid"><label><span>Helmet ID</span><input value={form.espId} disabled={!!editingHelmet} onChange={(e) => setForm((c) => ({ ...c, espId: e.target.value }))} /></label><label><span>Secret Key</span><input value={form.secretKey} disabled={!!editingHelmet} onChange={(e) => setForm((c) => ({ ...c, secretKey: e.target.value }))} /></label><label><span>Label</span><input value={form.label} onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))} /></label><label><span>Serial Number</span><input value={form.serialNumber} onChange={(e) => setForm((c) => ({ ...c, serialNumber: e.target.value }))} /></label><label><span>Firmware</span><input value={form.firmwareVersion} onChange={(e) => setForm((c) => ({ ...c, firmwareVersion: e.target.value }))} /></label><label><span>Owner</span><select value={form.user} onChange={(e) => setForm((c) => ({ ...c, user: e.target.value }))}><option value="">Unassigned</option>{(users || []).map((user) => <option key={user._id} value={user._id}>{user.fullName}</option>)}</select></label></div><div className="row-between admin-flags"><label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} /> Active</label><label className="check"><input type="checkbox" checked={form.isBlacklisted} onChange={(e) => setForm((c) => ({ ...c, isBlacklisted: e.target.checked }))} /> Blacklisted</label><label className="check"><input type="checkbox" checked={form.bluetoothEnabled} onChange={(e) => setForm((c) => ({ ...c, bluetoothEnabled: e.target.checked }))} /> Bluetooth</label><button className="btn primary" type="button" onClick={save}>{editingHelmet ? "Save Helmet" : "Create Helmet"}</button></div></div> : null}<div className="panel-card"><table className="data-table"><thead><tr><th>Helmet ID</th><th>Owner</th><th>Model</th><th>Battery</th><th>Status</th><th>Location</th><th>Actions</th></tr></thead><tbody>{(helmets || []).map((helmet) => <tr key={helmet._id}><td>{helmet.helmetId || helmet.espId}</td><td>{helmet.ownerName}</td><td>{helmet.firmwareVersion || "1.0.0"}</td><td><div className="battery-cell"><div className="battery-bar"><div style={{ width: `${helmet.batteryPercentage ?? 0}%` }} /></div><span>{helmet.batteryPercentage ?? "--"}%</span></div></td><td><span className={`status-pill ${helmet.online ? "ok" : "neutral"}`}>{helmet.online ? "Online" : "Offline"}</span></td><td>{helmet.locationLabel || "Unknown"}</td><td><div className="table-actions"><button className="btn primary" type="button" onClick={() => requestLocation(helmet)}>Request Location</button><button className="btn back-btn" type="button" onClick={() => openEdit(helmet)}>Edit</button></div></td></tr>)}</tbody></table></div></AdminShell>;
};

export const AdminIncidentsPage = ({ session, logout }) => {
  const { data: incidents, error, reload } = useAdminBundle(session, "/admin/incidents");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [selected, setSelected] = useState(null);

  const updateIncidentStatus = async (incident, responseStatus) => {
    try {
      await apiPut(`/admin/incidents/${incident._id}`, { responseStatus }, session.token);
      setStatus({ type: "success", text: "Incident updated successfully." });
      await reload();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  const loadDetails = async (incidentId) => {
    try {
      const details = await apiGet(`/admin/incidents/${incidentId}`, session.token);
      setSelected(details);
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  return <AdminShell session={session} logout={logout} title="Incidents Management" status={error ? { type: "error", text: error } : status}><div className="split-panels"><div className="incident-card-list">{(incidents || []).map((incident) => <div key={incident._id} className="panel-card incident-admin-card"><div className="row-between"><div><div className="incident-title-row"><strong>{incident.user?.fullName || incident.helmetId}</strong><span className={`status-pill ${incident.canceled ? "ok" : incident.severity === "severe" ? "danger" : incident.severity === "medium" ? "warn" : "ok"}`}>{incident.canceled ? "False Alarm" : incident.severity}</span></div><p>{incident.location?.mapUrl ? "Location captured" : "Location unavailable"}</p><small>{new Date(incident.createdAt).toLocaleString()}</small></div><span className={`status-pill ${incident.responseStatus === "sent" ? "ok" : incident.responseStatus === "pending" ? "warn" : "neutral"}`}>{incident.responseStatus}</span></div><div className="table-actions"><button className="btn primary" type="button" onClick={() => loadDetails(incident._id)}>View Details</button><button className="btn primary" type="button" onClick={() => updateIncidentStatus(incident, "sent")}>Mark Resolved</button><button className="btn back-btn" type="button" onClick={() => updateIncidentStatus(incident, "pending")}>In Progress</button></div></div>)}</div><div className="panel-card">{selected ? <div className="detail-stack"><h2>Incident Details</h2><div className="info-table"><div><span>Rider</span><strong>{selected.incident.user?.fullName || "--"}</strong></div><div><span>Helmet</span><strong>{selected.incident.helmet?.espId || selected.incident.helmetId || "--"}</strong></div><div><span>Severity</span><strong>{selected.incident.severity}</strong></div><div><span>Status</span><strong>{selected.incident.responseStatus}</strong></div><div><span>Battery</span><strong>{selected.incident.batteryPercentage ?? "--"}%</strong></div><div><span>Map</span><strong>{selected.incident.location?.mapUrl || "Unavailable"}</strong></div></div><h3>Recent Notifications</h3><div className="notification-list compact-list">{(selected.notifications || []).map((item) => <div key={item._id} className="notification-card ok-note"><div><strong>{item.channel.toUpperCase()}</strong><small>{item.message}</small></div><span>{item.status}</span></div>)}</div></div> : <div className="empty-note">Select an incident to inspect rider, helmet, location, and notification history.</div>}</div></div></AdminShell>;
};

export const AdminSettingsPage = ({ session, logout }) => {
  const { data: settings, error, reload } = useAdminBundle(session, "/admin/settings");
  const map = useMemo(() => normalizeSettingMap(settings), [settings]);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [form, setForm] = useState({
    smsEnabled: true,
    whatsappEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
    autoResponse: false,
    adminEmail: session?.actor?.email || "",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioSmsFrom: "",
    twilioWhatsappFrom: "",
    googleApiKey: "",
    geolocationEnabled: true
  });

  useEffect(() => {
    setForm({
      smsEnabled: map.notifications?.smsEnabled ?? true,
      whatsappEnabled: map.notifications?.whatsappEnabled ?? true,
      emailEnabled: map.notifications?.emailEnabled ?? true,
      pushEnabled: map.notifications?.pushEnabled ?? true,
      autoResponse: map.features?.offlineSync ?? false,
      adminEmail: session?.actor?.email || "",
      twilioAccountSid: map.notifications?.twilio?.accountSid || "",
      twilioAuthToken: map.notifications?.twilio?.authToken || "",
      twilioSmsFrom: map.notifications?.twilio?.smsFrom || "",
      twilioWhatsappFrom: map.notifications?.twilio?.whatsappFrom || "",
      googleApiKey: map.maps?.googleApiKey || "",
      geolocationEnabled: map.maps?.geolocationEnabled ?? true
    });
  }, [settings, session]);

  const save = async () => {
    try {
      await apiPut("/admin/settings/notifications", {
        value: {
          ...(map.notifications || {}),
          smsEnabled: form.smsEnabled,
          whatsappEnabled: form.whatsappEnabled,
          emailEnabled: form.emailEnabled,
          pushEnabled: form.pushEnabled,
          twilio: {
            ...(map.notifications?.twilio || {}),
            accountSid: form.twilioAccountSid,
            authToken: form.twilioAuthToken,
            smsFrom: form.twilioSmsFrom,
            whatsappFrom: form.twilioWhatsappFrom
          }
        }
      }, session.token);
      await apiPut("/admin/settings/maps", {
        value: {
          ...(map.maps || {}),
          googleApiKey: form.googleApiKey,
          geolocationEnabled: form.geolocationEnabled
        }
      }, session.token);
      await apiPut("/admin/settings/features", { value: { ...(map.features || {}), offlineSync: form.autoResponse } }, session.token);
      setStatus({ type: "success", text: "System, Twilio, and maps settings saved." });
      await reload();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  return <AdminShell session={session} logout={logout} title="Settings" status={error ? { type: "error", text: error } : status}><div className="split-panels"><div className="panel-card"><h2>System Settings</h2><div className="settings-toggle-list"><label className="settings-toggle-row"><div><strong>Email Notifications</strong><small>Receive email alerts for critical incidents</small></div><input type="checkbox" checked={form.emailEnabled} onChange={(e) => setForm((c) => ({ ...c, emailEnabled: e.target.checked }))} /></label><label className="settings-toggle-row"><div><strong>SMS Alerts</strong><small>Receive SMS for emergency situations</small></div><input type="checkbox" checked={form.smsEnabled} onChange={(e) => setForm((c) => ({ ...c, smsEnabled: e.target.checked }))} /></label><label className="settings-toggle-row"><div><strong>WhatsApp Alerts</strong><small>Send emergency alerts through Twilio WhatsApp</small></div><input type="checkbox" checked={form.whatsappEnabled} onChange={(e) => setForm((c) => ({ ...c, whatsappEnabled: e.target.checked }))} /></label><label className="settings-toggle-row"><div><strong>Push Notifications</strong><small>Keep app and portal notification delivery enabled</small></div><input type="checkbox" checked={form.pushEnabled} onChange={(e) => setForm((c) => ({ ...c, pushEnabled: e.target.checked }))} /></label><label className="settings-toggle-row"><div><strong>Auto Response</strong><small>Automatically process false alarm and sync workflows</small></div><input type="checkbox" checked={form.autoResponse} onChange={(e) => setForm((c) => ({ ...c, autoResponse: e.target.checked }))} /></label></div></div><div className="panel-card"><h2>Twilio Credentials</h2><div className="form-grid"><label><span>Account SID</span><input value={form.twilioAccountSid} onChange={(e) => setForm((c) => ({ ...c, twilioAccountSid: e.target.value }))} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" /></label><label><span>Auth Token</span><input type="password" value={form.twilioAuthToken} onChange={(e) => setForm((c) => ({ ...c, twilioAuthToken: e.target.value }))} placeholder="Twilio auth token" /></label><label><span>SMS From</span><input value={form.twilioSmsFrom} onChange={(e) => setForm((c) => ({ ...c, twilioSmsFrom: e.target.value }))} placeholder="+1234567890" /></label><label><span>WhatsApp From</span><input value={form.twilioWhatsappFrom} onChange={(e) => setForm((c) => ({ ...c, twilioWhatsappFrom: e.target.value }))} placeholder="whatsapp:+1234567890" /></label></div><p className="subtle">These values are optional until you enable live SMS or WhatsApp delivery.</p></div></div><div className="split-panels"><div className="panel-card"><h2>Maps and Geolocation</h2><div className="form-grid"><label className="full"><span>Google Maps API Key</span><input value={form.googleApiKey} onChange={(e) => setForm((c) => ({ ...c, googleApiKey: e.target.value }))} placeholder="AIza..." /></label></div><div className="settings-toggle-list"><label className="settings-toggle-row"><div><strong>Google Geolocation Backup</strong><small>Allow server and helmet to use Google geolocation when GPS is weak</small></div><input type="checkbox" checked={form.geolocationEnabled} onChange={(e) => setForm((c) => ({ ...c, geolocationEnabled: e.target.checked }))} /></label></div></div><div className="panel-card"><h2>Admin Account</h2><div className="form-grid single"><label><span>Admin Email</span><input value={form.adminEmail} disabled readOnly /></label></div><button className="btn primary full-btn" type="button" onClick={save}>Save Changes</button></div></div></AdminShell>;
};

export const AdminCmsPage = ({ session, logout }) => {
  const { data: bundle, error, reload } = useAdminBundle(session, "/admin/cms");
  const settings = bundle?.settings || {};
  const [status, setStatus] = useState({ type: "", text: "" });
  const [branding, setBranding] = useState({ siteName: "", headerLogoText: "", footerLogoText: "", faviconUrl: "" });
  const [configuration, setConfiguration] = useState({ companyName: "", email1: "", email2: "", phone1: "", phone2: "", whatsapp: "", address: "", copyrights: "", facebook: "", twitter: "", instagram: "", linkedin: "" });
  const [homepage, setHomepage] = useState({ heroTitle: "", heroSubtitle: "", ctaTitle: "", ctaSubtitle: "" });
  const [bannerForm, setBannerForm] = useState({ title: "", targetUrl: "/register", imageUrl: "", active: true });
  const [innerBannerForm, setInnerBannerForm] = useState({ title: "", slug: "", subtitle: "", imageUrl: "", active: true });
  const [faqForm, setFaqForm] = useState({ question: "", answer: "", order: 0, active: true });
  const [blogForm, setBlogForm] = useState({ title: "", slug: "", excerpt: "", content: "", coverImageUrl: "", published: false, tags: "" });

  useEffect(() => {
    setBranding({ siteName: settings.branding?.siteName || "SmartHelmet", headerLogoText: settings.branding?.headerLogoText || "SmartHelmet", footerLogoText: settings.branding?.footerLogoText || "SmartHelmet", faviconUrl: settings.branding?.faviconUrl || "" });
    setConfiguration({ companyName: settings.configuration?.companyName || "SmartHelmet", email1: settings.configuration?.email1 || "", email2: settings.configuration?.email2 || "", phone1: settings.configuration?.phone1 || "", phone2: settings.configuration?.phone2 || "", whatsapp: settings.configuration?.whatsapp || "", address: settings.configuration?.address || "", copyrights: settings.configuration?.copyrights || "", facebook: settings.configuration?.facebook || "", twitter: settings.configuration?.twitter || "", instagram: settings.configuration?.instagram || "", linkedin: settings.configuration?.linkedin || "" });
    setHomepage({ heroTitle: bundle?.homepageContent?.heroTitle || "", heroSubtitle: bundle?.homepageContent?.heroSubtitle || "", ctaTitle: bundle?.homepageContent?.sections?.ctaTitle || "", ctaSubtitle: bundle?.homepageContent?.sections?.ctaSubtitle || "" });
  }, [bundle]);

  const uploadToField = async (file, target) => {
    try {
      const uploaded = await apiUpload("/admin/uploads", file, session.token);
      target(uploaded.url);
      setStatus({ type: "success", text: "Image uploaded successfully." });
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  const saveBranding = async () => {
    try {
      await apiPut("/admin/settings/branding", { value: branding }, session.token);
      setStatus({ type: "success", text: "Branding updated." });
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const saveConfiguration = async () => {
    try {
      await apiPut("/admin/settings/configuration", { value: configuration }, session.token);
      setStatus({ type: "success", text: "Configuration updated." });
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const saveHomepage = async () => {
    try {
      await apiPut("/admin/cms/homepage", { heroTitle: homepage.heroTitle, heroSubtitle: homepage.heroSubtitle, sections: { ctaTitle: homepage.ctaTitle, ctaSubtitle: homepage.ctaSubtitle } }, session.token);
      setStatus({ type: "success", text: "Homepage content updated." });
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const saveBanner = async () => {
    try {
      await apiPost("/admin/banners", bannerForm, session.token);
      setBannerForm({ title: "", targetUrl: "/register", imageUrl: "", active: true });
      setStatus({ type: "success", text: "Banner created." });
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const toggleBanner = async (banner) => {
    try {
      await apiPut(`/admin/banners/${banner._id}`, { active: !banner.active }, session.token);
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const saveInnerBanner = async () => {
    try {
      await apiPost("/admin/inner-banners", innerBannerForm, session.token);
      setInnerBannerForm({ title: "", slug: "", subtitle: "", imageUrl: "", active: true });
      setStatus({ type: "success", text: "Inner banner created." });
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const toggleInnerBanner = async (item) => {
    try {
      await apiPut(`/admin/inner-banners/${item._id}`, { active: !item.active }, session.token);
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const saveFaq = async () => {
    try {
      await apiPost("/admin/faqs", { ...faqForm, order: Number(faqForm.order) }, session.token);
      setFaqForm({ question: "", answer: "", order: 0, active: true });
      setStatus({ type: "success", text: "FAQ created." });
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const toggleFaq = async (item) => {
    try {
      await apiPut(`/admin/faqs/${item._id}`, { active: !item.active }, session.token);
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const saveBlog = async () => {
    try {
      await apiPost("/admin/blogs", { ...blogForm, tags: blogForm.tags.split(",").map((item) => item.trim()).filter(Boolean) }, session.token);
      setBlogForm({ title: "", slug: "", excerpt: "", content: "", coverImageUrl: "", published: false, tags: "" });
      setStatus({ type: "success", text: "Blog post created." });
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  const toggleBlog = async (item) => {
    try {
      await apiPut(`/admin/blogs/${item._id}`, { published: !item.published }, session.token);
      await reload();
    } catch (err) { setStatus({ type: "error", text: err.message }); }
  };

  return <AdminShell session={session} logout={logout} title="CMS Management" status={error ? { type: "error", text: error } : status}><div className="split-panels"><div className="panel-card"><h2>Logo Management</h2><div className="form-grid"><label><span>Site Name</span><input value={branding.siteName} onChange={(e) => setBranding((c) => ({ ...c, siteName: e.target.value }))} /></label><label><span>Header Logo Text</span><input value={branding.headerLogoText} onChange={(e) => setBranding((c) => ({ ...c, headerLogoText: e.target.value }))} /></label><label><span>Footer Logo Text</span><input value={branding.footerLogoText} onChange={(e) => setBranding((c) => ({ ...c, footerLogoText: e.target.value }))} /></label><label><span>Favicon URL</span><input value={branding.faviconUrl} onChange={(e) => setBranding((c) => ({ ...c, faviconUrl: e.target.value }))} /></label><label className="full"><span>Upload Favicon</span><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadToField(e.target.files[0], (url) => setBranding((c) => ({ ...c, faviconUrl: url })))} /></label></div><button className="btn primary" type="button" onClick={saveBranding}>Save Branding</button></div><div className="panel-card"><h2>Configuration</h2><div className="form-grid"><label><span>Company Name</span><input value={configuration.companyName} onChange={(e) => setConfiguration((c) => ({ ...c, companyName: e.target.value }))} /></label><label><span>Email 1</span><input value={configuration.email1} onChange={(e) => setConfiguration((c) => ({ ...c, email1: e.target.value }))} /></label><label><span>Email 2</span><input value={configuration.email2} onChange={(e) => setConfiguration((c) => ({ ...c, email2: e.target.value }))} /></label><label><span>Phone 1</span><input value={configuration.phone1} onChange={(e) => setConfiguration((c) => ({ ...c, phone1: e.target.value }))} /></label><label><span>Phone 2</span><input value={configuration.phone2} onChange={(e) => setConfiguration((c) => ({ ...c, phone2: e.target.value }))} /></label><label><span>WhatsApp</span><input value={configuration.whatsapp} onChange={(e) => setConfiguration((c) => ({ ...c, whatsapp: e.target.value }))} /></label><label className="full"><span>Address</span><input value={configuration.address} onChange={(e) => setConfiguration((c) => ({ ...c, address: e.target.value }))} /></label><label><span>Facebook</span><input value={configuration.facebook} onChange={(e) => setConfiguration((c) => ({ ...c, facebook: e.target.value }))} /></label><label><span>Twitter</span><input value={configuration.twitter} onChange={(e) => setConfiguration((c) => ({ ...c, twitter: e.target.value }))} /></label><label><span>Instagram</span><input value={configuration.instagram} onChange={(e) => setConfiguration((c) => ({ ...c, instagram: e.target.value }))} /></label><label><span>LinkedIn</span><input value={configuration.linkedin} onChange={(e) => setConfiguration((c) => ({ ...c, linkedin: e.target.value }))} /></label><label className="full"><span>Copyright Text</span><input value={configuration.copyrights} onChange={(e) => setConfiguration((c) => ({ ...c, copyrights: e.target.value }))} /></label></div><button className="btn primary" type="button" onClick={saveConfiguration}>Save Configuration</button></div></div><div className="split-panels"><div className="panel-card"><h2>Homepage Content</h2><div className="form-grid"><label className="full"><span>Hero Title</span><input value={homepage.heroTitle} onChange={(e) => setHomepage((c) => ({ ...c, heroTitle: e.target.value }))} /></label><label className="full"><span>Hero Subtitle</span><textarea rows="4" value={homepage.heroSubtitle} onChange={(e) => setHomepage((c) => ({ ...c, heroSubtitle: e.target.value }))} /></label><label className="full"><span>CTA Title</span><input value={homepage.ctaTitle} onChange={(e) => setHomepage((c) => ({ ...c, ctaTitle: e.target.value }))} /></label><label className="full"><span>CTA Subtitle</span><textarea rows="3" value={homepage.ctaSubtitle} onChange={(e) => setHomepage((c) => ({ ...c, ctaSubtitle: e.target.value }))} /></label></div><button className="btn primary" type="button" onClick={saveHomepage}>Save Homepage</button></div><div className="panel-card"><h2>Banner Management</h2><div className="form-grid"><label><span>Banner Title</span><input value={bannerForm.title} onChange={(e) => setBannerForm((c) => ({ ...c, title: e.target.value }))} /></label><label><span>Target URL</span><input value={bannerForm.targetUrl} onChange={(e) => setBannerForm((c) => ({ ...c, targetUrl: e.target.value }))} /></label><label className="full"><span>Image URL</span><input value={bannerForm.imageUrl} onChange={(e) => setBannerForm((c) => ({ ...c, imageUrl: e.target.value }))} /></label><label className="full"><span>Upload Banner</span><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadToField(e.target.files[0], (url) => setBannerForm((c) => ({ ...c, imageUrl: url })))} /></label></div><div className="row-between"><label className="check"><input type="checkbox" checked={bannerForm.active} onChange={(e) => setBannerForm((c) => ({ ...c, active: e.target.checked }))} /> Active</label><button className="btn primary" type="button" onClick={saveBanner}>Add New Banner</button></div><div className="banner-list">{(bundle?.banners || []).map((banner) => <div key={banner._id} className="banner-row"><div><strong>{banner.title}</strong><small>{banner.targetUrl}</small></div><button className="btn small-btn" type="button" onClick={() => toggleBanner(banner)}>{banner.active ? "Deactivate" : "Activate"}</button></div>)}</div></div></div><div className="split-panels"><div className="panel-card"><h2>Inner Banner Management</h2><div className="form-grid"><label><span>Title</span><input value={innerBannerForm.title} onChange={(e) => setInnerBannerForm((c) => ({ ...c, title: e.target.value }))} /></label><label><span>Slug</span><input value={innerBannerForm.slug} onChange={(e) => setInnerBannerForm((c) => ({ ...c, slug: e.target.value }))} /></label><label className="full"><span>Subtitle</span><input value={innerBannerForm.subtitle} onChange={(e) => setInnerBannerForm((c) => ({ ...c, subtitle: e.target.value }))} /></label><label className="full"><span>Image URL</span><input value={innerBannerForm.imageUrl} onChange={(e) => setInnerBannerForm((c) => ({ ...c, imageUrl: e.target.value }))} /></label><label className="full"><span>Upload Inner Banner</span><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadToField(e.target.files[0], (url) => setInnerBannerForm((c) => ({ ...c, imageUrl: url })))} /></label></div><div className="row-between"><label className="check"><input type="checkbox" checked={innerBannerForm.active} onChange={(e) => setInnerBannerForm((c) => ({ ...c, active: e.target.checked }))} /> Active</label><button className="btn primary" type="button" onClick={saveInnerBanner}>Save Inner Banner</button></div><div className="banner-list">{(bundle?.innerBanners || []).map((item) => <div key={item._id} className="banner-row"><div><strong>{item.title}</strong><small>{item.slug}</small></div><button className="btn small-btn" type="button" onClick={() => toggleInnerBanner(item)}>{item.active ? "Deactivate" : "Activate"}</button></div>)}</div></div><div className="panel-card"><h2>FAQ Management</h2><div className="form-grid"><label className="full"><span>Question</span><input value={faqForm.question} onChange={(e) => setFaqForm((c) => ({ ...c, question: e.target.value }))} /></label><label className="full"><span>Answer</span><textarea rows="4" value={faqForm.answer} onChange={(e) => setFaqForm((c) => ({ ...c, answer: e.target.value }))} /></label><label><span>Order</span><input value={faqForm.order} onChange={(e) => setFaqForm((c) => ({ ...c, order: e.target.value }))} /></label></div><div className="row-between"><label className="check"><input type="checkbox" checked={faqForm.active} onChange={(e) => setFaqForm((c) => ({ ...c, active: e.target.checked }))} /> Active</label><button className="btn primary" type="button" onClick={saveFaq}>Add FAQ</button></div><div className="list-panel compact-list">{(bundle?.faqs || []).map((item) => <div key={item._id} className="list-row"><div><strong>{item.question}</strong><small>{item.answer}</small></div><button className="btn small-btn" type="button" onClick={() => toggleFaq(item)}>{item.active ? "Deactivate" : "Activate"}</button></div>)}</div></div></div><div className="split-panels"><div className="panel-card"><h2>Blog Management</h2><div className="form-grid"><label><span>Title</span><input value={blogForm.title} onChange={(e) => setBlogForm((c) => ({ ...c, title: e.target.value }))} /></label><label><span>Slug</span><input value={blogForm.slug} onChange={(e) => setBlogForm((c) => ({ ...c, slug: e.target.value }))} /></label><label className="full"><span>Excerpt</span><input value={blogForm.excerpt} onChange={(e) => setBlogForm((c) => ({ ...c, excerpt: e.target.value }))} /></label><label className="full"><span>Content</span><textarea rows="5" value={blogForm.content} onChange={(e) => setBlogForm((c) => ({ ...c, content: e.target.value }))} /></label><label><span>Tags (comma separated)</span><input value={blogForm.tags} onChange={(e) => setBlogForm((c) => ({ ...c, tags: e.target.value }))} /></label><label className="full"><span>Cover Image URL</span><input value={blogForm.coverImageUrl} onChange={(e) => setBlogForm((c) => ({ ...c, coverImageUrl: e.target.value }))} /></label><label className="full"><span>Upload Cover Image</span><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadToField(e.target.files[0], (url) => setBlogForm((c) => ({ ...c, coverImageUrl: url })))} /></label></div><div className="row-between"><label className="check"><input type="checkbox" checked={blogForm.published} onChange={(e) => setBlogForm((c) => ({ ...c, published: e.target.checked }))} /> Published</label><button className="btn primary" type="button" onClick={saveBlog}>Save Blog</button></div><div className="list-panel compact-list">{(bundle?.blogs || []).map((item) => <div key={item._id} className="list-row"><div><strong>{item.title}</strong><small>{item.slug}</small></div><button className="btn small-btn" type="button" onClick={() => toggleBlog(item)}>{item.published ? "Unpublish" : "Publish"}</button></div>)}</div></div><div className="panel-card"><h2>Messages and Support</h2><h3>Contact Messages</h3><div className="list-panel compact-list">{(bundle?.contactMessages || []).slice(0, 6).map((item) => <div key={item._id} className="list-row"><div><strong>{item.name}</strong><small>{item.email} | {item.subject}</small><small>{item.message}</small></div></div>)}</div><h3>Support Tickets</h3><div className="list-panel compact-list">{(bundle?.supportTickets || []).slice(0, 6).map((item) => <div key={item._id} className="list-row"><div><strong>{item.subject}</strong><small>{item.user?.fullName || "Guest"}</small><small>{item.message}</small></div><span className={`status-pill ${item.status === "closed" ? "neutral" : item.status === "in_progress" ? "warn" : "ok"}`}>{item.status}</span></div>)}</div></div></div></AdminShell>;
};

export const AdminEmailPage = ({ session, logout }) => {
  const { data: settings, error, reload } = useAdminBundle(session, "/admin/settings");
  const map = useMemo(() => normalizeSettingMap(settings), [settings]);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [form, setForm] = useState({ fromName: "", fromEmail: "", host: "", port: 587, encryption: "TLS", username: "", password: "", isDefault: true, status: "inactive" });

  useEffect(() => {
    setForm({ fromName: map.email?.fromName || "", fromEmail: map.email?.fromEmail || "", host: map.email?.host || "", port: map.email?.port || 587, encryption: map.email?.encryption || "TLS", username: map.email?.username || "", password: map.email?.password || "", isDefault: map.email?.isDefault ?? true, status: map.email?.status || "inactive" });
  }, [settings]);

  const save = async () => {
    try {
      await apiPut("/admin/settings/email", { value: form }, session.token);
      setStatus({ type: "success", text: "Email integration updated." });
      await reload();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  return <AdminShell session={session} logout={logout} title="Email Integration" status={error ? { type: "error", text: error } : status}><div className="panel-card"><p className="subtle">Configure SMTP and default sender for transactional and alert emails.</p><div className="form-grid"><label><span>From Name</span><input value={form.fromName} onChange={(e) => setForm((c) => ({ ...c, fromName: e.target.value }))} /></label><label><span>From Email</span><input value={form.fromEmail} onChange={(e) => setForm((c) => ({ ...c, fromEmail: e.target.value }))} /></label><label><span>SMTP Host</span><input value={form.host} onChange={(e) => setForm((c) => ({ ...c, host: e.target.value }))} /></label><label><span>SMTP Port</span><input value={form.port} onChange={(e) => setForm((c) => ({ ...c, port: e.target.value }))} /></label><label><span>Encryption</span><select value={form.encryption} onChange={(e) => setForm((c) => ({ ...c, encryption: e.target.value }))}><option value="TLS">TLS</option><option value="SSL">SSL</option></select></label><label><span>Status</span><select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}><option value="inactive">Inactive</option><option value="active">Active</option></select></label><label><span>SMTP Username</span><input value={form.username} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} /></label><label><span>SMTP Password</span><input type="password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} /></label></div><div className="row-between"><label className="check"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((c) => ({ ...c, isDefault: e.target.checked }))} /> Set as default</label><button className="btn primary" type="button" onClick={save}>Save and Continue</button></div></div></AdminShell>;
};

export const AdminMaintenancePage = ({ session, logout }) => {
  const { data: settings, error, reload } = useAdminBundle(session, "/admin/settings");
  const map = useMemo(() => normalizeSettingMap(settings), [settings]);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [form, setForm] = useState({ enabled: false, endsAt: "", visitorMessage: "Website under maintenance" });

  useEffect(() => {
    setForm({ enabled: map.maintenance?.enabled ?? false, endsAt: map.maintenance?.endsAt || "", visitorMessage: map.maintenance?.visitorMessage || "Website under maintenance" });
  }, [settings]);

  const save = async () => {
    try {
      await apiPut("/admin/settings/maintenance", { value: form }, session.token);
      setStatus({ type: "success", text: "Maintenance timer updated." });
      await reload();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  return <AdminShell session={session} logout={logout} title="Maintenance Timer" status={error ? { type: "error", text: error } : status}><div className="panel-card"><div className={`maintenance-banner ${form.enabled ? "on" : "off"}`}>{form.enabled ? "Maintenance mode is ON." : "Maintenance mode is OFF. Visitors currently see the website normally."}</div><div className="form-grid"><label><span>Maintenance ends at</span><input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((c) => ({ ...c, endsAt: e.target.value }))} /></label><label className="full"><span>Visitor message</span><input value={form.visitorMessage} onChange={(e) => setForm((c) => ({ ...c, visitorMessage: e.target.value }))} /></label></div><div className="row-between"><label className="check"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((c) => ({ ...c, enabled: e.target.checked }))} /> Enable maintenance mode</label><button className="btn primary" type="button" onClick={save}>Start / Update Timer</button></div></div></AdminShell>;
};

export const AdminSecurityPage = ({ session, logout }) => {
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [status, setStatus] = useState({ type: "", text: "" });

  const save = async () => {
    try {
      await apiPut("/admin/account/password", form, session.token);
      setStatus({ type: "success", text: "Admin password updated successfully." });
      setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  return <AdminShell session={session} logout={logout} title="Change Admin Password" status={status}><div className="panel-card narrow-panel"><div className="form-grid single"><label><span>Old Password</span><input type="password" value={form.oldPassword} onChange={(e) => setForm((c) => ({ ...c, oldPassword: e.target.value }))} /></label><label><span>New Password</span><input type="password" value={form.newPassword} onChange={(e) => setForm((c) => ({ ...c, newPassword: e.target.value }))} /></label><label><span>Confirm Password</span><input type="password" value={form.confirmPassword} onChange={(e) => setForm((c) => ({ ...c, confirmPassword: e.target.value }))} /></label></div><button className="btn primary full-btn" type="button" onClick={save}>Update Password</button></div></AdminShell>;
};







