import { gm } from "../../manager/gm";

export class networkController {

    /**
     * GET请求
     * @param url 接口地址
     * @param params 参数
     */
    public get(url: string, params?: any): Promise<any> {

        return new Promise((resolve, reject) => {

            let xhr = new XMLHttpRequest();

            if (params) {
                let query = Object.keys(params)
                    .map(key => `${key}=${encodeURIComponent(params[key])}`)
                    .join("&");

                url += "?" + query;
            }

            xhr.open("GET", url, true);

            // 超时时间
            xhr.timeout = 10000;

            // 请求头
            xhr.setRequestHeader("Content-Type", "application/json");


            xhr.onreadystatechange = () => {

                if (xhr.readyState === 4) {

                    if (xhr.status >= 200 && xhr.status < 400) {

                        try {
                            let response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (e) {
                            resolve(xhr.responseText);
                        }

                    } else {
                        reject({
                            status: xhr.status,
                            msg: "GET请求失败"
                        });
                    }
                }
            };

            xhr.onerror = () => {
                reject({
                    status: xhr.status,
                    msg: "网络错误"
                });
            };

            xhr.ontimeout = () => {
                reject({
                    status: 0,
                    msg: "请求超时"
                });
            };

            xhr.send();
        });
    }

    /**
     * POST请求
     * @param url 接口地址
     * @param data 数据
     */
    public post(url: string, data?: any): Promise<any> {

        return new Promise((resolve, reject) => {

            let xhr = new XMLHttpRequest();

            xhr.open("POST", url, true);

            xhr.timeout = 10000;

            //可加可不加(有options预检和CORS问题需要关掉)
            // xhr.setRequestHeader("Content-Type", "application/json");


            xhr.onreadystatechange = () => {

                //请求状态：0-未初始化、1-请求未发送、2-服务器收到请求、3-请求处理中、4-请求完成
                if (xhr.readyState === 4) {

                    if (xhr.status >= 200 && xhr.status < 400) {

                        try {
                            let response = JSON.parse(xhr.responseText);
                            if(gm.isDebug){
                                console.warn("--------->后端返回数据>>>>", url, "\n", response);
                            }
                            resolve(response.data);
                        } catch (e) {
                            console.error("Post失败status：", xhr.status, "数据：", xhr.responseText);
                            reject({
                                status: xhr.status,
                                msg: xhr.responseText
                            });
                        }

                    } else {
                        console.error("Post失败：", xhr.status);
                        reject({
                            status: xhr.status,
                            msg: "POST请求失败"
                        });
                    }
                }
            };

            xhr.onerror = () => {
                reject({
                    status: xhr.status,
                    msg: "网络错误"
                });
            };

            xhr.ontimeout = () => {
                reject({
                    status: 0,
                    msg: "请求超时"
                });
            };

            xhr.send(JSON.stringify(data));
        });
    }
}
export let networkCtrl = new networkController();

