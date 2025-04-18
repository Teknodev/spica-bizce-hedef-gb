import { database, ObjectId } from "@spica-devkit/database";
import * as Bucket from "@spica-devkit/bucket";

const SECRET_API_KEY = process.env.SECRET_API_KEY;
const PAST_MATCHES_BUCKET_ID = process.env.PAST_MATCHES_BUCKET_ID;
const MAILER_BUCKET_ID = process.env.MAILER_BUCKET_ID;
const MATCH_REPORT_BUCKET_ID = process.env.MATCH_REPORT_BUCKET_ID;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const USER_REPORT_BUCKET_ID = process.env.USER_REPORT_BUCKET_ID;
const CHARGE_REPORT_BUCKET_ID = process.env.CHARGE_REPORT_BUCKET_ID;
const USERS_MATCH_REPORT_BUCKET_ID = process.env.USERS_MATCH_REPORT_BUCKET_ID;
const WIN_LOSE_MATCHES_BUCKET_ID = process.env.WIN_LOSE_MATCHES_BUCKET_ID;

const MANUALLY_REWARD_BUCKET_ID = process.env.MANUALLY_REWARD_BUCKET_ID;
const RETRY_REPORT_BUCKET_ID = process.env.RETRY_REPORT_BUCKET_ID;
const REWARD_REPORT_BUCKET_ID = process.env.REWARD_REPORT_BUCKET_ID;
const BUGGED_REWARD_BUCKET_ID = process.env.BUGGED_REWARD_BUCKET_ID;
const TRANSACTION_BUCKET = process.env.TRANSACTION_BUCKET;
const SINGLE_PAST_MATCHES_BUCKET_ID = process.env.SINGLE_PAST_MATCHES_BUCKET_ID;


export async function executeReportDaily() {
    let date = new Date().setDate(new Date().getDate() - 1)
    let dateFrom = new Date(date).setHours(0, 0, 0);
    let dateTo = new Date(date).setHours(23, 59, 59);

    await userReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 4", err));
    await playedMatchCount(0, dateFrom, dateTo).catch(err => console.log("ERROR: 49", err));
    await matchReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 2", err));
    await matchWinLoseCount(0, dateFrom, dateTo).catch(err => console.log("ERROR: 55", err));
    await chargeReportExport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 3", err));
    await retryReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: ", err));
    await getFailedRewards(0, dateFrom, dateTo).catch(err => console.log("ERROR: ", err));

    await reportExportSend("Günlük Rapor", 0).catch(err => console.log("ERROR: 5", err));

    return true;
}
export async function executeReportWeekly() {
    await reportExportSend("Haftalık Gün Bazlı Rapor", 11).catch(err =>
        console.log("ERROR: 63", err)
    );
    await reportExportSend("Haftalık Toplam Rapor", 1).catch(err => console.log("ERROR: 63", err));

    return true;
}
export async function executeReportMonthly() {
    await reportExportSend("Aylık Gün Bazlı Rapor", 22).catch(err =>
        console.log("ERROR: 163", err)
    );
    await reportExportSend("Aylık Toplam Rapor", 2).catch(err =>
        console.log("ERROR: 163", err)
    );

    return true;
}

export async function matchReport(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    let reportDate = new Date().setDate(new Date().getDate() - 1);

    const db = await database().catch(err => console.log("ERROR: 21", err));
    const singlePastMatchesCollection = db.collection(`bucket_${SINGLE_PAST_MATCHES_BUCKET_ID}`);
    const matchReportCollection = db.collection(`bucket_${MATCH_REPORT_BUCKET_ID}`);

    let totalPlayCount = 0,
        totalArrows = 0;

    const singlePlayerMatches = await singlePastMatchesCollection
        .find({
            end_time: {
                $gte: dateFrom,
                $lt: dateTo
            }
        })
        .toArray()
        .catch(err => console.log("ERROR: 23", err));

    singlePlayerMatches.forEach(match => {
        totalArrows += match.arrow_count || 0;
    });

    totalPlayCount = singlePlayerMatches.length;

    await matchReportCollection
        .insertOne({
            date: new Date(reportDate),
            play_count: totalPlayCount,
            arrows_average: totalPlayCount > 0 ? Math.floor(totalArrows / totalPlayCount) : 0,
            report_type: reportType,
        })
        .catch(err => console.log("ERROR: 27", err));

    return true;
}


export async function chargeReportExport(reportType, dateFrom, dateTo) {
    const db = await database().catch(err => console.log("ERROR 40: ", err));
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    let reportDate = new Date().setDate(new Date().getDate() - 1)

    const chargesCollection = db.collection(`bucket_${TRANSACTION_BUCKET}`);
    const chargeReportCollection = db.collection(`bucket_${CHARGE_REPORT_BUCKET_ID}`);

    const chargesSuccessfulFirst = await chargesCollection
        .find({ date: { $gte: dateFrom, $lt: dateTo }, status: true })
        .toArray()
        .catch(err => console.log("ERROR 41: ", err));

    const error1 = await chargesCollection
        .find({
            date: { $gte: dateFrom, $lt: dateTo },
            status: false,
            user_text:
                "Devam eden diğer işlemlerden dolayı Oyun aboneliği gerçekleştirilememektedir."
        })
        .toArray()
        .catch(err => console.log("ERROR 42: ", err));

    const error2 = await chargesCollection
        .find({
            date: { $gte: dateFrom, $lt: dateTo },
            status: false,
            user_text: "Abone kredisi(bakiyesi) yetersiz."
        })
        .toArray()
        .catch(err => console.log("ERROR 43: ", err));

    const error3 = await chargesCollection
        .find({
            date: { $gte: dateFrom, $lt: dateTo },
            status: false,
            user_text: "Abone bulunamadi."
        })
        .toArray()
        .catch(err => console.log("ERROR 44: ", err));

    const error4 = await chargesCollection
        .find({
            date: { $gte: dateFrom, $lt: dateTo },
            status: false,
            user_text: "Abone kara listede islem yapilamaz."
        })
        .toArray()
        .catch(err => console.log("ERROR 45: ", err));

    const error5 = await chargesCollection
        .find({
            date: { $gte: dateFrom, $lt: dateTo },
            status: false,
            user_text:
                "Hattiniz Katma Degerli Servis aboneligine kapali oldugu icin Oyun servisine abonelik talebiniz gerceklestirilememistir. Abonelik izninizi 532?yi arayarak actirabilirsiniz."
        })
        .toArray()
        .catch(err => console.log("ERROR 46: ", err));

    const error6 = await chargesCollection
        .find({
            date: { $gte: dateFrom, $lt: dateTo },
            status: false,
            user_text: "Rahat Hatlar bu servisten yararlanamazlar."
        })
        .toArray()
        .catch(err => console.log("ERROR 47: ", err));

    const error7 = await chargesCollection
        .find({
            date: { $gte: dateFrom, $lt: dateTo },
            status: false,
            user_text:
                "Sistemlerde oluşan hata sebebi ile işleminiz yapılamıyor. İşleminiz tekrar denenmek üzere kuyruğa atılmıştır."
        })
        .toArray()
        .catch(err => console.log("ERROR 48: ", err));

    let totalQuantityFirst = chargesSuccessfulFirst.length +
        error1.length +
        error2.length +
        error3.length +
        error4.length +
        error5.length +
        error6.length +
        error7.length;

    const datas = [
        {
            date: new Date(reportDate),
            daily_qty: chargesSuccessfulFirst.length,
            daily_ratio: chargesSuccessfulFirst.length ? Number(((chargesSuccessfulFirst.length / totalQuantityFirst) * 100).toFixed(2)) : 0,
            status: "Başarılı",
            error: "-",
            report_type: reportType
        },
        {
            date: new Date(reportDate),
            daily_qty: Math.max((error1.length), 0),
            daily_ratio: error1.length ? Number(((error1.length / totalQuantityFirst) * 100).toFixed(2)) : 0,
            status: "Başarısız",
            error: "Devam eden diğer işlemlerden dolayı Oyun aboneliği gerçekleştirilememektedir.",
            report_type: reportType
        },
        {
            date: new Date(reportDate),
            daily_qty: Math.max((error2.length), 0),
            daily_ratio: error2.length ? Number(((error2.length / totalQuantityFirst) * 100).toFixed(2)) : 0,
            status: "Başarısız",
            error: "Abone kredisi(bakiyesi) yetersiz.",
            report_type: reportType
        },
        {
            date: new Date(reportDate),
            daily_qty: Math.max((error3.length), 0),
            daily_ratio: error3.length ? Number(((error3.length / totalQuantityFirst) * 100).toFixed(2)) : 0,
            status: "Başarısız",
            error: "Abone bulunamadi.",
            report_type: reportType
        },
        {
            date: new Date(reportDate),
            daily_qty: Math.max((error4.length), 0),
            daily_ratio: error4.length ? Number(((error4.length / totalQuantityFirst) * 100).toFixed(2)) : 0,
            status: "Başarısız",
            error: "Abone kara listede islem yapilamaz.",
            report_type: reportType
        },
        {
            date: new Date(reportDate),
            daily_qty: Math.max((error5.length), 0),
            daily_ratio: error5.length ? Number(((error5.length / totalQuantityFirst) * 100).toFixed(2)) : 0,
            status: "Başarısız",
            error: "Hattiniz Katma Degerli Servis aboneligine kapali oldugu icin Oyun servisine abonelik talebiniz gerceklestirilememistir. Abonelik izninizi 532?yi arayarak actirabilirsiniz.",
            report_type: reportType
        },
        {
            date: new Date(reportDate),
            daily_qty: Math.max((error6.length), 0),
            daily_ratio: error6.length ? Number(((error6.length / totalQuantityFirst) * 100).toFixed(2)) : 0,
            status: "Başarısız",
            error: "Rahat Hatlar bu servisten yararlanamazlar.",
            report_type: reportType
        },
        {
            date: new Date(reportDate),
            daily_qty: Math.max((error7.length), 0),
            daily_ratio: error7.length ? Number(((error7.length / totalQuantityFirst) * 100).toFixed(2)) : 0,
            status: "Başarısız",
            error: "Sistemlerde oluşan hata sebebi ile işleminiz yapılamıyor. İşleminiz tekrar denenmek üzere kuyruğa atılmıştır.",
            report_type: reportType
        },
    ];

    await chargeReportCollection.insertMany(datas).catch(err => console.log("ERROR 49: ", err));

    return true;
}




export async function userReport(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    let reportDate = new Date().setDate(new Date().getDate() - 1)

    const db = await database().catch(err => console.log("ERROR: 30", err));
    const usersCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    const userReportCollection = db.collection(`bucket_${USER_REPORT_BUCKET_ID}`);

    const usersCount = await usersCollection.count();
    const newUsersCount = await usersCollection
        .find({
            created_at: {
                $gte: dateFrom,
                $lt: dateTo
            }
        })
        .count()
        .catch(err => console.log("ERROR: 32", err));

    await userReportCollection
        .insertOne({
            date: new Date(reportDate),
            total_user: usersCount,
            new_user: newUsersCount,
            created_at: new Date(),
            report_type: reportType
        })
        .catch(err => console.log("ERROR: 33", err));

    return true;
}

async function playedMatchCount(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    let reportDate = new Date().setDate(new Date().getDate() - 1)

    const db = await database().catch(err => console.log("ERROR 38", err));
    const pastMatchesCollection = db.collection(`bucket_${SINGLE_PAST_MATCHES_BUCKET_ID}`);
    const userMatchCollection = db.collection(`bucket_${USERS_MATCH_REPORT_BUCKET_ID}`);

    // let user1 = await pastMatchesCollection
    //     .aggregate([
    //         { $match: { end_time: { $gte: dateFrom, $lt: dateTo } } },
    //         { $group: { _id: "$user1" } }
    //     ])
    //     .toArray()
    //     .catch(err => console.log("ERROR 39", err));

    const [userPaid, userFree, uniqueUser] = await Promise.all([
        pastMatchesCollection.countDocuments({
            end_time: { $gte: dateFrom, $lt: dateTo },
            user_is_free: false
        }),
        pastMatchesCollection.countDocuments({
            end_time: { $gte: dateFrom, $lt: dateTo },
            user_is_free: true
        }),
        pastMatchesCollection.distinct("user", { end_time: { $gte: dateFrom, $lt: dateTo } })
    ])
    // let userPaid = await pastMatchesCollection.countDocuments({
    //     end_time: { $gte: dateFrom, $lt: dateTo },
    //     user_is_free: false
    // }).catch(err => console.error("userPaid", err))

    // let userFree = await pastMatchesCollection.countDocuments({
    //     end_time: { $gte: dateFrom, $lt: dateTo },
    //     user_is_free: true
    // }).catch(err => console.error("userFree", err))

    // pastMatchesCollection
    //     .distinct("user", {
    //         end_time: { $gte: dateFrom, $lt: dateTo },
    //     })
    //     .then(users => users.length)
    //     .catch(err => {
    //         console.log("ERROR 39 - Paid Users", err);
    //         return 0;
    //     }),
    // pastMatchesCollection
    //     .distinct("user", {
    //         end_time: { $gte: dateFrom, $lt: dateTo },
    //         user_is_free: true
    //     })
    //     .then(users => users.length)
    //     .catch(err => {
    //         console.log("ERROR 39 - Free Users", err);
    //         return 0;
    //     })
    // let user2 = await pastMatchesCollection
    //     .aggregate([
    //         {
    //             $match: {
    //                 end_time: { $gte: dateFrom, $lt: dateTo },
    //                 player_type: 0,
    //             }
    //         },
    //         { $group: { _id: "$user2" } }
    //     ])
    //     .toArray()
    //     .catch(err => console.log("ERROR 40", err));

    // const userVsUser = await pastMatchesCollection
    //     .find({
    //         player_type: 0,
    //         end_time: { $gte: dateFrom, $lt: dateTo }
    //     })
    //     .count()
    //     .catch(err => console.log("ERROR 43", err));

    // const userVsBot = await pastMatchesCollection
    //     .find({
    //         player_type: 1,
    //         end_time: { $gte: dateFrom, $lt: dateTo }
    //     })
    //     .count()
    //     .catch(err => console.log("ERROR 45", err));


    // user1 = user1.map(el => el._id);
    // user2 = user2.map(el => el._id);

    // let player = [...new Set([...user1, ...user2])];

    await userMatchCollection
        .insertOne({
            date: new Date(reportDate),
            player: uniqueUser.length,
            free_play: userFree,
            paid_play: userPaid,
            play_total: userFree + userPaid,
            report_type: reportType
        })
        .catch(err => console.log("ERROR 48", err));

    return true;
}

async function matchWinLoseCount(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    let reportDate = new Date().setDate(new Date().getDate() - 1)

    const db = await database().catch(err => console.log("ERROR 50", err));
    const pastMatchesCollection = db.collection(`bucket_${SINGLE_PAST_MATCHES_BUCKET_ID}`);
    const winLoseCollection = db.collection(`bucket_${WIN_LOSE_MATCHES_BUCKET_ID}`);

    const freeWin = await pastMatchesCollection.countDocuments({
        end_time: { $gte: dateFrom, $lt: dateTo },
        user_is_free: true,
        arrow_count: { $gte: 10 }
    })
    const freeLose = await pastMatchesCollection.countDocuments({
        end_time: { $gte: dateFrom, $lt: dateTo },
        user_is_free: true,
        arrow_count: { $lt: 10 }
    })
    const paidWin = await pastMatchesCollection.countDocuments({
        end_time: { $gte: dateFrom, $lt: dateTo },
        user_is_free: false,
        arrow_count: { $gte: 10 },
    })
    const paidLose = await pastMatchesCollection.countDocuments({
        end_time: { $gte: dateFrom, $lt: dateTo },
        user_is_free: false,
        arrow_count: { $lt: 10 },
    })

    // let paidWin = await pastMatchesCollection
    //     .find({
    //         end_time: { $gte: dateFrom, $lt: dateTo },
    //         $or: [
    //             { user1_is_free: false, winner: 1 },
    //             { user2_is_free: false, winner: 2, player_type: 0 }
    //         ]
    //     })
    //     .count();

    // let paidLose = await pastMatchesCollection
    //     .find({
    //         end_time: { $gte: dateFrom, $lt: dateTo },
    //         $or: [
    //             { user1_is_free: false, winner: 2 },
    //             { user2_is_free: false, winner: 1, player_type: 0 }
    //         ]
    //     })
    //     .count();
    // //free play flow added
    // let freeWin = await pastMatchesCollection
    //     .find({
    //         end_time: { $gte: dateFrom, $lt: dateTo },
    //         $or: [
    //             { user1_is_free: true, winner: 1 },
    //             { user2_is_free: true, winner: 2, player_type: 0 }
    //         ]
    //     })
    //     .count();

    // let freeLose = await pastMatchesCollection
    //     .find({
    //         end_time: { $gte: dateFrom, $lt: dateTo },
    //         $or: [
    //             { user1_is_free: true, winner: 2 },
    //             { user2_is_free: true, winner: 1, player_type: 0 }
    //         ]
    //     })
    //     .count();

    await winLoseCollection
        .insertOne({
            date: new Date(reportDate),
            win_total: paidWin + freeWin,
            lose_total: paidLose + freeLose,
            report_type: reportType,
            win_paid: paidWin,
            win_free: freeWin,
            lose_paid: paidLose,
            lose_free: freeLose
        })
        .catch(err => console.log("ERROR 51", err));

    return true;
}

export async function reportExportSend(title, reportType) {
    Bucket.initialize({ apikey: SECRET_API_KEY });
    await Bucket.data
        .insert(MAILER_BUCKET_ID, {
            title: title,
            template: "report-mail",
            variables: `{"title": "${title}"}`,
            emails: [
                "ayse.sahin@turkcell.com.tr",
                "serdar@polyhagency.com",
                "ozangol@teknodev.biz",
                "serkan@polyhagency.com",
                "emrecandan@teknodev.biz",
                "batuhanevirgen@teknodev.biz"
            ],
            report_type: reportType
        })
        .catch(err => console.log("ERROR: 35", err));
    return true;
}

export async function retryReport(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    let reportDate = new Date().setDate(new Date().getDate() - 1)

    const db = await database().catch(err => console.log("ERROR: 30", err));
    const manualRewardCollection = db.collection(`bucket_${MANUALLY_REWARD_BUCKET_ID}`);
    const retryReportCollection = db.collection(`bucket_${RETRY_REPORT_BUCKET_ID}`);

    let gunluk_false = 0,
        gunluk_true = 0,
        gunluk_free_false = 0,//changed (free flow added)
        gunluk_free_true = 0;

    const manualRewards = await manualRewardCollection.find({
        created_at: {
            $gte: dateFrom,
            $lt: dateTo
        },
        system: true
    }).toArray().catch(err => console.log("ERROR ", err))


    manualRewards.forEach(reward => {
        if (reward.reward == 'gunluk_1') {
            if (reward.process_completed)
                gunluk_false += 1
            else gunluk_false += 1
        } else {
            if (reward.process_completed)
                gunluk_free_true += 1
            else gunluk_free_false += 1
        }
    })

    await retryReportCollection
        .insertOne({
            gunluk_false: gunluk_false,
            gunluk_true: gunluk_true,
            gunluk_free_false: gunluk_free_false,
            gunluk_free_true: gunluk_free_true,
            date: new Date(reportDate),
            report_type: reportType
        })
        .catch(err => console.log("ERROR: 33", err));

    return true;
}

export async function getFailedRewards(reportType, dateFrom, dateTo) {
    dateFrom = new Date(dateFrom);
    dateTo = new Date(dateTo);
    let reportDate = new Date().setDate(new Date().getDate() - 1)

    const db = await database().catch(err => console.log("ERROR ", err));
    const rewardLogsCollection = db.collection(`bucket_${BUGGED_REWARD_BUCKET_ID}`);
    const rewardReportCollection = db.collection(`bucket_${REWARD_REPORT_BUCKET_ID}`);

    let rewardFalse = await rewardLogsCollection
        .aggregate([
            {
                $match: {
                    status: false,
                    date: {
                        $gte: dateFrom,
                        $lt: dateTo
                    }
                }
            },
            { $group: { _id: "$user_text", count: { $sum: 1 } } }
        ])
        .toArray();

    let totalReward = 0;
    for (let reward of rewardFalse) {
        totalReward += reward.count;
    }

    for (let reward of rewardFalse) {
        let data = {
            date: new Date(reportDate),
            count: reward.count,
            ratio: reward.count ? Number(((reward.count / totalReward) * 100).toFixed(2)) : 0,
            error_text: reward._id,
            report_type: reportType
        }
        await rewardReportCollection.insertOne(data).catch(err => console.log("ERROR ", err))
    }

    return true
}

export async function executeReportMan(req, res) {
    let date = new Date().setDate(new Date().getDate() - 1)
    let dateFrom = new Date(date).setHours(0, 0, 0);
    let dateTo = new Date(date).setHours(23, 59, 59);

    await userReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 4", err));
    await playedMatchCount(0, dateFrom, dateTo).catch(err => console.log("ERROR: 49", err));
    await matchReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 2", err));
    await matchWinLoseCount(0, dateFrom, dateTo).catch(err => console.log("ERROR: 55", err));
    await chargeReportExport(0, dateFrom, dateTo).catch(err => console.log("ERROR: 3", err));
    await retryReport(0, dateFrom, dateTo).catch(err => console.log("ERROR: ", err));
    await getFailedRewards(0, dateFrom, dateTo).catch(err => console.log("ERROR: ", err));

    await reportExportSend("Günlük Rapor", 0).catch(err => console.log("ERROR: 5", err));


    return res.status(200).send({ message: 'ok' })
}


export async function executeReportWeeklyMan(req, res) {

    await reportExportSend("Haftalık Toplam Rapor", 1).catch(err => console.log("ERROR: 63", err));
    await reportExportSend("Haftalık Gün Bazlı Rapor", 11).catch(err =>
        console.log("ERROR: 63", err)
    );

    return res.status(200).send({ message: 'ok' });
}

export async function executeReportMonthlyMan(req, res) {

    await reportExportSend("Aylık Gün Bazlı Rapor", 22).catch(err =>
        console.log("ERROR: 163", err)
    );
    await reportExportSend("Aylık Toplam Rapor", 2).catch(err =>
        console.log("ERROR: 163", err)
    );

    return res.status(200).send({ message: 'ok' });
}