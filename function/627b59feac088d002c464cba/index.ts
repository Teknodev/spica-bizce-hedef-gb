import { database, ObjectId } from "@spica-devkit/database";
const fetch = require("node-fetch");

const DUEL_BUCKET_ID = process.env.DUEL_BUCKET_ID;
const MAIN_SERVER_URL = "https://bizce-hedef-gb-23d20.hq.spicaengine.com/api";
const OPERATION_KEY = '6Ww7PajcsGH34PbE';


let db;

export async function checkFinishedDuels() {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }

    const t = new Date();
    t.setSeconds(t.getSeconds() - 60);

    const finishedDuels = await db
        .collection(`bucket_${DUEL_BUCKET_ID}`)
        .aggregate([
            {
                $match: {
                    $and: [
                        { last_food_eat_date: { $exists: true } },
                        { last_food_eat_date: { $lt: t } }
                    ]
                }
            }
        ])
        .toArray()
        .catch(async e => {
            console.log("ERROR 3", e);
        });

    if (finishedDuels.length) {
        for (let duel of finishedDuels) {
            let duelId = duel._id.toString();
            let duelData = {
                duel_id: duelId,
                name: duel.user1 + " vs " + duel.user2,
                user1: duel.user1,
                user2: duel.user2,
                winner: duel.winner,
                user1_points: duel.user1_points,
                user2_points: duel.user2_points,
                start_time: ObjectId(duelId).getTimestamp(),
                end_time: new Date(),
                user1_is_free: duel.user1_is_free,
                user2_is_free: duel.user2_is_free,
                user1_second_match: duel.user1_second_match ? duel.user1_second_match : false,
                user2_second_match: duel.user2_second_match ? duel.user2_second_match : false,
                user1_actions: duel.user1_actions ? duel.user1_actions : [],
                user2_actions: duel.user2_actions ? duel.user2_actions : [],
                duel_type: duel.duel_type,
                user1_playing_duration: duel.user1_playing_duration,
                user2_playing_duration: duel.user2_playing_duration,
            }

            if (duel.winner == 0) {
                fetchOperation('insertPastMatchFromServerMultiplayer', duelData)
            } else {
                fetchOperation('insertDeletedMatch', duelData)
            }

            fetchOperation('removeServerInfoExternalMultiplayer', duel)

            removeIndetity(duelId)

            await db
                .collection(`bucket_${DUEL_BUCKET_ID}`)
                .deleteOne({
                    _id: ObjectId(duelId)
                })
                .catch(err => console.log("ERROR 8", err));
        }
    }

    const t2 = new Date();
    t2.setSeconds(t2.getSeconds() - 60);

    const t3 = new Date();
    t3.setMinutes(t3.getMinutes() - 20);

    await db
        .collection(`bucket_${DUEL_BUCKET_ID}`)
        .deleteMany({ $or: [{ created_at: { $lt: t2 }, last_food_eat_date: { $exists: false } }, { created_at: { $lt: t3 } }] })
        .catch(err => console.log("ERROR 10", err));
}

async function fetchOperation(functionName, duel) {
    await fetch(
        `${MAIN_SERVER_URL}/fn-execute/${functionName}`,
        {
            method: "post",
            body: JSON.stringify({
                duel: duel,
                key: OPERATION_KEY
            }),
            headers: {
                "Content-Type": "application/json",
            }
        }
    ).catch(err => console.log("ERROR FETCH OPERATION", err));

    return true
}

async function removeIndetity(duel_id) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }
    await db.collection('identity').deleteMany({ "attributes.duel_id": duel_id })
        .catch(err => console.log("ERROR ", err))
}