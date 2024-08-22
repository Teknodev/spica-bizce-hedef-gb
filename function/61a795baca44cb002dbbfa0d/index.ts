import { database, ObjectId } from "@spica-devkit/database";
const jwt_decode = require("jwt-decode");

const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const LEADER_USERS_BUCKET_ID = process.env.LEADER_USERS_BUCKET_ID;

let db;

export async function getUserRank(req, res) {
    let token = req.headers.get("authorization").split(" ")[1];
    let userPoint;
    if (!db) {
        db = await database();
    }
    const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);

    let decoded_token = jwt_decode(token);
    let identity_id = decoded_token._id;
    let request = await users_collection
        .findOne({ identity: identity_id })
        .catch(err => console.log("ERROR 1", err));
    if (!request?._id) return res.status(400).send({ error: request });
    // user_id = request._id;
    userPoint = request.weekly_point;
    let userId = String(request._id);

    let leaders = await users_collection
        .find().sort({ weekly_point: -1 }).limit(100).toArray()
        .catch(err => console.log("ERROR 2", err));

    const userIndex = leaders.findIndex(el => String(el._id) == userId)
    const userRank = userIndex == -1 ? 100 : userIndex + 1


    // const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    // let userRank = await userCollection.find({ weekly_point: { $gte: userPoint } }).count();

    return res.status(200).send({ rank: userRank });
}

export async function getOpponentUserRank(req, res) {
    // const { user_id } = req.body
    // let userPoint;

    // if (!db) {
    //     db = await database();
    // }

    // const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);
    // let request = await users_collection
    //     .findOne({ _id: ObjectId(user_id) })
    //     .catch(err => console.log("ERROR 1", err));

    // if (!request?._id) return res.status(400).send({ error: request });
    // userPoint = request.weekly_point;

    // const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    // // let userRank = await userCollection.find({ weekly_point: { $gte: userPoint } }).count();
    // let userRank = 0;
    return res.status(200).send({ rank: 0 });
}


export async function getLeaderUsers(req, res) {
    if (!db) {
        db = await database();
    }

    /* FETCH DATA FROM LEADER BUCKET
    const leaderUsersCollection = db.collection(`bucket_${LEADER_USERS_BUCKET_ID}`);

    let leaders = await leaderUsersCollection
        .find()
        .sort({ weekly_point: -1 })
        .toArray()
        .catch(err => console.log("ERROR 2", err));

    return res.status(200).send(leaders);
    */

    const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);
    let leaders = await users_collection
        .find().sort({ weekly_point: -1 }).limit(10).toArray()
        .catch(err => console.log("ERROR 2", err));


    return res.status(200).send(leaders);
}

export async function setLeaderUsers() {
    if (!db) {
        db = await database();
    }
    const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);
    const leaderUsersCollection = db.collection(`bucket_${LEADER_USERS_BUCKET_ID}`);
    let leaders = await users_collection
        .find()
        .sort({ weekly_point: -1 })
        .limit(10)
        .toArray()
        .catch(err => console.log("ERROR 2", err));

    for (const leader of leaders) {
        delete leader["_id"];
    }

    await leaderUsersCollection.deleteMany();
    leaderUsersCollection.insertMany(leaders);
}

export async function setNewData(req, res) {
    if (!db) {
        db = await database();
    }

    // await db.listCollections().toArray().catch(err => console.log("ERR", err))
    // await db.collection('buckets').find().toArray().catch(err => console.log("ERR", err))  
    // await db.collection('policy').deleteMany().catch(err => console.log("ERR", err))
    // db.collection("bucket_undefined").drop(function (err, delOK) {
    //     if (err) throw err;
    //     if (delOK) console.log("Collection deleted");
    //     db.close();
    // });

    const { data } = req.body;

    data.forEach((el) => {
        el['_id'] = ObjectId(el['_id'])
    })
    
    await db.collection('bucket_605c9480e9960e002c278191').insert(data).catch(err => console.log(err))

    return true
}