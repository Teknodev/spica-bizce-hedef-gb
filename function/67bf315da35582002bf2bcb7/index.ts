import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";
import * as Api from "../../66c35126435fd2002ce680c4/.build";
// // import * as Helper from "../../633bf949956545002c9b7e31/.build";
// import * as Tcell from "../../63b6d60cebfd83002c5e1966/.build";
// import * as User from "../../63b6a403ebfd83002c5e104e/.build";
// import * as InGame from "../../611b8c1db157fd002d853f6c/.build";


const SINGLEPLAY_PAST_MATCHES = Environment.env.BUCKET.SINGLEPLAY_PAST_MATCHES;
const CORRUPTED_SINGLEPLAY_PAST_MATCHES = Environment.env.BUCKET.CORRUPTED_SINGLEPLAY_PAST_MATCHES;
const USER_BUCKET = Environment.env.BUCKET.USER;
const SINGLEPLAY_DUEL_QUEUE = Environment.env.BUCKET.SINGLEPLAY_DUEL_QUEUE;
const SINGLEPLAY_DUEL_COUNT = Environment.env.BUCKET.SINGLEPLAY_DUEL_COUNT;
const SINGLEPLAY_BUGGED_GAMES = Environment.env.BUCKET.SINGLEPLAY_BUGGED_GAMES;


const CryptoJS = require("crypto-js");

const TCELL_USERNAME = Environment.env.TCELL.USERNAME;
const TCELL_PASSWORD = Environment.env.TCELL.PASSWORD;
const CHARGE_VARIANT = Environment.env.TCELL.CHARGE_VARIANT;

const OFFER_ID_1GB = Environment.env.TCELL.OFFER_ID_1GB;
const CAMPAIGN_ID_1GB = Environment.env.TCELL.CAMPAIGN_ID_1GB;

function hashData(data) {
    const dataString = JSON.stringify(data);  // Convert object to string
    const hashed = CryptoJS.SHA3(dataString).toString(CryptoJS.enc.Hex);  // Hash the string
    return hashed;
}

export async function singleplayPastMatchOperation(doc) {
    const data = doc.current;
    const requestBody = { ...data };
    delete requestBody.hashed_data
    delete requestBody._id
    const { created_at, finished_at, user_actions, is_paid, subscriber_free, user } = requestBody;

    const hashed = await hashData(requestBody);
    const userObj = await Api.getOne(USER_BUCKET, { _id: Api.toObjectId(user) })

    if (!userObj) {
        console.log("No user found!")
        return;
    }
    if (is_paid) {
        if (JSON.parse(user_actions).length <= 1) return;
        await InGame.playCountDecreaseHelper(user)
        // console.log(test, JSON.parse(user_actions).length, user)
    }
    // console.log(JSON.parse(user_actions).length, is_paid, user)
    // if (is_paid && JSON.parse(user_actions).length <= 1) return;
    if (hashed != data.hashed_data) {
        await Api.insertOne(CORRUPTED_SINGLEPLAY_PAST_MATCHES, {
            name: userObj.name,
            user: String(userObj._id),
            created_at: new Date(),
            duel_object: data
        })
        console.error("Corrupted Game Detected!! ");
        return
    } else {
        const actions = JSON.parse(user_actions);
        const earnedPoint = actions[actions.length - 1].totalPoints;
        const userActions = actions.map(action => JSON.stringify(action));

        await Api.insertOne(SINGLEPLAY_PAST_MATCHES, {
            name: userObj.name,
            user: String(userObj._id),
            user_point: earnedPoint,
            user_actions: userActions,
            start_time: new Date(created_at),
            end_time: new Date(finished_at) || new Date(),
            user_is_free: !is_paid,
            user_subscriber_free: subscriber_free
        })
        let userEarnedAward = is_paid ? (earnedPoint >= 150 ? 2 : 1) : 0;

        earnedPoint >= 150 ? userObj.win_count++ : userObj.lose_count++;

        const userPoint = is_paid ? earnedPoint : 0;

        User.updateOne({ _id: Api.toObjectId(userObj._id) }, {
            $set: {
                total_point: parseInt(userObj.total_point) + userPoint,
                weekly_point: userObj.weekly_point + userPoint,
                win_count: userObj.win_count,
                lose_count: userObj.lose_count,
                total_award: parseInt(userObj.total_award) + userEarnedAward,
                weekly_award: (userObj.weekly_award || 0) + userEarnedAward,
            }
        })
    }

    await Api.deleteOne(SINGLEPLAY_DUEL_QUEUE, {
        _id: Api.toObjectId(data._id)
    })

    return;
}

export async function buggedUsersHandle() {
    try {
        const date = new Date();
        date.setMinutes(date.getMinutes() - 5);

        const matchData = await Api.getMany(SINGLEPLAY_DUEL_QUEUE, { finished_at: { $lte: date } });

        if (matchData && matchData.length > 0) {
            await Api.insertMany(SINGLEPLAY_BUGGED_GAMES, matchData);

            await Api.deleteMany(SINGLEPLAY_DUEL_QUEUE, { finished_at: { $lte: date } });
        }
    } catch (error) {
        console.error("Error handling bugged users:", error);
    }
}

export async function singleplayPastMatchesMigration(req, res) {
    const db = await Api.useDatabase();

    const date = {
        $gte: new Date("2024-11-08T00:00:00Z"),
        $lt: new Date("2024-11-14T00:00:00Z")
    };
    const pastMatchesCollection = db.collection(`bucket_${SINGLEPLAY_PAST_MATCHES}`);
    console.log("date: ", date);

    const matches = await pastMatchesCollection.find({
        start_time: date
    }).toArray();

    console.log("matches found: ", matches.length);

    const bulkOperations = matches.map(match => ({
        updateOne: {
            filter: { _id: match._id },
            update: {
                $set: { user: match.user.toString() }
            }
        }
    }));

    if (bulkOperations.length > 0) {
        pastMatchesCollection.bulkWrite(bulkOperations);
        console.log("Bulk update! ");
    } else {
        console.log("No matches to update.");
    }

    return res.send('ok');
}
