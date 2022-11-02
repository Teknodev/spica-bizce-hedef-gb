import { database } from "@spica-devkit/database";
import * as Identity from "@spica-devkit/identity";

const MATCHMAKING_BUCKET_ID = process.env.MATCHMAKING_BUCKET_ID;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const SECRET_API_KEY = process.env.SECRET_API_KEY;
const SERVER_INFO_BUCKET = process.env.SERVER_INFO_BUCKET;


let db;

export async function addMatchMaking(req, res) {
    let token = getToken(req.headers.get("authorization"));
    let token_object = await tokenVerified(token);

    if (token_object.error === false) {
        let decoded_token = token_object.decoded_token;

        if (!db) db = await database();
        const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);
        const matchmaking_collection = db.collection(`bucket_${MATCHMAKING_BUCKET_ID}`);
        const serverInfoCollection = db.collection(`bucket_${SERVER_INFO_BUCKET}`);

        const { user } = req.body;

        let user_object = await users_collection
            .findOne({ identity: decoded_token._id })
            .catch(err => console.log("ERROR 1", err));

        const serverInfo = await serverInfoCollection.findOne({
            $or: [
                { user1: user, available_to_user_1: true },
                { user2: user, available_to_user_2: true }
            ]
        });

        if (serverInfo) {
            return res.status(200).send({ message: "User in game", server_info: serverInfo });
        }

        if (user_object._id == user) {
            const matchmaking_bucket = db.collection(`bucket_${MATCHMAKING_BUCKET_ID}`);

            let current_date = new Date(Date.now()).toISOString();

            const query = { user: user };
            const update = {
                $set: { title: 'Matchmaking', user: user, date: current_date }
            };
            const options = { upsert: true };

            await matchmaking_bucket.updateOne(query, update, options);

            let matchmaking_object = await matchmaking_collection
                .findOne({ user: user })
                .catch(err => console.log("ERROR 2", err));

            return res.status(200).send(matchmaking_object);
        } else {
            return res.status(400).send({ message: "Invalid operation for current user." });
        }
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

    return response_object;
}