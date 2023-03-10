import { database, ObjectId } from "@spica-devkit/database";
import fetch from 'node-fetch';
const crypto = require("crypto");

const DRAW_LOGS_BUCKET = process.env.DRAW_LOGS_BUCKET;
const OFFER_ID = 4689;

let db;

export async function sendChargeRequest(change) {
    let target = change.document;

    if (target.status) {
        let point = 50;

        if (target.type == 'first') {
            point = 100;
        }

        let obj = {
            "Service": "GNÇ Yılan",
            "OfferId": OFFER_ID,
            "Action": "Payment",
            "Msisdn": target.msisdn,
            "ChargeId": target._id,
            "Point": point,
            "ChargeDate": target.date
        }

        sendDrawData(obj)
    }
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
        await fetch("https://api.dnatech.io/v1/Action", {
            method: "post",
            body: JSON.stringify({
                ...body
            }),
            headers: { "Content-Type": "application/json", "Authorization": hash }
        })
            .then(resTcell => resTcell.json())
            .then(data => {
                response = data
            })
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