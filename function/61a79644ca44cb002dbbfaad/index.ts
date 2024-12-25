import { database, ObjectId } from "@spica-devkit/database";
import * as Bucket from "@spica-devkit/bucket";
const nodemailer = require("nodemailer");

const nodeMailerUser = process.env.SMTP_USER || null;
const nodeMailerHost = process.env.SMTP_HOST || null;
const nodeMailerPassword = process.env.SMTP_PASSWORD || null;
const mailFrom = process.env.MAIL_FROM || null;

const MATCH_REPORT_BUCKET_ID = process.env.MATCH_REPORT_BUCKET_ID;
const CHARGE_REPORT_BUCKET_ID = process.env.CHARGE_REPORT_BUCKET_ID;
const USERS_REPORT_BUCKET_ID = process.env.USERS_REPORT_BUCKET_ID;
const USERS_MATCH_REPORT_BUCKET_ID = process.env.USERS_MATCH_REPORT_BUCKET_ID;
const WIN_LOSE_MATCHES_BUCKET_ID = process.env.WIN_LOSE_MATCHES_BUCKET_ID;
const RETRY_REPORT_BUCKET_ID = process.env.RETRY_REPORT_BUCKET_ID;
const REWARD_REPORT_BUCKET_ID = process.env.REWARD_REPORT_BUCKET_ID;

/*
    REPORT TYPES: 
        0 - Günlük Raport
        1 - Haftalık Rapor
        11 - Haftalık (Gün Bazlı) Rapor
        2 - Aylık Rapor
        22 - Aylık (Gün Bazlı) Rapor
*/

export default async function (change) {
    let buckets = {
        templates: process.env.TEMPLATES_BUCKET_ID
    };

    Bucket.initialize({ apikey: process.env.MAILER_API_KEY });
    let template = await Bucket.data
        .getAll(buckets.templates, {
            queryParams: { filter: `template=='${change.current.template}'` }
        })
        .catch(err => console.log("ERROR 42", err));
    template = template[0];

    let variables = JSON.parse(change.current.variables);
    let emails = change.current.emails;
    let reportType = change.current.report_type;

    const html = await getData(reportType).catch(err => console.log("ERROR 9", err));

    if (emails.length) {
        for (let email of emails) {
            _sendEmail(variables, email, template.subject, html);
        }
    }
}

function _sendEmail(variables, email, subject, html) {
    if (nodeMailerHost && nodeMailerUser && nodeMailerPassword && mailFrom) {
        var transporter = nodemailer.createTransport({
            direct: true,
            host: nodeMailerHost,
            port: 465,
            auth: {
                user: nodeMailerUser,
                pass: nodeMailerPassword
            },
            secure: true
        });

        var mailOptions = {
            from: mailFrom,
            to: email,
            subject: subject,
            html:
                "<html><head><meta http-equiv='Content-Type' content='text/plain'></head><body><table><tr><td>" +
                `<h3>${variables.title}</h3> ${html}` +
                "</td></tr></table></body></html>"
        };

        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log("Email sent: " + info.response);
            }
        });
    } else {
        console.log("Please set your all ENVIRONMENT VARIABLES");
        return null;
    }
}

async function getData(reportType) {
    let date = new Date();
    if (reportType == 0) {
        date.setHours(date.getHours() - 26);
    } else if (reportType == 11 || reportType == 1) {
        date.setDate(date.getDate() - 7);
        date.setHours(date.getHours() - 6);
    } else if (reportType == 22 || reportType == 2) {
        date.setMonth(date.getMonth() - 1);
        date.setHours(date.getHours() - 5);
    } else {
        return true;
    }

    let dateFilter = {
        $gte: new Date(date),
        $lte: new Date()
    }

    const usersHtml = await usersReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 27", err)
    );
    const playedMatchHtml = await playedMatchCount(reportType, dateFilter).catch(err =>
        console.log("ERROR 23", err)
    );
    const matchGeneralHtml = await matchGeneralReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 24", err)
    );
    const matchWinLoseHtml = await matchWinLoseCount(reportType, dateFilter).catch(err =>
        console.log("ERROR 22", err)
    );
    const chargeHtml = await chargeReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 26", err)
    );
    const rewardHtml = await rewardReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 25", err)
    );
    const retryHtml = await retryReport(reportType, dateFilter).catch(err =>
        console.log("ERROR 26", err)
    );

    let html =
        usersHtml +
        "<br/><br/>" +
        playedMatchHtml +
        "<br/><br/>" +
        matchGeneralHtml +
        "<br/><br/>" +
        matchWinLoseHtml +
        "<br/><br/>" +
        rewardHtml +
        "<br/><br/>" +
        chargeHtml +
        "<br/><br/>" +
        retryHtml

    return html;
}

async function usersReport(reportType, dateFilter) {
    let defaultReportType;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await database();
    const usersCollection = db.collection(`bucket_${USERS_REPORT_BUCKET_ID}`);

    let usersData = await usersCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 41", e);
            return res.status(400).send({ message: e });
        });


    if (defaultReportType == 2 || defaultReportType == 1) {
        let currentDate = new Date();
        let totalUser = 0;
        let totalNewUser = 0;
        usersData.forEach(data => {
            totalUser = data.total_user;
            totalNewUser += data.new_user;
        });
        usersData = [
            {
                date: currentDate.setDate(currentDate.getDate() - 1),
                total_user: totalUser,
                new_user: totalNewUser
            }
        ];
    }

    let tableBody = "";
    usersData.forEach(data => {
        tableBody += `
            <tr>
             <td style="width: 33.3%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 33.3%;">${numberWithDot(data.total_user)}</td>
             <td style="width: 33.3%;">${numberWithDot(data.new_user)}</td>
            </tr>`;
    });

    let userHtml = `
        <h4>Kullanıcı Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 33.3%; text-align:left">Tarih</th>
            <th style="width: 33.3%; text-align:left">Toplam Kullanıcı</th>
            <th style="width: 33.3%; text-align:left">Yeni Kullanıcı</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;

    return userHtml;
}

async function playedMatchCount(reportType, dateFilter) {
    let htmlType = 0;
    let defaultReportType = reportType;

    if (reportType == 11) {
        htmlType = 11;
    }
    if (reportType == 22) {
        htmlType = 22;
    }
    reportType = 0;

    const db = await database();
    const userMatchesCollection = db.collection(`bucket_${USERS_MATCH_REPORT_BUCKET_ID}`);

    let userMatches = await userMatchesCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 43", e);
            return res.status(400).send({ message: e });
        });

    if (defaultReportType == 1 || defaultReportType == 2) {
        let player = 0;
        let play_total = 0;
        let paid_play = 0;
        let free_play = 0;
        userMatches.forEach(data => {
            player += data.player;
            play_total += data.play_total;
            paid_play += data.paid_play;
            free_play += data.free_play;

        });
        userMatches = [
            {
                player: player,
                play_total: play_total,
                paid_play: paid_play,
                free_play: free_play,
            }
        ];
    }

    let html;
    if (htmlType == 11 || htmlType == 22) {
        let tableBody = "";
        userMatches.forEach(data => {
            tableBody += `
            <tr>
             <td style="width: 20%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 20%;">${numberWithDot(data.player)}</td>
             <td style="width: 20%;">${numberWithDot(data.play_total)}</td>
             <td style="width: 20%;">${numberWithDot(data.free_play)}</td>
             <td style="width: 20%;">${numberWithDot(data.paid_play)}</td>
            </tr>`;
        });
        html = `
        <h4>Kullanıcı-Oyun Raporu</h4>
         <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 20%; text-align:left">Tarih</th>
            <th style="width: 20%; text-align:left">Oynayan Kullanıcı</th>
            <th style="width: 20%; text-align:left">Oyun Sayısı</th>
            <th style="width: 20%; text-align:left">Ücretsiz Oyun Sayısı</th>
            <th style="width: 20%; text-align:left">Ücretli Oyun Sayısı</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;
    } else {
        html = `
        <h4>Kullanıcı-Oyun Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
                <tr>
                    <th style="width: 20%; text-align:left;">Toplam</th>
                    <th style="width: 20%; text-align:left;">Oynayan Kullanıcı</th>
                    <th style="width: 20%; text-align:left;">Toplam Oyun</th>
                    <th style="width: 20%; text-align:left">Ücretsiz Oyun Sayısı</th>
                    <th style="width: 20%; text-align:left">Ücretli Oyun Sayısı</th>
                </tr>
                 <tr>
                    <td style="width: 20%;">Toplam</td>
                    <td style="width: 20%;">${numberWithDot(userMatches[0].player)}</td>
                    <td style="width: 20%;">${numberWithDot(userMatches[0].play_total)}</td>
                    <td style="width: 20%;">${numberWithDot(userMatches[0].free_play)}</td>
                    <td style="width: 20%;">${numberWithDot(userMatches[0].paid_play)}</td
                </tr>
            </tbody>
        </table>`;
    }

    return html;
}

async function matchGeneralReport(reportType, dateFilter) {
    let htmlType = 0;
    let defaultReportType = reportType;

    if (reportType == 11) {
        htmlType = 11;
    }
    if (reportType == 22) {
        htmlType = 22;
    }
    reportType = 0;

    const db = await database();
    const matchCollection = db.collection(`bucket_${MATCH_REPORT_BUCKET_ID}`);

    let matchData = await matchCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 38", e);
            return res.status(400).send({ message: e });
        });

    if (defaultReportType == 1 || defaultReportType == 2) {
        let totalPlay = 0;
        let totalArrowsAverage = 0;
        let dayCounter = 0;

        matchData.forEach(data => {
            dayCounter += 1;
            totalPlay += data.play_count;
            totalArrowsAverage += Number(data.arrows_average || 0);
        });

        matchData = [
            {
                play_count: totalPlay,
                arrows_average: Number((totalArrowsAverage / dayCounter).toFixed(1))
            }
        ];
    }

    let html;
    if (htmlType == 11 || htmlType == 22) {
        let tableBody = "";
        matchData.forEach(data => {
            tableBody += `
            <tr>
             <td style="width: 7.6%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 7.6%;">${numberWithDot(data.play_count)}</td>
             <td style="width: 7.6%;">${data.arrows_average}</td>
            </tr>`;
        });
        html = `
        <h4>Oyun Raporu</h4>
         <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 9%; text-align:left">Tarih</th>
            <th style="width: 9%; text-align:left">Oyun Sayısı</th>
            <th style="width: 9%; text-align:left">Ortalama Atılan Ok Sayısı</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;
    } else {
        html = `
        <h4>Oyun Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
             <tr>
                <td style="width: 14.2%;"></td>
                <td style="width: 14.2%; font-weight: bold;">Oyun Sayısı</td>
                <td style="width: 14.2%; font-weight: bold;">Ortalama Atılan Ok Sayısı</td>
            </tr>
             <tr>
                <td style="width: 14.2%; font-weight: bold;">Toplam</td>
                <td style="width: 14.2%;">${numberWithDot(matchData[0].play_count)}</td>
                <td style="width: 14.2%;">${matchData[0].arrows_average}</td>
            </tr>
            </tbody>
        </table>`;
    }

    return html;
}


async function matchWinLoseCount(reportType, dateFilter) {
    let htmlType = 0;
    let defaultReportType = reportType;

    if (reportType == 11) {
        htmlType = 11;
    }
    if (reportType == 22) {
        htmlType = 22;
    }
    reportType = 0;

    const db = await database();
    const winLoseCollection = db.collection(`bucket_${WIN_LOSE_MATCHES_BUCKET_ID}`);

    let winLoseData = await winLoseCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 44", e);
            return res.status(400).send({ message: e });
        });

    if (defaultReportType == 1 || defaultReportType == 2) {
        let winTotal = 0;
        let loseTotal = 0;
        let winFree = 0;
        let loseFree = 0;
        let winPaid = 0;
        let losePaid = 0;

        winLoseData.forEach(data => {
            winTotal += data.win_total;
            loseTotal += data.lose_total;
            winFree += data.win_free;
            loseFree += data.lose_free;
            winPaid += data.win_paid;
            losePaid += data.lose_paid;

        });
        winLoseData = [
            {
                win_total: winTotal,
                lose_total: loseTotal,
                win_free: winFree,
                lose_free: loseFree,
                win_paid: winPaid,
                lose_paid: losePaid
            }
        ];
    }

    let html;
    if (htmlType == 11 || htmlType == 22) {
        let tableBody = "";
        winLoseData.forEach(data => {
            tableBody += `
            <tr>
             <td style="width: 14.2%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 14.2%;">${numberWithDot(data.win_total)}</td>
             <td style="width: 14.2%;">${numberWithDot(data.lose_total)}</td>
             <td style="width: 14.2%;">${numberWithDot(data.win_free)}</td>
             <td style="width: 14.2%;">${numberWithDot(data.lose_free)}</td>
             <td style="width: 14.2%;">${numberWithDot(data.win_paid)}</td>
             <td style="width: 14.2%;">${numberWithDot(data.lose_paid)}</td>
            </tr>`;
        });
        html = `
        <h4>Kullanıcılar (Kazanılan/Kaybedilen) Maç Raporu</h4>
         <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 14.2%; text-align:left">Tarih</th>
            <th style="width: 14.2%; text-align:left">Kazanılan Maç</th>
            <th style="width: 14.2%; text-align:left">Kaybedilen Maç</th>
            <th style="width: 14.2%; text-align:left">Ücretsiz Kazanılan Maç</th>
            <th style="width: 14.2%; text-align:left">Ücretsiz Kaybedilen Maç</th>
            <th style="width: 14.2%; text-align:left">Ücretli Kazanılan Maç</th>
            <th style="width: 14.2%; text-align:left">Ücretli Kaybedilen Maç</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;
    } else {
        html = `
        <h4>Kullanıcılar (Kazanılan/Kaybedilen) Maç Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
                <tr>
                    <td style="width: 14.2%;"></td>
                    <td style="width: 14.2%; font-weight: bold;">Kazanılan Maç</td>
                    <td style="width: 14.2%; font-weight: bold;">Kaybedilen Maç</td>
                    <th style="width: 14.2%; font-weight: bold;">Ücretsiz Kazanılan Maç</th>
                    <th style="width: 14.2%; font-weight: bold;">Ücretsiz Kaybedilen Maç</th>
                    <th style="width: 14.2%; font-weight: bold;">Ücretli Kazanılan Maç</th>
                    <th style="width: 14.2%; font-weight: bold;">Ücretli Kaybedilen Maç</th>
                </tr>
                <tr>
                    <td style="width: 14.2%; font-weight: bold;">Toplam</td>
                    <td style="width: 14.2%;">${numberWithDot(winLoseData[0].win_total)}</td>
                    <td style="width: 14.2%;">${numberWithDot(winLoseData[0].lose_total)}</td>
                    <td style="width: 14.2%;">${numberWithDot(winLoseData[0].win_free)}</td>
                    <td style="width: 14.2%;">${numberWithDot(winLoseData[0].lose_free)}</td>
                    <td style="width: 14.2%;">${numberWithDot(winLoseData[0].win_paid)}</td>
                    <td style="width: 14.2%;">${numberWithDot(winLoseData[0].lose_paid)}</td>
                </tr>
            </tbody>
        </table>`;
    }

    return html;
}

async function chargeReport(reportType, dateFilter) {
    let defaultReportType;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await database();
    const chargeCollection = db.collection(`bucket_${CHARGE_REPORT_BUCKET_ID}`);

    let chargeData = await chargeCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 47", e);
            return res.status(400).send({ message: e });
        });

    if (defaultReportType == 1 || defaultReportType == 2) {
        let result = [];
        chargeData.reduce(function (res, value) {
            if (!res[value.error]) {
                res[value.error] = {
                    status: value.status,
                    daily_qty: 0,
                    //chance_daily_qty: 0,
                    error: value.error
                };
                result.push(res[value.error]);
            }
            res[value.error].daily_qty += value.daily_qty;
            res[value.error].chance_daily_qty += value.chance_daily_qty;

            return res;
        }, {});
        chargeData = result;
    }

    let chargeBody = "";
    let totalDailyQty = 0;
    //let totalChanceDailyQty = 0;

    chargeData.forEach((charge, index) => {
        totalDailyQty += charge.daily_qty;
        //totalChanceDailyQty += charge.chance_daily_qty;
    })

    chargeData.forEach((charge, index) => {
        let date = charge.date;
        if (defaultReportType == 1 || defaultReportType == 2) {
            let now = new Date();
            date = now.setDate(now.getDate() - 1);
        }

        let dailyRatio = defaultReportType == 1 ? charge.daily_qty == 0 ? 0 : ((charge.daily_qty / totalDailyQty) * 100).toFixed(2) : charge.daily_ratio;
        //let chanceDailyRatio = defaultReportType == 1 ? charge.chance_daily_qty == 0 ? 0 : ((charge.chance_daily_qty / totalChanceDailyQty) * 100).toFixed(2) : charge.chance_daily_ratio;

        chargeBody += `<tr>
                    <td style="width: 10%;">${new Date(date).toLocaleDateString()}</td>
                    <td style="width: 10%;">${numberWithDot(charge.daily_qty)}</td>
                    <td style="width: 10%;">${dailyRatio}</td>
                    <td style="width: 10%;">${charge.status}</td>
                    <td style="width: 40%;">${charge.error}</td>
                    </tr>
                    `;
        (index + 1) % 8 == 0
            ? (chargeBody += `
        <tr>
            <td style="width: 10%;">---</td>
            <td style="width: 10%;">---</td>
            <td style="width: 10%;">---</td>
            <td style="width: 10%;">---</td>
            <td style="width: 40%;">---</td>
        </tr>`)
            : undefined;
    });

    let chargeHtml = `
        <h4>Charging Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 10%; text-align:left">Tarih</th>
            <th style="width: 10%; text-align:left">Gunluk</th>
            <th style="width: 10%; text-align:left">Gunluk Oran</th>
            <th style="width: 10%; text-align:left">Sonu&ccedil;</th>
            <th style="width: 50%; text-align:left">Hata Detayı</th>
            </tr>
            ${chargeBody}
             <tr>
                <th style="width: 10%; text-align:left">Toplam</th>
                <th style="width: 10%; text-align:left">${numberWithDot(totalDailyQty)}</th>
                <th style="width: 10%; text-align:left">-</th>
                <th style="width: 10%; text-align:left">-</th>
                <th style="width: 40%; text-align:left">-</th>
            </tr>
            </tbody>
        </table>`;

    return chargeHtml;
}

async function rewardReport(reportType, dateFilter) {
    let defaultReportType;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await database();
    const rewardCollection = db.collection(`bucket_${REWARD_REPORT_BUCKET_ID}`);

    let rewardData = await rewardCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 47", e);
            return res.status(400).send({ message: e });
        });

    if (defaultReportType == 1 || defaultReportType == 2) {
        let result = [];
        rewardData.reduce(function (res, value) {
            if (!res[value.error_text]) {
                res[value.error_text] = {
                    count: 0,
                    error_text: value.error_text
                };
                result.push(res[value.error_text]);
            }
            res[value.error_text].count += value.count;
            return res;
        }, {});
        rewardData = result;
    }

    let rewardBody = "";
    let total = 0;
    rewardData.forEach((reward, index) => {
        let date = reward.date;
        if (defaultReportType == 1 || defaultReportType == 2) {
            let now = new Date();
            date = now.setDate(now.getDate() - 1);
        }
        total += reward.count;
        rewardBody += `<tr>
                    <td style="width: 10%;">${new Date(date).toLocaleDateString()}</td>
                    <td style="width: 10%;">${numberWithDot(reward.count)}</td>
                    <td style="width: 80%;">${reward.error_text}</td>
                    </tr>
                    `;
    });

    let rewardHtml = `
        <h4>Reward Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 10%; text-align:left">Tarih</th>
            <th style="width: 10%; text-align:left">Adet</th>
            <th style="width: 80%; text-align:left">Hata Detayı</th>
            </tr>
            ${rewardBody}
             <tr>
            <th style="width: 10%; text-align:left">Toplam</th>
            <th style="width: 10%; text-align:left">${numberWithDot(total)}</th>
            <th style="width: 80%; text-align:left">-</th>
            </tr>
            </tbody>
        </table>`;

    return rewardHtml;
}

async function retryReport(reportType, dateFilter) {
    let defaultReportType;
    if (reportType == 1 || reportType == 11 || reportType == 22 || reportType == 2) {
        defaultReportType = reportType;
        reportType = 0;
    }

    const db = await database();
    const retryCollection = db.collection(`bucket_${RETRY_REPORT_BUCKET_ID}`);

    let retryData = await retryCollection
        .find({ report_type: reportType, date: dateFilter })
        .toArray()
        .catch(e => {
            console.log("ERROR 41", e);
            return res.status(400).send({ message: e });
        });

    if (defaultReportType == 1 || defaultReportType == 2) {
        let currentDate = new Date();
        let gunluk_false = 0;
        let gunluk_true = 0;
        let firsat_gunluk_false = 0;
        let firsat_gunluk_true = 0;

        retryData.forEach(data => {
            gunluk_false += data.gunluk_false;
            gunluk_true += data.gunluk_true;
            firsat_gunluk_false += data.firsat_gunluk_false;
            firsat_gunluk_true += data.firsat_gunluk_true;
        });
        retryData = [
            {
                date: currentDate.setDate(currentDate.getDate() - 1),
                gunluk_false: gunluk_false,
                gunluk_true: gunluk_true,
                firsat_gunluk_false: firsat_gunluk_false,
                firsat_gunluk_true: firsat_gunluk_true
            }
        ];
    }

    let tableBody = "";
    retryData.forEach(data => {
        tableBody += `
            <tr>
             <td style="width: 20%;">${new Date(data.date).toLocaleDateString()}</td>
             <td style="width: 20%;">${numberWithDot(data.gunluk_false)}</td>
             <td style="width: 20%;">${numberWithDot(data.gunluk_true)}</td>
             <td style="width: 20%;">${numberWithDot(data.firsat_gunluk_false)}</td>
             <td style="width: 20%;">${numberWithDot(data.firsat_gunluk_true)}</td>
            </tr>`;
    });

    let retryHtml = `
        <h4>Retry Raporu</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
            <tr>
            <th style="width: 20%; text-align:left">Tarih</th>
            <th style="width: 20%; text-align:left">Günlük Başarısız</th>
            <th style="width: 20%; text-align:left">Günlük Başarılı</th>
            <th style="width: 20%; text-align:left">Fırsat Günlük Başarısız</th>
            <th style="width: 20%; text-align:left">Fırsat Günlük Başarılı</th>
            </tr>
           ${tableBody}
            </tbody>
        </table>`;

    return retryHtml;
}

function numberWithDot(x) {
    if (!x) {
        return '-'
    }
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
