import { database, ObjectId } from "@spica-devkit/database";
const axios = require("axios").default;
import * as Api from "../../66c35126435fd2002ce680c4/.build";


const MATCHMAKING_BUCKET_ID = process.env.MATCHMAKING_BUCKET_ID;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const SERVERS_INFO_BUCKET = process.env.SERVERS_INFO_BUCKET;
const BOT_BUCKET_ID = process.env.BOT_BUCKET_ID;
const SINGLEPLAY_SERVERS_INFO_BUCKET = process.env.SINGLEPLAY_SERVERS_INFO_BUCKET;

const MATCH_SERVERS = [
    { title: 'bizce-hedef-gb-23d20', api_key: '406bus18l2yiufdq' },
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

    setInterval(async () => {
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
            duels_with_user_array.forEach(duels => {
                checkAvailability(duels)
            })
            // await checkAvailability(duels_with_user_array[0]);
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
            duels_with_bots_array.forEach(duels => {
                checkAvailability(duels)
            })
            // await checkAvailability(duels_with_bots_array[0]);
        }

        let delete_match_with_bot_filter = nonMatchedWithUserDeleteFilter([...matched_with_bots]);
        await matchmaking_collection.deleteMany(
            delete_match_with_bot_filter
        );
    }, 5000);
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
            user1_is_free: !!!matchmaking_user[0].user.available_play_count,
            user2_is_free: !!!matchmaking_user[1].user.available_play_count,
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
            user1_is_free: !!!matchmaking_user.user.available_play_count,
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

//New flow start
export async function newMatchmaker(req, res) {
    console.log("newMatchmaker")
    // const db = await Api.useDatabase();
    // const userCollection = db.collection(`bucket_${USER_BUCKET}`);
    // const user = await userCollection.findOne({
    //     _id: userID
    // }).toArray();
    const { userID, userFree } = req.body;
    const duelData = createDuelObject(userID, userFree);
    // if (userID == "66c23d80435fd2002cde2e74") {
    // console.log("batu", duelData)
    requestForANewGameS1(duelData)
    return res.status(200).send({ message: 'Successfull' });
    // }

    // newCheckAvailability(duelData);

    // return res.status(200).send({ message: 'Successfull' });
}

function createDuelObject(userID, userFree) {
    const duelArray = {
        user: ObjectId(userID),
        created_at: new Date(),
        user_ingame: false,
        user_playing_duration: 0,
        user_is_dead: false,
        user_is_free: userFree,
        user_arrows: 0,
    }
    return duelArray;
}

async function newCheckAvailability(data) {
    console.log("newCheckAvailability")
    data["user"] = String(data.user);
    const user = [String(data.user)];
    // console.log("user: ", user);
    const postData = {
        data: data,
        users: user,
    }
    // console.log("postData: ", postData);
    const server = MATCH_SERVERS[0].title;
    const api_key = MATCH_SERVERS[0].api_key;

    const url = `https://${server}.hq.spicaengine.com/api/fn-execute/newCheckAvailability`;

    const options = {
        method: "POST",
        headers: {
            Authorization: `APIKEY ${api_key}`,
            "Content-Type": "application/json"
        },
        data: JSON.stringify(postData)
    };

    let serverRes;
    try {
        console.time("newCheckAvailability")
        serverRes = await axios(url, options);
        console.timeEnd("newCheckAvailability")

    } catch (err) {
        console.log(`AXIOS ERR: `, server, 'ERR: ', err)
        return;
    }


    if (serverRes && serverRes.status != 200) {
        console.log("serverRes: ", serverRes)
    }
    //Todo! change SERVER_INFO_BUCKET
    if (serverRes && serverRes.data.tokens && serverRes.data.tokens[0]) {
        let insertedObj = {
            duel_id: serverRes.data.duel_id,
            match_server: server,
            user: data["user"],
            user_token: serverRes.data.tokens[0],
            created_at: new Date(),
        };
        console.time("insertServerDataNew")
        await insertServerDataNew(insertedObj);
        console.timeEnd("insertServerDataNew")


    }

}

async function insertServerDataNew(data) {
    if (!db) {
        db = await database();
    }
    const serverInfocollection = db.collection(`bucket_${SINGLEPLAY_SERVERS_INFO_BUCKET}`);
    return serverInfocollection.insertOne(data);
}
async function requestForANewGameS1(data) {
    data["user"] = String(data.user);
    // console.log("@REQUEST FOR A NEW GAME")
    const users = [String(data.user)];

    // console.log("USERS::", users)
    // if (users == "65e993036a06444f616d3584") {
    //     console.log("batu")
    //     Api.httpRequest('post', ' https://match-instance1-0e5a3.hq.spicaengine.com/api/fn-execute/new-game-listener', {
    //         "referenceNo": String(Date.now()),
    //         "service": "vdf_gol_at_kazan",
    //         "data": data,
    //         "users": users
    //     }, {}).catch(err => console.log("ERR:HATAHATAHATAHATAHATAHATAHATA ", err));
    //     return;
    // }
    // !TODO should send this request to the message broker
    // https://vodafone.queue.spicaengine.com/message?topic_id=657310d3f1bac9002c940b22
    // https://vodafone-sayi-krali-a4d57.hq.spicaengine.com/api/fn-execute/new-game-listener
    // console.log("denemedeneme", {
    //     "referenceNo": String(Date.now()),
    //     "service": "sayi_krali",
    //     "data": data,
    //     "users": users
    // })
    // console.log(users, data)
    await Api.httpRequest('post', 'https://vodafone.queue.spicaengine.com/message?topic_id=657310d3f1bac9002c940b22', {
        "referenceNo": String(Date.now()),
        "service": "bizce_hedef_gb",
        "data": data,
        "users": users
    }, {}).catch(err => console.error("ERR:HATAHATAHATAHATAHATAHATAHATA ", err));
    return
}

export async function newMatchmakerAWS(req, res) {
    const { userID, userFree } = req.body;
    const duelData = createDuelObject(userID, userFree);
    requestForANewGameAWS(duelData)
    return res.status(200).send({ message: 'Successfull' });
}

async function requestForANewGameAWS(data) {
    data["user"] = String(data.user);
    const users = [String(data.user)];

    const requestData = {
        referenceNo: String(Date.now()),
        service: 'bizce_hedef_gb',
        data: data,
        users: users
    };
    const refNo = String(Date.now())

    await Api.httpRequest('post', 'https://match-instance-f21ff.aws.spicaengine.com/api/fn-execute/new-game-listener', requestData, {
    }).then(res => { }).catch(err => { console.error(`Err:new-game-listener:post:referenceNo:${refNo}:`, err) });
    return
}
