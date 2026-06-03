import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth }   from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import { useTheme, ACCENTS } from "../context/ThemeContext";
import { isDesktop } from "../lib/platform";
import { getApiUrl, getStoredCoordinator, setCoordinatorUrl } from "../lib/api";
import {
  User, Power, HardDrive, FolderOpen, LogOut, Palette, Server,
} from "lucide-react";

const desktop = isDesktop();
const settingsApi = () => window.dfsDesktop?.settings;
const nodeApi     = () => window.dfsDesktop?.node;

function fmtBytes(b) {
  if (!b) return "0 B";
  if (b < 1024)               return `${b} B`;
  if (b < 1024 * 1024)        return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? "bg-blue-600 dark:bg-[var(--accent)]" : "bg-gray-300 dark:bg-neutral-700"
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
      <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
        <Icon size={13} /> {title}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-neutral-200">{label}</p>
        {hint && <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { user, logout }        = useAuth();
  const notify                  = useNotify();
  const navigate                = useNavigate();
  const { accent, setAccent }   = useTheme();

  const [coordInput, setCoordInput] = useState(getStoredCoordinator() || getApiUrl());
  const [savingCoord, setSavingCoord] = useState(false);

  const [cfg, setCfg]         = useState(null);   // desktop settings
  const [startup, setStartup] = useState(false);
  const [nodeStatus, setNodeStatus] = useState(null);

  useEffect(() => {
    const s = settingsApi();
    if (!s) return;
    s.get().then(setCfg).catch(() => {});
    s.getStartup().then(setStartup).catch(() => {});
  }, []);

  // Poll the embedded node's live status (chunks stored, etc.).
  useEffect(() => {
    const n = nodeApi();
    if (!n) return;
    let alive = true;
    const tick = () => n.getStatus().then((st) => alive && setNodeStatus(st)).catch(() => {});
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  async function patch(partial) {
    const s = settingsApi();
    if (!s) return;
    const next = await s.set(partial);
    setCfg(next);
  }

  async function toggleStartup(val) {
    const s = settingsApi();
    if (!s) return;
    setStartup(await s.setStartup(val));
  }

  async function changeFolder() {
    const s = settingsApi();
    if (!s) return;
    const dir = await s.pickFolder();
    if (dir) { await patch({ storageDir: dir }); notify.success("Storage folder updated"); }
  }

  async function saveCoordinator() {
    setSavingCoord(true);
    try {
      await setCoordinatorUrl(coordInput);
      notify.success("Coordinator updated — reconnecting…");
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      notify.error(e.message || "Enter a valid address");
      setSavingCoord(false);
    }
  }

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Account */}
      <Section icon={User} title="Account">
        <Row label="Signed in as" hint="Your account username">
          <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{user?.username ?? "—"}</span>
        </Row>
        <Row label="Sign out" hint="Return to the login screen">
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-[var(--accent)]/10 border border-gray-200 dark:border-neutral-700 transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </Row>
      </Section>

      {/* Connection (desktop only) */}
      {desktop && (
        <Section icon={Server} title="Connection">
          <Row label="Coordinator" hint="The server this app connects to — it holds no files or keys.">
            <span className="text-xs font-mono text-gray-500 dark:text-neutral-400 truncate max-w-[15rem]" title={getApiUrl()}>
              {getApiUrl() || "Not set"}
            </span>
          </Row>
          <div className="flex items-center gap-2">
            <input
              value={coordInput}
              onChange={(e) => setCoordInput(e.target.value)}
              placeholder="https://coordinator.example.com"
              spellCheck={false}
              autoCapitalize="off"
              className="flex-1 min-w-0 px-3 py-2 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500 dark:focus:border-[var(--accent)]"
            />
            <button
              onClick={saveCoordinator}
              disabled={savingCoord || !coordInput.trim() || coordInput.trim() === getApiUrl()}
              className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent-hover)] text-[var(--on-accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {savingCoord ? "Saving…" : "Save & reconnect"}
            </button>
          </div>
        </Section>
      )}

      {/* Appearance */}
      <Section icon={Palette} title="Appearance">
        <Row label="Accent color" hint="The app's highlight color">
          <div className="flex items-center gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  accent === a.id
                    ? "border-[var(--accent)] text-gray-900 dark:text-white bg-black/[0.03] dark:bg-white/[0.06]"
                    : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: a.swatch }} />
                {a.label}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      {/* Startup (desktop only) */}
      <Section icon={Power} title="Startup">
        <Row label="Start DFS when I sign in" hint={desktop ? "Launch the app automatically on login" : "Available in the desktop app"}>
          <Switch checked={startup} onChange={toggleStartup} disabled={!desktop} />
        </Row>
      </Section>

      {/* Storage contribution (desktop only) */}
      <Section icon={HardDrive} title="Storage contribution">
        <Row label="Contribute storage" hint={desktop ? "Let this device hold encrypted chunks for your groups" : "Available in the desktop app"}>
          <Switch checked={!!cfg?.contribute} onChange={(v) => patch({ contribute: v })} disabled={!desktop} />
        </Row>
        <Row label="Storage folder" hint={cfg?.storageDir ?? "Where chunks are stored on this device"}>
          <button
            onClick={changeFolder}
            disabled={!desktop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FolderOpen size={13} /> Change…
          </button>
        </Row>
        <Row label="Space to contribute" hint="Maximum disk this device will use">
          <div className="flex items-center gap-2">
            <input
              type="number" min="1" max="500"
              value={cfg?.quotaGB ?? 5}
              disabled={!desktop}
              onChange={(e) => setCfg((c) => ({ ...c, quotaGB: Number(e.target.value) }))}
              onBlur={(e) => patch({ quotaGB: Number(e.target.value) })}
              className="w-20 px-2.5 py-1.5 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm text-right text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[var(--accent)] disabled:opacity-40"
            />
            <span className="text-sm text-gray-400 dark:text-neutral-500">GB</span>
          </div>
        </Row>
        {desktop && (
          cfg?.contribute ? (
            nodeStatus?.running ? (
              <p className="text-xs text-emerald-600/90 dark:text-emerald-400/90 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                Contributing — storing {nodeStatus.chunks} chunk{nodeStatus.chunks === 1 ? "" : "s"} ({fmtBytes(nodeStatus.bytes)})
                {nodeStatus.registered ? "" : " · connecting…"}
              </p>
            ) : (
              <p className="text-xs text-amber-600/90 dark:text-amber-400/80 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
                Starting your node… if this persists, the coordinator may be unreachable.
              </p>
            )
          ) : (
            <p className="text-xs text-gray-400 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-800/40 rounded-lg px-3 py-2">
              Turn this on to store encrypted chunks for your groups while the app runs. Works on your local
              network today; cross-network sharing arrives with peer-to-peer networking.
            </p>
          )
        )}
      </Section>

      {desktop && window.dfsDesktop?.version && (
        <p className="text-center text-xs text-gray-400 dark:text-neutral-600">DFS desktop v{window.dfsDesktop.version}</p>
      )}
    </div>
  );
}
