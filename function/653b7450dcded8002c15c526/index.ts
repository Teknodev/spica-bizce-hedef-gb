import { database, ObjectId } from '@spica-devkit/database';
import * as Storage from '@spica-devkit/storage';
const json2csv = require("json2csv").parse;

const SECRET_APIKEY = process.env.SECRET_APIKEY;
const USER_BUCKET = process.env.USER_BUCKET;
const LEADER_USERS_BUCKET = process.env.LEADER_USERS_BUCKET;
const PAST_MATCHES_BUCKET = process.env.PAST_MATCHES_BUCKET;

export async function setLeaderUsers(req, res) {
    console.log("@setLeaderUsers")
    const db = await database().catch(console.error)
    const userCollection = db.collection(`bucket_${USER_BUCKET}`);
    const ypLeaderCollection = db.collection(`bucket_${LEADER_USERS_BUCKET}`);
    const identityCollection = db.collection('identity');
    //New flow start
    // const topUsers = await getMostPointedGameUsers();

    // const userIds = topUsers.map(user => user.user);

    // const leaderUsers = await userCollection.find({
    //     _id: { $in: userIds.map(id => ObjectId(id)) }
    // }).toArray();

    //New flow end

    const leaderUsers = await userCollection.find({ bot: false }).sort({ weekly_point: -1 })
        .limit(10).toArray().catch(console.error)

    const userIdentities = Array.from(leaderUsers, el => ObjectId(el.identity));
    const identitiesData = await identityCollection.find({ _id: { $in: userIdentities } })
        .toArray().catch(console.error);

    const dateFrom = new Date().setDate(new Date().getDate() - 1);
    const leadersData = [];
    leaderUsers.forEach(el => {
        const tempIdentity = identitiesData.find(identity => String(identity._id) == el.identity)
        // const topUser = topUsers.find(x => x.user == String(el._id)); //added 
        leadersData.push({
            msisdn: tempIdentity.attributes.msisdn,
            point: el.weekly_point,//topUser ? topUser.points : 0
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

    return true

}

async function insertToStorage(bufferData, dateFrom) {
    Storage.initialize({ apikey: SECRET_APIKEY });

    const startDate = new Date(dateFrom);
    const endDate = new Date();
    const formattedStartDate = `${startDate.getMonth() + 1}-${startDate.getDate()}-${startDate.getFullYear()}`;
    const formattedEndDate = `${endDate.getMonth() + 1}-${endDate.getDate()}-${endDate.getFullYear()}`;

    const bufferWithMeta = {
        contentType: 'text/csv',
        data: bufferData,
        name: `${formattedStartDate}--${formattedEndDate}`,
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
async function clearUserPoint() {
    console.log("@observer::clearUserPoint");
    const db = await database().catch(err => console.log("ERROR 1", err));
    return db
        .collection(`bucket_${USER_BUCKET}`)
        .updateMany({}, { $set: { weekly_point: 0, weekly_award: 0 } })
        .catch(err => console.log("ERROR 2", err));
}
async function getMostPointedGameUsers() {
    try {
        const db = await database();
        const pastMatchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET}`);
        let date = new Date().setDate(new Date().getDate() - 1);
        let dateFrom = new Date(date).setHours(-3, 0, 0);
        let dateTo = new Date(date).setHours(20, 59, 59);

        const query = {
            start_time: {
                $gte: new Date(dateFrom),
                $lte: new Date(dateTo)
            }
        };

        const topUser1Points = await pastMatchesCollection.find(query)
            .sort({ user1_points: -1 })
            .limit(10)
            .toArray();

        const topUser2Points = await pastMatchesCollection.find({
            ...query,
            player_type: 0
        })
            .sort({ user2_points: -1 })
            .limit(10)
            .toArray();

        const mergedArray = [...topUser1Points, ...topUser2Points].sort((a, b) => {
            const pointsA = a.user1_points !== undefined ? a.user1_points : a.user2_points;
            const pointsB = b.user1_points !== undefined ? b.user1_points : b.user2_points;
            return pointsB - pointsA;
        });

        const top10 = mergedArray.slice(0, 10).map(game => {
            return (game.user1_points > game.user2_points) ?
                { user: game.user1, points: game.user1_points } :
                { user: game.user2, points: game.user2_points };
        });

        return top10;
    } catch (error) {
        console.error("Error fetching top users:", error);
        return;
    }
}