const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());

const INFLUX_BASE   = 'http://localhost:8086';
const INFLUX_ORG    = 'nagios-lab';
const INFLUX_TOKEN  = 'ME7Ru9Pmc67WURVx4Naxiilcl0rB18I7BwNHJGNISUshMqslXK8aeyRoMlZizLzAbfvgHnaVBMdIcmG4WwDHjQ==';
const INFLUX_BUCKET = 'nagios_metrics';

// ✅ KEY: Only show devices that sent data in last 5 minutes
const ACTIVE_WINDOW = '-5m';

async function fluxQuery(query) {
  const res = await fetch(`${INFLUX_BASE}/api/v2/query?org=${INFLUX_ORG}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${INFLUX_TOKEN}`,
      'Content-Type': 'application/vnd.flux',
      'Accept': 'application/csv'
    },
    body: query
  });
  const text = await res.text();
  const rows = [];
  const lines = text.trim().split('\n');
  const headers = lines[0]?.split(',') || [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i] || lines[i].startsWith('#')) continue;
    const vals = lines[i].split(',');
    const obj  = {};
    headers.forEach((h, idx) => { obj[h.trim()] = vals[idx]?.trim(); });
    rows.push(obj);
  }
  return rows;
}

function detectType(name) {
  const n = name.toLowerCase();
  if (n.includes('cisco') || n.includes('router') || n.includes('vyos')) return 'router';
  if (n.includes('switch') || n.includes('linksys'))                      return 'switch';
  if (n.includes('printer') || n.includes('hplj'))                        return 'printer';
  if (n.includes('win'))                                                   return 'windows';
  return 'server';
}

app.get('/api/devices', async (req, res) => {
  try {
    // ✅ Only hosts that sent perfdata in last 5 minutes
    const perfHosts = await fluxQuery(`
      from(bucket:"${INFLUX_BUCKET}")
        |> range(start:${ACTIVE_WINDOW})
        |> filter(fn:(r) => r._measurement == "nagios_perfdata")
        |> keep(columns: ["host"])
        |> distinct(column: "host")
    `);

    // ✅ Only SNMP devices that sent data in last 5 minutes
    const snmpHosts = await fluxQuery(`
      from(bucket:"${INFLUX_BUCKET}")
        |> range(start:${ACTIVE_WINDOW})
        |> filter(fn:(r) => r._measurement == "snmp_device")
        |> keep(columns: ["agent_host"])
        |> distinct(column: "agent_host")
    `);

    // Get services per host (from last 1h for service list)
    const perfServices = await fluxQuery(`
      from(bucket:"${INFLUX_BUCKET}")
        |> range(start:-1h)
        |> filter(fn:(r) => r._measurement == "nagios_perfdata")
        |> keep(columns: ["host","service"])
        |> unique(column: "service")
    `);

    // Build service map
    const serviceMap = {};
    perfServices.forEach(r => {
      if (!r.host || !r.service) return;
      if (!serviceMap[r.host]) serviceMap[r.host] = new Set();
      serviceMap[r.host].add(r.service);
    });

    // SNMP IP pool (only active ones)
    const snmpIPs = snmpHosts.map(r => r.agent_host).filter(Boolean);
    const usedIPs = new Set();

    // Build devices ONLY from active perfdata hosts
    const devices = perfHosts
      .map(r => r._value)
      .filter(Boolean)
      .map(name => {
        const type = detectType(name);
        let snmpIp = null;

        if (type === 'router' || type === 'switch') {
          for (const ip of snmpIPs) {
            if (!usedIPs.has(ip)) {
              snmpIp = ip;
              usedIPs.add(ip);
              break;
            }
          }
        }

        return {
          name,
          alias:    name,
          ip:       snmpIp || (name === 'localhost' ? '127.0.0.1' : 'N/A'),
          type,
          hasSnmp:  !!snmpIp,
          snmpIp,
          services: serviceMap[name] ? [...serviceMap[name]] : []
        };
      });

    res.json(devices);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log('✅ Backend running on http://localhost:3001'));
