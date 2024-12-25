import { database, ObjectId } from "@spica-devkit/database";

const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const SINGLE_PAST_MATCH_BUCKET = process.env.SINGLE_PAST_MATCH_BUCKET;
const DELETED_MATCHES_BUCKET = process.env.DELETED_MATCHES_BUCKET;
const SINGLE_SERVER_INFO_BUCKET = process.env.SINGLE_SERVER_INFO_BUCKET;

const OPERATION_KEY = '6Ww7PajcsGH34PbE';

let db,
	usersCollection,
	pastDuelsCollection;
export async function singlePlayinsertPastMatch(req, res) {
	console.log("singlePlayinsertPastMatch", req.body)
	if (!db) {
		db = await database().catch(err => console.log("ERROR 2", err));
	}

	usersCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
	pastDuelsCollection = db.collection(`bucket_${SINGLE_PAST_MATCH_BUCKET}`);

	const { duel, key } = req.body;
	console.log("duel: ", duel)
	if (key == OPERATION_KEY) {
		removeServerInfo(duel._id);
		let userEarnedAward = 0;
		const user = await usersCollection
			.findOne({ _id: ObjectId(duel.user) })
			.catch(err => console.log("ERROR 15", err));

		if (duel.user_arrows >= 10 && duel.user_arrows <20) {
			user.win_count += 1;
			userEarnedAward += duel.user_is_free ? 0 : 2;
		}
		else if (duel.user_arrows >= 20) {
			user.win_count += 1;
			userEarnedAward += duel.user_is_free ? 0 : 3;
		}
		else if (duel.user_arrows < 10) {
			user.lose_count += 1;
			userEarnedAward += duel.user_is_free ? 0 : 1;
		}
		await pastDuelsCollection
			.insertOne({
				duel_id: duel._id,
				name: user.name,
				user: duel.user,
				start_time: new Date(ObjectId(duel._id).getTimestamp()),
				end_time: new Date(),
				user_is_free: duel.user_is_free,
				user_actions: duel.user_actions || [],
				user_playing_duration: duel.user_playing_duration,
				arrow_count: duel.user_arrows
			})
			.catch(err => console.log("ERROR 17", err));

		usersCollection.findOneAndUpdate(
			{
				_id: ObjectId(duel.user)
			},
			{
				$set: {
					total_point: parseInt(user.total_point) + duel.user_arrows,
					weekly_point: user.weekly_point + duel.user_arrows,
					win_count: user.win_count,
					lose_count: user.lose_count,
					total_award: parseInt(user.total_award) + userEarnedAward,
					weekly_award: (user.weekly_award || 0) + userEarnedAward,
				}
			}
		);
		return res.status(200).send({ message: "successful" });
	} else {
		return res.status(400).send({ message: "No access" });
	}
}
async function removeServerInfo(duel_id) {
	if (!db) {
		db = await database().catch(err => console.log("ERROR ", err));
	}

	const serverInfoCollection = db.collection(`bucket_${SINGLE_SERVER_INFO_BUCKET}`);
	serverInfoCollection
		.deleteOne({
			duel_id: duel_id
		})
		.catch(err => console.log("ERROR ", err));
}

export async function singlePlayremoveServerInfoExternal(req, res) {
	const { duel, key } = req.body;
	if (key == OPERATION_KEY) {
		removeServerInfo(String(duel._id));
		return res.status(200).send({ message: "successful" });

	} else {
		return res.status(400).send({ message: "No access" });
	}

}