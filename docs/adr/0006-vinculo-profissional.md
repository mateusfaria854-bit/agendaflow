# ADR 0006: Acesso profissional vinculado, sem seleção de identidade na URL

- **Status:** Aceita
- **Data:** 2026-11-20

## Contexto
O sistema tem perfis PROFISSIONAL e registros de profissionais, mas a API não deve permitir que o papel PROFISSIONAL selecione arbitrariamente qual agenda consultar.

## Decisão
A conta é criada em procedimento local explícito e associada à coluna UNIQUE professionals.user_id, cuja chave estrangeira já existia. O provisionamento usa uma transação com lock na linha do profissional, confere vínculo ausente, cria usuário no papel PROFISSIONAL com senha scrypt e registra auditoria. E-mail em uso ou vínculo existente é rejeitado sem promover outros papéis.

Os endpoints /staff/me e /staff/appointments exigem role PROFISSIONAL e identificam a agenda EXCLUSIVAMENTE por user_id da sessão, com profissional ativo. A API não recebe professionalId. A resposta da agenda inclui identificação mínima de cliente para reconhecer o atendimento, mas não email ou valor. A interface é somente leitura.

## Alternativas
- Receber professionalId da UI com checagem posterior: aumenta risco de acesso cruzado e manipulação de parâmetro.
- Criar contas PROFISSIONAL por cadastro público: permite escolha arbitrária de perfil e facilitaria abuso.
- Administrador definir senhas em um formulário web: amplia exposição de credenciais por interface e logs.
- Conceder permissões ADMIN a profissionais: expõe dados e ações de toda a empresa.

## Consequências
O ambiente local exige uma etapa de provisionamento manual usando PROFESSIONAL_ID. Convites seguros, recuperação de senha, auditoria adicional e testes E2E completos ficam para próximas etapas. A disciplina de autorização continua no servidor e é validada em testes de integração.
