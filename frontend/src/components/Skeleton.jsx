export default function Skeleton({ className = "", style }) {
  return <div style={style} className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-neutral-800 ${className}`} />;
}
