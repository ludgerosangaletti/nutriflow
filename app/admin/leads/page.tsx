import { desc } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "../../../db";
import { whatsappLeads } from "../../../db/schema";
import { requireAdmin } from "../../supabase/server";
import LeadStatusControl from "./lead-status-control";

export const dynamic = "force-dynamic";

const serviceLabels: Record<string, string> = {
  presencial: "Consulta presencial",
  online: "Consultoria on-line",
  mentoria: "Mentoria",
  avaliacao: "Avaliação física",
  unknown: "Não identificado",
};

const stageLabels: Record<string, string> = {
  new: "Novo",
  informed: "Informações enviadas",
  qualified: "Qualificado",
  converted: "Convertido",
  archived: "Arquivado",
};

const periodLabels: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const dayLabels: Record<string, string> = {
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
  domingo: "Domingo",
  flexivel: "Sem preferência",
};

const appointmentTypeLabels: Record<string, string> = {
  primeira_consulta: "Primeiro atendimento",
  retorno: "Já é paciente",
};

const interactionLabels: Record<string, string> = {
  menu: "Abriu o menu",
  service_interest: "Consultou um serviço",
  scheduling: "Solicitou agendamento",
  scheduling_intent: "Iniciou o agendamento",
  qualification_service: "Escolhendo o serviço",
  qualification_period: "Informou preferência de período",
  qualification_day: "Informou preferência de dia",
  qualification_appointment: "Identificando o atendimento",
  scheduling_confirmed: "Agendamento qualificado",
  marketing_opt_in: "Aceitou novidades",
  marketing_opt_out: "Cancelou novidades",
  unrecognized_text: "Mensagem livre",
  audio: "Enviou áudio",
  image: "Enviou imagem",
  document: "Enviou documento",
  video: "Enviou vídeo",
  sticker: "Enviou figurinha",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length !== 11) return `+${digits}`;
  return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
}

export default async function WhatsAppLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; service?: string; stage?: string }>;
}) {
  await requireAdmin("/admin/leads");
  const filters = await searchParams;
  const query = filters.q?.trim().toLowerCase() || "";
  const selectedService = filters.service || "all";
  const selectedStage = filters.stage || "all";

  const allLeads = await getDb()
    .select()
    .from(whatsappLeads)
    .orderBy(desc(whatsappLeads.lastContactAt));

  const filteredLeads = allLeads.filter((lead) => {
    const matchesQuery =
      !query ||
      lead.profileName?.toLowerCase().includes(query) ||
      lead.phone.includes(query.replace(/\D/g, ""));
    const matchesService =
      selectedService === "all" || lead.serviceInterest === selectedService;
    const matchesStage =
      selectedStage === "all" || lead.stage === selectedStage;
    return matchesQuery && matchesService && matchesStage;
  });

  const newCount = allLeads.filter((lead) => lead.stage === "new").length;
  const qualifiedCount = allLeads.filter((lead) =>
    ["qualified", "converted"].includes(lead.stage),
  ).length;
  const marketingCount = allLeads.filter((lead) => lead.marketingOptIn).length;

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" href="/">Gestão da consultoria</Link>
        <nav className="admin-header-actions" aria-label="Navegação administrativa">
          <Link href="/admin/clientes">Pacientes</Link>
          <form action="/auth/sair" method="post">
            <button className="auth-signout" type="submit">Sair</button>
          </form>
        </nav>
      </header>

      <section className="admin-panel leads-panel">
        <div className="admin-hero">
          <div>
            <p className="section-kicker">Captação pelo WhatsApp</p>
            <h1>Leads</h1>
            <p>
              Contatos comerciais essenciais, sem armazenar o conteúdo das conversas.
            </p>
          </div>
          <aside className={qualifiedCount ? "has-actions" : "is-clear"}>
            <span>Oportunidades</span>
            <strong>{qualifiedCount} lead(s) qualificado(s)</strong>
            <a href="#lista-leads">Ver contatos ↓</a>
          </aside>
        </div>

        <div className="admin-summary-grid" aria-label="Indicadores de leads">
          <a href="#lista-leads">
            <span>Total captado</span>
            <strong>{allLeads.length}</strong>
            <small>Contatos únicos</small>
          </a>
          <a href="?stage=new#lista-leads">
            <span>Novos</span>
            <strong>{newCount}</strong>
            <small>Aguardando classificação</small>
          </a>
          <a href="?stage=qualified#lista-leads">
            <span>Qualificados</span>
            <strong>{qualifiedCount}</strong>
            <small>Solicitaram agendamento</small>
          </a>
          <a href="#lista-leads">
            <span>Consentimento</span>
            <strong>{marketingCount}</strong>
            <small>Podem receber novidades</small>
          </a>
        </div>

        <form className="lead-filters" method="get">
          <label>
            <span>Buscar</span>
            <input
              defaultValue={filters.q}
              name="q"
              placeholder="Nome ou telefone"
              type="search"
            />
          </label>
          <label>
            <span>Serviço</span>
            <select defaultValue={selectedService} name="service">
              <option value="all">Todos</option>
              <option value="presencial">Consulta presencial</option>
              <option value="online">Consultoria on-line</option>
              <option value="mentoria">Mentoria</option>
              <option value="avaliacao">Avaliação física</option>
              <option value="unknown">Não identificado</option>
            </select>
          </label>
          <label>
            <span>Estágio</span>
            <select defaultValue={selectedStage} name="stage">
              <option value="all">Todos</option>
              <option value="new">Novo</option>
              <option value="informed">Informações enviadas</option>
              <option value="qualified">Qualificado</option>
              <option value="converted">Convertido</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
          <button className="admin-action" type="submit">Filtrar</button>
          <Link href="/admin/leads#lista-leads">Limpar</Link>
        </form>

        <header className="admin-patient-heading" id="lista-leads">
          <div>
            <span>Base comercial</span>
            <h2>Contatos captados</h2>
          </div>
          <p>{filteredLeads.length} contato(s) nesta visualização.</p>
        </header>

        <div className="lead-list">
          {filteredLeads.map((lead) => {
            const phone = lead.phone.startsWith("55")
              ? lead.phone
              : `55${lead.phone}`;
            const firstName = lead.profileName?.split(" ")[0] || "tudo bem";
            const qualificationDetails = [
              serviceLabels[lead.serviceInterest] || lead.serviceInterest,
              lead.preferredPeriod
                ? `preferência pelo período da ${periodLabels[lead.preferredPeriod]?.toLowerCase() || lead.preferredPeriod}`
                : null,
              lead.preferredDay
                ? `dia preferido: ${dayLabels[lead.preferredDay]?.toLowerCase() || lead.preferredDay}`
                : null,
              lead.appointmentType
                ? appointmentTypeLabels[lead.appointmentType]?.toLowerCase() ||
                  lead.appointmentType
                : null,
            ]
              .filter(Boolean)
              .join(", ");
            const message = encodeURIComponent(
              `Olá, ${firstName}! Aqui é da equipe Ludgero Sangaletti. Recebemos sua solicitação sobre ${qualificationDetails}. Vamos verificar o melhor horário para você.`,
            );

            return (
              <article className={`lead-card stage-${lead.stage}`} key={lead.id}>
                <header>
                  <div>
                    <span>{lead.source === "linktree" ? "Via Linktree" : "Contato direto"}</span>
                    <h3>{lead.profileName || "Nome não informado"}</h3>
                    <a href={`https://wa.me/${phone}`} target="_blank">
                      {formatPhone(lead.phone)}
                    </a>
                  </div>
                  <strong>{stageLabels[lead.stage] || lead.stage}</strong>
                </header>

                <dl>
                  <div>
                    <dt>Interesse</dt>
                    <dd>{serviceLabels[lead.serviceInterest] || lead.serviceInterest}</dd>
                  </div>
                  <div>
                    <dt>Última interação</dt>
                    <dd>
                      {interactionLabels[lead.lastInteractionKind] ||
                        lead.lastInteractionKind}
                    </dd>
                  </div>
                  <div>
                    <dt>Contatos</dt>
                    <dd>{lead.interactionCount}</dd>
                  </div>
                  <div>
                    <dt>Período preferido</dt>
                    <dd>
                      {lead.preferredPeriod
                        ? periodLabels[lead.preferredPeriod] ||
                          lead.preferredPeriod
                        : "Não informado"}
                    </dd>
                  </div>
                  <div>
                    <dt>Dia preferido</dt>
                    <dd>
                      {lead.preferredDay
                        ? dayLabels[lead.preferredDay] || lead.preferredDay
                        : "Não informado"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tipo de atendimento</dt>
                    <dd>
                      {lead.appointmentType
                        ? appointmentTypeLabels[lead.appointmentType] ||
                          lead.appointmentType
                        : "Não informado"}
                    </dd>
                  </div>
                  <div>
                    <dt>Primeiro contato</dt>
                    <dd>{formatDate(lead.firstContactAt)}</dd>
                  </div>
                  <div>
                    <dt>Último contato</dt>
                    <dd>{formatDate(lead.lastContactAt)}</dd>
                  </div>
                  <div>
                    <dt>Novidades</dt>
                    <dd>{lead.marketingOptIn ? "Autorizado" : "Sem autorização"}</dd>
                  </div>
                </dl>

                <footer>
                  <LeadStatusControl id={lead.id} initialStage={lead.stage} />
                  <a
                    className="lead-contact-link"
                    href={`https://wa.me/${phone}?text=${message}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Continuar no WhatsApp →
                  </a>
                </footer>
              </article>
            );
          })}
          {!filteredLeads.length ? (
            <div className="admin-all-clear lead-empty">
              <strong>Nenhum contato encontrado</strong>
              <p>Novos contatos do número automático aparecerão aqui.</p>
            </div>
          ) : null}
        </div>

        <p className="lead-privacy-note">
          O sistema não armazena o texto das conversas, áudios, imagens ou
          documentos. O envio de promoções deve considerar apenas contatos com
          consentimento marcado como autorizado.
        </p>
      </section>
    </main>
  );
}
