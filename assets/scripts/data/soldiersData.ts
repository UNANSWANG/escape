import { _decorator, CCInteger, Component, Enum, Node } from 'cc';
const { ccclass, property } = _decorator;

enum ScoutType {
    站岗 = 0,
    范围侦察 = 1,
    路径侦察 = 2,
}
@ccclass('soldiersData')
export class soldiersData extends Component {
    @property({
        type: CCInteger,
        tooltip: '小兵编号'
    })
    soldierId: number = 0;

    @property({
        type: Enum(ScoutType),
        tooltip: '侦察类型'
    })
    scoutType: ScoutType = ScoutType.站岗;

    @property({
        tooltip: '路径是否循环',
        visible() {
            return this.scoutType == ScoutType.路径侦察;
        },
    })
    isLoop: boolean = false;

    @property({
        type: [Node],
        tooltip: '侦察路径',
        visible() {
            return this.scoutType == ScoutType.路径侦察;
        },
    })
    scoutPath: Node[] = [];
}


