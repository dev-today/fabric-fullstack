# API

Este API expone via HTTP las operaciones que se pueden realizar sobre el chaincode NFT.


## Lanzar el servidor


Declarar las variables en el .env
```bash
CHANNEL_NAME=demo
CHAINCODE_NAME=product-dev
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
http GET "http://localhost:3004/ping"
```

Debe devolver `pong`


### Registrar un usuario
```bash
http POST "http://localhost:3004/signup" username="user1" password="user1pw"
```

### Logearnos con el usuario
Esta operacion se tiene que hacer siempre que el programa se reinicie
```bash
http POST "http://localhost:3004/login" username="user1" password="user1pw"
```

### Crear un Producto
```bash
http POST "http://localhost:3004/submit" "x-user=user1" fcn=createProduct "args[]=1"  \
        "args[]=Ipad Pro" "args[]=Tablet de Apple" "args[]=699" "args[]=10"
```

### Obtener un Producto
```bash
http POST "http://localhost:3004/evaluate" "x-user=user1" fcn=getProduct "args[]=1"
```


### Registrar otro usuario
```bash
http POST "http://localhost:3004/signup" username="user2" password="user2pw"
```

### Logearnos con otro usuario

Esta operacion se tiene que hacer siempre que el programa se reinicie

```bash
http POST "http://localhost:3004/login" username="user2" password="user2pw"
```


## Add fondos a nuestra cuenta
Esta operacion en produccion deberia de estar relacionado con un mecanismo de pago
```bash
http POST "http://localhost:3004/submit" x-user:user2 fcn=setMyBalance "args[]=3000"

```

## Obtener nuestros fondos
Esta operacion en produccion deberia de estar relacionado con un mecanismo de pago
```bash
http POST "http://localhost:3004/evaluate" x-user:user2 fcn=getMyBalance

```

## Comprar un producto

```bash
http POST "http://localhost:3004/submit" x-user:user2 fcn=comprar "args[]=1" "args[]=2"
```


## Comprobar que nuestro balance ha sido actualizado

```bash
http POST "http://localhost:3004/evaluate" x-user:user2 fcn=getMyBalance

```


## Obtener productos comprados

```bash
http POST "http://localhost:3004/evaluate" x-user:user2 fcn=getMyVentas
```


## Comprobar que no podemos comprar mas de 10 productos

```bash
http POST "http://localhost:3004/submit" x-user:user2 fcn=comprar "args[]=1" "args[]=12"
```
