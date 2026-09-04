import { _decorator, Component, Node } from 'cc';
import { roleController, roleType } from './roleController';
const { ccclass, property } = _decorator;

@ccclass('role1')
export class role1 extends roleController {
    /**角色类型 */
    roleType: roleType = roleType.heal;
}


