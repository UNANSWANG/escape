import { _decorator, Component, Node } from 'cc';
import { roleController } from '../controller/role/roleController';
const { ccclass, property } = _decorator;

@ccclass('playerManager')
export class playerManager {
    /**玩家节点 */
    player: Node = null;
    /**当前角色实际挂载的控制脚本 */
    private roleComp: roleController = null;
    /**相机跟随玩家 */
    cameraFollow: boolean = false;

    /**玩家组件 */
    get playerComp(): roleController {
        if(!this.player){
            return null;
        }
        return this.roleComp || this.player.getComponent(roleController);
    }

    /**记录根据角色 id 创建出的专属角色脚本。 */
    setPlayerComp(roleComp: roleController) {
        this.roleComp = roleComp;
    }

    /**清理玩家引用。 */
    clearPlayer() {
        this.player = null;
        this.roleComp = null;
    }
}
export let playerMgr = new playerManager();

