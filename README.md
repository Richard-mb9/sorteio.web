# Sorteio Web

Aplicação web local para organizar jogos de vôlei em grupos equilibrados, gerenciar a rotação das partidas e acompanhar o ranking dos jogadores durante uma sequência de jogos.

O sistema foi pensado para uso em celular, sem backend e sem autenticação. Todos os dados ficam salvos localmente no navegador, permitindo cadastrar jogadores fixos, ativar apenas quem está presente no dia e controlar as partidas a partir de um único aparelho.

## Objetivo

O Sorteio Web resolve três problemas comuns em jogos recreativos de vôlei:

- formar times equilibrados considerando gênero e nota técnica dos jogadores;
- manter uma rotação contínua entre times, vencedores, perdedores e jogadores excedentes;
- registrar partidas finalizadas para exibir um ranking de vitórias.

A aplicação não é um sistema de campeonato. Ela gerencia a ordem de jogo do dia, mantendo o sorteio inicial justo e permitindo ajustes durante a rotação.

## Como Funciona

O fluxo principal é:

1. Cadastre todos os jogadores em `Jogadores`.
2. Marque como ativos apenas os jogadores presentes no dia.
3. Configure o sorteio em `Configurações`.
4. Gere o sorteio no `Painel`.
5. Acompanhe e controle as partidas em `/rotacao`.
6. Consulte o ranking em `/ranking`.

Jogadores inativos permanecem cadastrados, mas não entram no sorteio, na rotação, em trocas, em substituições, nos times exibidos nem no ranking da rotação.

## Funcionalidades

### Cadastro de Jogadores

Cada jogador possui:

- nome;
- gênero;
- nota técnica de 0 a 10;
- status ativo ou inativo.

O cadastro permite:

- adicionar novos jogadores;
- editar dados de jogadores existentes;
- ativar ou inativar jogadores;
- remover jogadores;
- filtrar por nome, gênero e status;
- manter jogadores cadastrados permanentemente para reutilização em outros dias.

Jogadores cadastrados como ativos durante uma rotação são encaixados na rotação atual sem refazer o sorteio inteiro.

### Sorteio Inicial

O sorteio inicial usa apenas jogadores ativos.

Ele monta times buscando equilíbrio por:

- quantidade de jogadores por time;
- proporção de gênero;
- soma total das notas;
- média técnica;
- soma das notas masculinas;
- soma das notas femininas;
- equilíbrio técnico entre os grupos.

A aleatoriedade existe apenas como desempate entre alternativas equivalentes ou muito próximas. Isso evita um sorteio previsível sem destruir o equilíbrio.

### Rotação de Partidas

A tela principal da rotação fica em:

```text
/rotacao
```

Nela são exibidos:

- os dois times em partida;
- próximos times da fila;
- jogadores excedentes;
- quantidade atual de vitórias dos times em partida;
- soma total das notas de cada time;
- ações por jogador.

Após cada partida, o usuário confirma qual time venceu. A rotação só muda depois dessa confirmação.

Por padrão:

- o vencedor permanece;
- o perdedor sai;
- o próximo time da fila entra;
- o time que sai vai para o fim da rotação;
- as vitórias do time que sai são zeradas.

### Limite de Vitórias

A aplicação permite configurar a quantidade máxima de vitórias consecutivas por time.

Quando um time atinge esse limite:

- ele sai da partida após a confirmação da vitória;
- sua contagem de vitórias volta para zero;
- ele retorna para a fila de rotação.

Essa regra tem prioridade sobre a regra padrão de permanência do vencedor.

### Saída Dupla

Também é possível ativar a regra de saída dupla.

Quando ela está ativa, se um time atingir o limite máximo de vitórias:

- o time vencedor sai por atingir o limite;
- o time perdedor também sai;
- dois novos times entram.

Essa regra só é aplicada quando existem pelo menos 4 times completos na rotação. Se houver menos de 4 times completos, a aplicação mantém a rotação possível para preservar dois times jogando sempre que houver jogadores suficientes.

Nesse cenário com menos de 4 times, quando um time atinge o limite de vitórias, apenas o vencedor sai. O perdedor permanece na partida, o próximo time da fila entra e o vencedor que saiu volta para a fila com a contagem de vitórias zerada. Se não existir outro time completo aguardando, o próprio vencedor pode voltar imediatamente para completar a próxima partida.

Na saída dupla, os times que já estavam aguardando continuam na frente da fila. Depois deles, entra o time vencedor que atingiu o limite e, em seguida, o time perdedor.

### Jogadores Excedentes

Jogadores que não formam um time completo são tratados como excedentes.

Excedentes não jogam como um time incompleto. Eles entram nos times que saem da partida e voltam para o fim da fila.

Exemplo:

- dois times estão jogando;
- dois times completos estão aguardando;
- existem 2 jogadores excedentes;
- um time que estava jogando sai;
- esse time vai para o fim da fila;
- os 2 excedentes entram nesse time;
- 2 jogadores desse time são removidos;
- os jogadores removidos passam a ser os novos excedentes.

Na saída dupla:

- os excedentes entram primeiro no time vencedor que saiu por limite de vitórias;
- os jogadores removidos desse time entram no time perdedor que saiu;
- os jogadores removidos do time perdedor viram os novos excedentes.

### Aleatoriedade na Rotação dos Times

A configuração `Aleatoriedade na rotação dos times` afeta apenas as substituições automáticas feitas durante a rotação. Ela não altera o sorteio inicial.

Quando está desativada:

- a substituição automática tenta preservar equilíbrio por gênero, nota e força dos grupos;
- também considera o histórico de remoções para evitar repetir sempre os mesmos jogadores.

Quando está ativada:

- a rotação não considera equilíbrio técnico entre times;
- mulheres são substituídas preferencialmente por mulheres;
- homens são substituídos preferencialmente por homens;
- o histórico de remoções continua sendo considerado, para evitar que o mesmo jogador saia mais vezes que os demais.

### Trocas Manuais

Na tela de rotação, cada jogador possui um menu de três pontos com as opções:

- `Inativar`;
- `Mover`.

Ao escolher `Mover`, o jogador fica marcado. Depois, basta tocar em outro jogador de outro grupo para confirmar a troca.

Regras da troca manual:

- sempre troca 1 jogador por 1 jogador;
- não permite trocar jogadores do mesmo grupo;
- só envolve jogadores ativos;
- exige confirmação antes de aplicar;
- mantém a ordem dos grupos na rotação;
- cada jogador passa a seguir a rotação do novo grupo.

### Inativação Durante a Rotação

A opção `Inativar` remove o jogador da rotação imediatamente.

Se o jogador estiver em um time que está jogando, a aplicação tenta preencher a vaga automaticamente com um jogador ativo da sequência da rotação, preservando a estrutura dos times.

Jogadores inativos deixam de aparecer:

- na partida atual;
- nos próximos times;
- nos excedentes;
- nas opções de troca;
- nos cálculos da rotação.

### Ranking

A tela de ranking fica em:

```text
/ranking
```

Ela lista os jogadores ativos que participaram de partidas finalizadas depois do último sorteio.

Para cada jogador são exibidos:

- quantidade de jogos;
- quantidade de vitórias.

A classificação considera apenas o número de vitórias. A quantidade de jogos é informativa.

Sempre que um novo sorteio é gerado, o ranking é zerado porque o histórico da rotação anterior é substituído.

## Cálculos e Critérios

### Formação da Estrutura dos Times

A quantidade de times completos é calculada assim:

- `times completos = jogadores ativos / jogadores por time`, arredondando para baixo;
- `excedentes = jogadores ativos % jogadores por time`;
- o sorteio só é permitido quando existem jogadores ativos suficientes para formar pelo menos 2 times completos.

Se sobrarem jogadores depois da formação dos times completos, eles entram como excedentes da rotação.

### Distribuição por Gênero

O sorteio calcula a proporção de homens e mulheres entre os jogadores ativos e tenta repetir essa proporção em cada time.

Exemplo: se 60% dos jogadores ativos forem homens, cada time recebe uma quantidade de homens o mais próxima possível de 60% do seu tamanho.

Quando a divisão não é exata, as vagas restantes são distribuídas entre os times com maior fração proporcional. Empates usam aleatoriedade controlada.

### Distribuição por Nota

Depois de definir quantas vagas de cada gênero existem em cada time, os jogadores são separados por gênero e ordenados pela nota técnica, da maior para a menor.

Cada jogador é colocado no time que, naquele gênero, possui a menor soma de notas no momento. Isso espalha jogadores mais fortes e mais fracos entre os times, evitando concentração técnica em um único grupo.

Empates de nota ou de soma usam sorteio aleatório apenas para desempate.

### Totais do Time

Cada time mantém os seguintes totais calculados automaticamente:

- quantidade de jogadores;
- quantidade de homens;
- quantidade de mulheres;
- soma das notas dos homens;
- soma das notas das mulheres;
- soma total das notas do time.

A tela de rotação exibe a soma total das notas do time, mas não exibe gênero nem nota individual dos jogadores.

### Substituições Automáticas com Equilíbrio

Quando a configuração `Aleatoriedade na rotação dos times` está desativada, a substituição automática escolhe quem sai do time avaliando, nesta ordem:

1. preservar a composição de gênero;
2. reduzir a diferença entre a nota de quem entra e a nota de quem sai;
3. manter a força do time próxima ao que ela era antes da troca;
4. reduzir a diferença técnica contra o adversário atual;
5. reduzir a diferença entre o time mais forte e o mais fraco da rotação;
6. evitar remover novamente jogadores que já saíram recentemente.

O histórico de remoções pesa contra jogadores que já foram removidos mais vezes ou há poucas rodadas.

### Substituições Automáticas com Aleatoriedade na Rotação

Quando a configuração `Aleatoriedade na rotação dos times` está ativada, a substituição automática da rotação ignora nota e equilíbrio técnico.

Nesse modo, a escolha considera apenas:

- substituir homens preferencialmente por homens;
- substituir mulheres preferencialmente por mulheres;
- evitar remover de novo jogadores que já foram removidos mais vezes ou há poucas rodadas;
- usar aleatoriedade como desempate final.

Esse comportamento vale apenas para a rotação. O sorteio inicial continua equilibrado por gênero e nota.

### Ranking

Ao confirmar uma partida:

- todos os jogadores do time vencedor recebem `1` jogo e `1` vitória;
- todos os jogadores do time perdedor recebem `1` jogo e `0` vitórias;
- jogadores que estavam fora da partida não recebem jogo nem vitória naquela rodada.

A ordenação do ranking usa apenas a quantidade de vitórias. A quantidade de jogos serve para consulta.

## Configurações Disponíveis

As configurações ficam em `Configurações`.

### Jogadores por Time

Define o tamanho dos times completos.

O sorteio só pode ser feito quando existem jogadores ativos suficientes para formar pelo menos dois times completos.

### Máximo de Vitórias Consecutivas por Time

Define quantas vitórias seguidas um time pode acumular antes de sair obrigatoriamente da partida.

### Remover os Dois Times Quando um Atingir o Limite de Vitórias

Ativa ou desativa a saída dupla.

Essa configuração só tem efeito quando um time atinge o limite de vitórias e existem pelo menos 4 times completos na rotação.

### Aleatoriedade na Rotação dos Times

Define se a rotação automática deve ignorar equilíbrio técnico entre times.

Essa configuração afeta apenas a rotação. O sorteio inicial continua equilibrado por gênero e nota.

## Telas e Rotas

- `/painel`: visão geral do sorteio, jogadores ativos e atalhos principais.
- `/jogadores`: cadastro, edição, filtros, ativação e inativação de jogadores.
- `/configuracoes`: configurações do sorteio e da rotação.
- `/rotacao`: controle das partidas, vencedores, fila, excedentes e trocas.
- `/ranking`: ranking de vitórias da rotação atual.

A rota antiga `/resultado` redireciona para `/rotacao`.

## Persistência dos Dados

A aplicação não usa backend.

Os dados são salvos no `localStorage` do navegador:

- jogadores;
- configurações;
- último sorteio;
- estado atual da rotação;
- histórico da rotação atual;
- ranking derivado das partidas finalizadas.

Limpar os dados do navegador remove o estado salvo da aplicação.

## Execução com Docker e HTTPS

Esta seção mantém as instruções operacionais de uso do projeto.

A aplicação React/Vite é servida por `nginx` via Docker e está preparada para acesso local em HTTPS na porta `443`.

### Como Subir

```bash
docker compose up --build -d
```

Depois disso:

- `http://192.168.29.67` redireciona para HTTPS.
- `https://192.168.29.67` serve a aplicação com TLS.

### Como o HTTPS Funciona

Na primeira subida do container, o `nginx` gera automaticamente:

- uma CA local em `docker/certs/rootCA.crt`;
- um certificado do servidor em `docker/certs/server.crt`;
- a chave privada em `docker/certs/server.key`.

O certificado do servidor é emitido com SAN para:

- `IP:192.168.29.67`;
- `IP:127.0.0.1`;
- `DNS:localhost`.

Os arquivos ficam persistidos em `docker/certs`, então não são recriados a cada restart. Se você mudar o IP da máquina, basta ajustar as variáveis no `docker-compose.yml` e subir novamente.

### Confiar no Certificado nos Dispositivos

Para remover o aviso de certificado no navegador, instale `docker/certs/rootCA.crt` como autoridade certificadora confiável em cada dispositivo que vai acessar a aplicação.

- Windows: importe o arquivo no repositório `Trusted Root Certification Authorities`.
- macOS: importe no `Keychain Access` e marque como `Always Trust`.
- Android: instale como certificado de CA do usuário.
- iPhone/iPad: importe o perfil e habilite a confiança total em `Settings > General > About > Certificate Trust Settings`.

Sem esse passo, o HTTPS funciona, mas o navegador continuará exibindo aviso por se tratar de uma CA privada da sua rede.

### Personalização do HTTPS

As variáveis abaixo podem ser alteradas no serviço `sorteio-web` do `docker-compose.yml`:

- `TLS_CERT_COMMON_NAME`;
- `TLS_CERT_ALT_NAMES`;
- `TLS_CERT_VALID_DAYS`.

Exemplo de SAN para outro IP local:

```yaml
environment:
  TLS_CERT_COMMON_NAME: "192.168.1.10"
  TLS_CERT_ALT_NAMES: "IP:192.168.1.10,IP:127.0.0.1,DNS:localhost"
```

## Desenvolvimento Local

Instale as dependências:

```bash
npm install
```

Execute em modo de desenvolvimento:

```bash
npm run dev
```

Valide o projeto:

```bash
npm run lint
npm run build
```
