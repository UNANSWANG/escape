import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('roleSkinItemController')
export class roleSkinItemController extends Component {
    /**皮肤id */
    skinId: number = 0;
}


