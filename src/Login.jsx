import { useState } from "react";

const USERS = [
  { email: "katheprasad24@gmail.com",              password: "it" },
  { email: "aniket.ghorpade@walchandsangli.ac.in", password: "it" },
];

export default function Login({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      const user = USERS.find(u => u.email === email && u.password === password);
      if (user) { onLogin(email); }
      else { setError("ACCESS DENIED — Invalid credentials"); setLoading(false); }
    }, 800);
  }

  const inputStyle = {
    width: "100%",
    background: "rgba(10,4,36,0.8)",
    border: "1px solid var(--border2)",
    borderRadius: 8,
    padding: "15px 18px",
    color: "var(--text)",
    fontSize: 16,
    fontFamily: "'JetBrains Mono', monospace",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    letterSpacing: 0.5
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "48px 20px 0",
      position: "relative",
      overflow: "hidden"
    }}>

      {/* TOP LEFT bright flare */}
      <div style={{
        position:"fixed", top:"-80px", left:"-80px",
        width:400, height:400, borderRadius:"50%",
        background:"radial-gradient(circle at 30% 30%, rgba(255,204,242,0.45) 0%, rgba(153,102,255,0.2) 40%, transparent 70%)",
        pointerEvents:"none", zIndex:0,
        filter:"blur(18px)"
      }} />
      {/* secondary smaller flare */}
      <div style={{
        position:"fixed", top:"20px", left:"20px",
        width:160, height:160, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)",
        pointerEvents:"none", zIndex:0,
        filter:"blur(8px)"
      }} />

      {/* Bottom right orb */}
      <div style={{
        position:"fixed", bottom:"-20%", right:"-10%",
        width:500, height:500, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(0,51,255,0.1) 0%, transparent 70%)",
        pointerEvents:"none", zIndex:0
      }} />

      {/* Header — no subtitle line */}
      <div style={{ textAlign:"center", zIndex:2, animation:"fadeIn 0.7s ease" }}>
        <div style={{
          fontSize:13, letterSpacing:5, color:"var(--text-dim)",
          marginBottom:22, fontFamily:"'JetBrains Mono',monospace",
          textTransform:"uppercase"
        }}>
          Walchand College of Engineering — Network Operations Center
        </div>

        <h1 style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: "clamp(40px, 7vw, 70px)",
          fontWeight: 900,
          background: "linear-gradient(135deg, #ffccf2 0%, #cc99ff 35%, #6633ff 65%, #0033ff 100%)",
          backgroundSize: "200% 200%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "gradShift 4s ease infinite",
          letterSpacing: 6,
          marginBottom: 0
        }}>
          LABWATCH
        </h1>
      </div>

      {/* Login Box */}
      <div style={{
        zIndex:2, width:"100%", maxWidth:460,
        animation:"fadeIn 0.7s ease 0.15s both",
        margin: "44px 0"
      }}>
        <div style={{
          background:"linear-gradient(90deg, rgba(0,51,255,0.3), rgba(255,204,242,0.15))",
          border:"1px solid var(--border2)",
          borderBottom:"none",
          borderRadius:"12px 12px 0 0",
          padding:"13px 22px",
          display:"flex", alignItems:"center", gap:10
        }}>
          <div style={{
            width:10, height:10, borderRadius:"50%",
            background:"linear-gradient(135deg, #ffccf2, #0033ff)",
            boxShadow:"0 0 10px rgba(204,153,255,0.6)"
          }} />
          <span style={{
            fontSize:13, letterSpacing:2, fontWeight:600,
            color:"var(--text-mid)", fontFamily:"'JetBrains Mono',monospace"
          }}>
            AUTHENTICATE — LAB ADMIN ACCESS
          </span>
        </div>

        <div style={{
          background:"rgba(6,2,26,0.95)",
          border:"1px solid var(--border2)",
          borderRadius:"0 0 12px 12px",
          padding:"38px 42px 42px",
          boxShadow:"var(--glow-lg), 0 24px 48px rgba(0,0,0,0.5)"
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:24 }}>
              <label style={{
                fontSize:13, letterSpacing:1.5, color:"var(--text-mid)",
                display:"block", marginBottom:10, fontWeight:600
              }}>EMAIL ADDRESS</label>
              <input
                type="email" value={email} required
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@lab.local"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow="0 0 16px rgba(153,102,255,0.25)"; }}
                onBlur={e =>  { e.target.style.borderColor="var(--border2)"; e.target.style.boxShadow="none"; }}
              />
            </div>

            <div style={{ marginBottom:32 }}>
              <label style={{
                fontSize:13, letterSpacing:1.5, color:"var(--text-mid)",
                display:"block", marginBottom:10, fontWeight:600
              }}>PASSWORD</label>
              <input
                type="password" value={password} required
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow="0 0 16px rgba(153,102,255,0.25)"; }}
                onBlur={e =>  { e.target.style.borderColor="var(--border2)"; e.target.style.boxShadow="none"; }}
              />
            </div>

            {error && (
              <div style={{
                background:"rgba(255,68,102,0.1)", border:"1px solid rgba(255,68,102,0.3)",
                borderRadius:8, padding:"13px 16px", marginBottom:24,
                fontSize:14, color:"var(--red)", letterSpacing:0.5, fontWeight:500
              }}>⚠ &nbsp;{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width:"100%",
              background: loading ? "var(--border2)" : "linear-gradient(135deg, #0033ff 0%, #6633ff 50%, #ffccf2 100%)",
              backgroundSize:"200% 200%",
              color: loading ? "var(--text-dim)" : "#fff",
              border:"none", borderRadius:8,
              padding:"17px",
              fontSize:15, fontWeight:700,
              fontFamily:"'Orbitron',monospace",
              letterSpacing:4,
              cursor: loading ? "not-allowed" : "pointer",
              transition:"all 0.3s",
              boxShadow: loading ? "none" : "0 0 24px rgba(102,51,255,0.5)",
              animation: loading ? "none" : "gradShift 3s ease infinite"
            }}>
              {loading ? "VERIFYING..." : "INITIATE ACCESS"}
            </button>
          </form>
        </div>
      </div>

      {/* Footer marquee — login only */}
      <div style={{
        zIndex:2, width:"100%",
        borderTop:"1px solid var(--border2)",
        padding:"18px 0",
        overflow:"hidden",
        background:"rgba(6,2,26,0.85)"
      }}>
        <div style={{
          whiteSpace:"nowrap",
          animation:"marquee 28s linear infinite",
          fontSize:15, fontWeight:500,
          color:"var(--text-mid)", letterSpacing:1.5
        }}>
          &nbsp;&nbsp;&nbsp;&nbsp;◈&nbsp;&nbsp;&nbsp;&nbsp;
          From detection to action — a powerful monitoring solution that ensures reliability, maximizes uptime, and gives you complete control over your infrastructure.
          &nbsp;&nbsp;&nbsp;&nbsp;◈&nbsp;&nbsp;&nbsp;&nbsp;
          From detection to action — a powerful monitoring solution that ensures reliability, maximizes uptime, and gives you complete control over your infrastructure.
          &nbsp;&nbsp;&nbsp;&nbsp;◈&nbsp;&nbsp;&nbsp;&nbsp;
        </div>
      </div>
    </div>
  );
}
