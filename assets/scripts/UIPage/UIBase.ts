import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UIBase')
export class UIBase extends Component {
    onUI_Open(data?: any) {
        //打开界面   
    }
    onUI_Close() {
        //关闭界面
    }
}


