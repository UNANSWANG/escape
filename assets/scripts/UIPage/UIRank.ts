import { _decorator, Animation, Color, Label, Node, Sprite } from 'cc';
import { zoomButton } from '../extention/zoomButton';
import { imgPath, ItemPath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { UIBase } from './UIBase';
import { ccTools } from '../extention/generalTools';
import List from '../sdk/virtualList/List';
import { gm } from '../manager/gm';
import { userMgr } from '../manager/userManager';
import { pData } from '../manager/playerData';
import { httpMgr } from '../sdk/network/httpManager';
import { urlConfig } from '../sdk/network/netConfig';
import { ccStorageTools } from '../extention/storageTools';
import { SaveKey } from '../manager/configData';
import { levelConfig } from '../json/jsonLevel';
const { ccclass, property } = _decorator;

@ccclass('UIRank')
export class UIRank extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    rankList: Node;

    @property(Node)
    rankFriend: Node;

    @property([Node])
    btnArr: Node[] = [];

    /**当前页面索引 */
    pageIdx = 0;
    /**是否在等待数据 */
    isWaitingData = false;
    /**排行榜数据 */
    rankData: any[] = [];
    /**自身数据 */
    selfData: any = {};

    protected onLoad(): void {
        this.bindBtn();
    }

    onUI_Open(data?: any) {
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData();
    }

    initData() {
        this.checkAvatarUrlCache();
        this.isWaitingData = false;
        this.refreshPage();
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        for (let i = 0; i < this.btnArr.length; i++) {
            this.btnArr[i].on(Node.EventType.TOUCH_END, this.clickPageBtn.bind(this, i), this);
        }

        this.rankFriend.on(Node.EventType.TOUCH_START, this.onTouchStartFriend.bind(this), this);
        this.rankFriend.on(Node.EventType.TOUCH_MOVE, this.onTouchMoveFriend.bind(this), this);
        this.rankFriend.on(Node.EventType.TOUCH_END, this.onTouchEndFriend.bind(this), this);
        this.rankFriend.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancelFriend.bind(this), this);
    }

    /**切换页面 */
    refreshPage() {
        //先关闭所有页面，等数据后再打开当前页面
        this.rankList.active = false;
        this.rankFriend.active = false;

        for (let i = 0; i < this.btnArr.length; i++) {
            this.btnArr[i].getChildByName("select").active = i == this.pageIdx;
        }

        if (this.pageIdx == 2) {
            //好友排行榜
            gm.API.getFriendRank();

            this.rankFriend.active = true;
        } else {
            this.isWaitingData = true;
            let list = this.rankList.getChildByName("rankScrol").getComponent(List);
            let tempType = this.pageIdx == 0 ? "all" : "daily";
            httpMgr.post(urlConfig.rank, { type: tempType }, (data) => {
                console.log("获取排行榜数据成功", data);
                this.rankData = data.list;
                this.selfData = data.user;

                this.checkSelfData();
                this.rankList.active = true;
                list.numItems = this.rankData.length;
                this.refreshSelfData();
                this.isWaitingData = false;
            }, () => {
                uiMgr.showTips("获取排行榜数据失败");
                this.isWaitingData = false;
            })
        }
    }

    setRankItemData(item, data, isSelf = false) {
        let medals = item.getChildByName("medals");
        let nameLab = item.getChildByName("nameLab").getComponent(Label);
        let scoreLab = item.getChildByName("scoreLab").getComponent(Label);
        let rankLab = item.getChildByName("rankLab").getComponent(Label);

        let avatarImg = item.getChildByName("avatarMask").getChildByName("avatarImg").getComponent(Sprite);

        let rankNumber = Number(data.rank);
        if(!rankNumber){
            rankNumber = 100;
        }
        if (!isSelf) {
            this.refreshRankItemStyle(item, rankNumber);
        }
        medals.active = rankNumber <= 3;
        rankLab.node.active = rankNumber > 3;

        let isUnranked = isSelf && rankNumber > 100;
        rankLab.string = isUnranked ? "未上榜" : data.rank;
        if (isSelf) {
            rankLab.color = new Color(isUnranked ? "#9B9B9B" : "#FFFFFF");
            rankLab.fontSize = isUnranked ? 40 : 55;
        }
        if (rankNumber <= 3) {
            ccTools.showChildByIdx(medals, rankNumber - 1);
        }

        nameLab.string = data.name;

        if (this.pageIdx == 0) {
            //总榜的value为关卡上报的rank值，反解成关卡名称显示，如 400002 => “进阶-3”
            scoreLab.string = levelConfig.getRankLevelName(data.score) || `${data.score}`;
        } else if (this.pageIdx == 1) {
            scoreLab.string = `通过${data.score}关`;
        } else {
            scoreLab.string = data.score;
        }

        if (data.avatar) {
            //赋值头像
            ccTools.loadUrlImg(avatarImg, data.avatar);
        } else {
            //默认头像
            ccTools.loadImg(avatarImg, imgPath.defAvatar);
        }
    }

    /**刷新列表排名项样式（自身排名不处理） */
    refreshRankItemStyle(item: Node, rankNumber: number) {
        let styleIndex = rankNumber >= 1 && rankNumber <= 3 ? rankNumber : 4;
        let bg = item.getChildByName("bg").getComponent(Sprite);
        ccTools.loadImg(bg, imgPath.rankItemBg + styleIndex);

        for (let i = 0; i < 3; i++) {
            let line = item.getChildByName(`line_${i}`).getComponent(Sprite);
            ccTools.loadImg(line, imgPath.rankItemLine + styleIndex);
        }
    }

    /**渲染排行榜 */
    onListRender(item: any, idx: number) {
        // console.log("渲染排行榜", idx);

        let data: any = {};

        data.rank = this.rankData[idx].rank;
        data.score = this.rankData[idx].value;
        data.name = this.rankData[idx].nickname ? this.rankData[idx].nickname : `用户${this.rankData[idx].uid}`;
        data.avatar = this.rankData[idx].profile;
        this.setRankItemData(item, data);
    }

    /**刷新玩家数据 */
    refreshSelfData() {
        let selfNode = this.rankList.getChildByName("selfNode");
        let selfData: any = {};
        selfData.rank = this.selfData.rank;
        selfData.score = this.selfData.value;
        selfData.name = userMgr.nickName ? userMgr.nickName : this.selfData.nickname;
        if(!selfData.name){
            selfData.name = `用户${this.selfData.uid}`;
        }
        selfData.avatar = userMgr.avatarUrl ? userMgr.avatarUrl : this.selfData.profile;
        this.setRankItemData(selfNode, selfData, true);
    }

    /**检测自身玩家数据修改排行榜数据 */
    checkSelfData() {
        if (userMgr.nickName && userMgr.avatarUrl) {
            for (let i = 0; i < this.rankData.length; i++) {
                if (this.rankData[i].uid == this.selfData.uid) {
                    this.rankData[i].profile = userMgr.avatarUrl;
                    this.rankData[i].nickname = userMgr.nickName;
                    break;
                }
            }
        }
    }

    /**检测头像url缓存 */
    checkAvatarUrlCache(){
        if(userMgr.avatarUrl){
            let lastAvatarUrl = ccStorageTools.getData(SaveKey.avatarUrl);
            if(userMgr.avatarUrl != lastAvatarUrl){
                //上传用户数据(仅授权成功后上传一次)
                httpMgr.post(urlConfig.reportUser, { nickname: userMgr.nickName, profile: userMgr.avatarUrl });
                //缓存头像url
                ccStorageTools.setData(SaveKey.avatarUrl, userMgr.avatarUrl);
            }
        }
    }

    /**触摸开始事件 */
    onTouchStartFriend() {

    }

    /**触摸移动事件 */
    onTouchMoveFriend() {

    }

    /**触摸结束事件 */
    onTouchEndFriend() {
        //没授权就打开设置
        if (!userMgr.isAuthFriend) {
            gm.API.refreshSetting(() => {
                //刷新状态后依旧未授权，打开设置
                if (!userMgr.isAuthFriend) {
                    this.openPlatSetting();
                }
            });
        }
    }

    /**触摸取消事件 */
    onTouchCancelFriend() {

    }

    /**打开平台设置界面 */
    openPlatSetting() {
        gm.API.openSetting(() => {
            gm.API.getFriendRank();
        });
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
    }

    /**点击页面选项按钮 */
    clickPageBtn(index: number) {
        if (this.isWaitingData) {
            return;
        }
        if (index == this.pageIdx) {
            return;
        }
        this.pageIdx = index;
        this.refreshPage();
    }

    onClose() {
        uiMgr.closePage(UIPath.UIRank);
    }
}
