import { _decorator, Component, Node } from 'cc';
import { roleController } from '../controller/roleController';
const { ccclass, property } = _decorator;

@ccclass('playerManager')
export class playerManager {
    /**玩家节点 */
    player: Node = null;
    /**相机跟随玩家 */
    cameraFollow: boolean = false;

    /**玩家组件 */
    get playerComp(): roleController {
        if(!this.player){
            return null;
        }
        return this.player.getComponent(roleController);
    }
}
export let playerMgr = new playerManager();

