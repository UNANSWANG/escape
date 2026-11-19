import { _decorator, Component, Node } from 'cc';
import { roleController } from '../controller/role/roleController';
import { agentRoleConfig, JsonAgentRoleData } from '../json/jsonAgentRole';
import { nicknameConfig } from '../json/jsonNickname';
import { mapConfig } from '../json/jsonMap';
import { ccTools } from '../extention/generalTools';
const { ccclass, property } = _decorator;

@ccclass('playerManager')
export class playerManager {
    /** 匹配时确定的本局 AI 配置和昵称，进入游戏时直接复用。 */
    matchedAIRoles: (JsonAgentRoleData & { nickname: string })[] = [];

    /**普通匹配和首次引导共用阵容生成，人数包含玩家。 */
    prepareMatch(mapIdx: number, difficultyType: number, count: number): number {
        const nicknamePool = Array.from(new Set(
            (nicknameConfig.roleNicknameAllData || [])
                .map(data => data.nickname?.trim())
                .filter(nickname => !!nickname && nickname !== '你')
        ));
        ccTools.shuffleArray(nicknamePool);
        const itemCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 6;
        this.matchedAIRoles = [];
        const rawTypes: unknown = mapConfig.getMapData(mapIdx, difficultyType)?.agentList;
        let agentTypes: number[] = [];
        try {
            const parsed: unknown = typeof rawTypes === 'string' ? JSON.parse(rawTypes) : rawTypes;
            if (Array.isArray(parsed)) agentTypes = parsed.filter(value => Number.isInteger(value));
        } catch {
            console.warn('地图 agentList 配置格式错误', rawTypes);
        }
        this.matchedAIRoles = agentRoleConfig.randomRoles(agentTypes, itemCount - 1).map((data, index) => ({
            ...data,
            nickname: nicknamePool.pop() || `玩家${index + 1}`,
        }));
        if (this.matchedAIRoles.length !== itemCount - 1) {
            throw new Error('agentRole 表中没有符合地图 agentList 的 AI 配置');
        }
        return itemCount;
    }

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

