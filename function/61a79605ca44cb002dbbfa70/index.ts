import { database } from "@spica-devkit/database";

const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const CONFIRMATION_CODE_BUCKET_ID = process.env.CONFIRMATION_CODE_BUCKET_ID;

export async function clearUserPoint() {
    console.log("@observer::clearUserPoint");
    const db = await database().catch(err => console.log("ERROR 1", err));
    await db
        .collection(`bucket_${USER_BUCKET_ID}`)
        .updateMany({}, { $set: { weekly_point: 0, weekly_award: 0 } })
        .catch(err => console.log("ERROR 2", err));
}

export async function clearBotPoint() {
    const db = await database();
    await db.collection(`bucket_${USER_BUCKET_ID}`).updateMany({ bot: true }, { $set: { weekly_point: 0, total_point: 0 } })
}

export async function updateConfirmCode() {
    let date = new Date()
    date.setMinutes(date.getMinutes() - 2)

    const db = await database();
    
    const confirmCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);
    confirmCodeCollection.updateMany({
        sent_date: { $lt: date },
        $or: [{ is_expired: false }, { is_expired: { $exists: false } }]
    },
        { $set: { is_expired: true } })
        .catch(err => console.log("ERROR ", err))
}