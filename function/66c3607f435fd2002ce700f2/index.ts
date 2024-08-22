
import * as Api from "../../66c35126435fd2002ce680c4/.build";

const SINGLEPLAY_SERVERS_INFO_BUCKET = process.env.SINGLEPLAY_SERVERS_INFO_BUCKET;



export async function assignDuel(req, res) {
    const { referenceNo, duelId, duelData, tokens, serverName } = req.body;
    // console.log("DUEL DATA::", duelData)
    const isAssigned = await Api.getOne(SINGLEPLAY_SERVERS_INFO_BUCKET, { reference_no: referenceNo });
    if (isAssigned) {
        return res.status(200).send({ canContinue: false })
    }

    try {
        await insertServerInfo(duelData, duelId, tokens, referenceNo, serverName)
        // console.log("AssignDuel True")
        return res.status(200).send({ canContinue: true })
    } catch (err) {
        // console.log("AssignDuel False")
        return res.status(200).send({ canContinue: false })
    }
}
function insertServerInfo(duelData, duelId, tokens, referenceNo, serverName) {
    // console.log("duelData :: ", duelData)
    let insertedObj = {
        duel_id: duelId,
        match_server: serverName,
        user: duelData["user"],
        user_token: tokens[0],
        created_at: new Date(),
        reference_no: referenceNo
    };

    // const insertedObj = {
    //     duel_id: duelId,
    //     match_server: serverName,
    //     user1: duelData["user1"],
    //     user1_token: tokens[0],
    //     user2: duelData["user2"],
    //     user2_token: tokens[1] || "",
    //     available_to_user_1: true,
    //     available_to_user_2: true,
    //     created_at: new Date(),
    //     user1_ready: false,
    //     user2_ready: tokens[1] ? false : true,
    //     reference_no: referenceNo
    // };

    return Api.insertOne(SINGLEPLAY_SERVERS_INFO_BUCKET, insertedObj)
}