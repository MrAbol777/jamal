export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="در حال بارگذاری">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton h-12 w-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-28 w-full" />
      ))}
    </div>
  );
}
