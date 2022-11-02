import { database } from "@spica-devkit/database";

const SERVERS_INFO_BUCKET = process.env.SERVERS_INFO_BUCKET;


let db;

export async function clearServerInfoBucket() {
    let date_1 = new Date();
    date_1.setMinutes(date_1.getMinutes() - 15);

    let date_2 = new Date();
    date_2.setSeconds(date_1.getSeconds() - 25);

    if (!db) {
        db = await database();
    }

    await db
        .collection(`bucket_${SERVERS_INFO_BUCKET}`)
        .deleteMany({
            $or: [
                { created_at: { $lt: date_1 } },
                { created_at: { $lt: date_2 }, user1_ready: false },
                { created_at: { $lt: date_2 }, user2_ready: false },
            ]
        })
        .catch(e => console.log(e));

    return true;
}