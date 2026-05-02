import { useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import {
  fluxQuery, fmt, fmtUptime,
  fetchHostServices, fetchSeriesForHost,
  fetchLatestSnmpForHost, fetchSeriesSnmpForHost,
  fetchInterfacesForHost
} from "./api.js";
import { TYPE_META } from "./DeviceCard.jsx";

// ── OID → readable label mapping (flexible for future OIDs) ──────────────────
const OID_MAP = {
  "iso.3.6.1.4.1.2021.10.1.3.1": { label:"CPU Load",        unit:"",    color:"#6622cc", chartable:true  },
  "iso.3.6.1.4.1.2021.10.1.3.2": { label:"CPU Load 5m",     unit:"",    color:"#9944cc", chartable:true  },
  "iso.3.6.1.4.1.2021.10.1.3.3": { label:"CPU Load 15m",    unit:"",    color:"#bb66cc", chartable:true  },
  "iso.3.6.1.4.1.2021.4.6.0":    { label:"Memory Free",     unit:"KB",  color:"#1a9a5a", chartable:true  },
  "iso.3.6.1.4.1.2021.4.5.0":    { label:"Memory Total",    unit:"KB",  color:"#2a8a6a", chartable:false },
  "iso.3.6.1.4.1.2021.4.11.0":   { label:"Mem Available",   unit:"KB",  color:"#1a9a5a", chartable:true  },
  "iso.3.6.1.2.1.1.3.0":         { label:"Uptime",          unit:"ticks", color:"#aa7700", chartable:false },
  "iso.3.6.1.2.1.2.2.1.8.1":     { label:"Interface Status",unit:"",    color:"#0055cc", chartable:false },
  "iso.3.6.1.2.1.2.2.1.8.2":     { label:"Interface2 Status",unit:"",   color:"#0066cc", chartable:false },
  "iso.3.6.1.2.1.6.9.0":         { label:"TCP Connections", unit:"",    color:"#cc7700", chartable:true  },
  "iso.3.6.1.2.1.2.2.1.10.1":    { label:"Bytes In",        unit:"B",   color:"#1a9a5a", chartable:true  },
  "iso.3.6.1.2.1.2.2.1.16.1":    { label:"Bytes Out",       unit:"B",   color:"#6622cc", chartable:true  },
};

// Services to skip in charts (info-only)
const SKIP_CHART_SERVICES = ["System_Uptime","Interface_Status","TCP_Connections_Total"];
const SKIP_CHART_SERVICES_DISPLAY = ["System Uptime","Interface Status","TCP Connections Total"];

// GPU field names
const GPU_FIELDS = ["gpu","memory","encoder","decoder","temperature"];

function resolveField(fieldName) {
  return OID_MAP[fieldName] || { label: fieldName, unit:"", color:"#667788", chartable:true };
}

function isSkipService(svc) {
  return SKIP_CHART_SERVICES.includes(svc) ||
         SKIP_CHART_SERVICES_DISPLAY.includes(svc) ||
         svc.toLowerCase().includes("uptime") ||
         svc.toLowerCase().includes("interface_status") ||
         svc.toLowerCase().includes("tcp");
}

function isGpuService(svc) {
  return svc.toLowerCase().includes("gpu");
}

function isChartableService(svc, fields) {
  if (isSkipService(svc) || isGpuService(svc)) return false;
  return Object.keys(fields).some(f => resolveField(f).chartable);
}

// ── UI Components ─────────────────────────────────────────────────────────────
const TOOLTIP = {
  background:"#fff", border:"1px solid var(--dash-border)",
  borderRadius:8, fontFamily:"'JetBrains Mono',monospace",
  fontSize:12, color:"var(--dash-text)"
};
const GRID = "#e8d8ec";

function StatCard({ title, value, unit, color }) {
  return (
    <div style={{
      background:"var(--dash-card)", borderRadius:10, padding:"18px 22px",
      borderLeft:`4px solid ${color}`, minWidth:150,
      boxShadow:"0 2px 10px rgba(151,125,255,0.08)",
      border:`1px solid var(--dash-border)`,
      borderLeftColor: color
    }}>
      <div style={{ fontSize:12, color:"var(--dash-text3)", marginBottom:8, fontWeight:600 }}>{title}</div>
      <div style={{ fontSize:24, fontWeight:800, color, fontFamily:"'JetBrains Mono',monospace" }}>
        {value ?? "—"}
        <span style={{ fontSize:12, color:"var(--dash-text3)", marginLeft:6 }}>{unit}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background:"var(--dash-card)", borderRadius:12, padding:28,
      marginBottom:20, border:"1px solid var(--dash-border)",
      boxShadow:"0 2px 12px rgba(151,125,255,0.06)"
    }}>
      <div style={{ fontSize:13, fontWeight:700, color:"var(--dash-text2)", marginBottom:20 }}>{title}</div>
      {children}
    </div>
  );
}

function InfoCard({ title, fields }) {
  return (
    <div style={{
      background:"var(--dash-card)", borderRadius:10, padding:"16px 20px",
      border:"1px solid var(--dash-border)",
      boxShadow:"0 2px 8px rgba(151,125,255,0.06)", minWidth:200
    }}>
      <div style={{ fontSize:12, fontWeight:700, color:"var(--dash-text2)", marginBottom:12, letterSpacing:0.5 }}>{title}</div>
      {Object.entries(fields).map(([f, v]) => {
        const meta = resolveField(f);
        return (
          <div key={f} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
            <span style={{ color:"var(--dash-text3)", fontWeight:500 }}>{meta.label}</span>
            <span style={{ color:meta.color, fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>
              {f === "iso.3.6.1.2.1.1.3.0" ? fmtUptime(v) :
               f === "iso.3.6.1.2.1.2.2.1.8.1" ? (v === 1 ? "UP ✓" : "DOWN ✗") :
               typeof v === "number" ? v.toFixed(2) : v}
              {" "}{meta.unit !== "ticks" ? meta.unit : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── GPU Chart ─────────────────────────────────────────────────────────────────
function GpuSection({ hostname, serviceKey, fields }) {
  const [series, setSeries] = useState([]);

  async function load() {
    const results = await Promise.all(
      GPU_FIELDS.filter(f => fields[f] !== undefined).map(async f => {
        const rows = await fetchSeriesForHost(hostname, serviceKey, f, 30);
        return { field:f, rows };
      })
    );
    const map = {};
    results.forEach(({ field, rows }) => {
      rows.forEach(r => {
        const t = fmt(r._time);
        if (!map[t]) map[t] = { time:t };
        map[t][field] = parseFloat(r._value);
      });
    });
    setSeries(Object.values(map).slice(-30));
  }

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [hostname]);

  const GPU_COLORS = { gpu:"#6622cc", memory:"#1a9a5a", encoder:"#aa7700", decoder:"#0055cc", temperature:"#cc2244" };

  return (
    <ChartCard title="🎮 GPU Health — Last 30 Minutes">
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:20 }}>
        {Object.entries(fields).map(([f, v]) => (
          <StatCard
            key={f}
            title={`GPU ${f.charAt(0).toUpperCase() + f.slice(1)}`}
            value={f === "temperature" ? `${v}°C` : `${v}%`}
            unit=""
            color={GPU_COLORS[f] || "#667788"}
          />
        ))}
      </div>
      {series.length > 0 && (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="time" tick={{ fill:"var(--dash-text3)", fontSize:11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill:"var(--dash-text3)", fontSize:11 }} />
            <Tooltip contentStyle={TOOLTIP} />
            <Legend wrapperStyle={{ fontSize:12 }} />
            {GPU_FIELDS.filter(f => fields[f] !== undefined).map(f => (
              <Line key={f} type="monotone" dataKey={f}
                stroke={GPU_COLORS[f] || "#667788"} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ── Generic chartable service ─────────────────────────────────────────────────
function ServiceChart({ hostname, serviceKey, fields }) {
  const [series, setSeries] = useState([]);
  const chartableFields = Object.keys(fields).filter(f => resolveField(f).chartable);

  async function load() {
    const results = await Promise.all(
      chartableFields.map(async f => {
        const rows = await fetchSeriesForHost(hostname, serviceKey, f, 30);
        return { field:f, rows };
      })
    );
    const map = {};
    results.forEach(({ field, rows }) => {
      rows.forEach(r => {
        const t = fmt(r._time);
        if (!map[t]) map[t] = { time:t };
        const meta = resolveField(field);
        map[t][meta.label] = parseFloat(r._value);
      });
    });
    setSeries(Object.values(map).slice(-30));
  }

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [hostname, serviceKey]);

  const firstField = chartableFields[0];
  const firstMeta  = firstField ? resolveField(firstField) : null;

  if (series.length === 0) return null;

  return (
    <ChartCard title={`${serviceKey.replace(/_/g," ")} — Last 30 Minutes`}>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={series}>
          <defs>
            {chartableFields.map(f => {
              const meta = resolveField(f);
              return (
                <linearGradient key={f} id={`grad_${f}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={meta.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={meta.color} stopOpacity={0}   />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="time" tick={{ fill:"var(--dash-text3)", fontSize:11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fill:"var(--dash-text3)", fontSize:11 }} />
          <Tooltip contentStyle={TOOLTIP} />
          <Legend wrapperStyle={{ fontSize:12 }} />
          {chartableFields.map(f => {
            const meta = resolveField(f);
            return (
              <Area key={f} type="monotone" dataKey={meta.label}
                stroke={meta.color} fill={`url(#grad_${f})`} strokeWidth={2} />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Server Detail — fully auto-discovering ────────────────────────────────────
function ServerDetail({ device }) {
  const [serviceData, setServiceData] = useState({});
  const [loading,     setLoading]     = useState(true);

  async function load() {
    const services = await fetchHostServices(device.name, 30);
    setServiceData(services);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [device.name]);

  if (loading) return (
    <div style={{ textAlign:"center", padding:60, color:"var(--dash-text3)", fontSize:15 }}>
      Loading metrics for {device.name}...
    </div>
  );

  if (Object.keys(serviceData).length === 0) return (
    <div style={{
      background:"rgba(204,34,68,0.05)", border:"1px solid rgba(204,34,68,0.2)",
      borderRadius:10, padding:48, textAlign:"center"
    }}>
      <div style={{ fontSize:28, marginBottom:12 }}>⚠</div>
      <div style={{ color:"var(--dash-red)", fontSize:15, fontWeight:700, marginBottom:6 }}>No data available</div>
      <div style={{ color:"var(--dash-text3)", fontSize:13 }}>No metrics found for {device.name} in the last 30 minutes</div>
    </div>
  );

  // Separate services into categories
  const gpuServices     = Object.entries(serviceData).filter(([svc]) => isGpuService(svc));
  const infoServices    = Object.entries(serviceData).filter(([svc]) => isSkipService(svc) && !isGpuService(svc));
  const chartServices   = Object.entries(serviceData).filter(([svc]) => isChartableService(svc, serviceData[svc]));

  // Build top stat cards from chartable services
  const statCards = [];
  chartServices.forEach(([svc, fields]) => {
    Object.entries(fields).forEach(([f, v]) => {
      const meta = resolveField(f);
      statCards.push({ title:`${svc.replace(/_/g," ")} — ${meta.label}`, value:v.toFixed(2), unit:meta.unit === "ticks" ? "" : meta.unit, color:meta.color });
    });
  });

  return (
    <>
      {/* Stat cards for chartable services */}
      {statCards.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:14, marginBottom:28 }}>
          {statCards.map((s,i) => <StatCard key={i} {...s} />)}
        </div>
      )}

      {/* Charts for each chartable service */}
      {chartServices.map(([svc, fields]) => (
        <ServiceChart key={svc} hostname={device.name} serviceKey={svc} fields={fields} />
      ))}

      {/* GPU section — special chart */}
      {gpuServices.map(([svc, fields]) => (
        <GpuSection key={svc} hostname={device.name} serviceKey={svc} fields={fields} />
      ))}

      {/* Info-only services — no chart, just values */}
      {infoServices.length > 0 && (
        <ChartCard title="ℹ System Information">
          <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
            {infoServices.map(([svc, fields]) => (
              <InfoCard key={svc} title={svc.replace(/_/g," ")} fields={fields} />
            ))}
          </div>
        </ChartCard>
      )}
    </>
  );
}

// ── Network detail (router/switch) ────────────────────────────────────────────
function NetworkDetail({ device }) {
  const [cpuData,   setCpuData]   = useState([]);
  const [memData,   setMemData]   = useState([]);
  const [ifaceData, setIfaceData] = useState([]);
  const [latest,    setLatest]    = useState({});
  const [offline,   setOffline]   = useState(false);

  const snmpIp = device.snmpIp || device.ip;

  async function load() {
    const cpu = await fetchSeriesSnmpForHost(snmpIp, "cpu_load");
    if (cpu.length === 0) { setOffline(true); return; }
    setOffline(false);
    setCpuData(cpu.map(r => ({ time:fmt(r._time), cpu:parseFloat(r._value) })));

    const mem = await fetchSeriesSnmpForHost(snmpIp, "memory_free");
    setMemData(mem.map(r => ({ time:fmt(r._time), mem:Math.round(parseFloat(r._value)/1024) })));

    const ifaces = await fetchInterfacesForHost(snmpIp);
    const ifMap  = {};
    ifaces.forEach(r => {
      const name = r.ifName || "unknown";
      if (!ifMap[name]) ifMap[name] = { name };
      ifMap[name][r._field] = Math.round(parseFloat(r._value)/1024);
    });
    setIfaceData(Object.values(ifMap).filter(i => i.name !== "Nu0"));

    const m = {};
    for (const f of ["cpu_load","memory_free","uptime"]) {
      const rows = await fluxQuery(`
        from(bucket:"nagios_metrics")
          |> range(start:-5m)
          |> filter(fn:(r) => r._measurement == "snmp_device")
          |> filter(fn:(r) => r.agent_host == "${snmpIp}")
          |> filter(fn:(r) => r._field == "${f}")
          |> last()
      `);
      if (rows.length > 0) m[f] = parseFloat(rows[0]._value);
    }
    setLatest(m);
  }

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [snmpIp]);

  if (offline) return (
    <div style={{
      background:"rgba(204,34,68,0.05)", border:"1px solid rgba(204,34,68,0.2)",
      borderRadius:10, padding:48, textAlign:"center"
    }}>
      <div style={{ fontSize:32, marginBottom:12 }}>⚠</div>
      <div style={{ color:"var(--dash-red)", fontSize:15, fontWeight:700, marginBottom:6 }}>Device Unreachable</div>
      <div style={{ color:"var(--dash-text3)", fontSize:13 }}>No SNMP data — check connectivity to {snmpIp}</div>
    </div>
  );

  return (
    <>
      <div style={{ display:"flex", flexWrap:"wrap", gap:14, marginBottom:28 }}>
        <StatCard title="CPU Load"    value={latest.cpu_load}                                          unit="%" color="#6622cc" />
        <StatCard title="Memory Free" value={latest.memory_free ? Math.round(latest.memory_free/1024) : null} unit="KB" color="#1a9a5a" />
        <StatCard title="Uptime"      value={latest.uptime ? fmtUptime(latest.uptime) : null}          unit=""  color="#aa7700" />
        <StatCard title="IP"          value={snmpIp}                                                   unit=""  color="#0055cc" />
      </div>

      <ChartCard title="CPU Load % — Last 30 Minutes">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={cpuData}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6622cc" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6622cc" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="time" tick={{ fill:"var(--dash-text3)", fontSize:11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill:"var(--dash-text3)", fontSize:11 }} domain={[0,100]} />
            <Tooltip contentStyle={TOOLTIP} />
            <Area type="monotone" dataKey="cpu" stroke="#6622cc" fill="url(#cg)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Memory Free (KB) — Last 30 Minutes">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={memData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="time" tick={{ fill:"var(--dash-text3)", fontSize:11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill:"var(--dash-text3)", fontSize:11 }} />
            <Tooltip contentStyle={TOOLTIP} />
            <Line type="monotone" dataKey="mem" stroke="#1a9a5a" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {ifaceData.length > 0 && (
        <ChartCard title="Interface Traffic (KB) — Current">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ifaceData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="name" tick={{ fill:"var(--dash-text3)", fontSize:11 }} />
              <YAxis tick={{ fill:"var(--dash-text3)", fontSize:11 }} />
              <Tooltip contentStyle={TOOLTIP} />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <Bar dataKey="ifInOctets"  name="In (KB)"  fill="#1a9a5a" radius={[4,4,0,0]} />
              <Bar dataKey="ifOutOctets" name="Out (KB)" fill="#6622cc" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DeviceDetail({ device, onBack }) {
  const meta = TYPE_META[device.type] || TYPE_META.server;
  return (
    <div style={{ padding:36 }}>
      <button onClick={onBack} style={{
        background:"transparent", border:"1px solid var(--dash-border2)",
        color:"var(--dash-text3)", padding:"9px 20px", borderRadius:8,
        cursor:"pointer", marginBottom:28, fontSize:14, fontWeight:600,
        transition:"all 0.2s"
      }}
      onMouseEnter={e => { e.target.style.borderColor="var(--dash-red)"; e.target.style.color="var(--dash-red)"; }}
      onMouseLeave={e => { e.target.style.borderColor="var(--dash-border2)"; e.target.style.color="var(--dash-text3)"; }}
      >← Back to Dashboard</button>

      <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:32 }}>
        <span style={{ fontSize:44 }}>{meta.icon}</span>
        <div>
          <div style={{ fontSize:12, color:"var(--dash-text3)", marginBottom:6, fontWeight:600 }}>
            {meta.label} — Detail View
          </div>
          <h2 style={{
            fontSize:24, fontWeight:900, color:"var(--dash-text)",
            fontFamily:"'Orbitron',monospace", letterSpacing:1
          }}>{device.alias || device.name}</h2>
          <div style={{ fontSize:14, color:"var(--dash-text3)", marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>
            {device.ip} &nbsp;·&nbsp; {device.services.length} services monitored
          </div>
        </div>
      </div>

      {device.type === "server"
        ? <ServerDetail device={device} />
        : <NetworkDetail device={device} />
      }
    </div>
  );
}
