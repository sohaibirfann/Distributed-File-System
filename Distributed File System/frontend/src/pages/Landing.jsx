import {
  Database, ShieldCheck, Zap, Server, HardDrive,
  Users, Download, ArrowRight,
  Lock, GitBranch, KeyRound,
} from "lucide-react";

const FEATURES = [
  { icon: Lock,       title: "End-to-end Encrypted", desc: "Files are encrypted on your device before they ever leave it. The coordinator and storage nodes only ever see ciphertext." },
  { icon: KeyRound,   title: "Your Keys, Your Device", desc: "Each group's key is generated on-device and shared only through its invite. No server ever holds a key to your files." },
  { icon: GitBranch,  title: "Fault Tolerant", desc: "Every chunk is replicated across multiple members' machines. Anyone can go offline and your files stay fully recoverable." },
  { icon: Zap,        title: "Parallel Downloads", desc: "Chunks are fetched simultaneously across the group's nodes — assembly is as fast as your fastest peers." },
  { icon: HardDrive,  title: "Contribute Storage", desc: "The desktop app turns your machine into a storage node, holding encrypted chunks for your groups while it runs." },
  { icon: Users,      title: "Invite-only Groups", desc: "Create a private group, share an invite, and your files live distributed across just your members — no one else." },
];

const STEPS = [
  { n: "01", title: "Encrypt", desc: "Your file is encrypted on your device with your group's key, then split into chunks. Plaintext never leaves your machine." },
  { n: "02", title: "Distribute", desc: "Encrypted chunks are spread across your group's members with configurable replication, so the file survives nodes going offline." },
  { n: "03", title: "Access", desc: "Any member fetches the chunks in parallel and decrypts on-device with the shared group key. The coordinator only ever relays ciphertext." },
];

export default function Landing() {
  return (
    <div className="relative min-h-full overflow-hidden bg-[#0b0b0e] text-white">
      {/* ── Ambient glow ─────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-12rem] h-[36rem] w-[60rem] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(ellipse at center, rgba(0,103,192,0.45), rgba(76,194,255,0.15) 45%, transparent 70%)", animation: "glowDrift 14s ease-in-out infinite" }}
        />
        <div className="absolute right-[-10rem] top-[20rem] h-[28rem] w-[28rem] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle at center, rgba(124,58,237,0.18), transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.25]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "linear-gradient(to bottom, black, transparent 60%)" }} />
      </div>

      {/* ── Navbar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0b0b0e]/70 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between" style={{ height: 60 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#0067C0] rounded-lg flex items-center justify-center"><Database size={14} className="text-white" /></div>
            <span className="font-bold text-white text-sm tracking-tight">DFS</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#how" className="hidden sm:block text-xs font-medium text-neutral-400 hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hidden sm:block text-xs font-medium text-neutral-400 hover:text-white transition-colors">Features</a>
            <a href="#download" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0">
              <Download size={12} /> Download
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
          <div className="reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/[0.04] text-[#4cc2ff] border border-white/10 mb-7" style={{ animationDelay: "0s" }}>
            <ShieldCheck size={12} /> AES-256-GCM · Fault tolerant · Peer-to-peer
          </div>

          <h1 className="reveal text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6" style={{ animationDelay: ".05s" }}>
            Your files.<br />
            <span className="bg-gradient-to-r from-[#4cc2ff] via-[#3a9bff] to-[#7c5cff] bg-clip-text text-transparent">Encrypted</span> and everywhere.
          </h1>

          <p className="reveal text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-9" style={{ animationDelay: ".1s" }}>
            A private, peer-to-peer file system. Your files are encrypted on-device, split into chunks, and spread across a network of machines <span className="text-neutral-200">you and your group control</span>. No cloud. No trust required.
          </p>

          <div className="reveal flex items-center justify-center gap-3" style={{ animationDelay: ".15s" }}>
            <a href="#download" className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0">
              <Download size={15} /> Download the app
            </a>
            <a href="#how" className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-neutral-200 border border-white/10 hover:bg-white/[0.05] transition-colors">
              How it works <ArrowRight size={15} />
            </a>
          </div>

          {/* Product shot — a real screenshot of the desktop app */}
          <div className="reveal relative mt-16 max-w-4xl mx-auto" style={{ animationDelay: ".25s" }}>
            <div className="absolute -inset-x-8 -top-8 bottom-0 -z-10 blur-2xl" style={{ background: "radial-gradient(ellipse at center top, rgba(0,103,192,0.4), transparent 65%)" }} />
            <img
              src="/app-preview.png"
              alt="The DFS desktop app showing a group's end-to-end encrypted files"
              className="relative w-full rounded-2xl border border-white/10 shadow-2xl shadow-black/60"
            />
          </div>
        </section>

        {/* ── Stats bar ──────────────────────────────────────────── */}
        <section className="border-y border-white/[0.06] bg-white/[0.02]">
          <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: "Encryption",   value: "AES-256-GCM" },
              { label: "Replication",  value: "per group"   },
              { label: "Keys held by", value: "you only"    },
              { label: "File limit",   value: "500 MB"      },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-lg font-bold font-mono text-white">{value}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        <section id="features" className="max-w-5xl mx-auto px-6 py-24 scroll-mt-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Built for privacy and resilience</h2>
            <p className="text-sm text-neutral-400">Everything you need. Nothing you don't.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.05]">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0067C0] to-[#4cc2ff] flex items-center justify-center mb-4 shadow-lg shadow-[#0067C0]/20">
                  <Icon size={17} className="text-white" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-[13px] text-neutral-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────── */}
        <section id="how" className="border-y border-white/[0.06] bg-white/[0.02] scroll-mt-16">
          <div className="max-w-5xl mx-auto px-6 py-24">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight mb-2">How it works</h2>
              <p className="text-sm text-neutral-400">Three steps. Zero trust in third parties.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STEPS.map(({ n, title, desc }) => (
                <div key={n} className="relative">
                  <p className="text-6xl font-black font-mono mb-3 select-none bg-gradient-to-b from-white/20 to-white/[0.03] bg-clip-text text-transparent">{n}</p>
                  <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Download CTA ───────────────────────────────────────── */}
        <section id="download" className="max-w-5xl mx-auto px-6 py-24 text-center scroll-mt-16">
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-16 overflow-hidden">
            <div className="pointer-events-none absolute left-1/2 -top-20 h-64 w-[40rem] -translate-x-1/2 blur-[100px]" style={{ background: "radial-gradient(ellipse at center, rgba(0,103,192,0.35), transparent 70%)" }} />
            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-br from-[#0067C0] to-[#4cc2ff] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#0067C0]/30">
                <Server size={24} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Get the desktop app</h2>
              <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-8 leading-relaxed">
                Browse your group's files and contribute your own disk space as a storage node — all from one place.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                {["Windows", "macOS", "Linux"].map((platform) => (
                  <button key={platform} disabled className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-white/10 text-neutral-400 cursor-not-allowed">
                    <Download size={13} /> {platform}
                    <span className="text-[10px] font-medium bg-white/10 px-1.5 py-0.5 rounded">Soon</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-neutral-500">Builds coming soon — the app runs the storage node and keeps your keys on your device.</p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#0067C0] rounded-md flex items-center justify-center"><Database size={10} className="text-white" /></div>
            <span className="text-xs font-bold text-neutral-400">DFS</span>
          </div>
          <p className="text-xs text-neutral-600">Distributed File System · end-to-end encrypted</p>
        </div>
      </footer>
    </div>
  );
}
