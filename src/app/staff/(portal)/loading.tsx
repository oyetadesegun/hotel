/**
 * Shown while a staff page loads its data. Because it sits under the portal layout,
 * the sidebar stays in place and switching between staff pages feels instant.
 */
export default function StaffLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex animate-pulse flex-col gap-5">
      <div className="h-8 w-56 rounded-lg bg-black/10" />
      <div className="flex max-w-3xl flex-col gap-3.5 rounded-2xl bg-white p-5">
        <div className="h-5 w-48 rounded bg-black/10" />
        <div className="h-4 w-full rounded bg-black/5" />
        <div className="h-4 w-2/3 rounded bg-black/5" />
      </div>
      <div className="flex max-w-3xl flex-col gap-3.5 rounded-2xl bg-white p-5">
        <div className="h-4 w-full rounded bg-black/5" />
        <div className="h-4 w-5/6 rounded bg-black/5" />
        <div className="h-4 w-1/2 rounded bg-black/5" />
      </div>
    </div>
  );
}
