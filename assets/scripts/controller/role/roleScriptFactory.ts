import { Node } from 'cc';
import { role0 } from './role0';
import { roleController } from './roleController';

/** 角色 id 与专属控制脚本的对应关系。新增角色时在此注册即可。 */
const roleScriptMap: Record<number, typeof roleController> = {
    0: role0,
};

/**
 * 根据角色 id 将对应的专属脚本挂到角色节点。
 * 未注册的角色暂时使用通用角色控制器，避免角色无法创建。
 */
export function addRoleScript(roleNode: Node, roleId: number): roleController {
    const RoleScript = roleScriptMap[roleId] || roleController;
    return roleNode.getComponent(RoleScript) || roleNode.addComponent(RoleScript);
}
