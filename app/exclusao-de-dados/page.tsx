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
            Envie uma mensagem para o WhatsApp profissional{" "}
            <a href="https://wa.me/5542999876280">+55 42 99987-6280</a>.
          </li>
          <li>
            Escreva <strong>“Solicitação de exclusão de dados”</strong> e informe
            o nome e o telefone ou e-mail utilizado no cadastro.
          </li>
          <li>
            Aguarde a confirmação de identidade e o número de protocolo da
            solicitação.
          </li>
        </ol>
      </section>

      <section>
        <h2>Prazo e alcance</h2>
        <p>
          A solicitação será analisada e respondida em até 15 dias. Após a
          validação da identidade, serão eliminados ou anonimizados os dados que
          não precisem ser conservados por obrigação legal, regulatória,
          contratual ou profissional.
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
