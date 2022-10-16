## Ejecutar el API

### Preparar el network config

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

### Ejecutar network config

```bash
export NETWORK_CONFIG_PATH=$(pwd)/org1.yaml
export MSP_ID=Org1MSP
export HLF_USER=admin
export CHANNEL_NAME=demo2
export CHAINCODE_NAME=asset-dev
npm run server:dev

```


### Crear un coche

```bash
curl -v -X POST http://localhost:3000/cars \
  -H 'Content-Type: application/json' \
  -d '{
   "carId": "FERRARI2022-1",
   "make": "Ferrari",
   "model": "F22",
   "colour": "Red",
   "owner": "Carlos Sainz"
}'
```


### Eliminar un coche

```bash
curl -v -X DELETE http://localhost:3000/cars/FERRARI2022-1
```

### Ver la historia un coche

```bash
curl -v http://localhost:3000/cars/FERRARI2022-1/history
```

