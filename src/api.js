const TOKEN = "ME7Ru9Pmc67WURVx4Naxiilcl0rB18I7BwNHJGNISUshMqslXK8aeyRoMlZizLzAbfvgHnaVBMdIcmG4WwDHjQ==";
const ORG   = "nagios-lab";
const BASE  = "http://localhost:8086";

export async function fluxQuery(query) {
  const res = await fetch(`${BASE}/api/v2/query?org=${ORG}`, {
    method: "POST",
    headers: {
      "Authorization": `Token ${TOKEN}`,
      "Content-Type": "application/vnd.flux",
      "Accept": "application/csv"
    },
    body: query
  });
  const text = await res.text();
  const rows = [];
  const lines = text.trim().split("\n");
  const headers = lines[0]?.split(",") || [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i] || lines[i].startsWith("#")) continue;
    const vals = lines[i].split(",");
    const obj  = {};
    headers.forEach((h, idx) => { obj[h.trim()] = vals[idx]?.trim(); });
    if (obj._value && obj._time) rows.push(obj);
  }
  return rows;
}

export function fmt(t) {
  const d = new Date(t);
  return d.getHours().toString().padStart(2,"0") + ":" +
         d.getMinutes().toString().padStart(2,"0") + ":" +
         d.getSeconds().toString().padStart(2,"0");
}

export function fmtUptime(ticks) {
  const secs = Math.floor(ticks / 100);
  const h    = Math.floor(secs / 3600);
  const m    = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export async function fetchDevices() {
  const res = await fetch('http://localhost:3001/api/devices');
  return res.json();
}

// Get all services+fields for a specific host — auto-discovery
export async function fetchHostServices(hostname, minutes = 15) {
  const rows = await fluxQuery(`
    from(bucket:"nagios_metrics")
      |> range(start:-${minutes}m)
      |> filter(fn:(r) => r._measurement == "nagios_perfdata")
      |> filter(fn:(r) => r.host == "${hostname}")
      |> keep(columns: ["service","_field","_value","_time"])
      |> group(columns: ["service","_field"])
      |> last()
  `);
  const map = {};
  rows.forEach(r => {
    if (!r.service || !r._field) return;
    const svc = r.service.trim();
    if (!map[svc]) map[svc] = {};
    map[svc][r._field] = parseFloat(r._value);
  });
  return map;
}

// Get latest value of a field for a specific host
export async function fetchLatestForHost(hostname, field, minutes = 15) {
  const rows = await fluxQuery(`
    from(bucket:"nagios_metrics")
      |> range(start:-${minutes}m)
      |> filter(fn:(r) => r._measurement == "nagios_perfdata")
      |> filter(fn:(r) => r.host == "${hostname}")
      |> filter(fn:(r) => r._field == "${field}")
      |> last()
  `);
  return rows.length > 0 ? parseFloat(rows[0]._value) : null;
}

// Get time series for a specific host + service + field
export async function fetchSeriesForHost(hostname, service, field, minutes = 30) {
  return fluxQuery(`
    from(bucket:"nagios_metrics")
      |> range(start:-${minutes}m)
      |> filter(fn:(r) => r._measurement == "nagios_perfdata")
      |> filter(fn:(r) => r.host == "${hostname}")
      |> filter(fn:(r) => r.service == "${service}")
      |> filter(fn:(r) => r._field == "${field}")
      |> aggregateWindow(every:1m, fn:mean, createEmpty:false)
  `);
}

// SNMP — filtered by agent_host IP
export async function fetchLatestSnmpForHost(snmpIp, field, minutes = 5) {
  const rows = await fluxQuery(`
    from(bucket:"nagios_metrics")
      |> range(start:-${minutes}m)
      |> filter(fn:(r) => r._measurement == "snmp_device")
      |> filter(fn:(r) => r.agent_host == "${snmpIp}")
      |> filter(fn:(r) => r._field == "${field}")
      |> last()
  `);
  return rows.length > 0 ? parseFloat(rows[0]._value) : null;
}

export async function fetchSeriesSnmpForHost(snmpIp, field, minutes = 30) {
  return fluxQuery(`
    from(bucket:"nagios_metrics")
      |> range(start:-${minutes}m)
      |> filter(fn:(r) => r._measurement == "snmp_device")
      |> filter(fn:(r) => r.agent_host == "${snmpIp}")
      |> filter(fn:(r) => r._field == "${field}")
      |> aggregateWindow(every:1m, fn:mean, createEmpty:false)
  `);
}

export async function fetchInterfacesForHost(snmpIp) {
  return fluxQuery(`
    from(bucket:"nagios_metrics")
      |> range(start:-5m)
      |> filter(fn:(r) => r._measurement == "snmp_interface")
      |> filter(fn:(r) => r.agent_host == "${snmpIp}")
      |> filter(fn:(r) => r._field == "ifInOctets" or r._field == "ifOutOctets")
      |> last()
  `);
}

// Legacy exports for compatibility
export async function fetchLatestNagios(field) {
  return fetchLatestForHost("localhost", field);
}
export async function fetchLatestSnmp(field) {
  return fetchLatestSnmpForHost("192.168.1.1", field);
}
export async function fetchSeriesNagios(service, field, minutes = 30) {
  return fetchSeriesForHost("localhost", service, field, minutes);
}
export async function fetchSeriesSnmp(field, minutes = 30) {
  return fetchSeriesSnmpForHost("192.168.1.1", field, minutes);
}
export async function fetchInterfaces() {
  return fetchInterfacesForHost("192.168.1.1");
}
