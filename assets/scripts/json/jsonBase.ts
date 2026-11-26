import { ccResTools } from "../extention/resTools";
import { GameEvent, SaveKey } from "../manager/configData";
import { ccStorageTools } from "../extention/storageTools";
import { gm } from "../manager/gm";
import { uiMgr } from "../manager/UIManager";

const stringTableFields: { [tableName: string]: string[] } = {
    arms: ['name', 'chaseTime'],
    boss: ['name', 'desc'],
    common: ['key', 'value'],
    container: ['name', 'fontColor', 'probabilityWeight', 'itemNumWeight'],
    equipment: ['name'],
    item: ['name'],
    map: ['name', 'rewardList', 'equipList', 'agentList'],
    nickname: ['nickname'],
    rank: ['name'],
    role: ['name', 'infoDesc'],
    roleLevel: ['passiveValue', 'initiativeValue', 'passiveDesc', 'initiativeDesc', 'passiveUpgradeDesc', 'initiativeUpgradeDesc', 'upgradeItem'],
    roleSkin: ['name'],
    sign: ['reward'],
    weapons: ['name', 'effectName'],
};

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
            this.data = this.normalizeRemoteData(tempData);
            if (!this.tableUrl2) {
                //没有表格2直接加载完成
                this.tableLoadComplete();
            } else {
                if (this.tableUrl2) {
                    //线上表格2
                    let tempData2 : any = await ccResTools.loadJsonByUrl(this.tableUrl2);
                    //合并表格2数据
                    this.data = [...this.data, ...this.normalizeRemoteData(tempData2)];
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

    private normalizeRemoteData(tableData: any): any[] {
        const rows = Array.isArray(tableData) ? tableData : Object.values(tableData);
        const stringFields = new Set(stringTableFields[this.tableName] ?? []);
        return rows.map(row => {
            const normalizedRow = { ...row };
            for (const field of Object.keys(normalizedRow)) {
                if (stringFields.has(field)) continue;
                const value = normalizedRow[field];
                if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
                    normalizedRow[field] = Number(value);
                }
            }
            return normalizedRow;
        });
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


