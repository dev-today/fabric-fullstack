import { connect } from '@hyperledger/fabric-gateway';
import "reflect-metadata";

import { User } from 'fabric-common';
import { promises as fs } from 'fs';
import * as _ from "lodash";
import { AddressInfo } from "net";
import { Logger } from "tslog";
import * as yaml from "yaml";
import { checkConfig, config } from './config';
import FabricCAServices = require("fabric-ca-client")
import express = require("express")
import { newGrpcConnection, newConnectOptions } from './utils';

const log = new Logger({ name: "nft-api" })


async function main() {
    checkConfig()
    const networkConfig = yaml.parse(await fs.readFile(config.networkConfigPath, 'utf8'));
    const orgPeerNames = _.get(networkConfig, `organizations.${config.mspID}.peers`)
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
    const ca = networkConfig.certificateAuthorities[config.caName]
    if (!ca) {
        throw new Error(`Certificate authority ${config.caName} not found in network configuration`);
    }
    const caURL = ca.url;
    if (!caURL) {
        throw new Error(`Certificate authority ${config.caName} does not have a URL`);
    }

    const fabricCAServices = new FabricCAServices(caURL, {
        trustedRoots: [],
        verify: false,
    }, "ca")

    const identityService = fabricCAServices.newIdentityService()
    const registrarUserResponse = await fabricCAServices.enroll({
        enrollmentID: "enroll",
        enrollmentSecret: "enrollpw"
    });

    const registrar = User.createUser("enroll", "enrollpw", config.mspID, registrarUserResponse.certificate, registrarUserResponse.key.toBytes());


    const adminUser = _.get(networkConfig, `organizations.${config.mspID}.users.${config.hlfUser}`)
    const userCertificate = _.get(adminUser, "cert.pem")
    const userKey = _.get(adminUser, "key.pem")

    const grpcConn = await newGrpcConnection(peerUrl, Buffer.from(peerCACert))
    const connectOptions = await newConnectOptions(
        grpcConn,
        config.mspID,
        Buffer.from(userCertificate),
        userKey
    )
    const gateway = connect(connectOptions);
    const network = gateway.getNetwork(config.channelName);
    const contract = network.getContract(config.chaincodeName);
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    })
    app.post("/init", async (req, res) => {
        try {
            const { tokenName, tokenSymbol } = req.query as any
            const initialized = await contract.submitTransaction("Initialize", tokenName, tokenSymbol)
            log.info("Initialized: ", initialized.toString())
            res.send("Initialized")
        } catch (e) {
            res.send(`Error initializing ${e}`)
        }
    })
    const users = {}
    app.post("/signup", async (req, res) => {
        const { username, password } = req.body
        let identityFound = null
        try {
            identityFound = await identityService.getOne(username, registrar)
        } catch (e) {
            log.info("Identity not found, registering", e)
        }
        if (identityFound) {
            res.status(400)
            res.send("Username already taken")
            return
        }
        const r = await fabricCAServices.register({
            enrollmentID: username,
            enrollmentSecret: password,
            affiliation: "",
            role: "client",
            attrs: [],
            maxEnrollments: -1
        }, registrar)
        res.send("OK")
    })
    app.post("/login", async (req, res) => {
        const { username, password } = req.body
        let identityFound = null
        try {
            identityFound = await identityService.getOne(username, registrar)
        } catch (e) {
            log.info("Identity not found, registering", e)
            res.status(400)
            res.send("Username not found")
            return
        }
        const r = await fabricCAServices.enroll({
            enrollmentID: username,
            enrollmentSecret: password,
        })
        users[username] = r
        res.send("OK")
    })
    app.use(async (req, res, next) => {
        (req as any).contract = contract
        try {
            const user = req.headers["x-user"] as string
            console.log(users, user)
            if (user && users[user]) {
                const connectOptions = await newConnectOptions(
                    grpcConn,
                    config.mspID,
                    Buffer.from(users[user].certificate),
                    users[user].key.toBytes()
                )
                const gateway = connect(connectOptions);
                const network = gateway.getNetwork(config.channelName);
                const contract = network.getContract(config.chaincodeName);
                (req as any).contract = contract
            }
            next()
        } catch (e) {
            log.error(e)
            next(e)
        }
    })
    app.get("/nfts/:id", async (req, res) => {
        const id = req.params.id
        try {
            const responseBuffer = await (req as any).contract.evaluateTransaction("GetToken", id)
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString)
        } catch (e) {
            res.status(400)
            if (e.details) {
                res.send(e.details)
            } else {
                res.send(e.message);
            }
        }
    })
    app.get("/nfts", async (req, res) => {
        try {
            const responseBuffer = await (req as any).contract.evaluateTransaction("GetTokens")
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString)
        } catch (e) {
            res.status(400)
            if (e.details && e.details.length) {
                res.send(e.details)
            } else {
                res.send(e.message);
            }
        }
    })
    app.get("/id", async (req, res) => {
        try {
            const responseBuffer = await (req as any).contract.evaluateTransaction("ClientAccountID")
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString)
        } catch (e) {
            res.status(400)
            if (e.details) {
                res.send(e.details)
            } else {
                res.send(e.message);
            }
        }
    })
    app.get("/total", async (req, res) => {
        try {
            const responseBuffer = await (req as any).contract.evaluateTransaction("TotalSupply")
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString)
        } catch (e) {
            res.status(400)
            if (e.details) {
                res.send(e.details)
            } else {
                res.send(e.message);
            }
        }
    })
    app.get("/ping", async (req, res) => {
        try {
            const responseBuffer = await (req as any).contract.evaluateTransaction("ping");
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString);
        } catch (e) {
            res.status(400)
            res.send(e.message);
        }
    })
    app.get("/balance", async (req, res) => {
        try {
            const responseBuffer = await (req as any).contract.evaluateTransaction("ClientAccountBalance");
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString);
        } catch (e) {
            res.status(400)
            res.send(e.message);
        }
    })
    app.post("/evaluate", async (req, res) => {
        try {
            const fcn = req.body.fcn
            const responseBuffer = await (req as any).contract.evaluateTransaction(fcn, ...(req.body.args || []));
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString);
        } catch (e) {
            res.status(400)
            res.send(e.details && e.details.length ? e.details : e.message);
        }
    })

    app.post("/submit", async (req, res) => {
        try {
            const fcn = req.body.fcn
            const responseBuffer = await (req as any).contract.submitTransaction(fcn, ...(req.body.args || []));
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString);
        } catch (e) {
            res.status(400)
            res.send(e.details && e.details.length ? e.details : e.message);
        }
    })
    app.get("/mint", async (req, res) => {
        try {
            const { tokenId, tokenUri } = req.query as { tokenId: string, tokenUri: string }
            if (!tokenId || !tokenUri) {
                throw new Error("Missing tokenId or tokenUri")
            }
            const fcn = "Mint"
            const responseBuffer = await (req as any).contract.submitTransaction(fcn, tokenId, tokenUri);
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString);
        } catch (e) {
            res.status(400)
            res.send(e.message);
        }
    })
    app.get("/burn", async (req, res) => {
        try {
            const { tokenId, tokenUri } = req.query as { tokenId: string, tokenUri: string }
            if (!tokenId || !tokenUri) {
                throw new Error("Missing tokenId or tokenUri")
            }
            const fcn = "MintWithTokenURI"
            const responseBuffer = await (req as any).contract.submitTransaction(fcn, tokenId, tokenUri);
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString);
        } catch (e) {
            res.status(400)
            res.send(e.message);
        }
    })

    app.get("/transfer", async (req, res) => {
        try {
            const { tokenId, from, to } = req.query as { from: string, to: string, tokenId: string }
            if (!tokenId) {
                throw new Error("Missing tokenId")
            }
            if (!from) {
                throw new Error("Missing from")
            }
            if (!to) {
                throw new Error("Missing to")
            }
            const fcn = "TransferFrom"
            const responseBuffer = await (req as any).contract.submitTransaction(fcn, from, to, tokenId);
            const responseString = Buffer.from(responseBuffer).toString();
            res.send(responseString);
        } catch (e) {
            res.status(400)
            res.send(e.message);
        }
    })


    const server = app.listen(
        {
            port: process.env.PORT || 3003,
            host: process.env.HOST || "0.0.0.0",
        },
        () => {
            const addressInfo: AddressInfo = server.address() as AddressInfo;
            console.log(`
        Server is running!
        Listening on ${addressInfo.address}:${addressInfo.port}
      `);
        }
    );

}


main()
