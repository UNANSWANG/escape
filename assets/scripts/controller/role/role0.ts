import { _decorator, Component, Node } from 'cc';
import { roleController, roleType } from './roleController';
const { ccclass, property } = _decorator;

@ccclass('role0')
export class role0 extends roleController {
    /**角色类型 */
    roleType: roleType = roleType.advance;

    /** 使用技能1 */
    useSkill1() {
        
    }
}


