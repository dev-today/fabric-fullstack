## Chaincode para el proyecto de productos


## Instalación del chaincode en los peers


```bash
ngrok tcp 9998 --region=eu
```
```bash
export CHAINCODE_ADDRESS=$(curl http://localhost:4040/api/tunnels | jq -r ".tunnels[0].public_url" | sed 's/.*tcp:\/\///')
rm code.tar.gz chaincode.tgz
export CHAINCODE_NAME=product-dev
export CHAINCODE_LABEL=product
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
export CP_FILE=$PWD/../../../marketplace.yaml
kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=$CP_FILE --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=marketplace-peer0.marketplace

kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=$CP_FILE --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=sony-peer0.marketplace

```


## Aprobar chaincode
```bash
export CHAINCODE_NAME=product-dev
export SEQUENCE=1
export VERSION="1.0"
kubectl hlf chaincode approveformyorg --config="${CP_FILE}" --user=admin --peer=marketplace-peer0.marketplace \
    --package-id=$PACKAGE_ID \
    --version "$VERSION" --sequence "$SEQUENCE" --name="${CHAINCODE_NAME}" \
    --policy="OR('MarketplaceMSP.member', 'SonyMSP.member')" --channel=demo

kubectl hlf chaincode approveformyorg --config="${CP_FILE}" --user=admin --peer=sony-peer0.marketplace \
    --package-id=$PACKAGE_ID \
    --version "$VERSION" --sequence "$SEQUENCE" --name="${CHAINCODE_NAME}" \
    --policy="OR('MarketplaceMSP.member', 'SonyMSP.member')" --channel=demo
```

## Commit chaincode
```bash
kubectl hlf chaincode commit --config="${CP_FILE}" --user=admin --mspid=MarketplaceMSP \
    --version "$VERSION" --sequence "$SEQUENCE" --name="${CHAINCODE_NAME}" \
    --policy="OR('MarketplaceMSP.member', 'SonyMSP.member')" --channel=demo
```




## Empezar chaincode
```bash
export CORE_CHAINCODE_ADDRESS=0.0.0.0:9998
export CORE_CHAINCODE_ID=$PACKAGE_ID
export CORE_PEER_TLS_ENABLED=false

npm run chaincode:start
```

### Ejecutar chaincode
```bash
export CP_FILE=$PWD/../../../marketplace.yaml
kubectl hlf chaincode query --config=$CP_FILE \
    --user=admin --peer=marketplace-peer0.marketplace \
    --chaincode=product-dev --channel=demo \
    --fcn=Ping
```


### Crear producto

```bash
kubectl hlf chaincode invoke --config=$CP_FILE \
    --user=user-sony --peer=sony-peer0.marketplace \
    --chaincode=product-dev --channel=demo \
    --fcn=createProduct -a '1' -a 'Ipad Pro' -a 'Tablet de Apple' -a '699' -a '10'

```


### Obtener un producto

```bash
kubectl hlf chaincode query --config=$CP_FILE \
    --user=user-sony --peer=sony-peer0.marketplace \
    --chaincode=product-dev --channel=demo \
    --fcn=getProduct -a '1'
```

### Add fondos a nuestra cuenta

```bash
kubectl hlf chaincode invoke --config=$CP_FILE \
    --user=user-marketplace --peer=marketplace-peer0.marketplace \
    --chaincode=product-dev --channel=demo \
    --fcn=setMyBalance -a '3500'
```

### Obtener nuestros fondos

```bash
kubectl hlf chaincode query --config=$CP_FILE \
    --user=user-marketplace --peer=marketplace-peer0.marketplace \
    --chaincode=product-dev --channel=demo \
    --fcn=getMyBalance
```


### Comprar un producto

Como usuario del marketplace, voy a comprar un producto


```bash

kubectl hlf chaincode invoke --config=$CP_FILE \
    --user=user-marketplace --peer=marketplace-peer0.marketplace \
    --chaincode=product-dev --channel=demo \
    --fcn=comprar -a '1' -a '2' 
```

Obtener balance de nuevo para ver como ha bajado, tiene que estar en 2102:
```bash
kubectl hlf chaincode query --config=$CP_FILE \
    --user=user-marketplace --peer=marketplace-peer0.marketplace \
    --chaincode=product-dev --channel=demo \
    --fcn=getMyBalance

```

### Obtener nuestros productos

```bash
kubectl hlf chaincode query --config=$CP_FILE \
    --user=user-marketplace --peer=marketplace-peer0.marketplace \
    --chaincode=product-dev --channel=demo \
    --fcn=getMyVentas

```

### Comprobar que no podemos comprar mas de 10 productos
```bash
kubectl hlf chaincode invoke --config=$CP_FILE \
    --user=user-marketplace --peer=marketplace-peer0.marketplace \
    --chaincode=product-dev --channel=demo \
    --fcn=comprar -a '1' -a '10' 

```