import { database, ObjectId } from "@spica-devkit/database";
import * as Identity from "@spica-devkit/identity";
import axios from "axios";
import convert from "xml-js";
import { DOMParser } from "xmldom";

const SECRET_API_KEY = process.env.SECRET_API_KEY;
const REWARDS_BUCKET_ID = '609669f805b0df002ceb2517';
const BUGGED_REWARDS_BUCKET_ID = '616e7b1a7db15e002d1e2278';
const TRANSACTIONS_BUCKET = process.env.TRANSACTIONS_BUCKET;
const CONFIRMATION_CODE_BUCKET_ID = process.env.CONFIRMATION_CODE_BUCKET_ID;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;

const TCELL_USERNAME = 400026758;
const TCELL_PASSWORD = 400026758;

const CHARGE_AMOUNT = 24;

const MT_VARIANT = 130524;

const CHARGE_VARIANT = 158964;
const CHARGE_OFFER_ID = 501423;

// const HOURLY_1GB_OFFER_ID = 451319;
// const HOURLY_CAMPAIGN_ID = "871137.947568.966245";

const DAILY_1GB_OFFER_ID = 501399;
const DAILY_CAMPAIGN_ID = 1236;

let db;


export async function chargeRequest(req, res) {
    let token = getToken(req.headers.get("authorization"));
    let token_object = await tokenVerified(token);

    if (!token_object) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    let msisdn = token_object.attributes.msisdn;

    let generatedCode = codeGenerate(4);
    const codeData = await getConfirmationCodeByMsisdn(msisdn);

    if (codeData) {
        generatedCode = codeData.code;
    } else {
        await insertConfirmationCode(msisdn, generatedCode);
    }

    sendSms(msisdn, generatedCode)
    // sendSms("5317828001",generatedCode);

    return res.status(200).send({ message: 'Charge request success' });
}

function codeGenerate(length) {
    let result = "";
    let characters = "123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return parseInt(result);
}

export async function sendSms(receiverMsisdn, code) {
    let message = `Sifreniz: ${code}. Kodu ekrana girerek vergiler dahil ${CHARGE_AMOUNT} TL karsiliginda Hedef GB oyunundan Gunluk 1 GB kazanacaksiniz. Oyundaki ilerlemenize göre ek olarak Gunluk 2 GB'a kadar ekstra ödül kazanabilirsiniz. Basarilar! `;
    let shortNumber = 3757;

    const sessionId = await sessionSOAP(MT_VARIANT).catch(err =>
        console.log("ERROR 6", err)
    );

    if (sessionId) {
        let soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
            <soap:Envelope 
            xmlns:mrns0="http://sdp.turkcell.com/mapping/TSO" 
            xmlns:sdp="http://sdp.turkcell.com.tr/mapping/generated"
            xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
            xmlns:xs="http://www.w3.org/2001/XMLSchema">
            <soap:Header>
                <sdp:token>
                    <sdp:sessionId>${sessionId}</sdp:sessionId>
                </sdp:token>
            </soap:Header>
            <soap:Body>
                <sdp:SendSMSInput>
                    <sdp:SHORT_NUMBER>${shortNumber}</sdp:SHORT_NUMBER>
                    <sdp:TO_RECEIVERS>
                        <sdp:msisdn>${receiverMsisdn}</sdp:msisdn>
                    </sdp:TO_RECEIVERS>
                    <sdp:MESSAGE_BODY>
                        <sdp:message>${message}</sdp:message>
                    </sdp:MESSAGE_BODY>
                </sdp:SendSMSInput>
            </soap:Body>
        </soap:Envelope>`;

        return await axios
            .post("https://sdp.turkcell.com.tr/proxy/external/SendMessage", soapEnv, {
                headers: {
                    "Content-Type": "text/xml",
                    soapAction: "http://sdp.turkcell.com.tr/services/action/SendMessage/SendSMS"
                }
            })
            .then(res => {
                let result = JSON.parse(convert.xml2json(res.data, { compact: true, spaces: 4 }));

                updateConfirmationCode(result["S:Envelope"]["S:Body"]["sdp:SendSMSOutput"], receiverMsisdn, code)
                let statusCode =
                    result["S:Envelope"]["S:Body"]["sdp:SendSMSOutput"]["so:TSOresult"][
                    "so:statusCode"
                    ]["_text"];
                if (parseInt(statusCode) == 0) {
                    return true;
                } else {
                    return false;
                }
            })
            .catch(err => {
                console.log("ERROR 7", err);
                return false;
            });
    } else return false; // SESSION ERROR
}

export async function checkSMSCode(req, res) {
    const { shortCode } = req.body;
    if (!db) {
        db = await database().catch(err => console.log("ERROR 30", err));
    }

    let token = getToken(req.headers.get("authorization"));
    let token_object = await tokenVerified(token);

    if (!token_object) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    const confirmationCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);
    let msisdn = token_object.attributes.msisdn;

    const codeData = await confirmationCodeCollection
        .findOne({
            msisdn: msisdn,
            code: Number(shortCode),
            status: false,
            is_expired: false
        }).catch(err => {
            console.log("ERROR 31: ", err);
            return res
                .status(400)
                .send({ status: false, message: "Hata oluştu, daha sonra dene" });
        });

    if (!codeData) {
        return res.status(400).send({ status: false, message: "Yanlış kod girdin" });
    }

    await confirmationCodeCollection.updateOne({ _id: ObjectId(codeData._id) },
        { $set: { status: true, confirmed_date: new Date() } }
    );

    const chargeRes = await charge(msisdn);
    // console.log("chargeRes: ", chargeRes);
    if (!chargeRes.status) {
        return res.status(400).send({ status: false, message: chargeRes.message });
    }

    const flowResult = await successTransaction(msisdn);

    if (!flowResult.status) {
        return res.status(400).send({ status: false, message: flowResult.message });
    }

    return res.status(200).send({ status: true });
}

async function charge(msisdn) {
    const sessionId = await sessionSOAP(CHARGE_VARIANT).catch(err =>
        console.log("ERROR 32", err)
    );

    return offerTransactionSOAP(sessionId, msisdn);
}

async function getConfirmationCodeByMsisdn(msisdn) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }

    const confirmationCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);
    return confirmationCodeCollection
        .findOne({
            msisdn: msisdn,
            status: false,
            is_expired: false
        })
        .catch(err => console.log("ERROR 3", err));
}

async function insertConfirmationCode(msisdn, code) {
    const confirmationCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);
    return confirmationCodeCollection
        .insertOne({
            msisdn: msisdn,
            code: code,
            status: false,
            sent_date: new Date(),
            is_expired: false,
        })
        .catch(err => console.log("ERROR 4", err));
}

async function updateConfirmationCode(result, msisdn, code) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }
    const confirmationCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);
    confirmationCodeCollection.updateOne({
        msisdn: msisdn,
        code: code
    },
        { $set: { result: JSON.stringify(result), result_date: new Date() } })
        .catch(err => console.log("ERROR UPDATE CODE", err));
}

export async function sessionSOAP(variantId) {
    let soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:SPGW">
        <soapenv:Header/>
            <soapenv:Body>
                <urn:createSession>
                    <spId>${TCELL_USERNAME}</spId>
                    <serviceVariantId>${variantId}</serviceVariantId>
                    <password>${TCELL_PASSWORD}</password>
                </urn:createSession>
            </soapenv:Body>
        </soapenv:Envelope>`;

    const response = await axios
        .post("https://sdp.turkcell.com.tr/spgw/services/AuthenticationPort", soapEnv, {
            headers: {
                "Content-Type": "text/xml",
                soapAction: "add"
            }
        })
        .catch(err => {
            console.log("ERROR 8", err);
        });
    if (!response) {
        return false;
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, "text/xml");
    const sessionIdElement = xmlDoc.getElementsByTagName("sessionId")[0];
    let sessionId = sessionIdElement.textContent;

    if (!sessionId) {
        return false;
    }

    return sessionId
}

async function successTransaction(msisdn) {

    const sessionId = await sessionSOAP(CHARGE_VARIANT).catch(err =>
        console.log("ERROR 32", err)
    );

    setAwardSOAP(sessionId, msisdn, DAILY_1GB_OFFER_ID, DAILY_CAMPAIGN_ID, '', 'charge').catch(err => {
        console.log("ERROR 20", err)
        return { status: false, message: "Ödülün yüklenirken bir hata oluştu" };
    });

    return await increaseAvailablePlay(msisdn)
        .then(res => {
            if (res) return { status: true }
            return { status: false, message: "Oyun hakkı eklenirken bir hata oluştu" };
        })
        .catch(err => {
            console.log("ERROR 34: ", err);
            return { status: false, message: "Oyun hakkı eklenirken bir hata oluştu" };
        });
}

export async function setAwardSOAP(sessionID, msisdn, offerId, campaignId, matchId = "", type) {
    // console.log(sessionID, msisdn, offerId, campaignId, matchId ,type);
    if (!db) {
        db = await database().catch(err => console.log("ERROR 27", err));
    }
    let soapEnv = `<soap:Envelope xmlns:soap = "http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header>
        <ns4:token
            xmlns:ns4 = "http://sdp.turkcell.com.tr/mapping/generated"
            xmlns:ns3 = "http://extranet.turkcell.com/ordermanagement/processes/serviceordermanagement/ServiceOrderManagement_v1.0"
            xmlns:ns2 = "http://extranet.turkcell.com/ordermanagement/processes/serviceordermanagement/ServiceOrderManagementTypes">
            <sessionId>${sessionID}</sessionId>
        </ns4:token>
    </soap:Header>
    <soap:Body>
        <ns2:CreateOrderRequest
            xmlns:ns2 = "http://extranet.turkcell.com/ordermanagement/processes/serviceordermanagement/ServiceOrderManagementTypes"
            xmlns:ns3 = "http://extranet.turkcell.com/ordermanagement/processes/serviceordermanagement/ServiceOrderManagement_v1.0"
            xmlns:ns4 = "http://sdp.turkcell.com.tr/mapping/generated">
            <ns2:header>
                <ns2:channelApplication>
                    <ns2:channelId>23</ns2:channelId>
                </ns2:channelApplication>
            </ns2:header>
            <ns2:orderLine>
                <ns2:msisdn>${msisdn}</ns2:msisdn>
                <ns2:orderLineItem>
                    <ns2:offerId>${offerId}</ns2:offerId>
                    <ns2:campaignId>${campaignId}</ns2:campaignId>
                    <ns2:action>1</ns2:action>
                </ns2:orderLineItem>
            </ns2:orderLine>
        </ns2:CreateOrderRequest>
    </soap:Body>
    </soap:Envelope>`;

    return axios
        .post("https://sdp.turkcell.com.tr/proxy/external/ServiceOrderManagement", soapEnv, {
            headers: {
                "Content-Type": "text/xml",
                soapAction:
                    "http://sdp.turkcell.com.tr/services/action/ServiceOrderManagement/createOrder"
            }
        })
        .then(async res => {
            let content = JSON.parse(convert.xml2json(res.data, { compact: true, spaces: 4 }));
            if (!content["S:Envelope"]) {
                console.log("Envelope: ", content["soapenv:Envelope"]["soapenv:Body"]["soapenv:Fault"])
            } else if (content["S:Envelope"]["S:Body"]["ns1:ServiceOrderManagementResponse"]) {
                let result = content["S:Envelope"]["S:Body"]["ns1:ServiceOrderManagementResponse"];
                let status = result["line"]["lineItem"]["businessInteraction"];
                let rewardData = {
                    order_id: parseInt(result["ns1:orderId"]["_text"]),
                    offer_id: parseInt(result["line"]["lineItem"]["offerId"]["_text"]),
                    date: new Date(),
                    error_id: status ? status["error"]["errorId"]["_text"] : "",
                    user_text: status ? status["error"]["userText"]["_text"] : "",
                    status: status ? false : true,
                    result: res.data,
                    match_id: matchId || "",
                    type: type || "",
                    msisdn: result["line"]["identifierForLineOfferId"]["_text"]
                };

                if (rewardData.status) {
                    await db
                        .collection("bucket_" + REWARDS_BUCKET_ID)
                        .insertOne(rewardData)
                        .catch(err => console.log("ERROR 28: ", err));
                } else {
                    await db
                        .collection("bucket_" + BUGGED_REWARDS_BUCKET_ID)
                        .insertOne(rewardData)
                        .catch(err => console.log("ERROR 40: ", err));
                }
            }
            return res.data;
        })
        .catch(err => {
            console.log("ERROR 29", err);
            return err;
        });
}

async function offerTransactionSOAP(sessionID, msisdn) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 9", err));
    }
    let date = new Date();
    let transactionDate = `${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${(
        "0" + date.getDate()
    ).slice(-2)}`;

    let soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gen="http://sdp.turkcell.com.tr/mapping/generated" xmlns:par="http://extranet.turkcell.com/ordermanagement/processes/partnerdisposableservicecharge/PartnerDisposableServiceChargeTypes">
    <soapenv:Header>
        <gen:token>
            <sessionId>${sessionID}</sessionId>
        </gen:token>
    </soapenv:Header>
    <soapenv:Body>
        <par:DisposableServiceCreateOrderRequest>
            <par:header>
                <par:user>
                <par:userName>${TCELL_USERNAME}</par:userName>
                <par:ipAddress>104.197.250.30</par:ipAddress>
                <par:dealer>
                    <par:dealerCode>TTB34.00009</par:dealerCode>
                    <par:subDealerCode>?</par:subDealerCode>
                </par:dealer>
                </par:user>
                <par:channel>
                <par:channelId>23</par:channelId>
                <par:applicationId>514</par:applicationId>
                </par:channel>
                <par:transactionId>7890${transactionDate}0${CHARGE_OFFER_ID}</par:transactionId>
            </par:header>
            <par:customer>
                <par:crmCustomerId>${TCELL_USERNAME}</par:crmCustomerId>
            </par:customer>
            <!--1 or more repetitions:-->
            <par:lineItem>
                <par:msisdn>${msisdn}</par:msisdn>
                <par:offerId>${CHARGE_OFFER_ID}</par:offerId>
            </par:lineItem>
            <par:synchronize>true</par:synchronize>
        </par:DisposableServiceCreateOrderRequest>
    </soapenv:Body>
    </soapenv:Envelope>`;

    return axios
        .post(
            "https://sdp.turkcell.com.tr/proxy/external/partnerdisposableservicecharge",
            soapEnv,
            {
                headers: {
                    "Content-Type": "text/xml",
                    soapAction:
                        "http://sdp.turkcell.com.tr/services/action/PartnerChargeService/createOrder"
                }
            }
        )
        .then(async res => {
            let content = JSON.parse(convert.xml2json(res.data, { compact: true, spaces: 4 }));

            if (content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"]) {
                let result =
                    content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"];
                let status = result["line"]["businessInteraction"];

                let chargeData = {
                    order_id: parseInt(result["ns1:orderId"]["_text"]),
                    date: new Date(),
                    user_text: status ? status["error"]["userText"]["_text"] : "",
                    status: status ? false : true,
                    result: res.data,
                    msisdn: result["line"]["msisdn"]["_text"],
                };

                await db
                    .collection(`bucket_${TRANSACTIONS_BUCKET}`)
                    .insertOne(chargeData)
                    .catch(err => console.log("ERROR 10", err));

            }

            if (!content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"]) {
                console.log("ERROR CONTENT", content["S:Envelope"]["S:Body"]["S:Fault"]);
                return { status: false, message: "Hata oluştu, daha sonra dene1 " };
            }

            let isContinue =
                content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"]["line"][
                "continue"
                ]["_text"];
            if (isContinue == "true") {
                return { status: true, message: "OK" };
            } else {
                if (
                    content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"][
                    "line"
                    ]["businessInteraction"]["error"]["userText"]["_text"]
                ) {
                    return {
                        status: false,
                        message:
                            content["S:Envelope"]["S:Body"][
                            "ns1:DisposableServiceCreateOrderResponse"
                            ]["line"]["businessInteraction"]["error"]["userText"]["_text"]
                    };
                } else {
                    return { status: false, message: "Hata oluştu, daha sonra dene2 " };
                }
            }
        })
        .catch(err => {
            console.log("ERROR 11", err);
            return {
                status: false,
                message: "Hata oluştu. Ayarlar sayfasından bize ulaşabilirsin"
            };
        });
}

export async function applyRewardManually(change) {
    const sessionId = await sessionSOAP(CHARGE_VARIANT).catch(err =>
        console.log("ERROR 35", err)
    );
    let result;
    let matchID = "";

    if (!db) {
        db = await database().catch(err => console.log("ERROR 38", err));
    }
    if (change.current.retry_id) {
        let rewardsCollection = db.collection("bucket_" + BUGGED_REWARDS_BUCKET_ID);
        matchID = await rewardsCollection
            .find({
                _id: ObjectId(change.current.retry_id)
            })
            .toArray()
            .catch(err => console.log(err));
        matchID = matchID[0].match_id;
    }
    if (change.current.reward == "daily_1") {
        result = await setAwardSOAP(
            sessionId,
            change.current.msisdn,
            DAILY_1GB_OFFER_ID,
            DAILY_CAMPAIGN_ID,
            matchID,
            'manual'
        ).catch(err => console.log("ERROR 36", err));
    }
    // else if (change.current.reward == "hourly_1") {
    //     result = await setAwardSOAP(
    //         sessionId,
    //         change.current.msisdn,
    //         HOURLY_1GB_OFFER_ID,
    //         HOURLY_CAMPAIGN_ID,
    //         matchID,
    //         'manual'
    //     ).catch(err => console.log("ERROR 37", err));
    // }

    let manuallyRewardsCollection = db.collection("bucket_" + change.bucket);
    await manuallyRewardsCollection
        .updateOne(
            { _id: ObjectId(change.documentKey) },
            { $set: { result: result, process_completed: true } }
        )
        .catch(err => console.log("ERROR 39", err));
}

async function increaseAvailablePlay(msisdn) {
    Identity.initialize({ apikey: `${SECRET_API_KEY}` });
    const identity = await Identity.getAll({
        filter: { "attributes.msisdn": String(msisdn) }
    }).catch(err => console.log("ERROR 12", err));

    if (!db) {
        db = await database().catch(err => console.log("ERROR 13", err));
    }
    const usersCollection = db.collection(`bucket_${USER_BUCKET_ID}`);

    return usersCollection
        .findOne({ identity: identity[0]._id })
        .then(user => {
            let available_play = user.available_play_count
                ? Number(user.available_play_count) + 1
                : 1;
            return usersCollection
                .findOneAndUpdate(
                    { _id: ObjectId(user._id) },
                    {
                        $set: { available_play_count: available_play }
                    }
                )
                .then(res => {
                    return true;
                })
                .catch(err => {
                    console.log("ERROR update available_play_count: ", err);
                    return false;
                });
        })
        .catch(err => {
            console.log(`Error: ${err}`);
            return false;
        });
}

async function getUserMsisdn(user) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 22", err));
    }
    Identity.initialize({ apikey: `${SECRET_API_KEY}` });

    const usersCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    const identityCollection = db.collection(`identity`);

    const userData = await usersCollection
        .findOne({ _id: ObjectId(user) })
        .catch(err => console.log("ERROR 23: ", err));


    const userIdentity = await identityCollection
        .findOne({ _id: ObjectId(userData.identity) })
        .catch(err => console.log("ERROR 25 ", err));

    const msisdn = userIdentity.attributes.msisdn

    return msisdn;
}
async function setAward(msisdn, userFree, matchId) {
    const sessionId = await sessionSOAP(CHARGE_VARIANT).catch(err =>
        console.log("ERROR 15", err)
    );
    if (sessionId) {
        if (userFree) { // Free gameplay flow
            console.log("@FreeUserReward");
            await setAwardSOAP(
                sessionId,
                msisdn,
                DAILY_1GB_OFFER_ID,
                DAILY_CAMPAIGN_ID,
                matchId,
                'freeMatchPlay'
            ).catch(err => console.log("ERROR 16", err));
        }
        // winner award
        else {
            await setAwardSOAP(
                sessionId,
                msisdn,
                DAILY_1GB_OFFER_ID,
                DAILY_CAMPAIGN_ID,
                matchId,
                'match'
            ).catch(err => console.log("ERROR 17", err));
        }
        return true;
    } else return false;
}

// -----HELPER FUNCTION-----
function getToken(token) {
    if (token) {
        token = token.split(" ")[1];
    } else {
        token = "";
    }

    return token;
}

async function tokenVerified(token) {
    Identity.initialize({ apikey: SECRET_API_KEY });
    return Identity.verifyToken(token)
}

export async function singlePlayMatchReward(change) {
    const match = change.document;
    if (match.arrow_count < 10) return;
    const msisdn = await getUserMsisdn(match.user);

    const number = match.arrow_count >= 20 ? 2 : 1;

    awardHandler(msisdn, match.user_is_free, match.duel_id, number);
    return;
}

async function awardHandler(msisdn, userFree, duelId, number) {
    // const mockMsisdn = '5317828001'
    // for (let i = 0; i < number; i++) {
    //     console.log("setAward!");
    //     await setAward(mockMsisdn, userFree, duelId);
    //     await new Promise(resolve => setTimeout(resolve, 1000));
    // }
    await setAward(msisdn, userFree, duelId);
    if (number == 1) return;

    await new Promise(resolve => setTimeout(resolve, 1000));
    await setAward(msisdn, userFree, duelId);

    return;
}

