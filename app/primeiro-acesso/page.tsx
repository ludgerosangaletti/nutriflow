import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import { clients } from "../../db/schema";
import { requirePatient } from "../supabase/server";
import PresentialProfileForm from "./presential-profile-form";

export const dynamic = "force-dynamic";

export default async function FirstAccessPage() {
  const user = await requirePatient("/primeiro-acesso");
  if (!user.email) redirect("/entrar");
  const [client] = await getDb()
    .select()
    .from(clients)
    .where(eq(clients.email, user.email.toLowerCase()))
    .limit(1);
  if (!client || client.modality !== "in_person") redirect("/area-cliente");
  if (client.profileCompletedAt) redirect("/area-cliente");

  return (
    <main className="portal-shell first-access-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/">
          Ludgero Sangaletti
        </Link>
        <span>Atendimento presencial</span>
      </header>
      <section className="portal-grid first-access-grid">
        <div className="portal-copy">
          <p className="section-kicker">Primeiro acesso</p>
          <h1>Complete seu cadastro.</h1>
          <p>
            Seus dados serão usados para identificar seu acompanhamento e
            organizar os documentos disponibilizados após o atendimento.
          </p>
          <ul className="first-access-benefits">
            <li>Protocolo alimentar em um só lugar</li>
            <li>Avaliações físicas disponíveis em PDF</li>
            <li>Check-ins e solicitações de ajustes</li>
            <li>Histórico protegido durante a vigência</li>
          </ul>
        </div>
        <PresentialProfileForm email={user.email} />
      </section>
    </main>
  );
}
