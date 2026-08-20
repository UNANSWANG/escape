export class netConfig {
    /**基础链接配置 */
    static baseUrlConfig = {
        /**无加密链接 */
        noEncryptionUrl: "https://iaa.taozigame.com",
        /**加密链接 */
        encryptionUrl: "",
    }

    /**网络基础链接 */
    static netBaseUrl = "https://iaa.quluyx.cn";
}

/**接口链接配置 */
export enum urlConfig {
    /**登录 */
    login = "/client/login",
    /**排行榜数据 */
    rank = "/client/top",
    /**关卡日志上报 */
    levelReport = "/client/reportLevel",
    /**用户数据上报 */
    reportUser = "/client/reportUser",
    /**用户数据 */
    userInfo = "/client/userInfo",
    /**游戏数据上报 */
    reportGame = "/client/reportGame",
}