import { database, ObjectId } from "@spica-devkit/database";
import * as Bucket from "@spica-devkit/bucket";

const MANUALLY_REWARD_BUCKET_ID = process.env.MANUALLY_REWARD_BUCKET_ID;
const SECRET_API_KEY = process.env.SECRET_API_KEY;
const BUGGED_REWARDS_BUCKET_ID = process.env.BUGGED_REWARDS_BUCKET_ID;

const HOURLY_1GB_OFFER_ID = 451319;

let db;

export async function checkReward() {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 7 ", err));
    }

    retryTcellIssues().catch(err => console.log("ERROR 13", err));
}

async function retryTcellIssues() {
    const rewardsCollection = db.collection(`bucket_${BUGGED_REWARDS_BUCKET_ID}`);
    const manuallyRewardsCollection = db.collection(`bucket_${MANUALLY_REWARD_BUCKET_ID}`);
    const errors = ["3302", "3238", "3581", "3483"]; // TCELL ERROR

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
        if (retryCount.length < 24) {//free play added
            let type = reward.offer_id == HOURLY_1GB_OFFER_ID ? 'hourly_1' : 'daily_1';
            logData.push({
                msisdn: reward.msisdn.substring(2),
                type,
                reward_id: reward._id
            })
            insertReward(
                reward.msisdn.substring(2),
                type,
                reward._id
            );
            
        }
    }

    if (logData.length) {
        console.log("logData: ", logData)
    }
}

async function insertReward(msisdn, rewardType, retry_id = "") {
    console.log("insertReward: ",msisdn, rewardType, retry_id);
    return;
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