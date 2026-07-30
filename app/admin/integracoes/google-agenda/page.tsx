import Link from "next/link";
import { requireAdmin } from "../../../supabase/server";
import GoogleCalendarSettings from "./google-calendar-settings";

export const dynamic = "force-dynamic";

export default async function GoogleCalendarIntegrationPage() {
  await requireAdmin("/admin/integracoes/google-agenda");
  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" href="/admin/clientes">← Gestão da consultoria</Link>
      </header>
      <section className="admin-panel google-calendar-page">
        <p className="section-kicker">Integrações</p>
        <h1>Google Agenda</h1>
        <p>
          Conecte exclusivamente o calendário Consultório 1 - Interno. Eventos
          “Fisio” bloquearão o horário e atendimentos “Nome - Nutri Ludgero”
          serão associados à plataforma.
        </p>
        <GoogleCalendarSettings />
      </section>
    </main>
  );
}
