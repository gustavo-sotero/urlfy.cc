export const Privacy = {
  title: 'Política de Privacidade',
  lastUpdated: 'Última atualização',
  metaTitle: 'Política de Privacidade - urlfy.cc',
  metaDescription:
    'Política de privacidade e proteção de dados do urlfy.cc - LGPD compliant',

  exportData: 'Exportar Meus Dados',
  deleteAccount: 'Excluir Minha Conta',
  dataRetention: 'Política de Retenção de Dados',

  sections: {
    s1: {
      title: '1. Introdução',
      warningTitle:
        '📚 Contexto: Projeto pessoal de pesquisa e desenvolvimento',
      warningContent:
        'O urlfy.cc é um projeto de portfólio e demonstração técnica, não um produto comercial. Os dados coletados são utilizados exclusivamente para demonstração das funcionalidades de analytics e para aprendizado sobre compliance (LGPD/GDPR).',
      warningNote:
        'Importante: Por se tratar de um ambiente de demonstração, dados podem ser periodicamente apagados ou modificados sem aviso prévio. Não recomendamos o uso deste serviço para links críticos de negócio.',
      content:
        'O urlfy.cc ("nós", "nosso" ou "Serviço") respeita sua privacidade e está comprometido em proteger seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações em conformidade com a Lei Geral de Proteção de Dados (LGPD) e regulamentações internacionais como GDPR.'
    },
    s2: {
      title: '2. Dados que Coletamos',
      sub1Title: '2.1 Informações de Conta',
      sub1Intro: 'Quando você cria uma conta, coletamos:',
      sub1Items: {
        i1: 'Nome e endereço de e-mail',
        i2: 'Senha (armazenada com criptografia bcrypt)',
        i3: 'Informações de perfil OAuth (se usar login social)'
      },
      sub2Title: '2.2 Dados de Analytics',
      sub2Intro: 'Para fornecer estatísticas sobre seus links, coletamos:',
      sub2Items: {
        i1: 'Endereço IP (anonimizado através de hash SHA-256 imediato)',
        i2: 'País e cidade (através de geolocalização offline)',
        i3: 'Navegador, sistema operacional e tipo de dispositivo',
        i4: 'URL de referência (origem do clique)',
        i5: 'Timestamp do acesso'
      },
      sub2Note:
        'Importante: Nunca armazenamos seu endereço IP em texto claro. Ele é convertido em um hash irreversível imediatamente após a coleta.',
      sub3Title: '2.3 Cookies',
      sub3Intro: 'Utilizamos cookies para:',
      sub3Items: {
        i1: 'Manter sua sessão ativa (cookies essenciais)',
        i2: 'Lembrar suas preferências de tema',
        i3: 'Proteger contra CSRF (cookies de segurança)'
      }
    },
    s3: {
      title: '3. Como Usamos Seus Dados',
      intro: 'Utilizamos seus dados para:',
      items: {
        i1: 'Fornecer e manter o Serviço',
        i2: 'Gerar estatísticas e analytics sobre seus links',
        i3: 'Autenticar e gerenciar sua conta',
        i4: 'Enviar notificações importantes sobre o Serviço',
        i5: 'Detectar e prevenir fraudes e abusos',
        i6: 'Cumprir obrigações legais'
      },
      note: 'Contexto de Pesquisa: Os dados coletados também são utilizados para demonstrar competências técnicas em implementação de sistemas de analytics com privacidade (IP hashing, anonimização, LGPD compliance).'
    },
    s4: {
      title: '4. Base Legal (LGPD)',
      intro: 'Processamos seus dados com base em:',
      items: {
        i1Heading: 'Consentimento:',
        i1: 'Quando você cria uma conta ou aceita cookies',
        i2Heading: 'Execução de contrato:',
        i2: 'Para fornecer o Serviço solicitado',
        i3Heading: 'Legítimo interesse:',
        i3: 'Para segurança, prevenção de fraude e melhorias do Serviço',
        i4Heading: 'Obrigação legal:',
        i4: 'Quando exigido por lei'
      }
    },
    s5: {
      title: '5. Compartilhamento de Dados',
      intro:
        'Não vendemos seus dados pessoais. Podemos compartilhar dados apenas com:',
      items: {
        i1Heading: 'Provedores de serviço:',
        i1: 'Empresas que nos ajudam a operar o Serviço (hospedagem, email)',
        i2Heading: 'Autoridades legais:',
        i2: 'Quando exigido por lei ou para proteger direitos legais'
      }
    },
    s6: {
      title: '6. Retenção de Dados',
      intro: 'Mantemos seus dados pelo seguinte período:',
      items: {
        i1Heading: 'Dados de conta:',
        i1: 'Enquanto sua conta estiver ativa',
        i2Heading: 'Analytics brutos:',
        i2: '90 dias (depois apenas dados agregados)',
        i3Heading: 'Backups:',
        i3: 'Até 30 dias após exclusão'
      },
      warningTitle: '⚠️ Aviso: Ambiente de Demonstração',
      warningContent:
        'Como este é um projeto pessoal de pesquisa e desenvolvimento, dados podem ser apagados periodicamente (incluindo antes dos períodos descritos acima) para demonstrações, testes ou manutenção. Recomendamos não armazenar links críticos ou dados importantes neste serviço.'
    },
    s7: {
      title: '7. Seus Direitos (LGPD/GDPR)',
      intro: 'Você tem o direito de:',
      items: {
        i1Heading: 'Acesso:',
        i1: 'Solicitar uma cópia de todos os seus dados',
        i2Heading: 'Retificação:',
        i2: 'Corrigir dados incorretos ou incompletos',
        i3Heading: 'Exclusão:',
        i3: 'Solicitar a remoção de seus dados',
        i4Heading: 'Portabilidade:',
        i4: 'Receber seus dados em formato estruturado',
        i5Heading: 'Revogação de consentimento:',
        i5: 'Retirar consentimento a qualquer momento',
        i6Heading: 'Oposição:',
        i6: 'Opor-se ao processamento de seus dados'
      },
      contactNote:
        'Para exercer esses direitos, acesse as configurações da sua conta ou entre em contato através da',
      contactLink: 'nossa página de contato',
      contactSuffix:
        '. Responderemos em até 72 horas conforme exigido pela LGPD.'
    },
    s8: {
      title: '8. Segurança',
      intro:
        'Implementamos medidas técnicas e organizacionais para proteger seus dados:',
      items: {
        i1: 'Criptografia TLS/SSL em todas as conexões',
        i2: 'Senhas armazenadas com bcrypt (hashing seguro)',
        i3: 'Anonimização imediata de endereços IP',
        i4: 'Backups criptografados',
        i5: 'Controles de acesso rigorosos',
        i6: 'Monitoramento contínuo de segurança'
      }
    },
    s9: {
      title: '9. Transferências Internacionais',
      content:
        'Seus dados são armazenados em servidores localizados no Brasil. Caso seja necessário transferir dados internacionalmente, garantimos proteções adequadas conforme exigido pela LGPD.'
    },
    s10: {
      title: '10. Menores de Idade',
      content:
        'O Serviço não é direcionado a menores de 18 anos. Não coletamos intencionalmente dados de menores. Se tomarmos conhecimento de tais dados, os excluiremos imediatamente.'
    },
    s11: {
      title: '11. Alterações nesta Política',
      content:
        'Podemos atualizar esta Política periodicamente. Notificaremos sobre mudanças significativas através do Serviço ou por e-mail. Recomendamos revisar esta Política regularmente.'
    },
    s12: {
      title: '12. Contato e DPO',
      content:
        'Para questões sobre privacidade ou para exercer seus direitos, entre em contato através da',
      contactLink: 'nossa página de contato'
    },
    s13: {
      title: '13. Autoridade de Supervisão',
      content:
        'Se não estivermos satisfeitos com nossa resposta, você tem o direito de apresentar uma reclamação à Autoridade Nacional de Proteção de Dados (ANPD) no Brasil.'
    }
  }
} as const;
