# API

Este API expone via HTTP las operaciones que se pueden realizar sobre el chaincode NFT.

## Instalar librerias
```bash
npm install
```


## Lanzar el servidor para Org1

Lanzar el servidor para la Org1

```bash
npm run server:org1:dev
```

## Lanzar el servidor para Org2

Lanzar el servidor para la Org2

```bash
npm run server:org2:dev
```

## Operaciones

### Verificar conectividad con el smart contract

```bash
http GET "http://localhost:3003/ping"
```

Debe devolver `pong`

### Inicializar el smart contract

```bash
http POST "http://localhost:3003/init?tokenName=Dolar&tokenSymbol=$"
```

### Registrar un usuario

```bash
http POST "http://localhost:3003/signup" username="user1" password="user1pw"
```

```json
{
        "username": "user1",
        "password": "user1pw"
}
```

### Logearnos con el usuario

Esta operacion se tiene que hacer siempre que el programa se reinicie

```bash
http POST "http://localhost:3003/login" username="user1" password="user1pw"
```

### Crear un NFT

```bash
http POST "http://localhost:3003/submit" x-user:user1 fcn=Mint "args[]=9"  \
        "args[]=https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png" "args[]=Nombre" "args[]=Descripcion"
```

### Obtener un NFT

```bash
http POST "http://localhost:3003/evaluate" x-user:user1 fcn=GetToken "args[]=9"
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
http POST "http://localhost:3003/submit" x-user:user2 fcn=Mint "args[]=10"  \
        "args[]=https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png" "args[]=Nombre2" "args[]=Descripcion2"
```

## Obtener identidad del usuario 1

```bash
http GET "http://localhost:3003/id" x-user:user1
```

## Transferir token de usuario 2 a usuario 1

```bash
http POST "http://localhost:3003/submit" x-user:user1 fcn=TransferFrom \
        "args[]=x509::/OU=client/CN=user1::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca" \
        "args[]=x509::/OU=client/CN=user2::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca" \
        "args[]=9"

```

## Comprobar owner del token transferido

```bash
http POST "http://localhost:3003/evaluate" x-user:user2 fcn=OwnerOf "args[]=9"
```

## Limpiar chaincode

```bash
http POST "http://localhost:3003/submit" x-user:user2 fcn=limpiarChaincode
```


### Registrar otro usuario

```bash
http POST "http://localhost:3004/signup" username="user2-org2" password="user2pw"
```

### Logearnos con otro usuario

Esta operacion se tiene que hacer siempre que el programa se reinicie

```bash
http POST "http://localhost:3004/login" username="user2-org2" password="user2pw"
```

## Obtener identidad del usuario 1

```bash
http GET "http://localhost:3004/id" x-user:user2-org2
```


## Transferir token de usuario 2 (Org1) a usuario 2 (Org2)

```bash
http POST "http://localhost:3003/submit" x-user:user2 fcn=TransferFrom \
        "args[]=x509::/OU=client/CN=user2::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca" \
        "args[]=x509::/OU=client/CN=user2-org2::/C=ES/L=Alicante/=Alicante/O=Kung Fu Software/OU=Tech/CN=ca" \
        "args[]=9"

```

## Comprobar owner del token transferido

```bash
http POST "http://localhost:3003/evaluate" x-user:user2 fcn=OwnerOf "args[]=9"
```

