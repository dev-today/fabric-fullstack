## Chaincode para el proyecto NFT


## Instalación del chaincode en los peers

Levantar el tunel
```bash
ngrok tcp 9999 --region=eu
```

```bash
export CHAINCODE_ADDRESS=$(curl http://localhost:4040/api/tunnels | jq -r ".tunnels[0].public_url" | sed 's/.*tcp:\/\///')
rm code.tar.gz chaincode.tgz
export CHAINCODE_NAME=nft-dev
export CHAINCODE_LABEL=nft
cat << METADATA-EOF > "metadata.json"
{
    "type": "ccaas",
    "label": "${CHAINCODE_LABEL}"
}
METADATA-EOF

cat > "connection.json" <<CONN_EOF
{
  "address": "${CHAINCODE_ADDRESS}",
  "dial_timeout": "10s",
  "tls_required": false
}
CONN_EOF

tar cfz code.tar.gz connection.json
tar cfz chaincode.tgz metadata.json code.tar.gz
export PACKAGE_ID=$(kubectl hlf chaincode calculatepackageid --path=chaincode.tgz --language=golang --label=$CHAINCODE_LABEL)
echo "PACKAGE_ID=$PACKAGE_ID"
export CP_FILE=$PWD/../../../org1.yaml
kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=$CP_FILE --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org1-peer0.default

kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=$CP_FILE --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org1-peer1.default

```


## Aprobar chaincode
```bash
export CHAINCODE_NAME=nft-dev
export SEQUENCE=1
export VERSION="1.0"
kubectl hlf chaincode approveformyorg --config=${CP_FILE} --user=admin --peer=org1-peer0.default \
    --package-id=$PACKAGE_ID \
    --version "$VERSION" --sequence "$SEQUENCE" --name="${CHAINCODE_NAME}" \
    --policy="OR('Org1MSP.member')" --channel=demo
```

## Commit chaincode
```bash
kubectl hlf chaincode commit --config=${CP_FILE} --user=admin --mspid=Org1MSP \
    --version "$VERSION" --sequence "$SEQUENCE" --name="${CHAINCODE_NAME}" \
    --policy="OR('Org1MSP.member')" --channel=demo
```




## Empezar chaincode
```bash
export CORE_CHAINCODE_ADDRESS=0.0.0.0:9999
export CORE_CHAINCODE_ID=$PACKAGE_ID
export CORE_PEER_TLS_ENABLED=false

npm run chaincode:start
```

### Ping chaincode
```bash
export CP_FILE=$PWD/../../../org1.yaml
kubectl hlf chaincode query --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo \
    --fcn=ping
```

### Ejecutar chaincode
```bash
export CP_FILE=$PWD/../../../org1.yaml
kubectl hlf chaincode query --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo \
    --fcn=BalanceOf -a 'XXXX'
```

### Inicializar chaincode

```bash
kubectl hlf chaincode invoke --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo \
    --fcn=Initialize -a 'XXXX' -a '$'
```

### Mintear token

```bash
kubectl hlf chaincode invoke --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo \
    --fcn=MintWithTokenURI -a '1' -a 'TOKENURI_1'

```

### Obtener la URI del token por el ID

```bash
kubectl hlf chaincode query --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo \
    --fcn=TokenURI -a '1'

kubectl hlf chaincode query --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo \
    --fcn=Symbol

kubectl hlf chaincode query --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo2 \
    --fcn=Name


kubectl hlf chaincode query --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo2 \
    --fcn=TotalSupply

```

## Aprobar 

```bash
export OWNER="x509::/OU=admin/CN=admin::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca"
kubectl hlf chaincode invoke --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo2 \
    --fcn=Approve -a "$OWNER" -a "1"



export OWNER="x509::/OU=admin/CN=admin::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca"
kubectl hlf chaincode query --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo2 \
    --fcn=IsApprovedForAll -a "$OWNER" -a "$OWNER"

```

### Comprobar nuestro balance token

```bash
kubectl hlf chaincode query --config=$CP_FILE \
    --user=admin --peer=org1-peer0.default \
    --chaincode=nft-dev --channel=demo2 \
    --fcn=ClientAccountBalance

```
