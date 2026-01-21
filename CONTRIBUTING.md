# Contribuindo para o SEDD

Obrigado por considerar contribuir com o SEDD! Este documento explica como você pode ajudar.

## Como Contribuir

### Reportando Bugs

1. Verifique se o bug já não foi reportado em [Issues](https://github.com/goldensrazer/sedd/issues)
2. Se não, crie uma nova issue com:
   - Título claro e descritivo
   - Passos para reproduzir
   - Comportamento esperado vs. atual
   - Versão do SEDD (`sedd --version`)
   - Sistema operacional

### Sugerindo Features

1. Abra uma issue com a tag `feature`
2. Descreva:
   - O problema que a feature resolve
   - Como você imagina funcionando (sua **expectativa**!)
   - Exemplos de uso

### Pull Requests

1. Fork o repositório
2. Crie uma branch para sua feature:
   ```bash
   git checkout -b feature/minha-feature
   ```
3. Faça suas alterações
4. Rode o build para garantir que tudo funciona:
   ```bash
   npm run build
   ```
5. Commit com mensagem clara:
   ```bash
   git commit -m "Add: descrição da mudança"
   ```
6. Push para seu fork:
   ```bash
   git push origin feature/minha-feature
   ```
7. Abra um Pull Request

## Setup de Desenvolvimento

```bash
# Clone seu fork
git clone git@github.com:SEU-USER/sedd.git
cd sedd

# Instale dependências
npm install

# Build
npm run build

# Para desenvolvimento com watch
npm run dev

# Testar localmente
node bin/sedd.js --help
```

## Estrutura do Projeto

```
sedd/
├── src/              # Código fonte TypeScript
│   ├── cli/          # Comandos CLI
│   ├── core/         # Lógica principal
│   ├── types/        # Tipos TypeScript
│   └── utils/        # Utilitários
├── commands/         # Documentação dos slash commands
├── templates/        # Templates de arquivos gerados
├── hooks/            # Hooks para AI assistants
├── scripts/          # Scripts auxiliares (bash/powershell)
└── page/             # Landing page
```

## Padrões de Código

- **TypeScript**: Todo código em `src/` deve ser TypeScript
- **ESM**: Usamos ES Modules (`import/export`)
- **Sem dependências pesadas**: Mantenha o pacote leve
- **Compatibilidade**: Node.js >= 18

### Convenções de Commit

```
Add: nova funcionalidade
Fix: correção de bug
Update: melhoria em funcionalidade existente
Docs: apenas documentação
Refactor: refatoração sem mudança de comportamento
```

## Filosofia do Projeto

Lembre-se: SEDD é sobre **expectativas claras**.

Ao contribuir, pergunte-se:
- Isso ajuda a capturar melhor as expectativas do usuário?
- Isso mantém a AI alinhada com o que o usuário quer?
- É simples de usar?

## Dúvidas?

Abra uma [Discussion](https://github.com/goldensrazer/sedd/discussions) ou entre em contato pelo [LinkedIn](https://www.linkedin.com/in/kelvin-rodrigues-772066166).

---

**Toda contribuição é bem-vinda!** 🎯
