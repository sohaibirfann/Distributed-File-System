import { useTheme } from "../context/ThemeContext";
import {
  Database, ShieldCheck, Zap, Server, HardDrive,
  Users, Download, Moon, Sun,
  Lock, GitBranch, KeyRound,
} from "lucide-react";

const FEATURES = [
  {
    icon: Lock,
    title: "End-to-end Encrypted",
    desc: "Files are encrypted on your device before they ever leave it. The coordinator and storage nodes only ever see ciphertext.",
  },
  {
    icon: KeyRound,
    title: "Your Keys, Your Device",
    desc: "Each group's key is generated on-device and shared only through its invite. No server ever holds a key to your files.",
  },
  {
    icon: GitBranch,
    title: "Fault Tolerant",
    desc: "Every chunk is replicated across multiple members' machines. Anyone can go offline and your files stay fully recoverable.",
  },
  {
    icon: Zap,
    title: "Parallel Downloads",
    desc: "Chunks are fetched simultaneously across the group's nodes — assembly is as fast as your fastest peers.",
  },
  {
    icon: HardDrive,
    title: "Contribute Storage",
    desc: "The desktop app turns your machine into a storage node, holding encrypted chunks for your groups while it runs.",
  },
  {
    icon: Users,
    title: "Invite-only Groups",
    desc: "Create a private group, share an invite, and your files live distributed across just your members — no one else.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Encrypt",
    desc: "Your file is encrypted on your device with your group's key, then split into chunks. Plaintext never leaves your machine.",
  },
  {
    n: "02",
    title: "Distribute",
    desc: "Encrypted chunks are spread across your group's members with configurable replication, so the file survives nodes going offline.",
  },
  {
    n: "03",
    title: "Access",
    desc: "Any member fetches the chunks in parallel and decrypts on-device with the shared group key. The coordinator only ever relays ciphertext.",
  },
];

export default function Landing() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-full flex flex-col">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass bg-white/40 dark:bg-neutral-950/45 border-b border-blue-100/60 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between" style={{ height: 56 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 dark:bg-[#FF6363] rounded-lg flex items-center justify-center">
              <Database size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">DFS</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <a
              href="#download"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] text-white transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Download size={12} />
              Download
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-[#FF6363]/10 text-blue-600 dark:text-[#FF6363] border border-blue-200/70 dark:border-[#FF6363]/25 mb-6">
            <ShieldCheck size={12} />
            AES-256-GCM · Fault tolerant · Multi-node
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight mb-5">
            Distributed.<br />
            <span className="text-blue-600 dark:text-[#FF6363]">Encrypted.</span> Yours.
          </h1>

          <p className="text-lg text-gray-500 dark:text-neutral-400 max-w-xl mx-auto leading-relaxed mb-10">
            A peer-to-peer file system that splits your files into encrypted chunks and distributes them across a network of nodes you control. No cloud. No trust required.
          </p>

          <div className="flex items-center justify-center">
            {/* Download — placeholder until the Electron build ships */}
            <a
              href="#download"
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] text-white transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Download size={15} />
              Download the app
            </a>
          </div>
        </section>

        {/* ── Stats bar ──────────────────────────────────────────── */}
        <section className="border-y border-gray-100 dark:border-white/[0.06] bg-white/30 dark:bg-white/[0.02]">
          <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: "Encryption",   value: "AES-256-GCM" },
              { label: "Replication",  value: "per group"   },
              { label: "Keys held by", value: "you only"    },
              { label: "File limit",   value: "500 MB"      },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-lg font-bold font-mono text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Built for privacy and resilience</h2>
            <p className="text-sm text-gray-500 dark:text-neutral-400">Everything you need. Nothing you don't.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5 hover:-translate-y-0.5 transition-transform duration-150"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#FF6363]/10 flex items-center justify-center mb-4">
                  <Icon size={16} className="text-blue-600 dark:text-[#FF6363]" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">{title}</h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────── */}
        <section className="border-y border-gray-100 dark:border-white/[0.06] bg-white/30 dark:bg-white/[0.02]">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">How it works</h2>
              <p className="text-sm text-gray-500 dark:text-neutral-400">Three steps. Zero trust in third parties.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {STEPS.map(({ n, title, desc }) => (
                <div key={n} className="relative">
                  <p className="text-5xl font-black font-mono text-gray-100 dark:text-white/[0.06] mb-3 select-none">{n}</p>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 dark:text-neutral-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Download CTA ───────────────────────────────────────── */}
        <section id="download" className="max-w-5xl mx-auto px-6 py-20 text-center scroll-mt-16">
          <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-3xl border border-gray-100 dark:border-neutral-800 px-8 py-14">
            <div className="w-14 h-14 bg-blue-600 dark:bg-[#FF6363] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20 dark:shadow-[#FF6363]/20">
              <Server size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Get the desktop app</h2>
            <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-sm mx-auto mb-8 leading-relaxed">
              Install the app to browse files and contribute your own disk space as a storage node — all from one place.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              {["Windows", "macOS", "Linux"].map((platform) => (
                <button
                  key={platform}
                  disabled
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-neutral-700 text-gray-400 dark:text-neutral-500 cursor-not-allowed"
                >
                  <Download size={13} />
                  {platform}
                  <span className="text-[10px] font-medium bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">Soon</span>
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-400 dark:text-neutral-500">
              Builds coming soon — the app runs the storage node and keeps your keys on your device.
            </p>
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 dark:bg-[#FF6363] rounded-md flex items-center justify-center">
              <Database size={10} className="text-white" />
            </div>
            <span className="text-xs font-bold text-gray-500 dark:text-neutral-400">DFS</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-neutral-600">Distributed File System</p>
        </div>
      </footer>

    </div>
  );
}
