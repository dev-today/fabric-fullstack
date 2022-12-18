## Creacion de la red

Este fichero creara la red que necesitamos para completar el proyecto Marketplace

La red que queremos crear es la siguiente:

![image](imagenes/Arquitectura%20-%20Red%20Marketplace.png)

## Lanzar Kubernetes Cluster

Para empezar a desplegar nuestra red Fabric tenemos que tener un cluster de Kubernetes. Para ello vamos a utilizar KinD.

```bash
kind create cluster --config=kind.yaml
```

## Instalar operador de Kubernetes

En este paso vamos a instalar el operador de kubernetes para Fabric, esto instalara:

- CRD (Custom resource definitions) para desplegar Peers, Orderers y Autoridades de certification Fabric
- Desplegara el programa para desplegar los nodos en Kubernetes

Para instalar helm: [https://helm.sh/es/docs/intro/install/](https://helm.sh/es/docs/intro/install/)

```bash
helm repo add kfs https://kfsoftware.github.io/hlf-helm-charts --force-update

helm install hlf-operator --version=1.8.0 --set image.tag=v1.8.0 kfs/hlf-operator
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


## Crear namespace en Kubernetes

```bash
kubectl create ns marketplace
```


### Variables de entorno para AMD (predeterminado)

```bash
export PEER_IMAGE=hyperledger/fabric-peer
export PEER_VERSION=2.4.6

export ORDERER_IMAGE=hyperledger/fabric-orderer
export ORDERER_VERSION=2.4.6

export CA_IMAGE=hyperledger/fabric-ca
export CA_VERSION=1.5.6-beta2
```


### Variables de entorno para ARM (Mac M1)

```bash
export PEER_IMAGE=bswamina/fabric-peer
export PEER_VERSION=2.4.6

export ORDERER_IMAGE=bswamina/fabric-orderer
export ORDERER_VERSION=2.4.6

export CA_IMAGE=hyperledger/fabric-ca
export CA_VERSION=1.5.6-beta2

```

## Desplegar MarketplaceMSP

### Desplegar una autoridad de certificacion

```bash

kubectl hlf ca create --image="kfsoftware/fabric-ca" --version="arm64-1.5.5.4" --db.type=postgres --db.datasource="dbname=fabric_ca2 host=192.168.1.26 port=5432 user=postgres password=postgres sslmode=disable"  --storage-class=standard --capacity=1Gi --name=marketplace-ca --namespace=marketplace \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=marketplace-ca.localho.st --istio-port=443


kubectl wait --timeout=180s --namespace=marketplace --for=condition=Running fabriccas.hlf.kungfusoftware.es --all
```

Comprobar que la autoridad de certificacion esta desplegada y funciona:

```bash
curl -k https://marketplace-ca.localho.st:443/cainfo
```

Registrar un usuario en la autoridad certificacion de la organizacion peer (MarketplaceMSP)

```bash
# registrar usuario en la CA para los peers
kubectl hlf ca register --name=marketplace-ca --namespace=marketplace --user=peer --secret=peerpw --type=peer \
 --enroll-id enroll --enroll-secret=enrollpw --mspid MarketplaceMSP

```

### Desplegar un peer

```bash
kubectl hlf peer create --statedb=couchdb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=standard --enroll-id=peer --mspid=MarketplaceMSP \
        --enroll-pw=peerpw --capacity=5Gi --name=marketplace-peer0 --namespace=marketplace --ca-name=marketplace-ca.marketplace \
        --hosts=peer0-marketplace.localho.st --istio-port=443


kubectl wait --timeout=180s --for=condition=Running --namespace=marketplace fabricpeers.hlf.kungfusoftware.es --all
```

Comprobar que el peer esta desplegado y funciona:

```bash
openssl s_client -connect peer0-marketplace.localho.st:443
```





## Desplegar SonyMSP

### Desplegar una autoridad de certificacion

```bash

kubectl hlf ca create  --image="kfsoftware/fabric-ca" --version="arm64-1.5.5.4" --db.type=postgres --db.datasource="dbname=fabric_ca2 host=192.168.1.26 port=5432 user=postgres password=postgres sslmode=disable"  --storage-class=standard --capacity=1Gi --name=sony-ca --namespace=marketplace \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=sony-ca.localho.st --istio-port=443


kubectl wait --timeout=180s --namespace=marketplace --for=condition=Running fabriccas.hlf.kungfusoftware.es --all

```

Comprobar que la autoridad de certificacion esta desplegada y funciona:

```bash
curl -k https://sony-ca.localho.st:443/cainfo
```

Registrar un usuario en la autoridad certificacion de la organizacion peer (SonyMSP)

```bash
# registrar usuario en la CA para los peers
kubectl hlf ca register --name=sony-ca --namespace=marketplace --user=peer --secret=peerpw --type=peer \
 --enroll-id enroll --enroll-secret=enrollpw --mspid SonyMSP

```

### Desplegar un peer

```bash
kubectl hlf peer create --statedb=couchdb --image=$PEER_IMAGE --version=$PEER_VERSION --storage-class=standard --enroll-id=peer --mspid=SonyMSP \
        --enroll-pw=peerpw --capacity=5Gi --name=sony-peer0 --namespace=marketplace --ca-name=sony-ca.marketplace \
        --hosts=peer0-sony.localho.st --istio-port=443


kubectl wait --timeout=180s --for=condition=Running --namespace=marketplace fabricpeers.hlf.kungfusoftware.es --all
```

Comprobar que el peer esta desplegado y funciona:

```bash
openssl s_client -connect peer0-sony.localho.st:443
```



## Desplegar una organizacion `Orderer`

Para desplegar una organizacion `Orderer` tenemos que:

1. Crear una autoridad de certificacion
2. Registrar el usuario `orderer` con password `ordererpw`
3. Crear orderer

### Crear la autoridad de certificacion

```bash

kubectl hlf ca create  --image="kfsoftware/fabric-ca" --version="arm64-1.5.5.4" --db.type=postgres --db.datasource="dbname=fabric_ca2 host=192.168.1.26 port=5432 user=postgres password=postgres sslmode=disable"  --storage-class=standard --capacity=1Gi --name=ord-ca --namespace=marketplace \
    --enroll-id=enroll --enroll-pw=enrollpw --hosts=marketplace-ord-ca.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabriccas.hlf.kungfusoftware.es --namespace=marketplace --all

```

Comprobar que la autoridad de certificacion esta desplegada y funciona:

```bash
curl -vik https://marketplace-ord-ca.localho.st:443/cainfo
```

### Registrar el usuario `orderer`

```bash
kubectl hlf ca register --name=ord-ca --namespace=marketplace --user=orderer --secret=ordererpw \
    --type=orderer --enroll-id enroll --enroll-secret=enrollpw --mspid=OrdererMSP --ca-url="https://marketplace-ord-ca.localho.st:443"

```

### Desplegar orderer

```bash
kubectl hlf ordnode create --image=$ORDERER_IMAGE --version=$ORDERER_VERSION \
    --storage-class=standard --enroll-id=orderer --mspid=OrdererMSP \
    --enroll-pw=ordererpw --capacity=2Gi --name=ord-node1 --namespace=marketplace --ca-name=ord-ca.marketplace \
    --hosts=marketplace-orderer0-ord.localho.st --istio-port=443

kubectl wait --timeout=180s --for=condition=Running fabricorderernodes.hlf.kungfusoftware.es --namespace=marketplace --all
```

Comprobar que el orderer esta ejecutandose:

```bash
kubectl get pods --namespace=marketplace
```

```bash
openssl s_client -connect marketplace-orderer0-ord.localho.st:443
```



## Preparar cadena de conexion para interactuar con el orderer

Para preparar la cadena de conexion, tenemos que:

- Obtener la cadena de conexion sin usuarios
- Registrar un usuario en la autoridad de certificacion para firma
- Obtener los certificados utilizando el usuario creado anteriormente
- Adjuntar el usuario a la cadena de conexion

1. Obtener la cadena de conexion sin usuarios

```bash
kubectl hlf inspect --output ordservice.yaml -o OrdererMSP --namespace=marketplace
```

2. Registrar un usuario en la autoridad de certificacion TLS

```bash
kubectl hlf ca register --name=ord-ca --namespace=marketplace --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=OrdererMSP

```

3. Obtener los certificados utilizando el certificado

```bash
kubectl hlf ca enroll --name=ord-ca --namespace=marketplace --user=admin --secret=adminpw --mspid OrdererMSP \
        --ca-name ca  --output admin-ordservice.yaml
```

4. Adjuntar el usuario a la cadena de conexion

```
kubectl hlf utils adduser --userPath=admin-ordservice.yaml --config=ordservice.yaml --username=admin --mspid=OrdererMSP
```

### Crear el secreto wallet


```bash

kubectl hlf ca register  --name=ord-ca --namespace=marketplace --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=OrdererMSP


kubectl hlf ca enroll --name=ord-ca --namespace=marketplace \
    --user=admin --secret=adminpw --mspid OrdererMSP \
    --ca-name tlsca  --output orderermsp.yaml

kubectl hlf ca register --name=marketplace-ca --namespace=marketplace --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=MarketplaceMSP


kubectl hlf ca enroll --name=marketplace-ca --namespace=marketplace \
    --user=admin --secret=adminpw --mspid MarketplaceMSP \
    --ca-name ca  --output marketplacemsp.yaml


kubectl hlf ca register --name=sony-ca --namespace=marketplace --user=admin --secret=adminpw \
    --type=admin --enroll-id enroll --enroll-secret=enrollpw --mspid=SonyMSP

kubectl hlf ca enroll --name=sony-ca --namespace=marketplace \
    --user=admin --secret=adminpw --mspid SonyMSP \
    --ca-name ca  --output sonymsp.yaml

kubectl create secret generic wallet --namespace=marketplace \
        --from-file=marketplacemsp.yaml=$PWD/marketplacemsp.yaml \
        --from-file=sonymsp.yaml=$PWD/sonymsp.yaml \
        --from-file=orderermsp.yaml=$PWD/orderermsp.yaml
```

Crear el canal

```bash

export IDENT_8=$(printf "%8s" "")
export ORDERER_TLS_CERT=$(kubectl get fabriccas ord-ca --namespace=marketplace -o=jsonpath='{.status.tlsca_cert}' | sed -e "s/^/${IDENT_8}/" )
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 --namespace=marketplace -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricMainChannel
metadata:
  name: demo-marketplace
  namespace: marketplace
spec:
  name: demo2
  adminOrdererOrganizations:
    - mspID: OrdererMSP
  adminPeerOrganizations:
    - mspID: MarketplaceMSP
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
    - mspID: MarketplaceMSP
      caName: "marketplace-ca"
      caNamespace: "marketplace"
    - mspID: SonyMSP
      caName: "sony-ca"
      caNamespace: "marketplace"
  identities:
    OrdererMSP:
      secretKey: orderermsp.yaml
      secretName: wallet
      secretNamespace: marketplace
    MarketplaceMSP:
      secretKey: marketplacemsp.yaml
      secretName: wallet
      secretNamespace: marketplace
    SonyMSP:
      secretKey: sonymsp.yaml
      secretName: wallet
      secretNamespace: marketplace
  externalPeerOrganizations: []
  ordererOrganizations:
    - caName: "ord-ca"
      caNamespace: "marketplace"
      externalOrderersToJoin:
        - host: ord-node1.marketplace
          port: 7053
      mspID: OrdererMSP
      ordererEndpoints:
        - marketplace-orderer0-ord.localho.st:443
      orderersToJoin: []
  orderers:
    - host: marketplace-orderer0-ord.localho.st
      port: 443
      tlsCert: |-
${ORDERER0_TLS_CERT}

EOF

```
Comprobar que el canal se ha creado correctamente:
```bash
kubectl get fabricmainchannels
```

Algo asi tiene que salir, con el estado en `RUNNING`:
```text
NAME               STATE     AGE
demo-marketplace   RUNNING   82s
```

## Unir peers de MarketplaceMSP peer a canal

```bash

export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 --namespace=marketplace -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: demo-marketplacemsp
spec:
  anchorPeers:
    - host: peer0-marketplace.localho.st
      port: 443
  hlfIdentity:
    secretKey: marketplacemsp.yaml
    secretName: wallet
    secretNamespace: marketplace
  mspId: MarketplaceMSP
  name: demo2
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://ord-node1.marketplace:7050
  peersToJoin:
    - name: marketplace-peer0
      namespace: marketplace
  externalPeersToJoin: []
EOF


```

Comprobar que la organizacion se ha adherido correctamente:
```bash
kubectl get fabricfollowerchannel     
```

Algo asi tiene que salir, con el estado en `RUNNING`:
```text
NAME                  STATE     AGE
demo-marketplacemsp   RUNNING   3m1s
```

## Unir peers de SonyMSP peer a canal

```bash

export IDENT_8=$(printf "%8s" "")
export ORDERER0_TLS_CERT=$(kubectl get fabricorderernodes ord-node1 --namespace=marketplace -o=jsonpath='{.status.tlsCert}' | sed -e "s/^/${IDENT_8}/" )

kubectl apply -f - <<EOF
apiVersion: hlf.kungfusoftware.es/v1alpha1
kind: FabricFollowerChannel
metadata:
  name: demo-sonymsp
spec:
  anchorPeers:
    - host: peer0-sony.localho.st
      port: 443
  hlfIdentity:
    secretKey: sonymsp.yaml
    secretName: wallet
    secretNamespace: marketplace
  mspId: SonyMSP
  name: demo2
  orderers:
    - certificate: |
${ORDERER0_TLS_CERT}
      url: grpcs://ord-node1.marketplace:7050
  peersToJoin:
    - name: sony-peer0
      namespace: marketplace
  externalPeersToJoin: []
EOF


```

Comprobar que la organizacion se ha adherido correctamente:
```bash
kubectl get fabricfollowerchannel     
```

Algo asi tiene que salir, con el estado en `RUNNING`:
```text
NAME                  STATE     AGE
demo-marketplacemsp   RUNNING   3m38s
demo-sonymsp          RUNNING   9s
```



## Preparar cadena de conexion para un peer

Para preparar la cadena de conexion, tenemos que:

1. Obtener la cadena de conexion sin usuarios para la organizacion MarketplaceMSP y OrdererMSP
2. Registrar un usuario en la autoridad de certificacion para firma (register)
3. Obtener los certificados utilizando el usuario creado anteriormente (enroll)
4. Adjuntar el usuario a la cadena de conexion

1. Obtener la cadena de conexion sin usuarios para la organizacion MarketplaceMSP y OrdererMSP

```bash
kubectl hlf inspect --output marketplace.yaml --namespace=marketplace
```

2. Registrar un usuario en la autoridad de certificacion para firma
```bash
kubectl hlf ca register --name=marketplace-ca --namespace=marketplace --user=admin --secret=adminpw --type=admin \
 --enroll-id enroll --enroll-secret=enrollpw --mspid MarketplaceMSP  
```

3. Obtener los certificados utilizando el usuario creado anteriormente
```bash
kubectl hlf ca enroll --name=marketplace-ca --namespace=marketplace --user=admin --secret=adminpw --mspid MarketplaceMSP \
        --ca-name ca  --output peer-marketplace.yaml
```

4. Adjuntar el usuario a la cadena de conexion
```bash
kubectl hlf utils adduser --userPath=peer-marketplace.yaml --config=marketplace.yaml --username=admin --mspid=MarketplaceMSP
```



5. Registrar un usuario en la autoridad de certificacion para firma
```bash
kubectl hlf ca register --name=sony-ca --namespace=marketplace --user=admin --secret=adminpw --type=admin \
 --enroll-id enroll --enroll-secret=enrollpw --mspid SonyMSP  
```

6. Obtener los certificados utilizando el usuario creado anteriormente
```bash
kubectl hlf ca enroll --name=sony-ca --namespace=marketplace --user=admin --secret=adminpw --mspid SonyMSP \
        --ca-name ca  --output peer-sony.yaml
```

4. Adjuntar el usuario a la cadena de conexion
```bash
kubectl hlf utils adduser --userPath=peer-sony.yaml --config=marketplace.yaml --username=admin --mspid=SonyMSP
```


