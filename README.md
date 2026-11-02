# ✦ Bíblia do Empreendedor

App de Bíblia cristã (PWA) com visual **preto e dourado**, texto bíblico em **branco** e foco em empreendedores.

## Funcionalidades

- **Bíblia King James (KJV, 1611)** completa — 66 livros e 1.189 capítulos (também dá para trocar para a Almeida em português)
- **Progresso de leitura**: capítulos lidos, % da Bíblia, meta diária, dias seguidos e progresso por livro
- **Mensagem do dia** (versículo + reflexão + ação prática) e **Mensagem da semana**
- **Tarefas cristãs** para tornar o mundo melhor (3 desafios por dia + mais de 40 tarefas, com contador de boas obras)
- **Negócios**: o ponto de vista da Bíblia para 12 decisões de empreendedor (dívidas, sócios, equipe, preço, crise, etc.)
- **Mentor IA** (Google Gemini, gratuito): pergunte como agir ou tire dúvidas sobre a Bíblia, com a pergunta do dia
- **Estúdio de Posts**: todo dia cria um **post (1080×1350)** e um **stories (1080×1920)** com 9 fundos de empreendedorismo, um versículo/provérbio ou uma frase criada pela IA, e a legenda pronta com hashtags
- Funciona offline depois de aberto, pode ser instalado no celular ("Adicionar à tela inicial")

## Ativar a IA (grátis)

1. Acesse https://aistudio.google.com/apikey com sua conta Google
2. Clique em **Create API key**
3. No app, vá em **Ajustes** (engrenagem) e cole a chave

A chave fica salva apenas no seu aparelho.

## Rodar / publicar

É um site estático, sem build:

```bash
python3 -m http.server 8080   # abra http://localhost:8080
```

### Publicar na Vercel (grátis)

1. Entre em https://vercel.com e faça login com o GitHub
2. **Add New… → Project** → importe o repositório `RIBIBLE`
3. Framework Preset: **Other** · Build Command: vazio · Output Directory: vazio (raiz)
4. Clique em **Deploy**

A cada `git push` na `main`, a Vercel publica a nova versão automaticamente. O `vercel.json` já está configurado.

## Créditos

Texto bíblico: King James Version (domínio público) e João Ferreira de Almeida, via [bible-api.com](https://bible-api.com).
Os versículos em português nas mensagens são traduções livres da KJV.
