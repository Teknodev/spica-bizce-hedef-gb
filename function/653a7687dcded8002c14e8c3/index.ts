import { database, ObjectId } from "@spica-devkit/database";
import * as Bucket from "@spica-devkit/bucket";
import fetch from 'node-fetch';

const USER_BUCKET = process.env.USER_BUCKET;
const SECRET_API_KEY = process.env.SECRET_API_KEY;
const PAST_MATCHES_BUCKET = process.env.PAST_MATCHES_BUCKET;
const CHARGE_LOGS_BUCKET = process.env.CHARGE_LOGS_BUCKET;

const CHARGE_AMOUNT = "25";


export async function onInsertedMatch(changed) {
    console.log("PastMatch!")
    Bucket.initialize({ apikey: `${SECRET_API_KEY}` });
    const document = changed.document;
    const usersIds = [document.user1]

    if (document.player_type == 0) {
        usersIds.push(document.user2)
    }

    const usersData = await getMsisdnsByUsersIds(usersIds);

    let isSuccess = true;
    let response = '';
    let bodyData = '';
    for (const userData of usersData.entries()) {
        bodyData = {
            "submitTime": Date.now(),
            "msisdn": userData.msisdn,
            "action": "played",
            "chargedAmount": "",
            "chargedProduct": "",
            "game": "zipzip",
            "channel": "hediye-havuzu"
        }
        response = await sendMarketingServiceData(bodyData);

        if (!response || response.body != 'Success') {
            isSuccess = false;
        }
    }

    await Bucket.data.patch(PAST_MATCHES_BUCKET, document._id, { is_success: isSuccess, marketing_response: JSON.stringify(response), marketing_request: JSON.stringify(bodyData) }).catch((e) => { console.log('PAST_MATCH'); console.log(e) })
}
export async function kafkaMatchesDataSender(req, res) {
    try {

        const db = await database().catch(console.error);
        Bucket.initialize({ apikey: `${SECRET_API_KEY}` });
        const matchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET}`);
        const currentTime = new Date();
        currentTime.setHours(currentTime.getHours());
        const dateFilter = {
            $gte: new Date(currentTime.getTime() - 5 * 60 * 1000),
            $lte: new Date(currentTime)
        }
        const pastMatches = await matchesCollection.find({
            end_time: dateFilter
        }).toArray();

        for (const data of pastMatches) {
            if (data.user1_is_free || (data.player_type === 0 && data.user2_is_free)) {
                continue;
            } else {
                const usersIds = [data.user1, ...(data.player_type === 0 ? [data.user2] : [])];
                const usersData = await getMsisdnsByUsersIds(usersIds);

                for (const userData of usersData) {
                    const bodyData = {
                        "submitTime": Date.now(),
                        "msisdn": userData.msisdn,
                        "action": "played",
                        "chargedAmount": "",
                        "chargedProduct": "",
                        "game": "ZıpZıp",
                        "channel": "hediye-havuzu"
                    };
                    const response = await sendMarketingServiceData(bodyData);
                    const isSuccess = !!(response && response.body === 'Success');

                    await Bucket.data.patch(PAST_MATCHES_BUCKET, data._id, {
                        is_success: isSuccess,
                        marketing_response: JSON.stringify(response),
                        marketing_request: JSON.stringify(bodyData)
                    }).catch((e) => {
                        console.log('PAST_MATCH');
                        console.log(e);
                    });
                }
            }
        }

    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
}
export async function kafkaChargesDataSender(req, res) {
    try {

        const db = await database().catch(console.error);
        Bucket.initialize({ apikey: `${SECRET_API_KEY}` });
        const chargesCollection = db.collection(`bucket_${CHARGE_LOGS_BUCKET}`);
        const currentTime = new Date();
        currentTime.setHours(currentTime.getHours());
        const dateFilter = {
            $gte: new Date(currentTime.getTime() - 5 * 60 * 1000),
            $lte: new Date(currentTime)
        }
        const pastCharges = await chargesCollection.find({
            date: dateFilter,
            status: true
        }).toArray();

        for (const data of pastCharges) {
            const bodyData = {
                "submitTime": Date.now(),
                "msisdn": data.msisdn.substring(2),
                "action": "charged",
                "chargedAmount": CHARGE_AMOUNT,
                "chargedProduct": "",
                "game": "ZıpZıp",
                "channel": "hediye-havuzu"
            };
            const response = await sendMarketingServiceData(bodyData);
            const isSuccess = !!(response && response.body === 'Success');

            await Bucket.data.patch(CHARGE_LOGS_BUCKET, data._id, {
                is_success: isSuccess,
                marketing_response: JSON.stringify(response),
                marketing_request: JSON.stringify(bodyData)
            }).catch((e) => {
                console.log('PAST_MATCH');
                console.log(e);
            });

        }
        
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
}

export async function onInsertedCharge(changed) {

    Bucket.initialize({ apikey: `${SECRET_API_KEY}` });
    const document = changed.document;
    console.log("document: ", document._id);
    if (!document.status) {
        return;
    }

    let isSuccess = true;
    const bodyData = {
        "submitTime": Date.now(),
        "msisdn": document.msisdn.substring(2),
        "action": "charged",
        "chargedAmount": CHARGE_AMOUNT,
        "chargedProduct": "",
        "game": "zipzip",
        "channel": "hediye-havuzu"
    }

    const response = await sendMarketingServiceData(bodyData);

    if (!response || response.body != 'Success') {
        isSuccess = false;
    }

    await Bucket.data.patch(CHARGE_LOGS_BUCKET, document._id, { is_success: isSuccess, marketing_response: JSON.stringify(response), marketing_request: JSON.stringify(bodyData) }).catch((e) => { console.log('CHARGE'); console.log(e) })
}

async function getMsisdnsByUsersIds(usersIds) {
    const usersData = [];
    const db = await database().catch(console.error);
    const userCollection = db.collection(`bucket_${USER_BUCKET}`);
    const identityCollection = db.collection(`identity`);

    for (const userId of usersIds) {
        const tempUser = await userCollection.findOne({ _id: ObjectId(userId) }).catch(console.error);
        if (tempUser) {
            const identityData = await identityCollection.findOne({ _id: ObjectId(tempUser.identity) });
            if (identityData) {
                usersData.push({
                    user_id: userId,
                    msisdn: identityData.attributes.msisdn
                })
            }
        }
    }

    return usersData;
}

async function sendMarketingServiceData(bodyData) {
    let response;
    try {
        await fetch("https://marketingservices.turkcell.com.tr/marketingServices/rest/GenericKafka/produce?topic=poly", {
            method: "post",
            body: JSON.stringify({
                ...bodyData
            }),
            headers: { "Content-Type": "application/json" }
        })
            .then(resTcell => resTcell.json())
            .then(data => { response = data })
    } catch (err) {
        console.log("ERROR : ", err)
        response = err
    }

    return response;
}

