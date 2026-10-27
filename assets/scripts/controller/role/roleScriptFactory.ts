import { Node } from 'cc';
import { role0 } from './role0';
import { role1 } from './role1';
import { role2 } from './role2';
import { aiRole0 } from './aiRole0';
import { aiRole1 } from './aiRole1';
import { roleController } from './roleController';

/** 角色 id 与专属控制脚本的对应关系。新增角色时在此注册即可。 */
const roleScriptMap: Record<number, typeof roleController> = {
    0: role0,
    1: role1,
    2: role2,
};

const aiRoleScriptMap: Record<number, typeof roleController> = {
    0: aiRole0,
    1: aiRole1,
};

export function addAIRoleScript(roleNode: Node, roleId: number): roleController {
    const RoleScript = aiRoleScriptMap[roleId];
    if (!RoleScript) throw new Error(`未注册角色 ${roleId} 的 AI 脚本`);
    return roleNode.getComponent(RoleScript) || roleNode.addComponent(RoleScript);
}

/**
 * 根据角色 id 将对应的专属脚本挂到角色节点。
 * 未注册的角色暂时使用通用角色控制器，避免角色无法创建。
 */
export function addRoleScript(roleNode: Node, roleId: number): roleController {
    const RoleScript = roleScriptMap[roleId] || roleController;
    return roleNode.getComponent(RoleScript) || roleNode.addComponent(RoleScript);
}
