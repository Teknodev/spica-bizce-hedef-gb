import { database } from "@spica-devkit/database";

const ALERT_BUCKET_ID = process.env.ALERT_BUCKET_ID;
const PAST_MATCHES_BUCKET_ID = process.env.PAST_MATCHES_BUCKET_ID;

let db;

export async function checkPastMatch() {
    let now = new Date();
    let now2 = new Date();
    if (!db) {
        db = await database().catch(err => console.log("ERROR 3", err));
    }

    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET_ID}`);
    const alertCollection = db.collection(`bucket_${ALERT_BUCKET_ID}`);

    const duel = await pastMatchesCollection
        .find()
        .sort({ _id: -1 })
        .limit(1)
        .toArray()
        .catch(err => console.log("ERROR 4", err));

    if (duel[0].end_time < now.setMinutes(now.getMinutes() - 25)) {
        const lastAlert = await alertCollection
            .find()
            .sort({ _id: -1 })
            .limit(1)
            .toArray()
            .catch(err => console.log("ERROR 5", err));

        if (
            !lastAlert[0] ||
            (lastAlert[0] && lastAlert[0].date < now2.setMinutes(now2.getMinutes() - 25))
        ) {
            await alertCollection
                .insertOne({
                    title: "GNC Snake: WARNING!",
                    message: "There have been no matches in 25 minutes!",
                    date: new Date()
                })
                .catch(err => {
                    console.log("ERROR 6: ", err);
                });
        }
    }
    return true;
}
