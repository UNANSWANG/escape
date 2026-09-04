import { _decorator, Component, Node } from 'cc';
import { roleController, roleType } from './roleController';
const { ccclass, property } = _decorator;

@ccclass('role0')
export class role0 extends roleController {
    /**角色类型 */
    roleType: roleType = roleType.advance;

    /**技能1的时间倍率(动画原时长为1.15s) */
    skill1TimeScale: number = 2.5;
    /**技能1的速度倍率 */
    skill1SpeedScale: number = 1.5;

    /** 使用技能1 */
    useSkill1() {
        
    }
}
