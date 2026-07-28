import LegalLayout from "../legal-layout";

export default function DataDeletionPage() {
  return (
    <LegalLayout
      eyebrow="Direitos do titular"
      title="Solicitação de Exclusão de Dados"
      intro="Você pode solicitar a exclusão dos dados pessoais associados ao site, à área do paciente e às interações pelo WhatsApp."
    >
      <section>
        <h2>Como solicitar</h2>
        <ol>
          <li>
            Envie uma mensagem para o WhatsApp de atendimento{" "}
            <a href="https://wa.me/5542999846280">+55 42 99984-6280</a>.
          </li>
          <li>
            Escreva <strong>“Solicitação de exclusão de dados”</strong> e informe
            o nome e o telefone ou e-mail utilizado no cadastro.
          </li>
          <li>
            Aguarde a validação de identidade, feita somente com as informações
            mínimas necessárias para impedir exclusões indevidas.
          </li>
          <li>Você receberá confirmação do recebimento e do resultado da solicitação.</li>
        </ol>
      </section>

      <section>
        <h2>O que a solicitação pode abranger</h2>
        <ul>
          <li>cadastro e credenciais da área do paciente;</li>
          <li>anamnese, check-ins, metas e solicitações de ajustes;</li>
          <li>fotos, anexos e documentos enviados pelo paciente;</li>
          <li>número, mensagens e identificadores tratados pela automação do WhatsApp;</li>
          <li>demais registros que não precisem ser legalmente conservados.</li>
        </ul>
      </section>

      <section>
        <h2>Prazo e acompanhamento</h2>
        <p>
          A solicitação será atendida gratuitamente e, sempre que possível, de
          forma imediata. Se a providência exigir análise, você receberá uma
          resposta com o andamento e a conclusão assim que o processo for
          finalizado. Pedidos de confirmação ou acesso em formato completo serão
          respondidos no prazo legal aplicável, atualmente de até 15 dias.
        </p>
      </section>

      <section>
        <h2>Dados que podem precisar ser mantidos</h2>
        <p>
          Alguns registros podem ser preservados pelo prazo exigido para
          cumprimento de deveres legais, exercício regular de direitos,
          prevenção a fraudes e guarda profissional. Nesses casos, os dados
          permanecerão restritos a essas finalidades e serão eliminados quando o
          prazo aplicável terminar.
        </p>
        <p>
          Informações mantidas diretamente por fornecedores independentes, como
          a plataforma de pagamentos ou a própria Meta, seguem os respectivos
          procedimentos de privacidade. A solicitação feita aqui alcança os
          registros controlados por Ludgero Sangaletti.
        </p>
      </section>

      <section>
        <h2>Revogação do acesso pela Meta</h2>
        <p>
          Caso tenha conectado algum recurso da Meta ao serviço, você também
          pode revisar ou remover a integração nas configurações da sua conta
          Meta/Facebook. A remoção da integração não substitui a solicitação
          acima quando você desejar excluir registros mantidos diretamente no
          site.
        </p>
      </section>
    </LegalLayout>
  );
}
