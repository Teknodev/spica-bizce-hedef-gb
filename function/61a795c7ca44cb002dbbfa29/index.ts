import { database, ObjectId } from "@spica-devkit/database";
const axios = require("axios").default;

const MATCHMAKING_BUCKET_ID = process.env.MATCHMAKING_BUCKET_ID;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const SERVERS_INFO_BUCKET = process.env.SERVERS_INFO_BUCKET;
const BOT_BUCKET_ID = process.env.BOT_BUCKET_ID;

const MATCH_SERVERS = [
    { title: 'turkcellapp-snake-631f5', api_key: '406bus18l2yiufdq' }, //TITLE CHANGED
]

let db;

export async function matchmaker() {
    // DATABASE
    if (!db) {
        db = await database();
    }
    const matchmaking_collection = db.collection(`bucket_${MATCHMAKING_BUCKET_ID}`);
    const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);
    const bots_collection = db.collection(`bucket_${BOT_BUCKET_ID}`);
    
    let match_making_users = await matchmaking_collection
        .aggregate([
            {
                $set: {
                    _id: {
                        $toString: "$_id"
                    },
                    user: {
                        $toObjectId: "$user"
                    }
                }
            },
            {
                $lookup: {
                    from: `bucket_${USER_BUCKET_ID}`,
                    localField: "user",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: { path: "$user", preserveNullAndEmptyArrays: true }
            },
            {
                $set: {
                    "user._id": {
                        $toString: "$user._id"
                    }
                }
            }
        ])
        .toArray()
        .catch(err => console.log("ERROR 1", err));

    
    let { matched_with_user, matched_with_bots } = seperateMatchingsUsers([
        ...match_making_users
    ]);
    
    // 1 - add mathced users to ->> duel ->> delete from ->> matchmaking bucket
    let duels_with_user_array = createDuelObjectsWithUser([...matched_with_user]);
    if (duels_with_user_array.length > 0) {
        await checkAvailability(duels_with_user_array[0]);
    }

    let delete_match_with_user_filter = matchedWithUserDeleteFilter([...matched_with_user]);
    await matchmaking_collection.deleteMany(delete_match_with_user_filter);

    // 2 - get random bot ->> add matched users(matched with bot) to ->> duel ->> delete these users from ->> matchmaking bucket
    let randomBot = await bots_collection
        .aggregate([{ $sample: { size: 1 } }])
        .toArray()
        .catch(err => console.log("ERROR", err));

    let bot = await users_collection
        .findOne({ _id: randomBot[0]._id })
        .catch(err => console.log("ERROR 2", err));


    let duels_with_bots_array = createDuelObjectsWithBot([...matched_with_bots], bot);
    if (duels_with_bots_array.length > 0) {
        await checkAvailability(duels_with_bots_array[0]);
    }

    let delete_match_with_bot_filter = nonMatchedWithUserDeleteFilter([...matched_with_bots]);
    await matchmaking_collection.deleteMany(
        delete_match_with_bot_filter
    );
}

// DATA MANIPULATION FUNCTIONS
function createDuelObjectsWithUser(matchmaking_users) {
    let duel_array = [];
    let current_date = new Date();

    for (const matchmaking_user of matchmaking_users) {
        duel_array.push({
            user1: matchmaking_user[0].user._id,
            user2: matchmaking_user[1].user._id,
            user1_ready: false,
            user2_ready: false,
            created_at: current_date,
            duel_type: 0,
            user1_ingame: false,
            user2_ingame: false,
            user1_points: 0,
            user2_points: 0,
            user1_playing_duration: 0,
            user2_playing_duration: 0,
            user1_is_dead: false,
            user2_is_dead: false,
            user1_is_free: matchmaking_user[0].user.free_play,
            user2_is_free: matchmaking_user[1].user.free_play,
        });
    }

    return duel_array;
}

function createDuelObjectsWithBot(matchmaking_users, bot) {
    let duel_array = [];
    let current_date = new Date();

    for (const matchmaking_user of matchmaking_users) {
        duel_array.push({
            user1: matchmaking_user.user._id,
            user2: bot._id,
            user1_ready: false,
            user2_ready: true,
            created_at: current_date,
            duel_type: 1,
            user1_ingame: false,
            user2_ingame: true,
            user1_points: 0,
            user2_points: 0,
            user1_playing_duration: 0,
            user2_playing_duration: 0,
            user1_is_dead: false,
            user2_is_dead: false,
            user1_is_free: matchmaking_user.user.free_play,
            user2_is_free: false //true
        });
    }

    return duel_array;
}

function matchedWithUserDeleteFilter(matched_with_users) {
    let in_array = [];

    for (const matched_with_user of matched_with_users) {
        in_array.push(ObjectId(matched_with_user[0]._id));
        in_array.push(ObjectId(matched_with_user[1]._id));
    }

    return {
        _id: {
            $in: in_array
        }
    };
}

function nonMatchedWithUserDeleteFilter(matchmaking_users) {
    let in_array = [];

    // use map please

    for (const matchmaking_user of matchmaking_users) {
        in_array.push(ObjectId(matchmaking_user._id));
    }

    return {
        _id: {
            $in: in_array
        }
    };
}

function seperateMatchingsUsers(matchmaking_users) {
    let matched = [];
    let unmatched = [];

    // --set matched
    for (let matchmaking_user1 of matchmaking_users) {
        // 1-if first user is matched
        if (!inMatched(matchmaking_user1, matched)) {
            for (let matchmaking_user2 of matchmaking_users) {
                // 2-if second user is matched
                if (
                    !inMatched(matchmaking_user2, matched) &&
                    matchmaking_user1._id != matchmaking_user2._id
                ) {
                    if (
                        !inMatched(matchmaking_user1, matched) &&
                        !inMatched(matchmaking_user2, matched)
                    ) {
                        matched.push([matchmaking_user1, matchmaking_user2]);
                    }
                }
            }
        }
    }

    // --set unmatched
    for (let matchmaking_user of matchmaking_users) {
        if (!inMatched(matchmaking_user, matched)) {
            unmatched.push(matchmaking_user);
        }
    }

    return {
        matched_with_user: matched,
        matched_with_bots: unmatched
    };
}

//check user is in the already matched array or not
function inMatched(matchmaking_user, matched) {
    let response = false;

    /* user -> array find */
    // or use normal for and break when find it

    for (const match of matched) {
        if (match[0]._id == matchmaking_user._id || match[1]._id == matchmaking_user._id) {
            response = true;
            break;
        }
    }

    return response;
}

async function checkAvailability(data) {
    data["user1"] = String(data.user1);
    data["user2"] = String(data.user2);
    let users = [String(data.user1)];

    if (data.duel_type == 0) {
        users.push(String(data.user2));
    }

    let postData = {
        data: data,
        users: users
    };

    let stopIteration = false;
    for (let index in MATCH_SERVERS) {
        if (!stopIteration) {
            let server = MATCH_SERVERS[index].title;
            let api_key = MATCH_SERVERS[index].api_key;

            let url = `https://${server}.hq.spicaengine.com/api/fn-execute/checkAvailability`;

            const options = {
                method: "POST",
                headers: {
                    Authorization: `APIKEY ${api_key}`,
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(postData)
            };
            const serverRes = await axios(url, options).catch(err => console.log("AXIOS ERR", err));
            
            if (serverRes.data.tokens && serverRes.data.tokens[0]) {
                stopIteration = true;
                let insertedObj = {
                    duel_id: serverRes.data.duel_id,
                    match_server: server,
                    user1: data["user1"],
                    user1_token: serverRes.data.tokens[0],
                    user2: data["user2"],
                    user2_token: serverRes.data.tokens[1] || "",
                    available_to_user_1: true,
                    available_to_user_2: true,
                    created_at: new Date(),
                    user1_ready: false,
                    user2_ready: serverRes.data.tokens[1] ? false : true
                };
                await insertServerData(insertedObj);
            }
        }
    }
}

async function insertServerData(data) {
    if (!db) {
        db = await database();
    }
    const serverInfocollection = db.collection(`bucket_${SERVERS_INFO_BUCKET}`);
    await serverInfocollection.insertOne(data);
}
