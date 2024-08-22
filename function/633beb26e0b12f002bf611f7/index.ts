import { database, ObjectId } from "@spica-devkit/database";
import axios from 'axios'
const json2csv = require("json2csv").parse;
const admz = require("adm-zip");

const USER_BUCKET = process.env.USER_BUCKET;
const PAST_MATCHES_BUCKET = process.env.PAST_MATCHES_BUCKET;
const GAME_LEAGUE_PARTICIPANTS = process.env.GAME_LEAGUE_PARTICIPANTS;
const DRAW_LOGS = process.env.DRAW_LOGS;
const CHARGE_BUCKET = process.env.CHARGE_BUCKET;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;


const wordsArr = ["abaza", "abazan", "ag", "a\u011fz\u0131na s\u0131\u00e7ay\u0131m", "ahmak", "allah", "allahs\u0131z", "am", "amar\u0131m", "ambiti", "am biti", "amc\u0131\u011f\u0131", "amc\u0131\u011f\u0131n", "amc\u0131\u011f\u0131n\u0131", "amc\u0131\u011f\u0131n\u0131z\u0131", "amc\u0131k", "amc\u0131k ho\u015faf\u0131", "amc\u0131klama", "amc\u0131kland\u0131", "amcik", "amck", "amckl", "amcklama", "amcklaryla", "amckta", "amcktan", "amcuk", "am\u0131k", "am\u0131na", "am\u0131nako", "am\u0131na koy", "am\u0131na koyar\u0131m", "am\u0131na koyay\u0131m", "am\u0131nakoyim", "am\u0131na koyyim", "am\u0131na s", "am\u0131na sikem", "am\u0131na sokam", "am\u0131n feryad\u0131", "am\u0131n\u0131", "am\u0131n\u0131 s", "am\u0131n oglu", "am\u0131no\u011flu", "am\u0131n o\u011flu", "am\u0131s\u0131na", "am\u0131s\u0131n\u0131", "amina", "amina g", "amina k", "aminako", "aminakoyarim", "amina koyarim", "amina koyay\u0131m", "amina koyayim", "aminakoyim", "aminda", "amindan", "amindayken", "amini", "aminiyarraaniskiim", "aminoglu", "amin oglu", "amiyum", "amk", "amkafa", "amk \u00e7ocu\u011fu", "amlarnzn", "aml\u0131", "amm", "ammak", "ammna", "amn", "amna", "amnda", "amndaki", "amngtn", "amnn", "amona", "amq", "ams\u0131z", "amsiz", "amsz", "amteri", "amugaa", "amu\u011fa", "amuna", "ana", "anaaann", "anal", "analarn", "anam", "anamla", "anan", "anana", "anandan", "anan\u0131", "anan\u0131", "anan\u0131n", "anan\u0131n am", "anan\u0131n am\u0131", "anan\u0131n d\u00f6l\u00fc", "anan\u0131nki", "anan\u0131sikerim", "anan\u0131 sikerim", "anan\u0131sikeyim", "anan\u0131 sikeyim", "anan\u0131z\u0131n", "anan\u0131z\u0131n am", "anani", "ananin", "ananisikerim", "anani sikerim", "ananisikeyim", "anani sikeyim", "anann", "ananz", "anas", "anas\u0131n\u0131", "anas\u0131n\u0131n am", "anas\u0131 orospu", "anasi", "anasinin", "anay", "anayin", "angut", "anneni", "annenin", "annesiz", "anuna", "aptal", "aq", "a.q", "a.q.", "aq.", "ass", "atkafas\u0131", "atm\u0131k", "att\u0131rd\u0131\u011f\u0131m", "attrrm", "auzlu", "avrat", "ayklarmalrmsikerim", "azd\u0131m", "azd\u0131r", "azd\u0131r\u0131c\u0131", "babaannesi ka\u015far", "baban\u0131", "baban\u0131n", "babani", "babas\u0131 pezevenk", "baca\u011f\u0131na s\u0131\u00e7ay\u0131m", "bac\u0131na", "bac\u0131n\u0131", "bac\u0131n\u0131n", "bacini", "bacn", "bacndan", "bacy", "bastard", "basur", "beyinsiz", "b\u0131z\u0131r", "bitch", "biting", "bok", "boka", "bokbok", "bok\u00e7a", "bokhu", "bokkkumu", "boklar", "boktan", "boku", "bokubokuna", "bokum", "bombok", "boner", "bosalmak", "bo\u015falmak", "cenabet", "cibiliyetsiz", "cibilliyetini", "cibilliyetsiz", "cif", "cikar", "cim", "\u00e7\u00fck", "dalaks\u0131z", "dallama", "daltassak", "dalyarak", "dalyarrak", "dangalak", "dassagi", "diktim", "dildo", "dingil", "dingilini", "dinsiz", "dkerim", "domal", "domalan", "domald\u0131", "domald\u0131n", "domal\u0131k", "domal\u0131yor", "domalmak", "domalm\u0131\u015f", "domals\u0131n", "domalt", "domaltarak", "domalt\u0131p", "domalt\u0131r", "domalt\u0131r\u0131m", "domaltip", "domaltmak", "d\u00f6l\u00fc", "d\u00f6nek", "d\u00fcd\u00fck", "eben", "ebeni", "ebenin", "ebeninki", "ebleh", "ecdad\u0131n\u0131", "ecdadini", "embesil", "emi", "fahise", "fahi\u015fe", "feri\u015ftah", "ferre", "fuck", "fucker", "fuckin", "fucking", "gavad", "gavat", "geber", "geberik", "gebermek", "gebermi\u015f", "gebertir", "ger\u0131zekal\u0131", "gerizekal\u0131", "gerizekali", "gerzek", "giberim", "giberler", "gibis", "gibi\u015f", "gibmek", "gibtiler", "goddamn", "godo\u015f", "godumun", "gotelek", "gotlalesi", "gotlu", "gotten", "gotundeki", "gotunden", "gotune", "gotunu", "gotveren", "goyiim", "goyum", "goyuyim", "goyyim", "g\u00f6t", "g\u00f6t deli\u011fi", "g\u00f6telek", "g\u00f6t herif", "g\u00f6tlalesi", "g\u00f6tlek", "g\u00f6to\u011flan\u0131", "g\u00f6t o\u011flan\u0131", "g\u00f6to\u015f", "g\u00f6tten", "g\u00f6t\u00fc", "g\u00f6t\u00fcn", "g\u00f6t\u00fcne", "g\u00f6t\u00fcnekoyim", "g\u00f6t\u00fcne koyim", "g\u00f6t\u00fcn\u00fc", "g\u00f6tveren", "g\u00f6t veren", "g\u00f6t verir", "gtelek", "gtn", "gtnde", "gtnden", "gtne", "gtten", "gtveren", "hasiktir", "hassikome", "hassiktir", "has siktir", "hassittir", "haysiyetsiz", "hayvan herif", "ho\u015faf\u0131", "h\u00f6d\u00fck", "hsktr", "huur", "\u0131bnel\u0131k", "ibina", "ibine", "ibinenin", "ibne", "ibnedir", "ibneleri", "ibnelik", "ibnelri", "ibneni", "ibnenin", "ibnerator", "ibnesi", "idiot", "idiyot", "imansz", "ipne", "iserim", "i\u015ferim", "ito\u011flu it", "kafam girsin", "kafas\u0131z", "kafasiz", "kahpe", "kahpenin", "kahpenin feryad\u0131", "kaka", "kaltak", "kanc\u0131k", "kancik", "kappe", "karhane", "ka\u015far", "kavat", "kavatn", "kaypak", "kayyum", "kerane", "kerhane", "kerhanelerde", "kevase", "keva\u015fe", "kevvase", "koca g\u00f6t", "kodu\u011fmun", "kodu\u011fmunun", "kodumun", "kodumunun", "koduumun", "koyarm", "koyay\u0131m", "koyiim", "koyiiym", "koyim", "koyum", "koyyim", "krar", "kukudaym", "laciye boyad\u0131m", "lavuk", "libo\u015f", "madafaka", "mal", "malafat", "malak", "manyak", "mcik", "meme", "memelerini", "mezveleli", "minaamc\u0131k", "mincikliyim", "mna", "monakkoluyum", "motherfucker", "mudik", "oc", "ocuu", "ocuun", "O\u00c7", "o\u00e7", "o. \u00e7ocu\u011fu", "o\u011flan", "o\u011flanc\u0131", "o\u011flu it", "orosbucocuu", "orospu", "orospucocugu", "orospu cocugu", "orospu \u00e7oc", "orospu\u00e7ocu\u011fu", "orospu \u00e7ocu\u011fu", "orospu \u00e7ocu\u011fudur", "orospu \u00e7ocuklar\u0131", "orospudur", "orospular", "orospunun", "orospunun evlad\u0131", "orospuydu", "orospuyuz", "orostoban", "orostopol", "orrospu", "oruspu", "oruspu\u00e7ocu\u011fu", "oruspu \u00e7ocu\u011fu", "osbir", "ossurduum", "ossurmak", "ossuruk", "osur", "osurduu", "osuruk", "osururum", "otuzbir", "\u00f6k\u00fcz", "\u00f6\u015fex", "patlak zar", "penis", "pezevek", "pezeven", "pezeveng", "pezevengi", "pezevengin evlad\u0131", "pezevenk", "pezo", "pic", "pici", "picler", "pi\u00e7", "pi\u00e7in o\u011flu", "pi\u00e7 kurusu", "pi\u00e7ler", "pipi", "pipi\u015f", "pisliktir", "porno", "pussy", "pu\u015ft", "pu\u015fttur", "rahminde", "revizyonist", "s1kerim", "s1kerm", "s1krm", "sakso", "saksofon", "salaak", "salak", "saxo", "sekis", "serefsiz", "sevgi koyar\u0131m", "sevi\u015felim", "sexs", "s\u0131\u00e7ar\u0131m", "s\u0131\u00e7t\u0131\u011f\u0131m", "s\u0131ecem", "sicarsin", "sie", "sik", "sikdi", "sikdi\u011fim", "sike", "sikecem", "sikem", "siken", "sikenin", "siker", "sikerim", "sikerler", "sikersin", "sikertir", "sikertmek", "sikesen", "sikesicenin", "sikey", "sikeydim", "sikeyim", "sikeym", "siki", "sikicem", "sikici", "sikien", "sikienler", "sikiiim", "sikiiimmm", "sikiim", "sikiir", "sikiirken", "sikik", "sikil", "sikildiini", "sikilesice", "sikilmi", "sikilmie", "sikilmis", "sikilmi\u015f", "sikilsin", "sikim", "sikimde", "sikimden", "sikime", "sikimi", "sikimiin", "sikimin", "sikimle", "sikimsonik", "sikimtrak", "sikin", "sikinde", "sikinden", "sikine", "sikini", "sikip", "sikis", "sikisek", "sikisen", "sikish", "sikismis", "siki\u015f", "siki\u015fen", "siki\u015fme", "sikitiin", "sikiyim", "sikiym", "sikiyorum", "sikkim", "sikko", "sikleri", "sikleriii", "sikli", "sikm", "sikmek", "sikmem", "sikmiler", "sikmisligim", "siksem", "sikseydin", "sikseyidin", "siksin", "siksinbaya", "siksinler", "siksiz", "siksok", "siksz", "sikt", "sikti", "siktigimin", "siktigiminin", "sikti\u011fim", "sikti\u011fimin", "sikti\u011fiminin", "siktii", "siktiim", "siktiimin", "siktiiminin", "siktiler", "siktim", "siktim", "siktimin", "siktiminin", "siktir", "siktir et", "siktirgit", "siktir git", "siktirir", "siktiririm", "siktiriyor", "siktir lan", "siktirolgit", "siktir ol git", "sittimin", "sittir", "skcem", "skecem", "skem", "sker", "skerim", "skerm", "skeyim", "skiim", "skik", "skim", "skime", "skmek", "sksin", "sksn", "sksz", "sktiimin", "sktrr", "skyim", "slaleni", "sokam", "sokar\u0131m", "sokarim", "sokarm", "sokarmkoduumun", "sokay\u0131m", "sokaym", "sokiim", "soktu\u011fumunun", "sokuk", "sokum", "soku\u015f", "sokuyum", "soxum", "sulaleni", "s\u00fclaleni", "s\u00fclalenizi", "s\u00fcrt\u00fck", "\u015ferefsiz", "\u015f\u0131ll\u0131k", "taaklarn", "taaklarna", "tarrakimin", "tasak", "tassak", "ta\u015fak", "ta\u015f\u015fak", "tipini s.k", "tipinizi s.keyim", "tiyniyat", "toplarm", "topsun", "toto\u015f", "vajina", "vajinan\u0131", "veled", "veledizina", "veled i zina", "verdiimin", "weled", "weledizina", "whore", "xikeyim", "yaaraaa", "yalama", "yalar\u0131m", "yalarun", "yaraaam", "yarak", "yaraks\u0131z", "yaraktr", "yaram", "yaraminbasi", "yaramn", "yararmorospunun", "yarra", "yarraaaa", "yarraak", "yarraam", "yarraam\u0131", "yarragi", "yarragimi", "yarragina", "yarragindan", "yarragm", "yarra\u011f", "yarra\u011f\u0131m", "yarra\u011f\u0131m\u0131", "yarraimin", "yarrak", "yarram", "yarramin", "yarraminba\u015f\u0131", "yarramn", "yarran", "yarrana", "yarrrak", "yavak", "yav\u015f", "yav\u015fak", "yav\u015fakt\u0131r", "yavu\u015fak", "y\u0131l\u0131\u015f\u0131k", "yilisik", "yogurtlayam", "yo\u011furtlayam", "yrrak", "z\u0131kk\u0131m\u0131m", "zibidi", "zigsin", "zikeyim", "zikiiim", "zikiim", "zikik", "zikim", "ziksiiin", "ziksiin", "zulliyetini", "zviyetini"]

export async function replaceAbusiveName() {
    const dateNow = new Date();
    let filterDate = new Date(dateNow.setMinutes(dateNow.getMinutes() - 90))

    const db = await database().catch(err => console.log("ERROR 1", err));
    const userData = await db
        .collection(`bucket_${USER_BUCKET}`)
        .find({ created_at: { $gte: filterDate }, name: { $in: wordsArr } }).toArray()
        .catch(err => console.log("ERROR 2", err));

    for (const user of userData) {
        console.log(`user_id: ${user._id} - name: ${user.name}`)
        let random = Math.floor(Math.random() * 100000) + 1
        await db
            .collection(`bucket_${USER_BUCKET}`)
            .updateOne({ _id: ObjectId(user._id) }, { $set: { name: `Kullanıcı34${random}` } })
            .catch(err => console.log("ERROR 2", err));
    }
}
export async function getMyIp(req, res) {
    const response = await axios.get("https://api.ipify.org?format=json")
    // await Api.httpRequest("get", "https://api.ipify.org?format=json").catch(console.error)
    console.log("data", response)
    console.log("rtrerwrwertdrtrd")

    return res.status(200).send({ message: 'ok' })
}
export async function checkUserFreePlay(req, res) {
    const db = await database();
    const { msisdn } = req.body;

    if (msisdn) {
        const usersCollection = db.collection(`bucket_${USER_BUCKET}`);
        const pastMatchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET}`);

        const identityCollection = db.collection(`identity`);

        const identity = await identityCollection
            .findOne({ "attributes.msisdn": msisdn })
        //.catch(err => console.log("ERROR 12 ", err));

        if (!identity) {
            // User has no identity, return false
            return false;
        }
        const user = await usersCollection
            .findOne({ identity: identity._id.toString() })
            .catch(err => console.log("ERROR 13 ", err));
        if (!user) {

            return false;
        }
        let userId = user._id;

        let dateFilter = {
            $gte: new Date("2023-10-16T21:00:00Z") // Only consider matches that have ended
        };

        const pastMatchesCount = await pastMatchesCollection.countDocuments({
            $or: [{ user1: userId.toString() }, { user2: userId.toString() }],
            end_time: dateFilter
        });

        return pastMatchesCount > 0; // Return true if there is at least one past match
    } else {
        return res.status(400).send({
            statusCode: 400,
            message: "Missing msisdn parameter",
            error: "Bad Request"
        });
    }

}

// export async function getLast3MonthsPlayUser(req, res) {
//     const db = await database();

//     const pastMatchescollection = db.collection(`bucket_60742ed3f95e39002c4917ae`);

//     // const userCollection = db.collection(`bucket_605c9480e9960e002c278191`);
//     // const identityCollection = db.collection(`identity`);


//     // const usersObjectArr = Array.from(LAST_30, el => ObjectId(el))
//     // const users = await userCollection.find({ _id: { $in: usersObjectArr } }).limit(75000).toArray().catch(console.error)

//     // const identites = Array.from(users, el => ObjectId(el.identity));
//     // const identitiesDatas = await identityCollection.find({ _id: { $in: identites } }).limit(75000).toArray().catch(console.error)

//     // const msisdns = Array.from(identitiesDatas, el => el.attributes.msisdn)

//     // console.log("RESULT_ARR", msisdns.length)


//     let dateFilter1 = {
//         $gte: new Date("03-15-2023 21:00:0"),
//         $lt: new Date("04-15-2023 21:00:0")
//     };

//     let dateFilter2 = {
//         $gte: new Date("04-24-2023 21:00:0"),
//         $lt: new Date("05-24-2023 21:00:0")
//     };

//     const users1 = [];
//     const users2 = [];

//     const matches1 = await pastMatchescollection.find({
//         end_time: dateFilter1
//     }).toArray().catch(console.error)

//     const matches2 = await pastMatchescollection.find({
//         end_time: dateFilter2
//     }).toArray().catch(console.error)

//     matches1.forEach(el => {
//         users1.push(el.user1)
//         if (el.duel_type == 0) {
//             users1.push(el.user2)
//         }
//     })

//     matches2.forEach(el => {
//         users2.push(el.user1)
//         if (el.duel_type == 0) {
//             users2.push(el.user2)
//         }
//     })

//     const uniqueUsers1 = [...new Set(users1)];
//     const uniqueUsers2 = [...new Set(users2)];

//     const resultArr = []
//     uniqueUsers1.forEach(el => {
//         if (!users2.includes(el)) {
//             resultArr.push(el)
//         }
//     })

//     console.log("users1", users1.length)
//     console.log("users2", users2.length)
//     console.log("uniqueUsers1", uniqueUsers1.length)
//     console.log("uniqueUsers2", uniqueUsers2.length)
//     console.log("resultArr", resultArr.length)


//     return res.status(200).send({ message: resultArr })
// }




// export async function botInsert(req,res){
//     const db = await database();
//     const botsBucket = db.collection(`bucket_6149c7c84c193b002fc84caa`);
//     const botsArray= req.body; 

//     botsArray.forEach(b => {
//         botsBucket.insertOne({
//             _id: ObjectId(b._id),
//             name: b.name,
//             avatar_id: b.avatar_id,
//             bot: true
//         })
//     })

//     console.log(botsArray);
//     return res.status(200).send(200);

// }
// export async function botInsertToUser(req,res){
//     const db = await database();
//     const botsBucket = db.collection(`bucket_605c9480e9960e002c278191`);
//     const botsArray= req.body; 

//     botsArray.forEach(b => {
//         botsBucket.insertOne({
//             _id: ObjectId(b._id),
//             name: b.name,
//             elo: 0,
//             total_point: 0,
//             weekly_point: 0,
//             win_count: 0,
//             lose_count: 0,
//             free_play: false,
//             bot: true,
//             perm_accept: false,
//             available_play_count: 0,
//             created_at: new Date(),
//             total_award: 0,
//             weekly_award: 0,

//         })
//     })

//     return res.status(200).send(200);

// }
// export async function deleteBuggedBots(req,res){
//     const db = await database();
//     const botsBucket = db.collection(`bucket_605c9480e9960e002c278191`);

//     try {
//         const result = await botsBucket.deleteMany({
//             bot: true
//         });
//         console.log(`Deleted ${result.deletedCount} documents`);
//         return res.status(200).send('Deleted successfully');
//     } catch (error) {
//         console.error("Error deleting documents: ", error);
//         return res.status(500).send('Internal Server Error');
//     }
// }

export async function getGameLeagueUsers(req, res) {

    const db = await database().catch(err => console.log("ERROR 1", err));

    const gameLeagueUsers = db.collection(`bucket_${GAME_LEAGUE_PARTICIPANTS}`);

    const users = await gameLeagueUsers.find({

    }).toArray()

    return res.send(users);
}

export async function getGameLeagueSendedData(req, res) {
    const db = await database().catch(err => console.log("ERROR 1", err));
    const drawLogsCollection = db.collection(`bucket_${DRAW_LOGS}`);

    let dateFilter = {
        $gte: new Date("12-11-2023 21:00:00"),
        $lt: new Date("01-17-2024 21:00:00")
    };

    const datas = await drawLogsCollection.find({
        date: dateFilter,
    }).skip(5000).limit(5000).toArray();

    return res.send(datas)

}
export async function chargesData(req, res) {
    const db = await database().catch(err => console.log("ERROR 1", err));
    const chargeCollection = db.collection(`bucket_${CHARGE_BUCKET}`);

    let dateFilter = {
        $gte: new Date("12-11-2023 21:00:00"),
        $lt: new Date("01-17-2024 21:00:00")
    };

    const chargeData = await chargeCollection.find({
        date: dateFilter,
        status: true,
    }).toArray();

    // Group data by msisdn and calculate charge count
    const groupedData = chargeData.reduce((result, item) => {
        const msisdn = item.msisdn;

        if (!result[msisdn]) {
            result[msisdn] = {
                msisdn: msisdn,
                charge_count: 1,
            };
        } else {
            result[msisdn].charge_count++;
        }

        return result;
    }, {});

    // Convert the grouped data object into an array
    const finalResult = Object.values(groupedData);

    console.log("finalResult: ", finalResult.length);

    return res.send(finalResult);
}

export async function tryLeader() {
    console.log("LOG 3")
    const db = await database();
    const userId = "65954c60520cd1c756d71b92"
    const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);
    let leaders = await users_collection
        .find().sort({ weekly_point: -1 }).limit(10).toArray()
        .catch(err => console.log("ERROR 2", err));

    console.log(leaders)
    const userIndex = leaders.findIndex(el => String(el._id) == userId)
    const userRank = userIndex == -1 ? 100 : userIndex + 1

    console.log(userRank)


    return "ok";
}

export async function getUniquePlayer() {
    const db = await database();
    const filter = {
        $lte: new Date("2024-03-31T20:59:00.855Z"),
        $gte: new Date("2024-02-31T21:01:00.855Z"),
    }
    const pastMatches = db.collection(`bucket_${PAST_MATCHES_BUCKET}`);
    const matchesData = await pastMatches.find({
        start_time: filter,
        user1_is_free: false,
        user2_is_free: false,
    }).toArray();
    const playerId = [];
    matchesData.forEach(el => {
        if (el.player_type == 1) {
            playerId.push(el.user1)
        }
        else { playerId.push(el.user1, el.user2) }
    })
    const uniquePlayer = [...new Set(playerId)];
    console.log("uniquePlayer", uniquePlayer.length)
    const userIdentity = [];

    await Promise.all(uniquePlayer.map(async (el) => {
        const userbucket = db.collection(`bucket_${USER_BUCKET}`);
        const userData = await userbucket.find({
            _id: ObjectId(el),
        }).toArray();
        userData.forEach(el => {
            userIdentity.push(el.identity)
        })
    }));
    const userMsisdns = [];

    await Promise.all(userIdentity.map(async (el) => {
        const identitesList = await db.collection(`identity`)
        const userMsisdn = await identitesList.find({
            _id: ObjectId(el),
        }).toArray();
        userMsisdn.forEach(el => {
            // db.collection(`bucket_65db9fa58a0920002cce406d`).insertOne({ msisdn: el.attributes.msisdn })

            userMsisdns.push({ msisdn: el.attributes.msisdn })
        })
    }));
    console.log(userMsisdns.length)
    await db.collection(`bucket_65db9fa58a0920002cce406d`).insertMany(userMsisdns)
    // console.log("useridentity", userIdentity.length)

    // console.log("usermsisdns", userMsisdns.length)

    return "ok"
}

export async function getMsisdnsFromBucket() {
    const db = await database();
    const msisdnsBucket = db.collection(`bucket_65db9fa58a0920002cce406d`);
    const uniqueMsisdns = await msisdnsBucket.find({}, { projection: { _id: 0 } }).toArray();
    return uniqueMsisdns
}

export async function deleteSome(req, res) {
    const db = await database();
    const msisdnsBucket = db.collection(`bucket_65db9fa58a0920002cce406d`);
    const result = msisdnsBucket.deleteMany();

    return res.status(200).send('Deleted successfully');
}

export async function removeSomeIdentity(req, res) {
    const db = await database();
    let dateFrom = new Date("02-01-2024 21:00:00");
    let dateTo = new Date("03-01-2024 21:00:00");
    const dateFilter = { $gte: dateFrom, $lt: dateTo }

    const users_collection = db.collection(`bucket_${USER_BUCKET}`);
    // const testData = await users_collection.find({
    //     available_play_count: 0, total_point: 0, win_count: 0, lose_count: 0, bot: false, created_at: dateFilter
    // }).toArray().catch(console.error)

    await users_collection.deleteMany({
        available_play_count: 0, total_point: 0, win_count: 0, lose_count: 0, bot: false, created_at: dateFilter
    }).catch(console.error)

    // console.log("data: ", testData.length);
    // const identyties = [];
    // testData.forEach((el) => {
    //     if (el.identity) {
    //         identyties.push(ObjectId(el.identity))
    //     }
    // })

    // const identyties_collection = db.collection(`identity`);
    // await identyties_collection.deleteMany({ _id: { $in: identyties } }).catch(console.error);

    return res.status(200).send({ message: 'ok' })
}

export async function patchUsers(req, res) {
    const db = await database();
    const filter = {
        $lte: new Date("2024-05-31T20:59:00.855Z"),
        $gte: new Date("2023-04-31T21:00:00.855Z"),
    }

    const userbucket = db.collection(`bucket_${USER_BUCKET}`);

    await userbucket.updateMany(
        {
            created_at: filter,
            bot: false
        },
        {
            $set: {
                free_play: true
            }
        }
    );

    return res.send('ok6');

}
export async function getUniqueCharge() {
    const db = await database();

    const filter = {
        $gte: new Date("2024-03-31T20:59:00.855Z"),
        $lte: new Date("2024-04-30T20:50:00.855Z"),
    }
    const test = await db.collection("bucket_61e03400833dac002d229730").find({ date: filter, status: true }).toArray()
    console.log(test.length)
    const rewardHourlyFalse = test.reduce((acc, curr) => {
        const existingItem = acc.find(item => item.msisdn === curr.msisdn);
        if (existingItem) {
            existingItem.count++;
        } else {
            acc.push({ msisdn: curr.msisdn, count: 1 });
        }
        return acc;
    }, []);


    db.collection("bucket_65db9fa58a0920002cce406d").insertMany(rewardHourlyFalse)
    console.log(rewardHourlyFalse.length)
    return "ok"
}
export async function deleteManyTest() {
    const db = await database();
    db.collection("bucket_65db9fa58a0920002cce406d").deleteMany({})
    // Api.deleteMany("65db9fa58a0920002cce406d", {})
    return "ok"
}