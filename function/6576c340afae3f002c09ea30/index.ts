import { database, ObjectId } from "@spica-devkit/database";
import * as Bucket from "@spica-devkit/bucket"

import fetch from 'node-fetch';
const crypto = require("crypto");
import axios from 'axios';

const DRAW_LOGS_BUCKET = process.env.DRAW_LOGS_BUCKET;
const GAME_LEAGUE_PARTICIPANTS_BUCKET = process.env.GAME_LEAGUE_PARTICIPANTS_BUCKET;
const TCELL_ADMIN_APIKEY = "fd5m19kpi9cn0e";
const TCELL_ADMIN_URL = "https://tcell-admin-3c220.hq.spicaengine.com/api/";
const TCELL_ADMIN_TVPLUS_CHARGE = "66b9fa1375cec4002c76db8d"

const OFFER_ID = 5818;
const CHARGE_BUCKET = process.env.CHARGE_BUCKET;
const SERVICE_KEY = "e2b50ca4-068a-4dfe-b763-2abbb92a1d99";

let db;

export async function onCharged(change) {
    let target = change.document;

    if (!target.status) return;


    const { data } = await axios.post(`https://tcell-admin-3c220.hq.spicaengine.com/api/fn-execute/getParticipantGameLeague`, {
        "service": "turkcell-doodle-jump-3a662",
        "msisdn": target.msisdn,
        "action": "data"
    });

    if (!data || !data.participant) return;

    target.msisdn = target.msisdn.slice(2);
    let obj = {
        "OfferId": OFFER_ID,
        "Action": "Payment",
        "Msisdn": target.msisdn,
        "UserId": data.participant.user,
        "Name": data.participant.name,
        "Surname": data.participant.surname,
        "Date": target.date,
        "Address": data.participant.address,
        "City": data.participant.city,
        "DateOfBirth": data.participant.date_of_birth,
        "Game": "Zıpzıp", // 3762 + 5162
        "Point": 1,
    }

    sendDrawData(obj)
    return;
}

async function sendDrawData(body) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 3", err));
    }

    const drawLogsCollection = db.collection(`bucket_${DRAW_LOGS_BUCKET}`);

    const SHARED_SECRET = 'GYh7fU+2@yseY+!7!B5xsq_!Fftf7bYJ';
    let jsonData = {
        "ApiClientKey": "P8NYyNKeMHf9SVxVGZ5G2RFkeyB64H7Y",
        "ApiClientSecret": "J7vqVT2s6fxPmYJA8qyRYaSRysr4kazs",
        "Timestamp": Math.floor((new Date().getTime() / 1000))
    }

    let hash = encryptAESGCM(SHARED_SECRET, jsonData)


    let response;
    try {
        await fetch("https://api.dnatech.io/v1/Code", {
            method: "post",
            body: JSON.stringify({
                ...body
            }),
            headers: { "Content-Type": "application/json", "Authorization": hash }
        })
            .then(resTcell => resTcell.json())
            .then(data => { response = data })
    } catch (err) {
        console.log("ERROR : ", err)
        response = err
    }

    drawLogsCollection.insertOne({
        msisdn: body.Msisdn,
        body: JSON.stringify(body),
        response: JSON.stringify(response),
        date: new Date()
    })

    return true
}

function encryptAESGCM(key, message) {
    message = JSON.stringify(message);
    try {
        if (key.length != 32)
            throw new Error("invalid key, must be 32 char");

        const IV = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, IV);
        let encrypted = cipher.update(message, "utf8", "hex");
        encrypted += cipher.final("hex");
        const tag = cipher.getAuthTag();
        return tobase64(
            tobuffer(IV.toString("hex") + encrypted + tag.toString("hex"))
        );
    } catch (ex) {
        console.error(ex);
    }
}

function tobuffer(str) {
    str = str.replace(/^0x/, "");
    if (str.length % 2 != 0) {
        console.log(
            "WARNING: expecting an even number of characters in the string"
        );
    }
    var bad = str.match(/[G-Z\s]/i);
    if (bad) {
        console.log("WARNING: found non-hex characters", bad);
    }
    var pairs = str.match(/[\dA-F]{2}/gi);
    var integers = pairs.map(function (s) {
        return parseInt(s, 16);
    });
    var array = new Uint8Array(integers);
    var props = new Uint8Array([16, 16]);
    var response = Buffer.concat([props, array]);
    return response;
};

function tobase64(str) {
    return Buffer.from(str, "utf8").toString("base64");
};

// Get all charges of all services --> This will work after insertFormData
export async function getAllChargesAndSendData(msisdn, userData) {
    // !TODO - you should change gameLeagueStartDate date with real date (real date: 2023-08-20T21:00:00.351Z)
    const gameLeagueStartDate = "2023-12-11T21:00:00.351Z";
    const gameLeagueEndDate = "2024-01-17T21:59:59.351Z";

    const { data } = await axios.post(`https://tcell-admin-3c220.hq.spicaengine.com/api/fn-execute/gameLeagueService`, {
        "msisdn": msisdn,
        "dateFrom": gameLeagueStartDate,
        "dateUntil": gameLeagueEndDate,
    });

    if (!data) return;

    for (const item of data) {
        let obj = {
            "OfferId": OFFER_ID,
            "Action": "Payment",
            "Msisdn": msisdn,
            "UserId": String(userData.user),
            "Name": userData.name,
            "Surname": userData.surname,
            "Date": item.date,
            "Address": userData.address,
            "City": userData.city,
            "DateOfBirth": userData.date_of_birth,
            "Game": item.service,
            "Point": 1,
        }


        await sendDrawData(obj);
    }
}
//Insert the datas of user who applied to Game League
export async function insertFormData(req, res) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }
    const gameLeagueParticipantsCollection = db.collection(`bucket_${GAME_LEAGUE_PARTICIPANTS_BUCKET}`);

    const { data, userId } = req.body;
    if (!data) return;
    const user = await gameLeagueParticipantsCollection.findOne({
        msisdn: data.msisdn
    });
    if (user) {
        console.log("user: ", user);
        return;
    }
    try {
        const participantData = {
            user: ObjectId(userId),
            address: data.address,
            date_of_birth: data.date_of_birth,
            msisdn: data.msisdn,
            name: data.name,
            surname: data.surname,
            city: data.city,
            created_at: new Date(),
        }
        // Insert the data into the database
        await gameLeagueParticipantsCollection.insertOne(participantData);
        //Get all the charges before this until the Game League start date
        getAllChargesAndSendData(data.msisdn, participantData)
        return res.status(200).send({ message: "Data inserted successfully." });

    } catch (error) {
        console.log("Error inserting data: ", error);
        return res.status(400).send({ message: "Failed to insert data." });
    }
}
//Check participant exist in this game 
export async function getLeagueParticipantData(req, res) {
    let servicekey = req.headers.get("servicekey");

    if (SERVICE_KEY != servicekey) {
        return res.status(400).send({ message: 'Forbiden' })
    }

    const msisdn = req.params.get("msisdn");

    if (!db) {
        db = await database().catch(err => console.log("ERROR 3", err));
    }

    const participantsCollection = db.collection(`bucket_${GAME_LEAGUE_PARTICIPANTS_BUCKET}`);
    const participant = await participantsCollection.findOne({ msisdn }).catch(console.error)

    return res.status(200).send({ participant })

}
//Tcell admin request handler function
//Get the charges of user who applied in other game 
export async function getChargesByMsisdn(req, res) {
    let { msisdn, dateFrom, dateUntil } = req.body;
    let servicekey = req.headers.get("servicekey");
    if (SERVICE_KEY != servicekey) {
        return res.status(400).send({ message: 'Forbiden' })
    }

    if (!db) {
        db = await database().catch(err => console.log("ERROR 3", err));
    }
    if (!msisdn.startsWith('90')) msisdn = `90${msisdn}`
    const chargeCollection = db.collection(`bucket_${CHARGE_BUCKET}`);
    const charges = await chargeCollection.find({
        msisdn,
        status: true,
        date: {
            $gte: new Date(dateFrom),
            $lte: new Date(dateUntil),
        }
    }).toArray().catch(console.error)

    const data = [];
    charges.forEach(x => {
        data.push({ service: 'Zıpla Kazan', date: x.date })
    })
    return res.status(200).send(data)
}

export async function onChargedTvPlus(change) {
    let target = change.document;
    if (!target.status) return;
    const msisdn = target.msisdn.substr(2)

    Bucket.initialize({ apikey: TCELL_ADMIN_APIKEY, publicUrl: TCELL_ADMIN_URL })
    await Bucket.data.insert(TCELL_ADMIN_TVPLUS_CHARGE, { msisdn, game: "zip_zip", date: new Date() }).catch(err => {
        err.message == "Value of the property .msisdn should unique across all documents." ? console.log("msisdn exists", msisdn) : console.error(err)
    })
    return;
}