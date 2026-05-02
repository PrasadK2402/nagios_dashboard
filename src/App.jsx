import { useState, useEffect } from "react";
import Login from "./Login.jsx";
import DeviceCard, { TYPE_META } from "./DeviceCard.jsx";
import DeviceDetail from "./DeviceDetail.jsx";
import { fetchDevices, fetchHostServices, fetchLatestSnmpForHost, fluxQuery } from "./api.js";

async function buildSummary(device) {
  try {
    if (device.type === "server") {
      // Use 15min window to avoid timing gaps
      const services = await fetchHostServices(device.name, 15);
      const hasData  = Object.keys(services).length > 0;

      // Extract metrics
      const load  = services["Current_Load"]?.load1    ?? null;
      const ping  = services["PING"]?.rta              ?? null;
      const disk  = services["Root_Partition"]?.root   ?? null;
      const users = services["Current_Users"]?.users   ?? null;
      const swap  = services["Swap_Usage"]?.swap       ?? null;
      const procs = services["Total_Processes"]?.procs ?? null;

      // orange_lab_server specific
      const cpu1min  = services["CPU_Load_1min"]?.["1"]    ??
                       services["CPU Load 1min"]?.["1"]    ?? null;
      const memFree  = services["Memory_Free"]?.memFreeBytes ??
                       services["Memory Free"]?.memFreeBytes ?? null;
      const gpuOk    = services["Nvidia_GPU_Health"] != null ||
                       services["Nvidia GPU Health"] != null;

      // ✅ Only CRITICAL if truly no data at all
      const online   = hasData;
      const criticals = online ? 0 : 1;

      return {
        load, ping, disk, users, swap, procs,
        cpu1min, memFree, gpuOk,
        warnings: 0, criticals, online, services
      };

    } else {
      const snmpIp = device.snmpIp;
      if (!snmpIp) return { warnings:0, criticals:1, online:false };

      const [cpu, memory] = await Promise.all([
        fetchLatestSnmpForHost(snmpIp, "cpu_load",    5),
        fetchLatestSnmpForHost(snmpIp, "memory_free", 5),
      ]);
      const online = cpu !== null || memory !== null;
      return { cpu, memory, warnings:0, criticals: online ? 0 : 1, online };
    }
  } catch(e) {
    return { warnings:0, criticals:1, online:false };
  }
}

function GroupSection({ title, icon, devices, summaries, onSelect }) {
  if (devices.length === 0) return null;
  const totalCrit = devices.filter(d => summaries[d.name]?.criticals > 0).length;
  return (
    <div style={{ marginBottom:48 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <span style={{ fontSize:20 }}>{icon}</span>
        <span style={{
          fontFamily:"'Orbitron',monospace", fontSize:14,
          fontWeight:700, color:"var(--dash-text2)", letterSpacing:3
        }}>{title}</span>
        <span style={{
          background:"rgba(151,125,255,0.15)", color:"var(--dash-accent)",
          fontSize:13, padding:"3px 12px", borderRadius:20,
          border:"1px solid var(--dash-border2)", fontWeight:700
        }}>{devices.length}</span>
        {totalCrit > 0 && (
          <span style={{
            background:"rgba(204,34,68,0.1)", color:"var(--dash-red)",
            fontSize:12, padding:"3px 12px", borderRadius:20,
            border:"1px solid rgba(204,34,68,0.3)", fontWeight:700
          }}>⚠ {totalCrit} CRITICAL</span>
        )}
        <div style={{ flex:1, height:1, background:"var(--dash-border)", marginLeft:8 }} />
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:20 }}>
        {devices.map(d => (
          <DeviceCard
            key={d.name}
            device={d}
            summary={summaries[d.name]}
            onClick={() => onSelect(d)}
          />
        ))}
      </div>
    </div>
  );
}

function Navbar({ user, onLogout, deviceCount }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position:"sticky", top:0, zIndex:100,
      background:"rgba(242,230,238,0.95)",
      borderBottom:"1px solid var(--dash-border)",
      backdropFilter:"blur(12px)",
      padding:"0 36px",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      height:62, boxShadow:"0 2px 16px rgba(151,125,255,0.1)"
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:28 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{
            width:10, height:10, borderRadius:"50%",
            background:"linear-gradient(135deg, #ffccf2, #977dff)",
            animation:"pulseGlow 2s infinite"
          }} />
          <span style={{
            fontFamily:"'Orbitron',monospace", fontWeight:900, fontSize:17,
            letterSpacing:4,
            background:"linear-gradient(90deg, #6622cc, #977dff, #0033ff)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"
          }}>LABWATCH</span>
        </div>
        <span style={{ color:"var(--dash-border2)", fontSize:18 }}>/</span>
        <span style={{ fontSize:14, color:"var(--dash-text3)", fontFamily:"'JetBrains Mono',monospace", fontWeight:500 }}>
          Network Monitor
        </span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:24 }}>
        <span style={{ fontSize:14, color:"var(--dash-text3)", fontWeight:500 }}>
          {deviceCount} devices online
        </span>
        <span style={{
          fontSize:14, fontFamily:"'JetBrains Mono',monospace", fontWeight:700,
          color:"var(--dash-accent)"
        }}>● LIVE &nbsp;{time}</span>
        <span style={{ fontSize:14, color:"var(--dash-text2)", fontWeight:600 }}>
          {user?.split("@")[0]}
        </span>
        <button onClick={onLogout} style={{
          background:"transparent", border:"1px solid var(--dash-border2)",
          color:"var(--dash-text3)", fontSize:13, padding:"7px 18px",
          borderRadius:6, cursor:"pointer", fontWeight:600,
          transition:"all 0.2s"
        }}
        onMouseEnter={e => { e.target.style.borderColor="var(--dash-red)"; e.target.style.color="var(--dash-red)"; }}
        onMouseLeave={e => { e.target.style.borderColor="var(--dash-border2)"; e.target.style.color="var(--dash-text3)"; }}
        >Logout</button>
      </div>
    </div>
  );
}

export default function App() {
  const [user,       setUser]       = useState(null);
  const [devices,    setDevices]    = useState([]);
  const [summaries,  setSummaries]  = useState({});
  const [selected,   setSelected]   = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading,    setLoading]    = useState(true);

  async function loadAll() {
    try {
      const devs = await fetchDevices();
      setDevices(devs);
      setLoading(false);
      const sumMap = {};
      await Promise.all(devs.map(async d => {
        sumMap[d.name] = await buildSummary(d);
      }));
      setSummaries(sumMap);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch(e) { setLoading(false); }
  }

  useEffect(() => {
    if (!user) return;
    loadAll();
    const id = setInterval(loadAll, 30000);
    return () => clearInterval(id);
  }, [user]);

  if (!user) return <Login onLogin={setUser} />;

  if (selected) return (
    <div style={{ minHeight:"100vh", background:"var(--dash-bg)" }}>
      <Navbar user={user} onLogout={() => { setUser(null); setSelected(null); }} deviceCount={devices.length} />
      <DeviceDetail device={selected} onBack={() => setSelected(null)} />
    </div>
  );

  const servers  = devices.filter(d => d.type === "server");
  const routers  = devices.filter(d => d.type === "router");
  const switches = devices.filter(d => d.type === "switch");
  const others   = devices.filter(d => !["server","router","switch"].includes(d.type));
  const totalCrit = Object.values(summaries).filter(s => s?.criticals > 0).length;
  const totalOk   = devices.length - totalCrit;

  return (
    <div style={{ minHeight:"100vh", background:"var(--dash-bg)" }}>
      <Navbar user={user} onLogout={() => setUser(null)} deviceCount={devices.length} />
      <div style={{ padding:"36px 36px 60px", position:"relative", zIndex:1 }}>

        {/* Summary Bar */}
        <div style={{ display:"flex", gap:16, marginBottom:44, flexWrap:"wrap", alignItems:"center" }}>
          {[
            { label:"Total Devices", value:devices.length, color:"var(--dash-text)"  },
            { label:"Servers",       value:servers.length,  color:"#6622cc"           },
            { label:"Routers",       value:routers.length,  color:"#aa7700"           },
            { label:"Switches",      value:switches.length, color:"#0055cc"           },
            { label:"Online",        value:totalOk,         color:"var(--dash-green)" },
            { label:"Critical",      value:totalCrit,       color:"var(--dash-red)"   },
          ].map(s => (
            <div key={s.label} style={{
              background:"var(--dash-card)",
              border:"1px solid var(--dash-border)",
              borderRadius:12, padding:"18px 26px", minWidth:130,
              boxShadow:"0 2px 12px rgba(151,125,255,0.08)"
            }}>
              <div style={{ fontSize:12, color:"var(--dash-text3)", marginBottom:8, fontWeight:600 }}>{s.label}</div>
              <div style={{ fontSize:32, fontWeight:800, color:s.color, fontFamily:"'Orbitron',monospace" }}>{s.value}</div>
            </div>
          ))}
          <div style={{ marginLeft:"auto", fontSize:14, color:"var(--dash-text3)", fontWeight:500 }}>
            Last sync: <span style={{ color:"var(--dash-accent)", fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>
              {lastUpdate ?? "loading..."}
            </span>
          </div>
        </div>

        {loading
          ? <div style={{ color:"var(--dash-text3)", textAlign:"center", padding:80, fontSize:16 }}>
              Loading devices...
            </div>
          : <>
              <GroupSection title="SERVERS"       icon="🖥"  devices={servers}  summaries={summaries} onSelect={setSelected} />
              <GroupSection title="ROUTERS"       icon="🔀"  devices={routers}  summaries={summaries} onSelect={setSelected} />
              <GroupSection title="SWITCHES"      icon="🔌"  devices={switches} summaries={summaries} onSelect={setSelected} />
              <GroupSection title="OTHER DEVICES" icon="📡"  devices={others}   summaries={summaries} onSelect={setSelected} />
            </>
        }
      </div>
    </div>
  );
}
