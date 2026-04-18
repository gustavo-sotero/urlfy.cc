# TASKS:
[x] Corrigir link do email
    - link público de verificação agora usa /api/auth/verify-email
    - redirecionamento pós-verificação aponta para o dashboard localizado
[x] Mudar proxy gateway para acesso direto a api.
[x] Ajustar home page
    - banner cookies responsividade quebrada em dispostiivos moveis.
    - seção "Pronto para mais recursos" tambem esta com responsividade que
    - navbar/sidebar do mobile esta não está legal, esta com dois botões "x" pra fechar, alem disso ao abrir a sidebar ele quebra a responsividade do fundo, empurrando os elementos da home page, outra coisa, seria legal ajustar os itens da sidebar, tipo eles estão literamente colados no canto do sidebar, e os botões preenchem toda largura da sidebar.
[ ] Ajustes Dashboard
    - ajustar dashboard e tornar ela responsiva para dispositivos mobiles.
    - Melhorar a UX do formulario de criar link no dashboard, tipo a ux não é ruim, mas é simples demais.
[ ] Correções email.
    - Atualmente o e-mail para verificar conta, só é enviado caso o usuario faça login e na tela de login solicitar o email, e e-mail deve ser enviado logo assim que a conta for criada, e o usuario deve ser avisado disso.
    - tornar visual do e-mail similar ao do site.
[ ] Atualizar e revisar a pagina de sobre o projeto e readme.
[ ] Alterar sistema de autenticação do admin
    - Por se tratar de um projeto pessoal, so terá um unico admin, entao seguinte o login do admin deverá ser feito pelo github, e verificar o id do usuario do github se é igual ao id salvo no .env