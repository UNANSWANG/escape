import { _decorator, Component, Node } from 'cc';
import { roleController, roleType } from './roleController';
const { ccclass, property } = _decorator;

@ccclass('role1')
export class role1 extends roleController {
    /**角色类型 */
    roleType: roleType = roleType.heal;

    /**被动：将当前等级配置的治疗加成百分比转换为治疗倍率。 */
    get healingEffectScale(): number {
        const value = Number(this.roleLevelData?.passiveValue);
        return Number.isFinite(value) ? 1 + Math.max(0, value) / 100 : 1;
    }
}


