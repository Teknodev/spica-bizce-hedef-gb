import { database, ObjectId } from "@spica-devkit/database";
import * as Identity from "@spica-devkit/identity";
import * as SetAward from "../../61a795fdca44cb002dbbfa6b/.build";

const SECRET_API_KEY = process.env.SECRET_API_KEY;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const SERVER_INFO_BUCKET_ID = process.env.SERVER_INFO_BUCKET_ID;
const CHARGE_VARIANT = 158964;
const DAILY_1GB_OFFER_ID = 501399;
const DAILY_CAMPAIGN_ID = 1236;


const DUEl_OPERATION_KEY = '6Ww7PajcsGH34PbE';

const FREE_PLAY_CONTROL_DAYS = [3, 4, 5, 6];

let db;


export async function changeName(req, res) {
    const { userId, name } = req.body;
    if (!db) {
        db = await database().catch(err => console.log("ERROR 1", err));
    }

    let token = getToken(req.headers.get("authorization"));
    let token_object = await tokenVerified(token);

    const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);

    if (token_object.error === false) {
        await userCollection.updateOne({ _id: ObjectId(userId) }, {
            $set: { name: name }
        }).catch(err => console.log("ERROR 2 ", err))
        return res.status(200).send({ message: "successful" });
    } else {
        return res.status(400).send({ message: "Token is not verified." });
    }
}

export async function changeAvatar(req, res) {
    const { userId, avatarId } = req.body;
    if (!db) {
        db = await database().catch(err => console.log("ERROR 30", err));
    }

    let token = getToken(req.headers.get("authorization"));
    let token_object = await tokenVerified(token);

    const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);

    if (token_object.error === false) {
        await userCollection
            .updateOne(
                { _id: ObjectId(userId) },
                {
                    $set: { avatar_id: avatarId }
                }
            )
            .catch(err => console.log("ERROR 2 ", err));
        return res.status(200).send({ message: "successful" });
    } else {
        return res.status(400).send({ message: "Token is not verified." });
    }
}

export async function setReadyMainServer(req, res) {
    const { userId, duelId, key } = req.body;

    if (key != DUEl_OPERATION_KEY) {
        return res.status(400).send({ message: "No access" });
    }

    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }

    changeServerAvailabilityToUser(userId, duelId, "ready");

    return res.status(200).send({ message: "successful" });
}

export async function playCountDecrease(req, res) {
    const { userId, duelId, key } = req.body;
    if (key != DUEl_OPERATION_KEY) {
        return res.status(400).send({ message: "No access" });
    }
    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }
    const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    const user = await userCollection.findOne({ _id: ObjectId(userId) })
    let setQuery = {
        available_play_count: Math.max(user.available_play_count - 1, 0)
    };

    if (user.free_play) {
        freePlaySetAward(user.identity);
        setQuery = { free_play: false }
    }

    await userCollection
        .updateOne(
            { _id: ObjectId(userId) },
            {
                $set: setQuery
            }
        )
        .catch(err => console.log("ERROR 2 ", err));

    // changeServerAvailabilityToUser(userId, duelId, "decrease");

    return res.status(200).send({ message: "successful" });
}
async function freePlaySetAward(userId) {

    try {
        const msisdn = await getMsisdn(userId);

        const sessionId = await SetAward.sessionSOAP(CHARGE_VARIANT);

        SetAward.setAwardSOAP(sessionId, msisdn, DAILY_1GB_OFFER_ID, DAILY_CAMPAIGN_ID, '', 'freeMatch');

    } catch (error) {
        console.log("ERROR freePlaySetAward! ", error);
    }
}

async function getMsisdn(userId) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }
    const identityCollection = db.collection(`identity`);

    const identity = await identityCollection.find({
        _id: ObjectId(userId)
    }).toArray();

    const [msisdn] = identity.map(user => user.attributes.msisdn);

    return msisdn;
}

async function changeServerAvailabilityToUser(userId, duelId, type) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 30", err));
    }

    const serverInfoCollection = db.collection(`bucket_${SERVER_INFO_BUCKET_ID}`);

    const serverInfo = await serverInfoCollection
        .findOne({ duel_id: duelId })
        .catch(err => console.log("ERROR ", err));

    if (!serverInfo) return;

    let userPlacement = 1;
    if (serverInfo.user2 == userId) {
        userPlacement = 2;
    }

    let setQuery = {};
    if (type == "decrease") {
        setQuery = { $set: { [`available_to_user_${userPlacement}`]: false } };
    } else if (type == "ready") {
        setQuery = { $set: { [`user${userPlacement}_ready`]: true } };
    }

    await serverInfoCollection
        .updateOne({ duel_id: duelId }, setQuery)
        .catch(err => console.log("ERROR ", err));

    return true;
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

    return response_object;
}

export async function updateFreePlayForUsers() {
    console.log("@updateFreePlayForUsers");
    const currentDate = new Date();
    currentDate.setHours(currentDate.getHours() + 3);
    const currentDay = currentDate.getDay(); // getDay() returns 0 (Sunday) to 6 (Saturday)

    let isFreePlay = true;

    if (!FREE_PLAY_CONTROL_DAYS.includes(currentDay)) return;
    //Set free play to false after free play days (wednesday & friday are free play days)
    if (currentDay === 4 || currentDay === 6) {
        isFreePlay = false;
    }
    //1 0 * * *
    const db = await database();
    const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    console.log("updateFreePlayForUsers", isFreePlay)
    userCollection.updateMany(
        { bot: false },
        { $set: { free_play: isFreePlay } }
    );
    return "ok"
}