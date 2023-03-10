import { database, ObjectId } from "@spica-devkit/database";
import * as Bucket from "@spica-devkit/bucket";

const json2csv = require("json2csv").parse;
const CryptoJS = require("crypto-js");
const axios = require("axios");

const PAST_MATCHES_BUCKET_ID = process.env.PAST_MATCHES_BUCKET_ID;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const REWARD_LOGS_BUCKET_ID = process.env.REWARD_LOGS_BUCKET_ID;
const TRANSACTIONS_BUCKET = process.env.TRANSACTIONS_BUCKET;
const SECRET_API_KEY = process.env.SECRET_API_KEY;
const MANUALLY_REWARD_BUCKET_ID = process.env.MANUALLY_REWARD_BUCKET_ID;
const CONTACT_BUCKET_ID = process.env.CONTACT_BUCKET_ID;
const CONFIGURATION_BUCKET_ID = process.env.CONFIGURATION_BUCKET_ID;
const BUGGED_REWARDS_BUCKET_ID = process.env.BUGGED_REWARDS_BUCKET_ID;

const PUSH_TEMPLATES_BUCKET = process.env.PUSH_TEMPLATES_BUCKET;
const NOTIFICATOIN_LAST_ID = process.env.NOTIFICATOIN_LAST_ID;
const PUSH_LOGS_BUCKET = process.env.PUSH_LOGS_BUCKET;

const PUBLIC_URL = process.env.__INTERNAL__SPICA__PUBLIC_URL__;

let db;
export async function matchChart(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let begin = new Date().setDate(new Date().getDate() - 2);
        let end = new Date();

        if (req.query.filter != "undefined") {
            let query = JSON.parse(req.query.filter);

            if (query.begin) {
                begin = query.begin;
            }

            if (query.end) {
                end = query.end;
            }
        }

        let oneDay = 1000 * 3600 * 24;
        let beginDate = new Date(begin);
        let endDate = new Date(end);
        let days = Math.ceil((endDate.getTime() - beginDate.getTime()) / oneDay);

        let userVsUser = [];
        let userVsBot = [];
        let total = [];
        let label = [];
        beginDate.setHours(21);
        beginDate.setMinutes(0);
        beginDate.setSeconds(0);
        db = await database().catch(err => console.log("ERROR 1", err));
        for (let day = 0; day < days; day++) {
            let previousDay = new Date(beginDate.getTime() + day * oneDay);
            let nextDay = new Date(beginDate.getTime() + (day + 1) * oneDay);
            if (nextDay.getTime() > endDate.getTime()) {
                nextDay.setTime(endDate.getTime());
            }
            let result = await getMatches(previousDay, nextDay).catch(err =>
                console.log("ERROR 2", err)
            );

            userVsUser.push(result.userVsUser);
            userVsBot.push(result.userVsBot);
            total.push(result.total);

            label.push(
                `${("0" + previousDay.getDate()).slice(-2)}-${(
                    "0" +
                    (previousDay.getMonth() + 1)
                ).slice(-2)}-${previousDay.getFullYear()}`
            );
        }

        return res.status(200).send({
            title: "Daily Chart",
            options: { legend: { display: true }, responsive: true },
            label: label,
            datasets: [
                { data: userVsUser, label: "User VS User" },
                { data: userVsBot, label: "User VS Bot" },
                { data: total, label: "Total Matches" }
            ],
            legend: true,
            width: 10,
            filters: [
                { key: "begin", type: "date", value: beginDate },
                { key: "end", type: "date", value: endDate }
            ]
        });
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function totalMatchChart(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let begin = new Date().setDate(new Date().getDate() - 1);
        let end = new Date();

        if (req.query.filter != "undefined") {
            let query = JSON.parse(req.query.filter);

            if (query.begin) {
                begin = query.begin;
            }

            if (query.end) {
                end = query.end;
            }
        }
        let beginDate = new Date(begin);
        beginDate.setHours(21);
        beginDate.setMinutes(0);
        beginDate.setSeconds(0);
        let endDate = new Date(end);
        db = await database().catch(err => console.log("ERROR 3", err));
        let result = await getMatches(beginDate, endDate).catch(err => console.log("ERROR 4", err));


        return res.status(200).send({
            title: "Total Chart",
            options: { legend: { display: true }, responsive: true },
            label: ["User VS User", "User VS Bot"],
            data: [
                result.userVsUser,
                result.userVsBot,
            ],
            legend: true,
            filters: [
                { key: "begin", type: "date", value: beginDate },
                { key: "end", type: "date", value: endDate }
            ]
        });
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

async function getMatches(begin, end) {
    const pastMachesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET_ID}`);
    let dateFilter = {
        $gte: begin,
        $lt: end
    };

    const userVsUser = await pastMachesCollection
        .find({
            player_type: 0,
            end_time: dateFilter
        })
        .count()
        .catch(err => console.log("ERROR 5", err));

    const userVsBot = await pastMachesCollection
        .find({
            player_type: 1,
            end_time: dateFilter
        })
        .count()
        .catch(err => console.log("ERROR 8", err));

    let result = {
        userVsUser,
        userVsBot,
        total: userVsUser + userVsBot
    };

    return result;
}

export async function dashboardPastMatches(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let db = await database().catch(err => console.log("ERROR 11 ", err));

        let msisdn = "";
        let begin = new Date("12-31-2021 21:00:0");
        let end = new Date();
        let tableData = [];

        if (req.query.filter != "undefined") {
            let filter = JSON.parse(req.query.filter);
            if (filter.begin) {
                begin = new Date(filter.begin);
            }

            if (filter.end) {
                end = new Date(filter.end);
            }
            msisdn = filter.msisdn;

            const usersCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
            const pastMatchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET_ID}`);

            const identityCollection = db.collection(`identity`);
            const identity = await identityCollection
                .findOne({ "attributes.msisdn": { $regex: msisdn } })
                .catch(err => console.log("ERROR 12 ", err));
            const user = await usersCollection
                .findOne({ identity: identity._id.toString() })
                .catch(err => console.log("ERROR 13 ", err));

            let userId = user._id;
            let dateFilter = {
                $gte: begin,
                $lt: end
            };

            const pastMatches = await pastMatchesCollection.aggregate([
                {
                    $match: {
                        $or: [{ user1: userId.toString() }, { user2: userId.toString() }],
                        start_time: dateFilter
                    },
                },
                {
                    $set: {
                        _id: {
                            $toString: "$_id"
                        },
                        user1: {
                            $toObjectId: "$user1"
                        },
                        user2: {
                            $toObjectId: "$user2"
                        }
                    }
                },
                {
                    $lookup: {
                        from: `bucket_${USER_BUCKET_ID}`,
                        localField: "user1",
                        foreignField: "_id",
                        as: "user1"
                    }
                },
                {
                    $lookup: {
                        from: `bucket_${USER_BUCKET_ID}`,
                        localField: "user2",
                        foreignField: "_id",
                        as: "user2"
                    }
                },
            ])
                .sort({ _id: -1 })
                .toArray()

            pastMatches.forEach(data => {
                let startTime = new Date(data.start_time);
                let endTime = new Date(data.end_time);
                startTime.setHours(startTime.getHours() + 3);
                endTime.setHours(endTime.getHours() + 3);

                let obj = {
                    duel_id: data._id,
                    user1: data.user1[0].name,
                    user2: data.user2[0].name,
                    winner: data.winner,
                    player_type: data.player_type == 0 ? "PVP" : "PVE",
                    start_time: startTime,
                    end_time: endTime
                };
                tableData.push(obj);
            });
        }

        return {
            title: "Duels",
            data: tableData,
            displayedColumns: [
                "duel_id",
                "user1",
                "user2",
                "winner",
                "player_type",
                "start_time",
                "end_time"
            ],
            filters: [
                { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
                { key: "begin", type: "date", value: begin },
                { key: "end", type: "date", value: end }
            ]
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function dashboardUserRewards(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let msisdn = "";
        let begin = new Date("01-01-2022 21:00:0");
        let end = new Date();
        let rewards = [];

        if (req.query.filter != "undefined") {
            let filter = JSON.parse(req.query.filter);
            msisdn = filter.msisdn;

            if (filter.begin) {
                begin = new Date(filter.begin);
            }

            if (filter.end) {
                end = new Date(filter.end);
            }

            if (msisdn) {
                let db = await database().catch(err => console.log("ERROR 15 ", err));
                const rewardsCollection = db.collection(`bucket_${REWARD_LOGS_BUCKET_ID}`);
                let dateFilter = {
                    $gte: begin,
                    $lt: end
                };
                rewards = await rewardsCollection
                    .find({
                        msisdn: { $regex: msisdn },
                        date: dateFilter
                    })
                    .sort({ date: -1 })
                    .toArray()
                    .catch(err => console.log("ERROR 16 ", err));

                rewards = rewards.map(data => {
                    let date = new Date(data.date);
                    date.setHours(date.getHours() + 3);
                    return {
                        _id: data._id,
                        order_id: data.order_id,
                        offer_id: data.offer_id,
                        date: date,
                        status: data.status,
                        match_id: data.match_id
                    };
                });

            }
        }


        return {
            title: "User Rewards",
            data: rewards,
            displayedColumns: ["_id", "order_id", "offer_id", "date", "status", "match_id"],
            filters: [
                { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
                { key: "begin", type: "date", value: begin },
                { key: "end", type: "date", value: end }
            ]
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function userDashboardCharges(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let msisdn = "";
        let begin = new Date("01-01-2022 21:00:0");
        let end = new Date();
        let charges = [];

        if (req.query.filter != "undefined") {
            let filter = JSON.parse(req.query.filter);
            msisdn = filter.msisdn;
            if (filter.begin) {
                begin = new Date(filter.begin);
            }

            if (filter.end) {
                end = new Date(filter.end);
            }

            if (msisdn) {
                let db = await database().catch(err => console.log("ERROR 20 ", err));
                const chargesCollection = db.collection(`bucket_${TRANSACTIONS_BUCKET}`);
                let dateFilter = {
                    $gte: begin,
                    $lt: end
                };

                charges = await chargesCollection
                    .find({ msisdn: { $regex: msisdn }, date: dateFilter })
                    .sort({ date: -1 })
                    .toArray()
                    .catch(err => console.log("ERROR 21 ", err));


                charges = charges.map(data => {
                    let date = new Date(data.date);
                    let amount = data.type == 'first' ? '9TL' : '7TL'
                    date.setHours(date.getHours() + 3);
                    return {
                        _id: data._id,
                        date: date,
                        amount: amount,
                        status: data.status,
                        user_text: data.user_text,
                    };
                });
            }
        }

        return {
            title: "User Charges",
            data: charges,
            displayedColumns: ["_id", "date", "amount", "status", "user_text"],
            filters: [
                { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
                { key: "begin", type: "date", value: begin },
                { key: "end", type: "date", value: end }]
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function playedUsersCount(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let begin = new Date().setDate(new Date().getDate() - 1);
        let end = new Date();

        if (req.query.filter != "undefined") {
            let query = JSON.parse(req.query.filter);

            if (query.begin) {
                begin = query.begin;
            }

            if (query.end) {
                end = query.end;
            }
        }

        let beginDate = new Date(begin).setHours(new Date(begin).getHours() + 3);
        let endDate = new Date(end).setHours(new Date(end).getHours() + 3);

        let dateFilter = {
            $gte: new Date(beginDate),
            $lt: new Date(endDate)
        };

        db = await database().catch(err => console.log("ERROR 38", err));
        const pastMatchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET_ID}`);

        let user1Paid = await pastMatchesCollection
            .aggregate([
                { $match: { end_time: dateFilter } },
                { $group: { _id: "$user1" } }
            ])
            .toArray()
            .catch(err => console.log("ERROR 39", err));

        let user2Paid = await pastMatchesCollection
            .aggregate([
                {
                    $match: {
                        end_time: dateFilter,
                        player_type: 0,
                    }
                },
                { $group: { _id: "$user2" } }
            ])
            .toArray()
            .catch(err => console.log("ERROR 40", err));

        user1Paid = user1Paid.map(el => el._id);
        user2Paid = user2Paid.map(el => el._id);

        let paid = [...new Set([...user1Paid, ...user2Paid])];

        let uniq = [...new Set(paid)];

        let total = uniq.length;

        paid = paid.length;

        return res.status(200).send({
            title: "Soru Avi Played Users",
            options: { legend: { display: true }, responsive: true },
            label: ["Paid", "Total"],
            data: [paid, total],
            legend: true,
            filters: [
                { key: "begin", type: "date", value: new Date(begin) },
                { key: "end", type: "date", value: new Date(end) }
            ]
        });
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function getManuallyRewardDashboard(req, res) {
    return {
        title: "Manually Reward",
        description:
            "Inputların içine numaraları virgül (5353334422,5321234567 şeklinde) ile ayrılmış şekilde yazabilirsiniz. " +
            "Tek seferde hem saatlik hemde günlük yükleyebilirsiniz.",
        inputs: [
            {
                key: "daily_1",
                type: "string",
                value: "",
                title: "Gunluk Reward MSISDNS"
            },
            {
                key: "key",
                type: "string",
                value: "",
                title: "Dashboard Key"
            }
        ],
        button: {
            color: "primary",
            target: `${PUBLIC_URL}/fn-execute/dashboardManuallyReward?key=wutbztACHHbT`,
            method: "get",
            title: "Send Request"
        }
    };
}

export async function dashboardManuallyReward(req, res) {
    let db = await database().catch(err => console.log("ERROR 17 ", err));
    const configurationCollection = db.collection(`bucket_${CONFIGURATION_BUCKET_ID}`);
    const dashboard_key = await configurationCollection.findOne({ key: "dashboard_key" }).catch(err => console.log("Error", err))

    if (req.query.key == dashboard_key.value) {
        Bucket.initialize({ apikey: `${SECRET_API_KEY}` });
        let dailyMsisdns = req.query.daily_1;
        dailyMsisdns = dailyMsisdns ? dailyMsisdns.split(",") : [];

        if (dailyMsisdns[0]) {
            for (let msisdn of dailyMsisdns) {
                await Bucket.data
                    .insert(MANUALLY_REWARD_BUCKET_ID, {
                        msisdn: Number(msisdn),
                        reward: "daily_1"
                    })
                    .catch(error => {
                        console.log("ERROR 14", error);
                    });
            }
        }

        await generateDashboardKey();

        return res.status(200).send({
            message: "successfully",
        });
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function dashboardGetContacts(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let beginDate = new Date().setDate(new Date().getDate() - 7);
        let endDate = new Date();

        let db = await database().catch(err => console.log("Error", err))

        let contactCollection = db.collection(`bucket_${CONTACT_BUCKET_ID}`)
        const contacts = await contactCollection.find(
            {
                created_at: {
                    $gte: new Date(beginDate), $lte: new Date(endDate)
                }
            }
        ).toArray().catch(err => console.log("Error", err))



        contacts.reverse();
        contacts.forEach((contact) => {
            delete contact['about']
        })

        return {
            title: "Soru Avi Contacts",
            data: contacts,
            displayedColumns: [
                "_id",
                "name",
                "email",
                "note",
                "msisdn",
                "user",
                "read",
                "fixed",
                "created_at",
                "message"
            ],
            filters: [
                { key: "begin", type: "date", value: beginDate },
                { key: "end", type: "date", value: endDate }
            ]
        };

    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function updateContact(req, res) {
    const { read, fixed, contact_id, note } = req.body

    let db = await database().catch(err => console.log("Error", err))
    let contactCollection = db.collection(`bucket_${CONTACT_BUCKET_ID}`)

    let data = {}

    data['read'] = read == 'true' ? true : false
    data['fixed'] = fixed == 'true' ? true : false
    if (note) data['note'] = note

    await contactCollection.updateOne(
        { _id: ObjectId(contact_id) },
        { $set: data }
    )

    return true;
}

function generatePassword() {
    let length = 16,
        charset = "0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
}

export async function generateDashboardKey() {
    let db = await database().catch(err => console.log("ERROR 17 ", err));
    const configurationCollection = db.collection(`bucket_${CONFIGURATION_BUCKET_ID}`);

    await configurationCollection
        .updateOne(
            { key: "dashboard_key" },
            { $set: { value: generatePassword() } }
        )
        .catch(e => console.log(e));

    return true;
}

export async function getDashboarKey(req, res) {
    if (req.query.key != "smlc49YjPoddQg)n") {
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
    }

    let db = await database().catch(err => console.log("ERROR ", err));
    const configurationCollection = db.collection(`bucket_${CONFIGURATION_BUCKET_ID}`);
    const dashboard_key = await configurationCollection.findOne({ key: "dashboard_key" }).catch(err => console.log("Error", err))

    let hashData = CryptoJS.AES.encrypt(JSON.stringify(dashboard_key.value), 'dashboard_key').toString();

    return res.status(200).send({ key: hashData })
}

export async function getLeaderUsersDashboard(req, res) {
    let limit = 10;
    let begin = new Date().setDate(new Date().getDate() - 7);
    let end = new Date();

    if (req.query.filter != "undefined") {
        let filter = JSON.parse(req.query.filter);
        if (filter.begin) {
            begin = filter.begin;
        }

        if (filter.end) {
            end = filter.end;
        }

        limit = Number(filter.limit);
    }

    let beginDate = new Date(begin);
    let endDate = new Date(end);

    let dateFilter = {
        $gte: beginDate,
        $lt: endDate
    };

    if (!db) {
        db = await database();
    }
    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET_ID}`);
    const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    const identityCollection = db.collection(`identity`);

    let user1Matches = await pastMatchesCollection
        .aggregate([
            { $match: { end_time: dateFilter } },
            {
                $group: {
                    _id: "$user1",
                    count: { $sum: 1 },
                    win_count: {
                        $sum: {
                            $cond: {
                                if: {
                                    $eq: [
                                        "$winner",
                                        1
                                    ]
                                }, then: 1, else: 0
                            }
                        }
                    },
                    paid_match: {
                        $sum: 1
                    },
                }
            },
            { $sort: { win_count: -1 } },
            { $limit: limit }
        ])
        .toArray()
        .catch(err => console.log("ERROR", err));


    let user2Matches = await pastMatchesCollection
        .aggregate([
            { $match: { end_time: dateFilter, duel_type: 0 } },
            {
                $group: {
                    _id: "$user2",
                    count: { $sum: 1 },
                    win_count: {
                        $sum: {
                            $cond: {
                                if: {
                                    $eq: [
                                        "$winner",
                                        2
                                    ]
                                }, then: 1, else: 0
                            }
                        }
                    },
                    paid_match: {
                        $sum: 1
                    },
                }
            },
            { $sort: { win_count: -1 } },
            { $limit: limit }
        ])
        .toArray()
        .catch(err => console.log("ERROR ", err));

    const uniqueUsers = [];
    const usersId = [];
    const usersIdentity = [];

    user1Matches.forEach(user => {
        usersId.push(ObjectId(user._id))
        let user2 = user2Matches.find(el => { return user._id == el._id })
        if (user2) {
            let obj = {
                _id: user._id,
                point: user.point + user2.point,
                match_count: user.count + user2.count,
                match_win_count: user.win_count + user2.win_count,
                match_lose_count: (user.count + user2.count) - (user.win_count + user2.win_count),
            }
            uniqueUsers.push(obj)
        } else {
            user['match_count'] = user.count;
            user['match_win_count'] = user.win_count;
            user['match_lose_count'] = user.count - user.win_count
            uniqueUsers.push(user)
        }
    })

    const usersArr = await userCollection.find({ _id: { $in: usersId } }).toArray().catch(err => console.log("ERROR ", err));

    usersArr.forEach(user => {
        usersIdentity.push(ObjectId(user.identity))
    })

    const identities = await identityCollection
        .find({ _id: { $in: usersIdentity } })
        .toArray()
        .catch(err => console.log("ERROR ", err));

    usersArr.map(user => {
        let userIdentity = identities.find(identity => { return String(identity._id) == user.identity })
        let userMatchData = uniqueUsers.find(el => { return user._id == el._id })

        // user['earned_points'] = userMatchData.point;
        user['match_count'] = userMatchData.match_count;
        user['match_win_count'] = userMatchData.match_win_count;
        user['match_lose_count'] = userMatchData.match_lose_count;
        user['msisdn'] = userIdentity.attributes.msisdn;
        return user;
    })

    let tableData = [];
    usersArr.forEach(data => {
        let obj = {
            _id: data._id,
            name: data.name,
            msisdn: data.msisdn,
            match_count: data.match_count,
            match_win_count: data.match_win_count,
            match_lose_count: data.match_lose_count || 0,
        };
        tableData.push(obj);
    });

    tableData.sort((a, b) => b.match_win_count - a.match_win_count);

    return {
        title: "Leaderboards",
        data: tableData,
        displayedColumns: [
            "_id",
            "name",
            "msisdn",
            "match_count",
            "match_win_count",
            "match_lose_count",
        ],
        filters: [
            { key: "limit", type: "string", value: limit, title: "limit" },
            { key: "begin", type: "date", value: beginDate },
            { key: "end", type: "date", value: endDate }
        ]
    };

}

export async function dahsboardBuggedRewards(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let msisdn = "";
        let begin = new Date("01-01-2022 21:00:0");
        let end = new Date();
        let rewards = [];

        if (req.query.filter != "undefined") {
            let filter = JSON.parse(req.query.filter);
            if (filter.begin) {
                begin = new Date(filter.begin);
            }

            if (filter.end) {
                end = new Date(filter.end);
            }
            msisdn = filter.msisdn;

            if (msisdn) {
                let db = await database().catch(err => console.log("ERROR 15 ", err));

                const rewardsCollection = db.collection(`bucket_${BUGGED_REWARDS_BUCKET_ID}`);

                rewards = await rewardsCollection
                    .find({
                        msisdn: { $regex: msisdn },
                        date: {
                            $gte: begin, $lte: end
                        }
                    })
                    .sort({ date: -1 })
                    .toArray()
                    .catch(err => console.log("ERROR 16 ", err));


                rewards = rewards.map(data => {
                    let date = new Date(data.date);
                    date.setHours(date.getHours() + 3);
                    return {
                        _id: data._id,
                        order_id: data.order_id,
                        offer_id: data.offer_id,
                        date: date.toLocaleDateString(),
                        time: getTwentyFourHourTime(date.toLocaleTimeString()),
                        status: data.status,
                        match_id: data.match_id
                    };
                });
            }
        }


        return {
            title: "User Bugged Rewards",
            data: rewards,
            displayedColumns: ["_id", "order_id", "offer_id", "date", "time", "status", "match_id"],
            filters: [
                { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
                { key: "begin", type: "date", value: begin },
                { key: "end", type: "date", value: end }
            ]
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

function getTwentyFourHourTime(amPmString) {
    var d = new Date("1/1/2021 " + amPmString);
    let currentHours = d.getHours()
    currentHours = ("0" + currentHours).slice(-2);

    let currentMinutes = d.getMinutes()
    currentMinutes = ("0" + currentMinutes).slice(-2);

    let currentSeconds = d.getSeconds()
    currentSeconds = ("0" + currentSeconds).slice(-2);

    return currentHours + ':' + currentMinutes + ':' + currentSeconds;
}

export async function dashboardUserAnalysisReport(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let now = new Date();
        let beginDate = new Date(now.setDate(now.getDate() - 1));
        let endDate = new Date();
        return {
            title: "Kullanıcı Analiz Raporu",
            description:
                "Analiz raporunu oluşturmak için, maçların başlangıç ve bitiş tarihlerini girerek, indir butonuna basınız.",
            inputs: [
                // { key: "msisdn", type: "string", value: "", title: "Msisdn" },
                { key: "begin", type: "date", value: beginDate, title: "Başlangıç Tarihi" },
                { key: "end", type: "date", value: endDate, title: "Bitiş Tarihi" },
                { key: "key", type: "string", value: "dlw2RH32NjSd", title: "Değiştirmeyin" },
            ],
            button: {
                color: "primary",
                target:
                    `${PUBLIC_URL}/fn-execute/downloadUserAnalysisReport`,
                method: "get",
                title: "İndir"
            }
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function downloadUserAnalysisReport(req, res) {
    if (req.query.key == "dlw2RH32NjSd") {
        Bucket.initialize({ apikey: `${SECRET_API_KEY}` });
        let db = await database().catch(err => console.log("ERROR 11 ", err));

        let beginDate = new Date(req.query.begin);
        let endDate = new Date(req.query.end);

        const identityIds = [];
        const tableData = [];

        const identityCollection = db.collection(`identity`);

        const pastMatches = await db.collection(`bucket_${PAST_MATCHES_BUCKET_ID}`)
            .find({ start_time: { $gte: beginDate, $lte: endDate } })
            .toArray().catch(error => {
                console.log("ERROR ", error);
            });

        const users = [];
        if (pastMatches.length) {
            pastMatches.forEach(data => {
                users.push(ObjectId(data.user1))
                if (data.duel_type == 0) {
                    users.push(ObjectId(data.user2))
                }
            })
        }

        const usersData = await db.collection(`bucket_${USER_BUCKET_ID}`)
            .find({ _id: { $in: users } }).toArray().catch(error => {
                console.log("ERROR ", error);
            });

        let usersObject = {};
        if (usersData.length) {
            usersData.forEach(user => {
                usersObject[user._id] = user.identity;
                identityIds.push(ObjectId(user.identity))
            })
        }

        let userIdentitiesObject = {};
        const identities = await identityCollection
            .find({ _id: { $in: identityIds } }).toArray()
            .catch(err => console.log("ERROR 12 ", err));

        identities.forEach(identity => {
            userIdentitiesObject[identity._id.toString()] = identity.attributes.msisdn;
        })


        pastMatches.forEach(data => {
            let startTime = new Date(data.start_time);
            let endTime = new Date(data.end_time);
            startTime.setHours(startTime.getHours() + 3);
            endTime.setHours(endTime.getHours() + 3);

            let users = [data.user1]
            if (data.duel_type == 0) users.push(data.user2)

            for (let [index, user] of users.entries()) {

                let userData = usersObject[user]

                if (userData) {

                    let userIdentity = userIdentitiesObject[userData];

                    if (userIdentity) {
                        let opponent = '';
                        let date = `${startTime.getDate()}/${startTime.getMonth() + 1}/${startTime.getFullYear()} ${getTwentyFourHourTime(startTime.toLocaleTimeString())}`
                        if (data.duel_type == 0) {
                            opponent = 'paid';
                        } else {
                            opponent = 'bot';
                        }

                        let obj = {
                            date: date,
                            msisdn: userIdentity,
                            services_name: "Bilgi Duellosu",
                            fee_type: "paid",
                            charge_amount: "7TL",
                            winner: data.winner,
                            opponent: opponent
                        };
                        tableData.push(obj);
                    }
                }
            }
        });

        const fields = [
            { label: "Tarih", value: 'date' },
            { label: "Msisdn", value: 'msisdn' },
            { label: "Oyun Adı", value: 'services_name' },
            { label: "Ücret Tipi", value: 'fee_type' },
            { label: "Charge Ücreti", value: 'charge_amount' },
            { label: "Maç Sonucu", value: 'winner' },
            { label: "Rakip", value: 'opponent' }
        ];

        let formattedString = json2csv(tableData, { fields });

        res.headers.set(
            "Content-Disposition",
            `attachment; filename=soru-avi-${beginDate.toLocaleDateString()}&${endDate.toLocaleDateString()}.xlsx`
        );

        return res.status(200).send(formattedString);

    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function dahsboardUserPoints(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let msisdn = "";
        let begin = new Date("01-31-2021 21:00:0");
        let end = new Date();
        let tableData = [];

        if (req.query.filter != "undefined") {
            let filter = JSON.parse(req.query.filter);
            if (filter.begin) {
                begin = new Date(filter.begin);
            }

            if (filter.end) {
                end = new Date(filter.end);
            }
            msisdn = filter.msisdn;

            if (msisdn) {
                let db = await database().catch(err => console.log("ERROR 15 ", err));

                const usersCollection = db.collection(`bucket_${USER_BUCKET_ID}`);

                const identityCollection = db.collection(`identity`);
                const identity = await identityCollection
                    .findOne({ "attributes.msisdn": { $regex: msisdn } })
                    .catch(err => console.log("ERROR 12 ", err));

                const user = await usersCollection
                    .findOne({ identity: identity._id.toString() })
                    .catch(err => console.log("ERROR 13 ", err));

                let userId = user._id;

                const pastMatchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET_ID}`);
                let pastMatches = await pastMatchesCollection
                    .find({
                        $or: [{ user1: userId.toString() }, { user2: userId.toString() }],
                    })
                    .sort({ _id: 1 })
                    .toArray()
                    .catch(err => console.log("ERROR 16 ", err));

                let totalPoint = 0;

                pastMatches.forEach((match) => {
                    let userOrder = 1;
                    if (match.user1 != userId) {
                        userOrder = 2;
                    }
                    let matchPoint = 0;
                    let opponentPoint = 0;
                    let opponentOrder = userOrder == 1 ? 2 : 1;
                    match.questions.forEach((question) => {
                        question = JSON.parse(question);
                        if (question.correct_answer == question[`user${userOrder}_answer`]) {
                            matchPoint += 10;
                        }
                        if (question.correct_answer == question[`user${opponentOrder}_answer`]) {
                            opponentPoint += 10;
                        }
                    })

                    if (match.winner == userOrder) {
                        matchPoint += 100;
                    } else {
                        opponentPoint += 100;
                    }

                    totalPoint += matchPoint;

                    tableData.push({
                        match_id: match._id,
                        start_date: match.start_time.toLocaleDateString(),
                        start_time: getTwentyFourHourTime(match.start_time.toLocaleTimeString()),
                        match_point: matchPoint,
                        total_point: totalPoint,
                        opponent_point: opponentPoint,
                        winner: userOrder == match.winner ? 'kazandı' : 'kaybetti'
                    })
                })

                tableData = tableData.filter(el => {
                    return new Date(el.start_date) >= begin && new Date(el.start_date) <= end
                })

                tableData.sort((a, b) => b.total_point - a.total_point)
            }
        }

        return {
            title: "User Match Points",
            data: tableData,
            displayedColumns: ["match_id", "start_date", "start_time", "match_point", "total_point", "opponent_point", "winner"],
            filters: [
                { key: "msisdn", type: "string", value: msisdn, title: "msisdn" },
                { key: "begin", type: "date", value: begin },
                { key: "end", type: "date", value: end }
            ]
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function chargeStatistics(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let now = new Date(new Date().toDateString());
        now.setHours(now.getHours() - 3)

        let begin = new Date(now);
        let end = new Date();
        const result = [];

        if (req.query.filter != "undefined") {
            let filter = JSON.parse(req.query.filter);
            if (filter.begin) {
                begin = new Date(filter.begin);
            }
            if (filter.end) {
                end = new Date(filter.end);
            }

            let dateFilter = {
                $gte: begin,
                $lt: end
            };

            let db = await database().catch(err => console.log("ERROR 20 ", err));
            const chargesCollection = db.collection(`bucket_${TRANSACTIONS_BUCKET}`);

            const total = await chargesCollection.find({ "date": dateFilter }).count().catch(err => console.log("ERROR ", err))
            const success = await chargesCollection.find({ "date": dateFilter, "status": true }).count().catch(err => console.log("ERROR ", err))
            

            result.push({
                total: numberWithDot(total),
                success: numberWithDot(success),
                error: numberWithDot(total - success)
            })
        }


        return {
            title: "Charge Statistics",
            data: result,
            displayedColumns: ["total", "success", "error"],
            filters: [
                { key: "begin", type: "date", value: begin },
                { key: "end", type: "date", value: end }
            ]
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

function numberWithDot(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export async function autoSentMessageManagement(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let title = "Gönderilmeyi Başlat";
        let db = await database().catch(err => console.log(err));
        const configurationCollection = db.collection(`bucket_${CONFIGURATION_BUCKET_ID}`);
        const push_notification = await configurationCollection.findOne({ key: "push_notification" }).catch(err => console.log("Error", err))
        if (push_notification.value === 'true') {
            title = "Gönderilmeyi Durdur";
        }

        return {
            title: "Otomatik Gönderilen Mesaj",
            description:
                "Butona basarak, kullanıcı kanala gediğinde otomatik gönderilen mesajları durudrup / başlatabilirsiniz",
            button: {
                color: "primary",
                target: `${PUBLIC_URL}/fn-execute/changeAutoSentMessageStatus`,
                method: "get",
                title: title
            }
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function changeAutoSentMessageStatus(req, res) {
    let value = "true";
    let db = await database().catch(err => console.log(err));
    const configurationCollection = db.collection(`bucket_${CONFIGURATION_BUCKET_ID}`);
    const push_notification = await configurationCollection.findOne({ key: "push_notification" }).catch(err => console.log("Error", err))
    if (push_notification.value === 'true') {
        value = "false";
    }
    await configurationCollection.findOneAndUpdate({ key: "push_notification" }, {
        $set: {
            value: value
        }
    }).catch(err => console.log("Error", err))
    return res.status(200).send({ message: "Success" })
}

export async function pushManagementPanel(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        const db = await database().catch(err => console.log(err));
        const pushTemplatesCollection = db.collection(`bucket_${PUSH_TEMPLATES_BUCKET}`);

        const template = await pushTemplatesCollection.findOne({ list_id: 1 }).catch(err => console.log("ERROR ", err))

        if (!template) {
            return res.status(400).send({
                statusCode: 400,
                message: `Template with id ${list_id} was not found`,
            });
        }

        return {
            title: "Push Yönetimi",
            description: "",
            // description: `Status: ${template.status.toUpperCase()} İşlemden sonra, güncel statusu görmek için cardı yenile`,
            inputs: [
                {
                    key: "list_id",
                    type: "number",
                    value: 1,
                    title: "List ID"
                },
                {
                    key: "user_count",
                    type: "number",
                    value: template.user_count,
                    title: "Kullanıcı Sayısı"
                },
                {
                    key: "action",
                    type: "multiselect",
                    items: {
                        type: "string",
                        enum: ['guncelle', `${template.status == 'askida' ? 'devam_ettir' : 'askiya_al'}`, `${template.status == 'askida' || template.status == 'aktif' ? 'bitir' : 'baslat'}`],
                    },
                    value: null,
                    maxItems: 1,
                    title: "İşlem"
                },
            ],
            button: {
                color: "primary",
                target: `${PUBLIC_URL}/fn-execute/handlePushManagementPanel`,
                method: "post",
                title: "Devam Et"
            },
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function handlePushManagementPanel(req, res) {
    const { list_id, user_count, action } = req.body;

    if (!action) {
        return res.status(200).send({ message: 'Action cannot be empty' })
    } else if (!list_id) {
        return res.status(200).send({ message: 'List ID cannot be empty' })
    } else if (!user_count || Number(user_count) > 500) {
        return res.status(200).send({ message: 'User count cannot be empty and must be less than 500' })
    }

    const db = await database().catch(err => console.log(err));
    const pushTemplatesCollection = db.collection(`bucket_${PUSH_TEMPLATES_BUCKET}`);
    const lastidCollection = db.collection(`bucket_${NOTIFICATOIN_LAST_ID}`);
    const pushLogsCollection = db.collection(`bucket_${PUSH_LOGS_BUCKET}`);

    const template = await pushTemplatesCollection.findOne({ list_id: Number(list_id) }).catch(err => console.log("ERROR ", err))

    if (!template) {
        return res.status(200).send({ message: `Template with id ${list_id} was not found` })
    }

    let setQuery = {}
    if (action == 'guncelle') {
        setQuery['user_count'] = Number(user_count);
    } else {
        await pushTemplatesCollection.updateMany({}, { $set: { status: 'devre_disi' } }).catch(err => console.log("ERROR ", err))
        if (action == 'baslat' || action == 'devam_ettir') {
            setQuery['status'] = 'aktif';
        } else if (action == 'bitir') {
            setQuery['status'] = 'devre_disi';
            await lastidCollection.findOneAndUpdate({ type: 'push_notification' }, { $set: { last_id: "" } }).catch(err => console.log("ERROR", err));
        } else {
            setQuery['status'] = 'askida';
        }
    }

    await pushTemplatesCollection.updateOne({ list_id: Number(list_id) }, { $set: setQuery }).catch(err => console.log("ERROR ", err))

    await pushLogsCollection.insertOne({
        list_id: Number(list_id),
        date: new Date(),
        action: action,
        user_count: Number(user_count),
        status: setQuery['status'] || template.status,
        type: template.type || '',
        title: template.title || '',
        description: template.description || '',
        button_name: template.button_name || '',
        message: template.message || ''
    }).catch(err => console.log("ERROR ", err))

    return res.status(200).send({ message: 'Success' })
}

export async function getPushTemplateById(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let listId = 1;
        const result = [];

        if (req.query.filter != "undefined") {
            let filter = JSON.parse(req.query.filter);
            if (filter.list_id) {
                listId = Number(filter.list_id);
            }

            let db = await database().catch(err => console.log("ERROR 20 ", err));
            const templatesCollection = db.collection(`bucket_${PUSH_TEMPLATES_BUCKET}`);

            const template = await templatesCollection.findOne({ "list_id": listId }).catch(err => console.log("ERROR ", err))

            if (template) {
                result.push(template)
            }

        }


        return {
            title: "Şablon Datası",
            data: result,
            displayedColumns: ["status", "note", "type", "title", "description", "button_name", "message", "user_count"],
            filters: [
                { key: "list_id", type: "number", value: listId, title: "List ID" },
            ]
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}

export async function pushStatisticsByListId(req, res) {
    if (req.query.key == "wutbztACHHbT") {
        let now = new Date(new Date().toDateString());
        now.setHours(now.getHours() - 3)

        let listId = 1;
        let begin = new Date(now);
        let end = new Date();
        const result = [];

        if (req.query.filter != "undefined") {
            let filter = JSON.parse(req.query.filter);
            if (filter.begin) {
                begin = new Date(filter.begin);
            }
            if (filter.end) {
                end = new Date(filter.end);
            }

            if (filter.list_id) {
                listId = Number(filter.list_id);
            }

            let dateFilter = {
                $gte: begin,
                $lt: end
            };

            let db = await database().catch(err => console.log("ERROR 20 ", err));

            const templatesCollection = db.collection(`bucket_${PUSH_TEMPLATES_BUCKET}`)
            const pushLogsCollection = db.collection(`bucket_${PUSH_LOGS_BUCKET}`);
            const chargesCollection = db.collection(`bucket_${TRANSACTIONS_BUCKET}`);

            const template = await templatesCollection.findOne({ list_id: listId }).catch(err => console.log("ERROR ", err))
            const pushLog = await pushLogsCollection.findOne({ date: dateFilter }).catch(err => console.log("ERROR ", err))

            if (template && pushLog) {
                const msisdnsList = await axios.get(template.included_msisdns).catch(err => console.log(err.response.data))

                const msisdns = msisdnsList.data.split(/\r?\n/);
                const charges = await chargesCollection.find({ "date": dateFilter }).toArray().catch(err => console.log("ERROR ", err))

                let seconds_1 = (begin.getTime() - end.getTime()) / 1000;
                let seconds_2 = (begin.getTime() - new Date().getTime()) / 1000;
                let userCount = seconds_1 / 60 * 500 > msisdns.length ? seconds_1 / 60 * 500 : msisdns.length;
                let userCountNow = seconds_2 / 60 * 500 > msisdns.length ? seconds_2 / 60 * 500 : msisdns.length;
                let total = 0;
                let success = 0;
                let unanswered = 0;
                let rejected = 0;

                for (let i = 0; i < charges.length; i++) {
                    if (msisdns.includes(charges[i].msisdn)) {
                        total += 1;
                    }
                    if (charges[i].status && msisdns.includes(charges[i].msisdn)) {
                        success += 1;
                    }
                    if (!charges[i].listener_result && msisdns.includes(charges[i].msisdn)) {
                        unanswered += 1;
                    }
                    if (charges[i].listener_result && charges[i].listener_result.includes('CONSENT_DENIED') && msisdns.includes(charges[i].msisdn)) {
                        rejected += 1;
                    }
                }

                result.push({
                    user_count: numberWithDot(userCount),
                    user_count_now: numberWithDot(userCountNow),
                    type: pushLog.type,
                    title: pushLog.title,
                    description: pushLog.description,
                    button_name: pushLog.button_name,
                    message: pushLog.message,
                    total: numberWithDot(total),
                    success: numberWithDot(success),
                    unanswered: numberWithDot(unanswered),
                    rejected: numberWithDot(rejected),
                    error: numberWithDot(total - success - unanswered - rejected),
                    total_success_ratio: ((100 * success) / userCount).toFixed(2)
                })
            }
        }

        return {
            title: "Push Statistics",
            data: result,
            displayedColumns: ["user_count", "user_count_now", "type", "title", "description", "button_name", "message", "total", "success", "unanswered", "rejected", "error", "total_success_ratio"],
            filters: [
                { key: "list_id", type: "string", value: listId, title: "List ID" },
                { key: "begin", type: "date", value: begin, title: "Start Date" },
                { key: "end", type: "date", value: end, title: "End Date" }
            ]
        };
    } else
        return res.status(401).send({
            statusCode: 401,
            message: "No auth token",
            error: "Unauthorized"
        });
}