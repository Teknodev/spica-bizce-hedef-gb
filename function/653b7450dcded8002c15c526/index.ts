import { database, ObjectId } from '@spica-devkit/database';
import * as Storage from '@spica-devkit/storage';
const json2csv = require("json2csv").parse;

const SECRET_APIKEY = process.env.SECRET_APIKEY;
const USER_BUCKET = process.env.USER_BUCKET;
const LEADER_USERS_BUCKET = process.env.LEADER_USERS_BUCKET;

export async function setLeaderUsers(req, res) {
    console.log("@setLeaderUsers")
    const db = await database().catch(console.error)
    const userCollection = db.collection(`bucket_${USER_BUCKET}`);
    const ypLeaderCollection = db.collection(`bucket_${LEADER_USERS_BUCKET}`);
    const identityCollection = db.collection('identity');

    const leaderUsers = await userCollection.find({ bot: false }).sort({ weekly_point: -1 })
        .limit(10).toArray().catch(console.error)

    const userIdentities = Array.from(leaderUsers, el => ObjectId(el.identity));
    const identitiesData = await identityCollection.find({ _id: { $in: userIdentities } })
        .toArray().catch(console.error);

    const dateFrom = new Date().setDate(new Date().getDate() - 7);
    const leadersData = [];
    leaderUsers.forEach(el => {
        const tempIdentity = identitiesData.find(identity => String(identity._id) == el.identity)
        leadersData.push({
            msisdn: tempIdentity.attributes.msisdn,
            point: el.weekly_point,
            user: String(el._id),
            name: el.name,
            date_from: new Date(dateFrom),
            date_to: new Date()
        })
    })

    await ypLeaderCollection.deleteMany().catch(console.error)
    await ypLeaderCollection.insertMany(leadersData).catch(console.error)

    let formattedString = json2csv(leadersData, { fields: ['msisdn', 'point', 'user', 'name'] });
    let bufferData = Buffer.alloc(formattedString.length, formattedString);

    await insertToStorage(bufferData, dateFrom).catch(err => console.log("ERROR 10", err));
    await clearUserPoint().catch(console.error)

    return res.status(200).send('ok')

}

async function insertToStorage(bufferData, dateFrom) {
    Storage.initialize({ apikey: SECRET_APIKEY });

    const bufferWithMeta = {
        contentType: 'text/csv',
        data: bufferData,
        name: `${new Date(dateFrom).toLocaleDateString()}-${new Date().toLocaleDateString()}`,
    }

    return Storage.insert(bufferWithMeta)
}

export async function getTopUsers(req, res) {
    const db = await database();
    const leaderUsersCollection = db.collection(`bucket_${LEADER_USERS_BUCKET}`);
    try {
        const leaderUsers = await leaderUsersCollection.find().toArray().catch(err => console.log("ERROR: 27", err));;
        return leaderUsers;
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).send('Internal Server Error');
    }

}