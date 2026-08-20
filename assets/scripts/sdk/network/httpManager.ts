import { gm } from "../../manager/gm";
import { userMgr } from "../../manager/userManager";
import { netConfig } from "./netConfig";
import { networkCtrl } from "./networkController";


export class httpManager {
    /**是否为线上 */
    isOnline = true;

    async post($url: string, $data: any = {}, success?, fail?) {
        //数据拼接
        let data: any = Object.assign({}, userMgr.params, $data);
        let url = netConfig.netBaseUrl + $url;


        let sendData = null;

        if (this.isOnline) {
            //线上发送数据格式
            sendData = {
                "data": JSON.stringify(data),
            };
        } else {
            //兜底结构
            sendData = data;
        }

        if(gm.isDebug){
            console.warn("--------->请求url:", url, "请求参数:\n", sendData);
        }
        try {
            let res = await networkCtrl.post(url, sendData);
            success?.(res);
        } catch (err) {
            fail?.(err);
        }
    }
}
export let httpMgr = new httpManager();
