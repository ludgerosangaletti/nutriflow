import LegalLayout from "../legal-layout";

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      eyebrow="Privacidade e proteção de dados"
      title="Política de Privacidade"
      intro="Esta política explica como os dados pessoais são tratados no site, na área do paciente e nas interações automatizadas pelo WhatsApp."
    >
      <section>
        <h2>1. Quem trata os seus dados</h2>
        <p>
          O responsável pelo tratamento é Ludgero Sangaletti, nutricionista,
          CRN-8 11719. Dúvidas sobre privacidade podem ser encaminhadas pelo
          WhatsApp de atendimento <a href="https://wa.me/5542999846280">+55 42 99984-6280</a>.
        </p>
      </section>

      <section>
        <h2>2. Dados que podem ser coletados</h2>
        <p>
          Conforme o serviço utilizado, podemos tratar dados de identificação e
          contato, informações fornecidas em cadastro e anamnese, objetivos,
          registros de acompanhamento, arquivos enviados pelo paciente, dados
          de acesso e mensagens enviadas ao canal profissional no WhatsApp.
        </p>
        <p>
          Na automação do WhatsApp podem ser tratados o número de telefone, o
          conteúdo da mensagem, data e horário, identificadores técnicos e
          informações de entrega necessárias ao funcionamento do canal.
        </p>
        <p>
          Informações relacionadas à saúde são dados pessoais sensíveis e
          recebem tratamento compatível com sua natureza, limitado à prestação
          do acompanhamento nutricional e às obrigações profissionais aplicáveis.
        </p>
      </section>

      <section>
        <h2>3. Finalidades e bases legais</h2>
        <ul>
          <li>viabilizar cadastro, atendimento e acompanhamento nutricional;</li>
          <li>responder dúvidas e solicitações enviadas pelo site ou WhatsApp;</li>
          <li>organizar pagamentos, acesso ao plano e comunicações de serviço;</li>
          <li>manter segurança, prevenir uso indevido e cumprir obrigações legais;</li>
          <li>melhorar a experiência e a confiabilidade dos serviços digitais.</li>
        </ul>
        <p>
          Conforme a situação, o tratamento poderá se apoiar no consentimento,
          na execução do serviço contratado, no cumprimento de obrigações
          legais ou regulatórias, no exercício regular de direitos e na tutela
          da saúde por profissional habilitado.
        </p>
      </section>

      <section>
        <h2>4. Automação no WhatsApp</h2>
        <p>
          Quando uma pessoa inicia contato pelo WhatsApp profissional, a mensagem
          e o número de telefone podem ser processados pela API oficial do
          WhatsApp/Meta e pelo servidor do site para identificar o assunto e
          enviar uma resposta informativa. A automação não realiza diagnóstico
          nem substitui consulta nutricional. Também não são tomadas decisões
          clínicas exclusivamente por meios automatizados.
        </p>
      </section>

      <section>
        <h2>5. Compartilhamento e operadores</h2>
        <p>
          Dados podem ser processados por fornecedores necessários ao funcionamento
          do serviço, como hospedagem, autenticação, armazenamento, e-mail,
          pagamentos e WhatsApp/Meta. Cada fornecedor recebe apenas os dados
          necessários à sua função e está sujeito às suas próprias medidas de
          segurança e privacidade.
        </p>
        <p>
          Alguns fornecedores podem processar informações em infraestrutura
          localizada fora do Brasil. Nesses casos, são utilizados serviços
          necessários à operação e mecanismos compatíveis com a legislação
          aplicável à transferência internacional de dados.
        </p>
        <p>
          Dados não são vendidos. O site não recebe nem armazena os dados
          completos do cartão utilizado no ambiente de pagamento.
        </p>
      </section>

      <section>
        <h2>6. Retenção, segurança e incidentes</h2>
        <p>
          Os dados são conservados pelo período necessário ao atendimento, à
          continuidade do acompanhamento e ao cumprimento de deveres legais,
          regulatórios e profissionais. São adotadas medidas técnicas e
          organizacionais razoáveis para reduzir riscos de acesso, alteração,
          perda ou divulgação indevida.
        </p>
        <p>
          Entre os controles adotados estão autenticação, acesso administrativo
          restrito, conexões protegidas, separação de permissões e rotinas de
          continuidade. Caso ocorra incidente com risco ou dano relevante, serão
          adotadas as providências e comunicações exigidas pela legislação.
        </p>
      </section>

      <section>
        <h2>7. Seus direitos</h2>
        <p>
          Nos termos da Lei Geral de Proteção de Dados (LGPD), o titular pode
          solicitar confirmação de tratamento, acesso, correção, anonimização,
          bloqueio ou eliminação quando cabíveis, portabilidade quando aplicável,
          informação sobre compartilhamentos, oposição e revogação do
          consentimento.
        </p>
        <p>
          Para solicitar a exclusão, consulte também a página de{" "}
          <a href="/exclusao-de-dados">Exclusão de Dados</a>.
        </p>
      </section>

      <section>
        <h2>8. Cookies e armazenamento local</h2>
        <p>
          O site pode utilizar cookies ou tecnologias equivalentes estritamente
          necessários para autenticação, segurança e manutenção da sessão. Não
          são utilizados para vender dados pessoais.
        </p>
      </section>

      <section>
        <h2>9. Atualizações desta política</h2>
        <p>
          Este documento pode ser atualizado para refletir mudanças nos serviços,
          fornecedores ou requisitos legais. A versão vigente ficará sempre
          disponível nesta página.
        </p>
      </section>
    </LegalLayout>
  );
}
