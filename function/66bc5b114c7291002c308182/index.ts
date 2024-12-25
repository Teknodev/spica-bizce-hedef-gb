import { database, ObjectId } from "@spica-devkit/database";
import axios from "axios"

const SINGLE_DUEL_BUCKET = process.env.SINGLE_DUEL_BUCKET;
const MAIN_SERVER_URL = "https://bizce-hedef-gb-23d20.hq.spicaengine.com/api";
const OPERATION_KEY = '6Ww7PajcsGH34PbE';
let db;
export async function singlePlaycheckFinishedDuels() {
	if (!db) {
		db = await database().catch(err => console.log("ERROR 2", err));
	}


	const finishedDuels = await db
		.collection(`bucket_${SINGLE_DUEL_BUCKET}`).find({ user_is_dead: true }).toArray()
		.catch(async e => {
			console.error("ERROR 3", e);
		});

	if (finishedDuels.length) {
		for (let duel of finishedDuels) {
			let duelId = duel._id.toString();
			let duelData = {
				duel_id: duelId,
				user: duel.user,
				user_points: duel.user_points,
				start_time: ObjectId(duelId).getTimestamp(),
				end_time: new Date(),
				user_is_free: duel.user_is_free,
				user_second_match: duel.user_second_match ? duel.user_second_match : false,
				user_actions: duel.user_actions ? duel.user_actions : [],
				user_playing_duration: duel.user_playing_duration,
			}
			console.log("duelData", duelData)
			fetchOperation('insertPastMatchFromServer', duelData)

			fetchOperation('removeServerInfoExternal', duel)

			removeIndetity(duelId)

			await db
				.collection(`bucket_${SINGLE_DUEL_BUCKET}`)
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
		.collection(`bucket_${SINGLE_DUEL_BUCKET}`)
		.deleteMany({ $or: [{ created_at: { $lt: t2 }, last_food_eat_date: { $exists: false } }, { created_at: { $lt: t3 } }] })
		.catch(err => console.log("ERROR 10", err));
}
async function fetchOperation(functionName, duel) {
	const body = {
		duel: duel,
		key: OPERATION_KEY
	}
	await axios.post(`${MAIN_SERVER_URL}/fn-execute/${functionName}`, body).catch(console.error)


	return true
}


async function removeIndetity(duel_id) {
	if (!db) {
		db = await database().catch(err => console.log("ERROR ", err));
	}

	await db.collection('identity').deleteMany({ "attributes.duel_id": duel_id })
		.catch(err => console.log("ERROR ", err))
}