#!/bin/sh

set -eu

CERT_DIR="${TLS_CERT_DIR:-/etc/nginx/certs}"
CA_KEY_FILE="${CERT_DIR}/rootCA.key"
CA_CERT_FILE="${CERT_DIR}/rootCA.crt"
CA_SERIAL_FILE="${CERT_DIR}/rootCA.srl"
SERVER_KEY_FILE="${CERT_DIR}/server.key"
SERVER_CERT_FILE="${CERT_DIR}/server.crt"
SERVER_CSR_FILE="${CERT_DIR}/server.csr"
OPENSSL_CONFIG_FILE="${CERT_DIR}/server-openssl.cnf"
SERVER_CN_FILE="${CERT_DIR}/server.cn"
SERVER_SANS_FILE="${CERT_DIR}/server.sans"

TLS_CERT_COMMON_NAME="${TLS_CERT_COMMON_NAME:-192.168.29.67}"
TLS_CERT_ALT_NAMES="${TLS_CERT_ALT_NAMES:-IP:192.168.29.67,IP:127.0.0.1,DNS:localhost}"
TLS_CERT_VALID_DAYS="${TLS_CERT_VALID_DAYS:-825}"
TLS_CA_COMMON_NAME="${TLS_CA_COMMON_NAME:-Sorteio Web Local CA}"

mkdir -p "${CERT_DIR}"

if [ ! -f "${CA_KEY_FILE}" ] || [ ! -f "${CA_CERT_FILE}" ]; then
    echo "Generating local CA certificate..."
    openssl genrsa -out "${CA_KEY_FILE}" 4096 >/dev/null 2>&1
    openssl req \
        -x509 \
        -new \
        -sha256 \
        -days 3650 \
        -key "${CA_KEY_FILE}" \
        -out "${CA_CERT_FILE}" \
        -subj "/C=BR/ST=Sao Paulo/L=Sao Paulo/O=Home LAN/OU=Sorteio Web/CN=${TLS_CA_COMMON_NAME}" \
        >/dev/null 2>&1
    chmod 600 "${CA_KEY_FILE}"
    chmod 644 "${CA_CERT_FILE}"
fi

CURRENT_CN=""
CURRENT_SANS=""

if [ -f "${SERVER_CN_FILE}" ]; then
    CURRENT_CN="$(cat "${SERVER_CN_FILE}")"
fi

if [ -f "${SERVER_SANS_FILE}" ]; then
    CURRENT_SANS="$(cat "${SERVER_SANS_FILE}")"
fi

if \
    [ ! -f "${SERVER_KEY_FILE}" ] || \
    [ ! -f "${SERVER_CERT_FILE}" ] || \
    [ "${CURRENT_CN}" != "${TLS_CERT_COMMON_NAME}" ] || \
    [ "${CURRENT_SANS}" != "${TLS_CERT_ALT_NAMES}" ]; then
    echo "Generating HTTPS certificate for ${TLS_CERT_COMMON_NAME}..."

    cat >"${OPENSSL_CONFIG_FILE}" <<EOF
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = req_distinguished_name
req_extensions = req_ext

[ req_distinguished_name ]
C = BR
ST = Sao Paulo
L = Sao Paulo
O = Home LAN
OU = Sorteio Web
CN = ${TLS_CERT_COMMON_NAME}

[ req_ext ]
subjectAltName = ${TLS_CERT_ALT_NAMES}
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[ v3_server ]
subjectAltName = ${TLS_CERT_ALT_NAMES}
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
basicConstraints = CA:FALSE
EOF

    openssl genrsa -out "${SERVER_KEY_FILE}" 2048 >/dev/null 2>&1
    openssl req \
        -new \
        -key "${SERVER_KEY_FILE}" \
        -out "${SERVER_CSR_FILE}" \
        -config "${OPENSSL_CONFIG_FILE}" \
        >/dev/null 2>&1
    openssl x509 \
        -req \
        -sha256 \
        -days "${TLS_CERT_VALID_DAYS}" \
        -in "${SERVER_CSR_FILE}" \
        -CA "${CA_CERT_FILE}" \
        -CAkey "${CA_KEY_FILE}" \
        -CAcreateserial \
        -CAserial "${CA_SERIAL_FILE}" \
        -out "${SERVER_CERT_FILE}" \
        -extensions v3_server \
        -extfile "${OPENSSL_CONFIG_FILE}" \
        >/dev/null 2>&1

    printf '%s' "${TLS_CERT_COMMON_NAME}" >"${SERVER_CN_FILE}"
    printf '%s' "${TLS_CERT_ALT_NAMES}" >"${SERVER_SANS_FILE}"

    chmod 600 "${SERVER_KEY_FILE}"
    chmod 644 "${SERVER_CERT_FILE}"
fi
