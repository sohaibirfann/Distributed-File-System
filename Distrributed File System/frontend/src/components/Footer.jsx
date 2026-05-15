export default function Footer() {
  return (
    <footer className="
      mt-10
      border-t
      border-slate-800
      pt-6
      pb-2
    ">
      <div className="
        flex
        flex-col
        md:flex-row
        items-center
        justify-between
        gap-4
      ">
        <div>
          <p className="
            text-slate-400
            text-sm
          ">
            Distributed File Storage System
          </p>

          <p className="
            text-slate-500
            text-xs
            mt-1
          ">
            Secure Chunk-Based Distributed Storage
          </p>
        </div>

        <div className="
          flex
          items-center
          gap-4
          text-sm
        ">
          <span className="
            text-emerald-400
          ">
            ● System Active
          </span>

          <span className="
            text-slate-500
          ">
            AES-256 Encryption
          </span>
        </div>
      </div>
    </footer>
  );
}