import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('gunController')
export class gunController extends Component {
    /**自动瞄准检测范围 */
    autoAttackRange: number = 400;
    /**射击间隔（秒）（临时） */
    shootInterval: number = 0.2;
}


