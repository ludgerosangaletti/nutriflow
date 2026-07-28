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
          WhatsApp profissional <a href="https://wa.me/5542999876280">+55 42 99987-6280</a>.
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
          Informações relacionadas à saúde são dados pessoais sensíveis e
          recebem tratamento compatível com sua natureza, limitado à prestação
          do acompanhamento nutricional e às obrigações profissionais aplicáveis.
        </p>
      </section>

      <section>
        <h2>3. Para que os dados são utilizados</h2>
        <ul>
          <li>viabilizar cadastro, atendimento e acompanhamento nutricional;</li>
          <li>responder dúvidas e solicitações enviadas pelo site ou WhatsApp;</li>
          <li>organizar pagamentos, acesso ao plano e comunicações de serviço;</li>
          <li>manter segurança, prevenir uso indevido e cumprir obrigações legais;</li>
          <li>melhorar a experiência e a confiabilidade dos serviços digitais.</li>
        </ul>
      </section>

      <section>
        <h2>4. Automação no WhatsApp</h2>
        <p>
          Quando uma pessoa inicia contato pelo WhatsApp profissional, a mensagem
          e o número de telefone podem ser processados pela API oficial do
          WhatsApp/Meta e pelo servidor do site para identificar o assunto e
          enviar uma resposta informativa. A automação não realiza diagnóstico
          nem substitui consulta nutricional.
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
          Dados não são vendidos. O site não recebe nem armazena os dados
          completos do cartão utilizado no ambiente de pagamento.
        </p>
      </section>

      <section>
        <h2>6. Retenção e segurança</h2>
        <p>
          Os dados são conservados pelo período necessário ao atendimento, à
          continuidade do acompanhamento e ao cumprimento de deveres legais,
          regulatórios e profissionais. São adotadas medidas técnicas e
          organizacionais razoáveis para reduzir riscos de acesso, alteração,
          perda ou divulgação indevida.
        </p>
      </section>

      <section>
        <h2>7. Seus direitos</h2>
        <p>
          Nos termos da Lei Geral de Proteção de Dados (LGPD), o titular pode
          solicitar confirmação de tratamento, acesso, correção, portabilidade
          quando aplicável, informação sobre compartilhamentos, revisão de
          consentimento e exclusão dos dados que possam ser eliminados.
        </p>
        <p>
          Para solicitar a exclusão, consulte também a página de{" "}
          <a href="/exclusao-de-dados">Exclusão de Dados</a>.
        </p>
      </section>

      <section>
        <h2>8. Atualizações desta política</h2>
        <p>
          Este documento pode ser atualizado para refletir mudanças nos serviços,
          fornecedores ou requisitos legais. A versão vigente ficará sempre
          disponível nesta página.
        </p>
      </section>
    </LegalLayout>
  );
}
