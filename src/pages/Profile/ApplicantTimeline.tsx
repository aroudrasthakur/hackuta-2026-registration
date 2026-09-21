type TimelineEvent = {
  id: string;
  label: string;
  timestamp: number | null;
  complete: boolean;
};

export function ApplicantTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="space-y-4" aria-label="Application timeline">
      <h3 className="text-base font-semibold text-(--ocean)">Timeline</h3>
      <ol className="space-y-4 border-l-2 border-(--sand) pl-5">
        {events.map((event) => (
          <li key={event.id} className="relative">
            <span
              className={`absolute -left-[1.625rem] top-1 h-3 w-3 rounded-full border-2 ${
                event.complete
                  ? "border-(--ocean) bg-(--ocean)"
                  : "border-(--sand) bg-white"
              }`}
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-(--ink)">{event.label}</p>
            {event.timestamp ? (
              <p className="text-xs text-(--mist)">
                {new Date(event.timestamp).toLocaleString()}
              </p>
            ) : (
              <p className="text-xs text-(--mist)">Pending</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
