import { useState, useEffect } from "react";
import { Database, Minus, Square, Copy, X } from "lucide-react";

// Custom title bar for the frameless desktop window. The bar itself is a drag
// region; the controls opt out of dragging so they stay clickable.
const drag   = { WebkitAppRegion: "drag" };
const noDrag = { WebkitAppRegion: "no-drag" };

export default function TitleBar() {
  const controls = window.dfsDesktop?.windowControls;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!controls) return;
    controls.isMaximized().then(setMaximized).catch(() => {});
    return controls.onMaximizeChange?.(setMaximized);
  }, [controls]);

  if (!controls) return null;

  return (
    <div
      style={drag}
      className="flex items-center justify-between h-8 shrink-0 select-none bg-white/55 dark:bg-neutral-950/70 border-b border-blue-100/60 dark:border-white/[0.06] backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 px-3">
        <div className="w-4 h-4 bg-blue-600 dark:bg-[#FF6363] rounded-[5px] flex items-center justify-center">
          <Database size={9} className="text-white" />
        </div>
        <span className="text-[11px] font-semibold text-gray-600 dark:text-neutral-300 tracking-wide">DFS</span>
      </div>

      <div style={noDrag} className="flex items-center h-full">
        <button
          onClick={() => controls.minimize()}
          className="h-full px-3.5 flex items-center text-gray-500 dark:text-neutral-400 hover:bg-gray-200/70 dark:hover:bg-neutral-800 transition-colors"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => controls.toggleMaximize()}
          className="h-full px-3.5 flex items-center text-gray-500 dark:text-neutral-400 hover:bg-gray-200/70 dark:hover:bg-neutral-800 transition-colors"
          title={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <Copy size={12} /> : <Square size={11} />}
        </button>
        <button
          onClick={() => controls.close()}
          className="h-full px-3.5 flex items-center text-gray-500 dark:text-neutral-400 hover:bg-red-500 hover:text-white transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
