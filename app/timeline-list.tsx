import Link from "next/link";
import { formatDate, type TimelineEvent } from "./timeline";

const labels: Record<TimelineEvent["kind"], string> = {
  purchase: "Contratação",
  access: "Acesso",
  anamnesis: "Anamnese",
  document: "Material",
  checkin: "Check-in",
  photo: "Evolução",
  goal: "Meta",
  adjustment: "Ajuste",
  milestone: "Vigência",
};

export default function TimelineList({
  events,
  admin = false,
}: {
  events: TimelineEvent[];
  admin?: boolean;
}) {
  if (!events.length) {
    return <p className="timeline-empty">Os primeiros acontecimentos aparecerão aqui.</p>;
  }

  return (
    <ol className="consultation-timeline">
      {events.map((event, index) => (
        <li className={event.future ? "is-future" : ""} key={`${event.kind}-${event.date}-${index}`}>
          <span className="timeline-marker" aria-hidden="true" />
          <article>
            <div className="timeline-meta">
              <span>{labels[event.kind]}</span>
              <time dateTime={event.date}>{formatDate(event.date)}</time>
            </div>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
            {event.href && !admin ? <Link href={event.href}>Ver detalhes →</Link> : null}
          </article>
        </li>
      ))}
    </ol>
  );
}
