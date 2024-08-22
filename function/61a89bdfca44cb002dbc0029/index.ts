import { database, ObjectId } from "@spica-devkit/database";

const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const PAST_DUELS_BUCKET_ID = process.env.PAST_DUELS_BUCKET_ID;
const DELETED_MATCHES_BUCKET = process.env.DELETED_MATCHES_BUCKET;
const SERVER_INFO_BUCKET_ID = process.env.SERVER_INFO_BUCKET_ID;

const OPERATION_KEY = '6Ww7PajcsGH34PbE';

let db,
    usersCollection,
    pastDuelsCollection,
    deletedMatchesCollection;

export async function insertPastMatchFromServerMultiplayer(req, res) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }

    usersCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    pastDuelsCollection = db.collection(`bucket_${PAST_DUELS_BUCKET_ID}`);

    const { duel, key } = req.body;
    
    if (key == OPERATION_KEY) {
        removeServerInfo(duel._id);
        let user1EarnedAward = 0;
        let user2EarnedAward = 0;
        const user1 = await usersCollection
            .findOne({ _id: ObjectId(duel.user1) })
            .catch(err => console.log("ERROR 15", err));
        const user2 = await usersCollection
            .findOne({ _id: ObjectId(duel.user2) })
            .catch(err => console.log("ERROR 16", err));

        // if both are winner
        
        if (duel.user1_points == duel.user2_points) {
            if (duel.user1_second_match > duel.user2_second_match) {
                duel.winner = 1;
                user1.win_count += 1;
            } else {
                duel.winner = 2;
                if (!user2.bot) {
                    user2.win_count += 1;
                }
            }
        }
        // if user1 is winner
        else if (duel.user1_points > duel.user2_points) {
            duel.winner = 1;
            user1.win_count += 1;
            user1EarnedAward += duel.user1_is_free ? 0 : 2;
            if (!duel.user2.bot) {
                user2EarnedAward += duel.user2_is_free ? 0 : 1;
            }
        }
        // if user2 is winner
        else if (duel.user1_points < duel.user2_points) {
            duel.winner = 2;
            if (!user2.bot) {
                user2.win_count += 1;
                user2EarnedAward += duel.user2_is_free ? 0 : 2;
            }
            user1.lose_count += 1;
            user1EarnedAward += duel.user1_is_free ? 0 : 1;
        }

        await pastDuelsCollection
            .insertOne({
                duel_id: duel.duel_id,
                name: user1.name + " vs " + user2.name,
                user1: duel.user1,
                user2: duel.user2,
                winner: duel.winner,
                user1_points: duel.user1_points,
                user2_points: duel.user2_points,
                start_time: ObjectId(duel._id).getTimestamp(),
                end_time: new Date(),
                player_type: duel.duel_type,
                points_earned: duel.user1_points + duel.user2_points,
                user1_is_free: duel.user1_is_free,
                user2_is_free: duel.user2_is_free,
                user1_second_match: duel.user1_second_match,
                user2_second_match: duel.user2_second_match,
                user1_actions: duel.user1_actions,
                user2_actions: duel.user2_actions,
                user1_playing_duration: duel.user1_playing_duration,
                user2_playing_duration: duel.user2_playing_duration,
            })
            .catch(err => console.log("ERROR 17", err));

        // Update users point --->
        usersCollection.findOneAndUpdate(
            {
                _id: ObjectId(duel.user1)
            },
            {
                $set: {
                    total_point: parseInt(user1.total_point) + duel.user1_points,
                    weekly_point: user1.weekly_point + duel.user1_points,
                    win_count: user1.win_count,
                    lose_count: user1.lose_count,
                    total_award: parseInt(user1.total_award) + user1EarnedAward,
                    weekly_award: (user1.weekly_award || 0) + user1EarnedAward,
                }
            }
        );
        usersCollection.findOneAndUpdate(
            {
                _id: ObjectId(duel.user2)
            },
            {
                $set: {
                    total_point: parseInt(user2.total_point) + duel.user2_points,
                    weekly_point: user2.weekly_point + duel.user2_points,
                    win_count: user2.win_count,
                    lose_count: user2.lose_count,
                    total_award: parseInt(user2.total_award) + user2EarnedAward,
                    weekly_award: (user2.weekly_award || 0) + user2EarnedAward,
                }
            }
        );
        return res.status(200).send({ message: "successful" });
    } else {
        return res.status(400).send({ message: "No access" });
    }
}

export async function insertDeletedMatch(req, res) {
    const { duel, key } = req.body;

    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }

    deletedMatchesCollection = db.collection(`bucket_${DELETED_MATCHES_BUCKET}`);

    if (key == OPERATION_KEY) {
        removeServerInfo(duel._id);
        duel["start_time"] = new Date(duel["start_time"]);
        duel["end_time"] = new Date(duel["end_time"]);
        await deletedMatchesCollection
            .insertOne(duel)
            .catch(err => console.log("ERROR INSERT DELETED MATCH", err));
    } else {
        return res.status(400).send({ message: "No access" });
    }
}

async function removeServerInfo(duel_id) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }

    const serverInfoCollection = db.collection(`bucket_${SERVER_INFO_BUCKET_ID}`);
    serverInfoCollection
        .deleteOne({
            duel_id: duel_id
        })
        .catch(err => console.log("ERROR ", err));
}

export async function removeServerInfoExternalMultiplayer(req, res) {
    const { duel, key } = req.body;
    if (key == OPERATION_KEY) {
        removeServerInfo(String(duel._id));
    } else {
        return res.status(400).send({ message: "No access" });
    }
}