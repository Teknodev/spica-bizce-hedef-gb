import { database, ObjectId } from "@spica-devkit/database";
import * as Bucket from "@spica-devkit/bucket";
import fetch from 'node-fetch';

const USER_BUCKET = process.env.USER_BUCKET;
const SECRET_API_KEY = process.env.SECRET_API_KEY;
const PAST_MATCHES_BUCKET = process.env.PAST_MATCHES_BUCKET;
const CHARGE_LOGS_BUCKET = process.env.CHARGE_LOGS_BUCKET;

export async function onInsertedMatch(changed) {
    const document = changed.document;
    const usersIds = [document.user1]

    if (document.player_type == 0) {
        usersIds.push(document.user2)
    }

    const usersData = await getMsisdnsByUsersIds(usersIds);

    let isSuccess = true;
    for (const [index, userData] of usersData.entries()) {
        const bodyData = {
            "submitTime": Date.now(),
            "msisdn": userData.msisdn.substring(2),
            "action": document[`user${index + 1}_second_match`] ? 'played_consecutive' : "played",
            "chargedAmount": "",
            "chargedProduct": ""
        }
        const response = await sendMarketingServiceData(bodyData);
        if (!response || response.body != 'Success') {
            isSuccess = false;
        }
    }

    if (isSuccess) {
        const db = await database().catch(console.error);
        const pastMatchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET}`);
        pastMatchesCollection.updateOne(
            { _id: ObjectId(document._id) },
            { $set: { is_success: true } }
        ).catch(console.error)
    }
}

export async function onChargeUpdated(changed) {
    Bucket.initialize({ apikey: `${SECRET_API_KEY}` });
    const document = changed.document;
    const keys = Object.keys(changed.updateDescription.updatedFields);

    if (!document.status || !document.item_id || !keys || !keys.includes('status')) {
        return;
    }

    let isSuccess = true;
    const bodyData = {
        "submitTime": Date.now(),
        "msisdn": document.msisdn.substring(2),
        "action": "charged",
        "chargedAmount": document.item_id == 261083 ? '3.99' : '5.99',
        "chargedProduct": String(document.item_id)
    }

    const response = await sendMarketingServiceData(bodyData);
    if (!response || response.body != 'Success') {
        isSuccess = false;
    }

    if (isSuccess) {
        Bucket.data.patch(CHARGE_LOGS_BUCKET, String(document._id), { is_success: true }).catch(console.error)
    }
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