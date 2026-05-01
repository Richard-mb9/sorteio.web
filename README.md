# Sorteio Web

Aplicacao React/Vite servida por `nginx` via Docker, agora preparada para acesso local em HTTPS na porta `443`.

## Como subir

```bash
docker compose up --build -d
```

Depois disso:

- `http://192.168.29.67` redireciona para HTTPS.
- `https://192.168.29.67` serve a aplicacao com TLS.

## Como o HTTPS funciona

Na primeira subida do container, o `nginx` gera automaticamente:

- uma CA local em `docker/certs/rootCA.crt`
- um certificado do servidor em `docker/certs/server.crt`
- a chave privada em `docker/certs/server.key`

O certificado do servidor e emitido com SAN para:

- `IP:192.168.29.67`
- `IP:127.0.0.1`
- `DNS:localhost`

Os arquivos ficam persistidos em `docker/certs`, entao nao sao recriados a cada restart. Se voce mudar o IP da maquina, basta ajustar as variaveis no `docker-compose.yml` e subir novamente.

## Confiar no certificado nos dispositivos

Para remover o aviso de certificado no navegador, instale `docker/certs/rootCA.crt` como autoridade certificadora confiavel em cada dispositivo que vai acessar a aplicacao.

- Windows: importe o arquivo no repositrio `Trusted Root Certification Authorities`.
- macOS: importe no `Keychain Access` e marque como `Always Trust`.
- Android: instale como certificado de CA do usuario.
- iPhone/iPad: importe o perfil e habilite a confianca total em `Settings > General > About > Certificate Trust Settings`.

Sem esse passo, o HTTPS funciona, mas o navegador continuara exibindo aviso por se tratar de uma CA privada da sua rede.

## Personalizacao

As variaveis abaixo podem ser alteradas no servico `sorteio-web` do `docker-compose.yml`:

- `TLS_CERT_COMMON_NAME`
- `TLS_CERT_ALT_NAMES`
- `TLS_CERT_VALID_DAYS`

Exemplo de SAN para outro IP local:

```yaml
environment:
  TLS_CERT_COMMON_NAME: "192.168.1.10"
  TLS_CERT_ALT_NAMES: "IP:192.168.1.10,IP:127.0.0.1,DNS:localhost"
```
