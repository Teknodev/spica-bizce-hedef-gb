import { database, ObjectId } from "@spica-devkit/database";
import * as Bucket from "@spica-devkit/bucket";

const MANUALLY_REWARD_BUCKET_ID = process.env.MANUALLY_REWARD_BUCKET_ID;
const SECRET_API_KEY = process.env.SECRET_API_KEY;
const BUGGED_REWARDS_BUCKET_ID = process.env.BUGGED_REWARDS_BUCKET_ID;
const TRANSACTIONS_BUCKET = process.env.TRANSACTIONS_BUCKET;;

const FIRST_1GB_OFFER_ID = 481642;

let db;

export async function checkReward() {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 7 ", err));
    }

    retryTcellIssues().catch(err => console.log("ERROR 13", err));
    retryCommitServiceError().catch(err => console.log("ERROR 32", err));
}

async function retryTcellIssues() {
    const rewardsCollection = db.collection(`bucket_${BUGGED_REWARDS_BUCKET_ID}`);
    const manuallyRewardsCollection = db.collection(`bucket_${MANUALLY_REWARD_BUCKET_ID}`);
    const errors = ["3302", "3238", "3581"]; // TCELL ERROR

    let minDate = new Date();
    minDate.setMinutes(minDate.getMinutes() - 240);

    let buggedRewards = await rewardsCollection
        .find({
            date: { $gte: minDate, $lt: new Date() },
            error_id: { $in: errors }
        })
        .toArray()
        .catch(err => console.log("ERROR 9 ", err));

    let buggedRewardsIds = Array.from(buggedRewards, x => x._id.toString());
    const manuallyRewards = await manuallyRewardsCollection
        .find({
            process_completed: true,
            retry_id: { $in: buggedRewardsIds }
        })
        .toArray()
        .catch(err => console.log("ERROR 14:", err));

    buggedRewards = buggedRewards.filter(
        reward => !manuallyRewards.find(mr => mr.retry_id == reward._id.toString())
    );

    const logData = [];
    for (let reward of buggedRewards) {
        let retryCount = await rewardsCollection.find({
            $and: [
                { match_id: { $exists: true } },
                { match_id: { $ne: '' } },
                { match_id: reward.match_id }
            ]
        }).toArray();
        if (retryCount.length < 24) {
            logData.push({
                msisdn: reward.msisdn.substring(2),
            })
            // insertReward(
            //     reward.msisdn.substring(2),
            //     reward.offer_id == FIRST_1GB_OFFER_ID ? "gunluk_1" : "firsat_gunluk_1",
            //     reward._id
            // );
        }
    }

    if (logData.length) {
        console.log("logData: ", logData)
    }
}

async function retryCommitServiceError() {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 7 ", err));
    }

    const identityCollection = db.collection(`identity`);
    const msisdns = [];
    const identitiesId = [];

    let date = new Date()
    date.setMinutes(date.getMinutes() - 12)
    let maxDate = new Date()
    maxDate.setMinutes(maxDate.getMinutes() - 2)

    const chargeData = await db.collection(`bucket_${TRANSACTIONS_BUCKET}`).find({
        status: false,
        listener_result: { "$regex": "\"resultCode\":0" },
        commit_result: { $exists: false },
        date: { $gte: date, $lt: maxDate }
    }).toArray().catch(err => console.log('err: ', err))

    if (!chargeData.length) {
        return;
    }

    chargeData.forEach((el) => {
        msisdns.push(el.msisdn)
    })

    let uniqueMsisdns = [...new Set(msisdns)];
    console.log("uniqueMsisdns: ", uniqueMsisdns)

    const identities = await identityCollection
        .find({ "attributes.msisdn": { $in: uniqueMsisdns } })
        .toArray()
        .catch(err => console.log("ERROR 30", err));

    identities.forEach(identity => {
        identitiesId.push(String(identity._id));
    });


    // for (let msisdn of uniqueMsisdns) {
    //     insertReward(msisdn, "gunluk_1");
    // }
}

async function insertReward(msisdn, rewardType, retry_id = "") {
    Bucket.initialize({ apikey: SECRET_API_KEY });

    await Bucket.data
        .insert(MANUALLY_REWARD_BUCKET_ID, {
            msisdn: Number(msisdn),
            reward: rewardType,
            system: true,
            retry_id
        })
        .catch(err => console.log("ERROR 3: ", err));

    return true;
}