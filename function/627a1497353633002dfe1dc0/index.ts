import { database, ObjectId } from "@spica-devkit/database";
import * as Identity from "@spica-devkit/identity";
const fetch = require("node-fetch");

const DUEL_BUCKET_ID = process.env.DUEL_BUCKET_ID;
const CONFIGURATION_BUCKET_ID = process.env.CONFIGURATION_BUCKET_ID;
const PASSWORD_SALT = process.env.PASSWORD_SALT;
const USER_POLICY = process.env.USER_POLICY;
const SECRET_API_KEY = process.env.SECRET_API_KEY;

const MAIN_SERVER_URL = "https://turkcellapp-snake-631f5.hq.spicaengine.com/api"; //CHANGED
const OPERATION_KEY = '6Ww7PajcsGH34PbE';


let db;

export async function checkAvailability(req, res) {
    const { data, users } = req.body;

    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }

    let availableCount = 0;
    const tokens = [];

    const duelCapacity = await db
        .collection(`bucket_${CONFIGURATION_BUCKET_ID}`)
        .findOne({ key: "max_duel_capacity" }).catch(err => console.log("ERROR ", err))

    const duelCount = await db
        .collection(`bucket_${DUEL_BUCKET_ID}`)
        .find().count().catch(err => console.log("ERROR ", err))

    availableCount = Math.max(duelCapacity.value - duelCount, 0)

    if ((users.length == 2 && availableCount < 2) || (users.length == 1 && availableCount < 1)) {
        return res.status(200).send({
            message: "Server is not available"
        });
    } else if (users.length == 2) {
        const duel_id = await createDuel(data);
        for (let user of users) {
            let newToken = await createIdentity(user, duel_id);
            tokens.push(newToken)
        }

        return res.status(200).send({
            message: "Server is available",
            tokens: tokens,
            duel_id: duel_id
        });
    } else if (users.length == 1) {
        const duel_id = await createDuel(data);
        let newToken = await createIdentity(users[0], duel_id);
        tokens.push(newToken)
        return res.status(200).send({
            message: "Server is available",
            tokens: tokens,
            duel_id: duel_id
        });
    } else {
        return res.status(400).send({
            message: "Unexpected case",
        });
    }
}

async function createIdentity(user_id, duel_id) {
    Identity.initialize({ apikey: `${SECRET_API_KEY}` });
    let msisdn = `1111${msisdnGenerate(6)}`;

    await Identity.insert({
        identifier: msisdn,
        password: PASSWORD_SALT,
        policies: [`${USER_POLICY}`],
        attributes: { msisdn: msisdn, user_id: user_id, duel_id: duel_id }
    }).catch(err => console.log("ERROR ", err))

    const token = await Identity.login(msisdn, PASSWORD_SALT).catch(err => console.log("ERROR ", err))

    return token
}

async function createDuel(data) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }

    data['created_at'] = new Date(data['created_at']);

    const duelData = await db
        .collection(`bucket_${DUEL_BUCKET_ID}`)
        .insertOne(data).catch(err => console.log("ERROR ", err))

    return duelData.ops[0]._id
}

function msisdnGenerate(length) {
    let result = "";
    let characters = "123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export async function removeIndetity(changed) {
    let target = changed.previous;

    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }

    await db.collection('identity').deleteMany({ "attributes.duel_id": target._id })
        .catch(err => console.log("ERROR ", err))
}

export async function clearIdentity() {
    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }

    const date1 = new Date()
    date1.setMinutes(date1.getMinutes() - 15)

    const customObjectId = Math.floor(date1.getTime() / 1000).toString(16) + "0000000000000000";

    await db.collection('identity').deleteMany({ _id: { $lt: ObjectId(customObjectId) }, "attributes.duel_id": { $exists: true }, identifier: { $nin: ['spica', 'serdar'] } })
        .catch(err => console.log("ERROR ", err))

    return true
}

export async function setReady(req, res) {
    const { duelId, user_placement } = req.body;

    if (!db) {
        db = await database().catch(err => console.log("ERROR 30", err));
    }

    let token = getToken(req.headers.get("authorization"));
    let token_object = await tokenVerified(token);

    const duelCollection = db.collection(`bucket_${DUEL_BUCKET_ID}`);

    if (token_object.error === false) {
        let setQuery = {};
        setQuery[user_placement] = true;
        await duelCollection
            .updateOne(
                { _id: ObjectId(duelId) },
                {
                    $set: setQuery
                }
            )
            .catch(err => console.log("ERROR 2 ", err));

        await fetch(
            `${MAIN_SERVER_URL}/fn-execute/setReadyMainServer`,
            {
                method: "post",
                body: JSON.stringify({
                    userId: token_object.decoded_token.attributes.user_id,
                    duelId: String(duelId),
                    key: OPERATION_KEY
                }),
                headers: {
                    "Content-Type": "application/json",
                }
            }
        ).catch(err => console.log("ERROR SET READY", err));

        return res.status(200).send({ message: "successful" });
    } else {
        return res.status(400).send({ message: "Token is not verified." });
    }
}

export async function decreasePlayCount(req, res) {
    const { duelId, userId } = req.body;

    let token = getToken(req.headers.get("authorization"));
    let token_object = await tokenVerified(token);
    if (token_object.error === false) {
        await fetch(
            `${MAIN_SERVER_URL}/fn-execute/playCountDecrease`,
            {
                method: "post",
                body: JSON.stringify({
                    userId: userId,
                    duelId: duelId,
                    key: OPERATION_KEY
                }),
                headers: {
                    "Content-Type": "application/json",
                }
            }
        )
            .catch(err => console.log("ERROR PLAY COUNT DECREASE", err));
        return res.status(200).send({ message: "successful" });
    } else {
        return res.status(400).send({ message: "Token is not verified." });
    }
}

// -----HELPER FUNCTION-----
function getToken(token) {
    if (token) {
        token = token.split(" ")[1];
    } else {
        token = "";
    }

    return token;
}

async function tokenVerified(token) {
    let response_object = {
        error: false
    };

    Identity.initialize({ apikey: `${SECRET_API_KEY}` });
    const decoded = await Identity.verifyToken(token).catch(err => (response_object.error = true));

    response_object.decoded_token = decoded;

    return response_object
}