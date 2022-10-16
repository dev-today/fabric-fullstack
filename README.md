# Tuturial full stack sobre Fabric con Chaincode

[Hyperledger Fabric build ARM](https://www.polarsparc.com/xhtml/Hyperledger-ARM-Build.html)

## Lanzar Kubernetes Cluster

Para empezar a desplegar nuestra red Fabric tenemos que tener un cluster de Kubernetes. Para ello vamos a utilizar KinD.

```bash
kind create cluster
```

## Instalar operador de Kubernetes

En este paso vamos a instalar el operador de kubernetes para Fabric, esto instalara:

- CRD (Custom resource definitions) para desplegar Peers, Orderers y Autoridades de certification Fabric
- Desplegara el programa para desplegar los nodos en Kubernetes

Para instalar helm: [https://helm.sh/es/docs/intro/install/](https://helm.sh/es/docs/intro/install/)

```bash
helm repo add kfs https://kfsoftware.github.io/hlf-helm-charts --force-update

helm install hlf-operator --version=1.8.0-beta9 --set image.tag=v1.8.0-beta13 kfs/hlf-operator
```

### Instalar plugin de Kubectl

Para instalar el plugin de kubectl, hay que instalar primero Krew:
[https://krew.sigs.k8s.io/docs/user-guide/setup/install/](https://krew.sigs.k8s.io/docs/user-guide/setup/install/)

Despues, se podra instalar el plugin con la siguiente instruccion:

```bash
kubectl krew install hlf
```

### Instalar Istio

Instalar binarios de Istio en la maquina:
```bash
curl -L https://istio.io/downloadIstio | sh -
```

Instalar Istio en el cluster de Kubernetes:

```bash

kubectl create namespace istio-system

istioctl operator init

kubectl apply -f - <<EOF
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: istio-gateway
  namespace: istio-system
spec:
  addonComponents:
    grafana:
      enabled: false
    kiali:
      enabled: false
    prometheus:
      enabled: false
    tracing:
      enabled: false
  components:
    ingressGateways:
      - enabled: true
        k8s:
          hpaSpec:
            minReplicas: 1
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 100m
              memory: 128Mi
          service:
            ports:
              - name: http
                port: 80
                targetPort: 8080
                nodePort: 30949
              - name: https
                port: 443
                targetPort: 8443
                nodePort: 30950
            type: NodePort
        name: istio-ingressgateway
    pilot:
      enabled: true
      k8s:
        hpaSpec:
          minReplicas: 1
        resources:
          limits:
            cpu: 300m
            memory: 512Mi
          requests:
            cpu: 100m
            memory: 128Mi
  meshConfig:
    accessLogFile: /dev/stdout
    enableTracing: false
    outboundTrafficPolicy:
      mode: ALLOW_ANY
  profile: default

EOF

```

## Desplegar una organizacion `Peer`

### Variables de entorno

```bash
export PEER_IMAGE=bswamina/fabric-peer
export PEER_VERSION=2.4.6

export ORDERER_IMAGE=bswamina/fabric-orderer
export ORDERER_VERSION=2.4.6

```

### Configurar DNS interno

```bash
CLUSTER_IP=$(kubectl -n istio-system get svc istio-ingressgateway -o json | jq -r .spec.clusterIP)
kubectl apply -f - <<EOF
kind: ConfigMap
apiVersion: v1
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health {
           lameduck 5s
        }
        rewrite name regex (.*)\.localho\.st host.ingress.internal
        hosts {
          ${CLUSTER_IP} host.ingress.internal
          fallthrough
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
    }
EOF
```

### Desplegar una autoridad de certificacion

```bash

kubectl hlf ca create --storage-class=standard --capacity=1Gi --name=org1-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --image="kfsoftware/fabric-ca" --version="arm64-1.5.5.4" --db.type=postgres --db.datasource="dbname=fabric_ca host=192.168.1.26 port=5432 user=postgres password=postgres sslmode=disable" --hosts=org1-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all
```

Comprobar que la autoridad de certificacion esta desplegada y funciona:

```bash
curl -k https://org1-ca.localho.st:443/cainfo
```

Registrar un usuario en la autoridad certificacion de la organizacion peer (Org1MSP)

```bash
# registrar usuario en la CA para los peers
kubectl hlf ca register --name=org1-ca --user=peer --secret=peerpw --type=peer \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org1MSP

```

### Desplegar un peer

```bash
kubectl hlf peer create --statedb=couchdb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=standard --enroll-id=peer --mspid=Org1MSP \
        --enroll-pw=peerpw --capacity=5Gi --name=org1-peer0 --ca-name=org1-ca.default \
        --hosts=peer0-org1.localho.st --istio-port=443


kubectl hlf peer create --statedb=couchdb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=standard --enroll-id=peer --mspid=Org1MSP \
        --enroll-pw=peerpw --capacity=5Gi --name=org1-peer1 --ca-name=org1-ca.default \
        --hosts=peer1-org1.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabricpeers.hlf.kungfusoftware.es --all
```

Comprobar que el peer esta desplegado y funciona:

```bash
curl -vik https://peer0-org1.localho.st:443
```

## Desplegar una organizacion `Orderer`

Para desplegar una organizacion `Orderer` tenemos que:

1. Crear una autoridad de certificacion
2. Registrar el usuario `orderer` con password `ordererpw`
3. Crear orderer

### Crear la autoridad de certificacion

```bash

kubectl hlf ca create --storage-class=standard --capacity=1Gi --name=ord-ca \
    --enroll-id=enroll --enroll-pw=enrollpw --image="kfsoftware/fabric-ca" --version="arm64-1.5.5.4" --db.type=postgres --db.datasource="dbname=fabric_ca host=192.168.1.26 port=5432 user=postgres password=postgres sslmode=disable" --hosts=ord-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --all

```

Comprobar que la autoridad de certificacion esta desplegada y funciona:

```bash
curl -vik https://ord-ca.localho.st:443/cainfo
```

### Registrar el usuario `orderer`

```bash
kubectl hlf ca register --name=ord-ca --user=orderer --secret=ordererpw \
    --type=orderer --enroll-id enroll --enroll-secret=enrollpw --mspid=OrdererMSP --ca-url="https://ord-ca.localho.st:443"

```

### Desplegar orderer

```bash
kubectl hlf ordnode create --image=$ORDERER_IMAGE --version=$ORDERER_VERSION \
    --storage-class=standard --enroll-id=orderer --mspid=OrdererMSP \
    --enroll-pw=ordererpw --capacity=2Gi --name=ord-node1 --ca-name=ord-ca.default \
    --hosts=orderer0-ord.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabricorderernodes.hlf.kungfusoftware.es --all
```

Comprobar que el orderer esta ejecutandose:

```bash
kubectl get pods
```

```bash
curl -vik https://orderer0-ord.localho.st:443
```

## Preparar cadena de conexion para interactuar con el orderer

Para preparar la cadena de conexion, tenemos que:

- Obtener la cadena de conexion sin usuarios
- Registrar un usuario en la autoridad de certificacion para firma
- Obtener los certificados utilizando el usuario creado anteriormente
- Adjuntar el usuario a la cadena de conexion

1. Obtener la cadena de conexion sin usuarios

```bash
kubectl hlf inspect --output ordservice.yaml -o OrdererMSP
```

2. Registrar un usuario en la autoridad de certificacion TLS

```bash
kubectl hlf ca register --name=ord-ca --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=OrdererMSP

```

3. Obtener los certificados utilizando el certificado

```bash
kubectl hlf ca enroll --name=ord-ca --user=admin --secret=adminpw --mspid OrdererMSP \
        --ca-name ca  --output admin-ordservice.yaml
```

4. Adjuntar el usuario a la cadena de conexion

```
kubectl hlf utils adduser --userPath=admin-ordservice.yaml --config=ordservice.yaml --username=admin --mspid=OrdererMSP
```

```bash
kubectl hlf ca enroll --name=ord-ca --namespace=default \
    --user=admin --secret=adminpw --mspid OrdererMSP \
    --ca-name tlsca  --output orderermsp.yaml

kubectl hlf ca enroll --name=org1-ca --namespace=default \
    --user=admin --secret=adminpw --mspid Org1MSP \
    --ca-name ca  --output org1msp.yaml

kubectl create secret generic wallet --namespace=default \
        --from-file=org1msp.yaml=$PWD/org1msp.yaml \
        --from-file=orderermsp.yaml=$PWD/orderermsp.yaml
```

Crear el canal

```bash
export PEER_ORG_SIGN_CERT=$(kubectl get fabriccas org1-ca -o=jsonpath='{.status.ca_cert}')
export PEER_ORG_TLS_CERT=$(kubectl get fabriccas org1-ca -o=jsonpath='{.status.tlsca_cert}')
export IDENT_8=$(printf "%8s" "")
export ORDERER_TLS_CERT=$(kubectl get fabriccas ord-ca -o=jsonpath='{.status.tlsca_cert}' | sed -e "s/^/${IDENT_8}/" )
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricMainChannel
metadata:
  name: demo
spec:
  name: demo2
  adminOrdererOrganizations:
    - mspID: OrdererMSP
  adminPeerOrganizations:
    - mspID: Org1MSP
  channelConfig:
    application:
      acls: null
      capabilities:
        - V2_0
      policies: null
    capabilities:
      - V2_0
    orderer:
      batchSize:
        absoluteMaxBytes: 1048576
        maxMessageCount: 10
        preferredMaxBytes: 524288
      batchTimeout: 2s
      capabilities:
        - V2_0
      etcdRaft:
        options:
          electionTick: 10
          heartbeatTick: 1
          maxInflightBlocks: 5
          snapshotIntervalSize: 16777216
          tickInterval: 500ms
      ordererType: etcdraft
      policies: null
      state: STATE_NORMAL
    policies: null
  externalOrdererOrganizations: []
  peerOrganizations:
    - mspID: Org1MSP
      caName: "org1-ca"
      caNamespace: "default"
  identities:
    OrdererMSP:
      secretKey: orderermsp.yaml
      secretName: wallet
      secretNamespace: default
    Org1MSP:
      secretKey: org1msp.yaml
      secretName: wallet
      secretNamespace: default
  externalPeerOrganizations: []
  ordererOrganizations:
    - caName: "ord-ca"
      caNamespace: "default"
      externalOrderersToJoin:
        - host: ord-node1
          port: 7053
      mspID: OrdererMSP
      ordererEndpoints:
        - ord-node1:7050
      orderersToJoin: []
  orderers:
    - host: ord-node1
      port: 7050
      tlsCert: |-
${ORDERER0_TLS_CERT}

EOF
```

## Unir peer a canal

```bash

export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: demo-org1msp
spec:
  anchorPeers:
    - host: org1-peer0.default
      port: 7051
  hlfIdentity:
    secretKey: org1msp.yaml
    secretName: wallet
    secretNamespace: default
  mspId: Org1MSP
  name: demo2
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://ord-node1.default:7050
  peersToJoin:
    - name: org1-peer0
      namespace: default
    - name: org1-peer1
      namespace: default
EOF


```



## Instalar un chaincode

## Preparar cadena de conexion para un peer

Para preparar la cadena de conexion, tenemos que:

1. Obtener la cadena de conexion sin usuarios para la organizacion Org1MSP y OrdererMSP
2. Registrar un usuario en la autoridad de certificacion para firma (register)
3. Obtener los certificados utilizando el usuario creado anteriormente (enroll)
4. Adjuntar el usuario a la cadena de conexion

1. Obtener la cadena de conexion sin usuarios para la organizacion Org1MSP y OrdererMSP

```bash
kubectl hlf inspect --output org1.yaml -o Org1MSP -o OrdererMSP
```

2. Registrar un usuario en la autoridad de certificacion para firma
```bash
kubectl hlf ca register --name=org1-ca --user=admin --secret=adminpw --type=admin \
 --enroll-id enroll --enroll-secret=enrollpw --mspid Org1MSP  
```

3. Obtener los certificados utilizando el usuario creado anteriormente
```bash
kubectl hlf ca enroll --name=org1-ca --user=admin --secret=adminpw --mspid Org1MSP \
        --ca-name ca  --output peer-org1.yaml
```

4. Adjuntar el usuario a la cadena de conexion
```bash
kubectl hlf utils adduser --userPath=peer-org1.yaml --config=org1.yaml --username=admin --mspid=Org1MSP
```


### Crear fichero de metadata

```bash
# remove the code.tar.gz chaincode.tgz if they exist
rm code.tar.gz chaincode.tgz
export CHAINCODE_NAME=asset
export CHAINCODE_LABEL=asset
cat << METADATA-EOF > "metadata.json"
{
    "type": "ccaas",
    "label": "${CHAINCODE_LABEL}"
}
METADATA-EOF
## chaincode as a service
```

### Preparar fichero de conexion

```bash
cat > "connection.json" <<CONN_EOF
{
  "address": "${CHAINCODE_NAME}:7052",
  "dial_timeout": "10s",
  "tls_required": false
}
CONN_EOF

tar cfz code.tar.gz connection.json
tar cfz chaincode.tgz metadata.json code.tar.gz
export PACKAGE_ID=$(kubectl hlf chaincode calculatepackageid --path=chaincode.tgz --language=node --label=$CHAINCODE_LABEL)
echo "PACKAGE_ID=$PACKAGE_ID"

kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=org1.yaml --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org1-peer0.default
kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=org1.yaml --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org1-peer1.default

```


## Instalar contenedor chaincode en el cluster
El siguiente comando creará o actualizará el CRD en función del packageID, el nombre del chaincode y la imagen docker.

```bash
kubectl hlf externalchaincode sync --image=kfsoftware/chaincode-external:latest \
    --name=$CHAINCODE_NAME \
    --namespace=default \
    --package-id=$PACKAGE_ID \
    --tls-required=false \
    --replicas=1
```


## Consultar chaincodes instalados
```bash
kubectl hlf chaincode queryinstalled --config=org1.yaml --user=admin --peer=org1-peer0.default
```

## Aprobar chaincode
```bash
export SEQUENCE=1
export VERSION="1.0"
kubectl hlf chaincode approveformyorg --config=org1.yaml --user=admin --peer=org1-peer0.default \
    --package-id=$PACKAGE_ID \
    --version "$VERSION" --sequence "$SEQUENCE" --name=asset \
    --policy="OR('Org1MSP.member')" --channel=demo2
```

## Commit chaincode
```bash
kubectl hlf chaincode commit --config=org1.yaml --user=admin --mspid=Org1MSP \
    --version "$VERSION" --sequence "$SEQUENCE" --name=asset \
    --policy="OR('Org1MSP.member')" --channel=demo2
```


## Invocar una transaction en el canal
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=admin --peer=org1-peer0.default \
    --chaincode=asset --channel=demo2 \
    --fcn=initLedger -a '[]'
```

## Consultar assets en el canal
```bash
kubectl hlf chaincode query --config=org1.yaml \
    --user=admin --peer=org1-peer0.default \
    --chaincode=asset --channel=demo2 \
    --fcn=GetAllAssets -a '[]'
```

# Desarrollar chaincode
```bash
ngrok tcp 9999
```
```bash
export CHAINCODE_ADDRESS=2.tcp.eu.ngrok.io:16747
rm code.tar.gz chaincode.tgz
export CHAINCODE_NAME=asset-dev
export CHAINCODE_LABEL=asset
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
export PACKAGE_ID=$(kubectl hlf chaincode calculatepackageid --path=chaincode.tgz --language=node --label=$CHAINCODE_LABEL)
echo "PACKAGE_ID=$PACKAGE_ID"

kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=org1.yaml --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org1-peer0.default

kubectl hlf chaincode install --path=./chaincode.tgz \
    --config=org1.yaml --language=golang --label=$CHAINCODE_LABEL --user=admin --peer=org1-peer1.default



```

## Aprobar chaincode
```bash
export CHAINCODE_NAME=asset-dev
export SEQUENCE=7
export VERSION="1.0"
kubectl hlf chaincode approveformyorg --config=org1.yaml --user=admin --peer=org1-peer0.default \
    --package-id=$PACKAGE_ID \
    --version "$VERSION" --sequence "$SEQUENCE" --name="${CHAINCODE_NAME}" \
    --policy="OR('Org1MSP.member')" --channel=demo2
```

## Commit chaincode
```bash
kubectl hlf chaincode commit --config=org1.yaml --user=admin --mspid=Org1MSP \
    --version "$VERSION" --sequence "$SEQUENCE" --name="${CHAINCODE_NAME}" \
    --policy="OR('Org1MSP.member')" --channel=demo2
```

## Lanzar el chaincode

```bash
cd chaincodes/fabcar
export CHAINCODE_ID=asset:7fe730a9764b39d394a8cd33cf7ede71540190ebe8c655c06f1b6dce4335d7ec
export CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999
go run ./fabcar.go
```


## Invocar una transaction en el canal
```bash
kubectl hlf chaincode invoke --config=org1.yaml \
    --user=admin --peer=org1-peer0.default \
    --chaincode=asset-dev --channel=demo2 \
    --fcn=initLedger -a '[]'
```

## Consultar assets en el canal
```bash
kubectl hlf chaincode query --config=org1.yaml \
    --user=admin --peer=org1-peer0.default \
    --chaincode=asset-dev --channel=demo2 \
    --fcn=QueryAllCars -a '[]'
```

## Anadir una funcion a chaincode
Para añadir una nueva función al chaincode, se debe modificar el fichero `fabcar.go` y añadir la nueva función. Después se debe volver a lanzar el chaincode.

```bash
go run ./fabcar.go
```


TODO: añadir como preparar la cadena de conexion y los hosts que tienen que haber en el /etc/hosts.

Crear peers y orderers con host alias para que pueda ver peers y orderers.

- [x] Deploy CA in ARm
- [x] Deploy Peer in ARM
- [x] Deploy Orderer in ARM
- [x] Install chaincode in ARM
- [x] Approve chaincode in ARM
- [x] Commit chaincode in ARM

- [x] Create channel in ARM
- [x] Modify channel in ARM
- [x] Join channel in ARM

- [x] Handle endpoints with main channel CRD
