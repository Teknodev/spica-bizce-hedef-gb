import * as Api from "../../66c35126435fd2002ce680c4/.build";

export async function saveProgress() {
    const headers = {
        Authorization: 'apikey ' + "22j218m0chwl0n"
    }
    const diffRes = await Api.httpRequest('post', `https://bizce-hedef-gb-23d20.hq.spicaengine.com/api/versioncontrol/commands/diff`,
        { args: [] }, headers)
    if (diffRes?.data?.message === "") return;
    const addRes = await Api.httpRequest('post', `https://bizce-hedef-gb-23d20.hq.spicaengine.com/api/versioncontrol/commands/add`,
        { args: ["."] }, headers)
    if (addRes?.data?.message != "") return;
    const commitRes = await Api.httpRequest('post', `https://bizce-hedef-gb-23d20.hq.spicaengine.com/api/versioncontrol/commands/commit`,
        { args: ["-m", "\"Auto save progress\""] }, headers)
    if (!commitRes?.data?.commit) return;

    const pushRes = await Api.httpRequest('post', `https://bizce-hedef-gb-23d20.hq.spicaengine.com/api/versioncontrol/commands/push`,
        { args: ["origin", "main"] }, headers)
    console.debug(`Commit: ${commitRes.data.commit} , Summary: ${commitRes.data.summary} , Repo: ${pushRes?.data?.repo || "CHECK IT"}`)
    return "ok"
}

