import { database, ObjectId } from "@spica-devkit/database";


const USER_BUCKET_ID = "605c9480e9960e002c278191";

let db;


export async function registerV2(req, res) {
    if (!db) db = await database().catch(err => console.log("ERROR 3", err));
    const { identity, name, avatar_id } = req.body;
    // console.log("registerV2",name)

    const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);

    if (!name) return res.status(400).send({ message: "Name or url is not defined." });
    
    let user = await users_collection
        .findOne({ identity: identity })
        .catch(err => console.log("ERROR 4", err));

    if (!user) return res.status(400).send({ message: "Can't find the user" });

    let userData = await users_collection
        .findOneAndUpdate(
            { _id: ObjectId(user._id) },
            {
                $set: {
                    name: name,
                    avatar_id: avatar_id
                }
            }
        )
        .catch(err => console.log("ERROR 5", err));

    return userData.value;


}



