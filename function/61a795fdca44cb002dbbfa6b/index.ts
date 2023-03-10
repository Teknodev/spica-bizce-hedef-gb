import { database, ObjectId } from "@spica-devkit/database";
import * as Identity from "@spica-devkit/identity";
const axios = require("axios");
const jsdom = require("jsdom");
var convert = require("xml-js");

const SECRET_API_KEY = process.env.SECRET_API_KEY;
const REWARDS_BUCKET_ID = process.env.REWARDS_BUCKET_ID;
const BUGGED_REWARDS_BUCKET_ID = process.env.BUGGED_REWARDS_BUCKET_ID;
const TRANSACTIONS_BUCKET = process.env.TRANSACTIONS_BUCKET;
const CONFIRMATION_CODE_BUCKET_ID = process.env.CONFIRMATION_CODE_BUCKET_ID;

const TCELL_USERNAME = 400026758;
const TCELL_PASSWORD = 400026758;

const SMS_VARIANT_ID = 130524;
// 7 TL charging bilgileri: CPCM offer id: 457412, Variant id: 132985
// 5 TL charging bilgileri: CPCM offer id: 453036, Variant id: 130522
const PRODUCT_DAILY_FIRST = 457412;
const PRODUCT_DAILY_SECOND = 453036;

const CHARGE_AMOUNT_FIRST = 9;
const CHARGE_AMOUNT_SECOND = 7;

const VARIANT_ID_FIRST = 132985;
const VARIANT_ID_SECOND = 130522;

const CAMPAIGN_ID = "871137.947567.966243";
const OFFER_ID_1GB = 451318;


let db;


export async function chargeRequest(req, res) {
    const { product } = req.body

    if (!product) {
        return res.status(400).send({ message: "Product cannot be empty." });
    }

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
        await insertConfirmationCode(msisdn, generatedCode, product);
    }

    let offerId = PRODUCT_DAILY_FIRST;

    if (product == 'second') {
        offerId = PRODUCT_DAILY_SECOND;
    }

    sendSms(msisdn, generatedCode, offerId)

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

export async function sendSms(receiverMsisdn, code, product) {
    let amount = CHARGE_AMOUNT_FIRST;

    if (product == PRODUCT_DAILY_SECOND) {
        amount = CHARGE_AMOUNT_SECOND;
    }

    let message = `Sifreniz: ${code}. Kodu ekrana girerek vergiler dahil ${amount} TL karsiliginda GNC Retro Yilan oyunundan Gunluk 1 GB kazanacaksiniz!`;
    let shortNumber = 3757;

    const sessionId = await sessionSOAP(SMS_VARIANT_ID).catch(err =>
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

                updateConfirmationCode(result["env:Envelope"]["env:Body"]["sdp:SendSMSOutput"], receiverMsisdn, code)
                let statusCode =
                    result["env:Envelope"]["env:Body"]["sdp:SendSMSOutput"]["so:TSOresult"][
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

    let variantId = VARIANT_ID_SECOND;
    let productId = PRODUCT_DAILY_SECOND

    if (codeData.type == 'first') {
        variantId = VARIANT_ID_FIRST;
        productId = PRODUCT_DAILY_FIRST;
    }

    const chargeRes = await charge(msisdn, variantId, productId);

    if (!chargeRes.status) {
        return res.status(400).send({ status: false, message: chargeRes.message });

    }

    successTransaction(msisdn, codeData.type)
    return res.status(200).send({ status: true });
}

async function charge(msisdn, variantId, productId) {
    const sessionId = await sessionSOAP(variantId).catch(err =>
        console.log("ERROR 32", err)
    );
    return offerTransactionSOAP(sessionId, msisdn, productId)
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

async function insertConfirmationCode(msisdn, code, type) {
    const confirmationCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);
    return confirmationCodeCollection
        .insertOne({
            msisdn: msisdn,
            code: code,
            status: false,
            sent_date: new Date(),
            is_expired: false,
            type: type
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

async function sessionSOAP(variantId) {
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

    let dom = new jsdom.JSDOM(response.data);
    let sessionId = dom.window.document.querySelector("sessionId").textContent;


    if (!sessionId) {
        return false;
    }

    return sessionId
}

async function successTransaction(msisdn, type) {
    let variantId = VARIANT_ID_SECOND;
    if (type == 'first') {
        variantId = VARIANT_ID_FIRST;
    }

    const sessionId = await sessionSOAP(variantId).catch(err =>
        console.log("ERROR 32", err)
    );

    setAwardSOAP(sessionId, msisdn, OFFER_ID_1GB, CAMPAIGN_ID).catch(err =>
        console.log("ERROR 20", err)
    );
}

async function setAwardSOAP(sessionID, msisdn, offerId, campaignId, matchId = "") {
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
            } else if(content["S:Envelope"]["S:Body"]["ns1:ServiceOrderManagementResponse"]) {
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
            // console.log("ERROR 29", err);
            return err;
        });
}

async function offerTransactionSOAP(sessionID, msisdn, offerId) {
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
                <par:transactionId>7890${transactionDate}0${offerId}</par:transactionId>
            </par:header>
            <par:customer>
                <par:crmCustomerId>${TCELL_USERNAME}</par:crmCustomerId>
            </par:customer>
            <!--1 or more repetitions:-->
            <par:lineItem>
                <par:msisdn>${msisdn}</par:msisdn>
                <par:offerId>${offerId}</par:offerId>
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
                    type: offerId == PRODUCT_DAILY_FIRST ? 'first' : 'second'
                };

                await db
                    .collection(`bucket_${TRANSACTIONS_BUCKET}`)
                    .insertOne(chargeData)
                    .catch(err => console.log("ERROR 10", err));
            }

            if (!content["S:Envelope"]["S:Body"]["ns1:DisposableServiceCreateOrderResponse"]) {
                console.log("ERROR CONTENT", content["S:Envelope"]["S:Body"]["S:Fault"]);
                return { status: false, message: "Hata oluştu, daha sonra dene " };
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
                    return { status: false, message: "Hata oluştu, daha sonra dene " };
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
    const sessionId = await sessionSOAP(VARIANT_ID_FIRST).catch(err =>
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
            OFFER_ID_1GB,
            CAMPAIGN_ID,
            matchID
        ).catch(err => console.log("ERROR 36", err));
    }

    let manuallyRewardsCollection = db.collection("bucket_" + change.bucket);
    await manuallyRewardsCollection
        .updateOne(
            { _id: ObjectId(change.documentKey) },
            { $set: { result: result, process_completed: true } }
        )
        .catch(err => console.log("ERROR 39", err));
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

// export async function testManuallyReqard(req, res) {
//     const sessionId = await sessionSOAP(158963).catch(err =>
//         console.log("ERROR 32", err)
//     );

//     await setAwardSOAP(sessionId, '5317828001', 501400, 1236).catch(err =>
//         console.log("ERROR 20", err)
//     );

//     //  const sessionId = await sessionSOAP(variantId).catch(err =>
//     //     console.log("ERROR 32", err)
//     // );
//     // await offerTransactionSOAP(sessionId, '5317828001', 501423)

//     return res.status(200).send({ message: 'ok' })
// }