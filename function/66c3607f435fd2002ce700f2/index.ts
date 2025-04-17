
import * as Api from "../../66c35126435fd2002ce680c4/.build";

const SINGLEPLAY_SERVERS_INFO_BUCKET = process.env.SINGLEPLAY_SERVERS_INFO_BUCKET;



export async function assignDuel(req, res) {
    const { referenceNo, duelId, duelData, tokens, serverName } = req.body;
    //Old Flow (Google Match instances)
    // const isAssigned = await Api.getOne(SINGLEPLAY_SERVERS_INFO_BUCKET, { reference_no: referenceNo });
    // if (isAssigned) {
    //     return res.status(200).send({ canContinue: false })
    // }
    try {
        await insertServerInfo(duelData, duelId, tokens, referenceNo, serverName)
        return res.status(200).send({ canContinue: true })
    } catch (err) {
        console.log("AssignDuel False")
        return res.status(200).send({ canContinue: false })
    }
}
function insertServerInfo(duelData, duelId, tokens, referenceNo, serverName) {
    let insertedObj = {
        duel_id: duelId,
        match_server: serverName,
        user: duelData["user"],
        user_token: tokens[0],
        created_at: new Date(),
        reference_no: referenceNo
    };
    return Api.insertOneAssignDuel(SINGLEPLAY_SERVERS_INFO_BUCKET, insertedObj)
}