export const TYPE_META = {
  server:  { icon:"🖥",  label:"Server",  color:"#6622cc" },
  router:  { icon:"🔀",  label:"Router",  color:"#aa7700" },
  switch:  { icon:"🔌",  label:"Switch",  color:"#0055cc" },
  printer: { icon:"🖨",  label:"Printer", color:"#667788" },
  windows: { icon:"🪟",  label:"Windows", color:"#0077aa" },
};

export default function DeviceCard({ device, summary, onClick }) {
  const meta    = TYPE_META[device.type] || TYPE_META.server;
  const hasCrit = summary?.criticals > 0 || summary?.online === false;
  const hasWarn = summary?.warnings > 0;
  const status  = hasCrit ? "CRITICAL" : hasWarn ? "WARNING" : "ONLINE";
  const sColor  = hasCrit ? "#cc2244" : hasWarn ? "#aa7700" : "#1a9a5a";
  const sBg     = hasCrit ? "rgba(204,34,68,0.08)" : hasWarn ? "rgba(170,119,0,0.08)" : "rgba(26,154,90,0.08)";
  const sBorder = hasCrit ? "rgba(204,34,68,0.25)" : hasWarn ? "rgba(170,119,0,0.25)" : "rgba(26,154,90,0.25)";

  return (
    <div onClick={onClick} style={{
      background:"var(--dash-card)",
      border:`1px solid ${hasCrit ? "rgba(204,34,68,0.2)" : "var(--dash-border)"}`,
      borderTop:`3px solid ${meta.color}`,
      borderRadius:14, padding:26,
      cursor:"pointer", transition:"all 0.2s",
      width:280,
      boxShadow: hasCrit
        ? "0 2px 16px rgba(204,34,68,0.12)"
        : "0 2px 16px rgba(151,125,255,0.08)"
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-5px)";
      e.currentTarget.style.boxShadow = `0 12px 32px rgba(151,125,255,0.18)`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = hasCrit ? "0 2px 16px rgba(204,34,68,0.12)" : "0 2px 16px rgba(151,125,255,0.08)";
    }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:30 }}>{meta.icon}</span>
          <span style={{ fontSize:12, color:"var(--dash-text3)", fontWeight:600, letterSpacing:0.5 }}>{meta.label}</span>
        </div>
        <div style={{
          background:sBg, color:sColor,
          fontSize:12, fontWeight:700, padding:"5px 11px",
          borderRadius:6, border:`1px solid ${sBorder}`
        }}>
          {hasCrit
            ? <span style={{ animation:"blink 1.2s infinite" }}>● {status}</span>
            : `● ${status}`
          }
        </div>
      </div>

      {/* Name + IP */}
      <div style={{
        fontSize:18, fontWeight:800, color:"var(--dash-text)",
        fontFamily:"'Orbitron',monospace", marginBottom:5, letterSpacing:0.5
      }}>{device.name}</div>
      <div style={{
        fontSize:14, color:"var(--dash-text3)", marginBottom:20,
        fontFamily:"'JetBrains Mono',monospace", fontWeight:500
      }}>{device.ip}</div>

      {/* Divider */}
      <div style={{ height:1, background:"var(--dash-border)", marginBottom:18 }} />

      {/* Stats */}
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        {summary?.load   != null && <Stat label="Load"     value={summary.load.toFixed(2)}                 color={summary.load > 4 ? "#cc2244" : "#1a9a5a"} />}
        {summary?.cpu    != null && <Stat label="CPU"      value={`${summary.cpu}%`}                       color={summary.cpu > 80 ? "#cc2244" : "#1a9a5a"} />}
        {summary?.ping   != null && <Stat label="Ping"     value={`${summary.ping.toFixed(2)} ms`}         color="#1a9a5a" />}
        {summary?.disk   != null && <Stat label="Disk"     value={`${summary.disk.toFixed(0)} MiB`}        color="#6622cc" />}
        {summary?.memory != null && <Stat label="Mem Free" value={`${Math.round(summary.memory/1024)} KB`} color="#0055cc" />}
        {summary?.users  != null && <Stat label="Users"    value={summary.users}                           color="#2b061f" />}
        {!summary && <div style={{ fontSize:14, color:"var(--dash-text3)" }}>Loading metrics...</div>}
      </div>

      {/* Footer */}
      <div style={{ marginTop:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:13, color:"var(--dash-text3)", fontWeight:500 }}>{device.services.length} services</span>
        <span style={{ fontSize:13, color:meta.color, fontWeight:700 }}>View details →</span>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontSize:14, color:"var(--dash-text2)", fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:14, fontWeight:700, color, fontFamily:"'JetBrains Mono',monospace" }}>{value}</span>
    </div>
  );
}
