import { _decorator } from 'cc';
import { role1 } from './role1';
const { ccclass } = _decorator;

@ccclass('aiRole1')
export class aiRole1 extends role1 {
    get isAI(): boolean { return true; }
}
