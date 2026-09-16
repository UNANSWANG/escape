import { _decorator, Component, Enum } from 'cc';
import { ContainerType } from '../json/jsonContainer';
const { ccclass, property } = _decorator;

@ccclass('containerController')
export class containerController extends Component {
    @property({
        type: Enum(ContainerType),
        tooltip: '选择容器类型'
    })
    containerType: ContainerType = ContainerType.SupplyBox;

}


