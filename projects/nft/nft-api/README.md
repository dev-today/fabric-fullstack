# API

Este API expone via HTTP las operaciones que se pueden realizar sobre el chaincode NFT.


## Lanzar el servidor


Declarar las variables en el .env
```bash
CHANNEL_NAME=demo
CHAINCODE_NAME=nft-dev
MSP_ID=Org1MSP
HLF_USER=admin
NETWORK_CONFIG_PATH=../../../org1.yaml
```

Lanzar el servidor
```bash
npm run server:dev
```


## Operaciones

### Verificar conectividad con el smart contract

```bash
http GET "http://localhost:3003/ping"
```

Debe devolver `pong`

### Inicializar el smart contract
```bash
http POST "http://localhost:3003/init?tokenName=CDC&tokenSymbol=$"
```

### Registrar un usuario
```bash
http POST "http://localhost:3003/signup" username="user1" password="user1pw"
```

### Logearnos con el usuario
Esta operacion se tiene que hacer siempre que el programa se reinicie
```bash
http POST "http://localhost:3003/login" username="user1" password="user1pw"
```

### Crear un NFT
```bash
http POST "http://localhost:3003/submit" "x-user=user1" fcn=Mint "args[]=8"  \
        "args[]=https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png" "args[]=Nombre" "args[]=Descripcion"
```

### Obtener un NFT
```bash
http POST "http://localhost:3003/evaluate" "x-user=user1" fcn=GetToken "args[]=8"
```


### Registrar otro usuario
```bash
http POST "http://localhost:3003/signup" username="user2" password="user2pw"
```

### Logearnos con otro usuario

Esta operacion se tiene que hacer siempre que el programa se reinicie

```bash
http POST "http://localhost:3003/login" username="user2" password="user2pw"
```

## Mintear un NFT
```bash
http POST "http://localhost:3003/submit" x-user:user2 fcn=MintWithTokenURI "args[]=6" "args[]=TokenURI"

```

## Obtener identidad del usuario 1
```bash
http GET "http://localhost:3003/id" x-user:user1
```

## Transferir token de usuario 2 a usuario 1
```bash
http POST "http://localhost:3003/submit" x-user:user2 fcn=TransferFrom "args[]=x509::/OU=client/CN=user2::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca" "args[]=x509::/OU=client/CN=user1::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca" "args[]=6"

```


## Comprobar owner del token transferido
```bash
http POST "http://localhost:3003/evaluate" x-user:user2 fcn=OwnerOf "args[]=6"
```
