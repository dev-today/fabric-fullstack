import * as yaml from "yaml";
import { promises as fs } from 'fs';
import * as _ from "lodash";
import * as grpc from '@grpc/grpc-js';
import { connect, ConnectOptions, Identity, Signer, signers } from "@hyperledger/fabric-gateway";
import * as crypto from 'crypto';
import express = require("express")
import cors = require('cors')

interface Config {
    networkConfigPath: string;
    mspId: string;
    hlfUser: string;
    channelName: string;
    chaincodeName: string;
}
const config: Config = {
    networkConfigPath: process.env.NETWORK_CONFIG_PATH,
    mspId: process.env.MSP_ID!,
    hlfUser: process.env.HLF_USER!,
    channelName: process.env.CHANNEL_NAME!,
    chaincodeName: process.env.CHAINCODE_NAME!,
}
async function main() {
    const networkConfig = yaml.parse(await fs.readFile(config.networkConfigPath, 'utf8'));
    const orgPeerNames = _.get(networkConfig, `organizations.${config.mspId}.peers`)
    let peerUrl: string = "";
    let peerCACert: string = "";
    let idx = 0
    for (const peerName of orgPeerNames) {
        const peer = networkConfig.peers[peerName]
        const peerUrlKey = `url`
        const peerCACertKey = `tlsCACerts.pem`
        peerUrl = _.get(peer, peerUrlKey).replace("grpcs://", "")
        peerCACert = _.get(peer, peerCACertKey)
        idx++;
        if (idx >= 1) {
            break;
        }
    }
    console.log(`peerUrl: ${peerUrl}`);

    const user = _.get(networkConfig, `organizations.${config.mspId}.users.${config.hlfUser}`)
    if (!user) {
        throw new Error(`User ${config.hlfUser} not found in network config`)
    }
    try {
        const clientCertPem = _.get(user, `cert.pem`)
        const clientKeyPem = _.get(user, `key.pem`)
        const grpcConn = await newGrpcConnection(peerUrl, Buffer.from(peerCACert))
        const connectOptions = await newConnectOptions(
            grpcConn,
            config.mspId,
            Buffer.from(clientCertPem),
            clientKeyPem
        )
        const gateway = connect(connectOptions);
        const network = gateway.getNetwork(config.channelName);
        const contract = network.getContract(config.chaincodeName);
        const app = express()
        app.use(cors())
        app.use(express.json());
        app.get("/cars", async (req, res) => {
            try {
                const queryAllCarsREsponse = await contract.evaluateTransaction("QueryAllCars")
                const queryAllCarsREsponseString = Buffer.from(queryAllCarsREsponse).toString();
                res.send(queryAllCarsREsponseString)
            } catch (e) {
                res.send(e)
            }
        })
        app.get("/cars/:carId", async (req, res) => {
            try {
                const carId = req.params.carId
                const queryCarResponse = await contract.evaluateTransaction("QueryCar", carId)
                const queryCarResponseString = Buffer.from(queryCarResponse).toString();
                res.send(queryCarResponseString)
            } catch (e) {
                res.send(e)
            }
        })
        app.delete("/cars/:carId", async (req, res) => {
            try {
                const carId = req.params.carId
                const queryCarResponse = await contract.submitTransaction("DeleteCar", carId)
                const queryCarResponseString = Buffer.from(queryCarResponse).toString();
                res.send(queryCarResponseString)
            } catch (e) {
                res.send(e)
            }
        })
        app.get("/cars/:carId/history", async (req, res) => {
            try {
                const carId = req.params.carId
                const queryCarResponse = await contract.evaluateTransaction("CarHistory", carId)
                const queryCarResponseString = Buffer.from(queryCarResponse).toString();
                const cars = JSON.parse(queryCarResponseString)
                const carsWithDate = cars.map(car => ({
                    ...car,
                    date: new Date(car.timestamp).toISOString()
                }))
                res.send(carsWithDate)
            } catch (e) {
                res.send(e)
            }
        })
        app.post("/cars", async (req, res) => {
            try {
                const {
                    carId,
                    make,
                    model,
                    colour,
                    owner,
                } = req.body
                const createCarResponse = await contract.submitTransaction(
                    "CreateCar",
                    carId,
                    make,
                    model,
                    colour,
                    owner
                )
                const createCarResponseString = Buffer.from(createCarResponse).toString();
                res.send(createCarResponseString)
            } catch (e) {
                res.send(e)
            }
        })
        const port = process.env.PORT || 3000
        app.listen(port, () => {
            console.log(`Server started at http://localhost:${port}`)
        })
    } catch (e) {
        console.log(e)
    }
}

export async function newGrpcConnection(peerEndpoint: string, tlsRootCert: Buffer): Promise<grpc.Client> {
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {});
}

async function newIdentity(mspId: string, credentials: Uint8Array): Promise<Identity> {
    return { mspId, credentials };
}

async function newSigner(privateKeyPem: string): Promise<Signer> {
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}
export async function newConnectOptions(
    client: grpc.Client,
    mspId: string,
    credentials: Uint8Array,
    privateKeyPem: string
): Promise<ConnectOptions> {
    return {
        client,
        identity: await newIdentity(mspId, credentials),
        signer: await newSigner(privateKeyPem),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    };
}

main()