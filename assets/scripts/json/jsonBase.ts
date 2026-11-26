import { ccResTools } from "../extention/resTools";
import { GameEvent, SaveKey } from "../manager/configData";
import { ccStorageTools } from "../extention/storageTools";
import { gm } from "../manager/gm";
import { uiMgr } from "../manager/UIManager";

export class jsonBase {
    /** 表格名称 */
    tableName: string = "";
    /** 表格路径 */
    protected jsonPath: string = "";
    /**表格链接1 */
    protected tableUrl1: string = "";
    /**表格链接2 */
    protected tableUrl2: string = "";
    /** 表格数据 */
    protected data: any;
    /**是否派发过表格加载完成事件 */
    protected isTableLoadComplete = false;

    async initTable() {
        if (this.tableUrl1 && ccStorageTools.getNumberData(SaveKey.useLocalTable) !== 1) {
            //线上表格
            let tempData = await ccResTools.loadJsonByUrl(this.tableUrl1);
            //还需要转化成数组
            this.data = tempData;
            if (!this.tableUrl2) {
                //没有表格2直接加载完成
                this.tableLoadComplete();
            } else {
                if (this.tableUrl2) {
                    //线上表格2
                    let tempData2 : any = await ccResTools.loadJsonByUrl(this.tableUrl2);
                    //合并表格2数据
                    this.data = [...this.data, ...tempData2];
                    this.tableLoadComplete();
                }
            }
        } else {
            //本地表格
            let tempData = await ccResTools.loadJson(uiMgr.resBundle, this.jsonPath);
            //还需要转化成数组
            this.data = Object.values(tempData);
            this.tableLoadComplete();
        }
        if(gm.isDebug){
            console.warn(this.tableName, 'JSON 数据:', this.data);
        }
    }

    /**表格处理 */
    protected processTableData() {

    }

    /**表格加载结束回调 */
    protected tableLoadComplete() {
        this.processTableData();
        if (!this.isTableLoadComplete) {
            this.isTableLoadComplete = true;
            gm.Event.emit(GameEvent.loadTable, this.tableName);
        }
    }

    /** 编号【KEY】 */
    id: number = 0;
}


