// 注意：导入路径可能需要根据你的 SillyTavern 版本调整
import {
    eventSource,
    saveSettingsDebounced,
    event_types 
} from '../../../../script.js'; // getContext 通常在这里或 script.js

import {
    renderExtensionTemplateAsync,
    extension_settings,
    getContext
} from '../../../extensions.js';


const PLUGIN_NAME = 'getcontext2';
const DEFAULT_SETTINGS = {
    enabled: false, // 默认禁用
};

// 跟踪监控状态，避免重复绑定监听器
let isMonitoringActive = false;

// 加载或初始化插件设置
async function loadSettings() {
    extension_settings[PLUGIN_NAME] = extension_settings[PLUGIN_NAME] || {};
    Object.assign(extension_settings[PLUGIN_NAME], {
        ...DEFAULT_SETTINGS,
        ...extension_settings[PLUGIN_NAME],
    });
}

// CHAT_CHANGED 事件处理器
function handleChatChangedMonitor(chatId) {
    // 只有在插件启用时才输出日志
    if (!extension_settings[PLUGIN_NAME].enabled) {
        return;
    }

    // 使用 console.groupCollapsed 将日志分组，方便查看
    console.groupCollapsed(`[Context Monitor] CHAT_CHANGED event triggered (chatId: ${chatId || '未知'})`);

    try {
        // --- 关键检查点 ---
        // 使用 typeof 安全地检查 getContext 是否为函数
        if (typeof getContext === 'function') {
            console.log('[Context Monitor] getContext is defined and appears to be a function.');
            try {
                // 尝试调用 getContext 并记录关键信息
                const context = getContext();
                console.log('[Context Monitor] getContext() called successfully.');
                console.log('[Context Monitor] Context details at event time:', {
                    chatId: context.chatId,
                    characterId: context.characterId,
                    groupId: context.groupId,
                    chatLength: context.chat ? context.chat.length : 'N/A',
                    chatMetadataDefined: !!context.chatMetadata,
                    chatMetadataSheetsDefined: !!context.chatMetadata?.sheets,
                    chatMetadataSheetsCount: context.chatMetadata?.sheets ? context.chatMetadata.sheets.length : 'N/A',
                     // 打印部分 sheets 的 UID 以确认它们是否存在
                    chatMetadataSheetsUIDs: context.chatMetadata?.sheets ? context.chatMetadata.sheets.slice(0, 5).map(s => s.uid) : 'N/A'
                });
                 // 可选：打印完整的 chatMetadata 副本以供详细检查
                // console.log('[Context Monitor] Full chatMetadata (copied):', JSON.parse(JSON.stringify(context.chatMetadata)));

            } catch (callError) {
                // 这通常不应该发生如果 typeof 是 function，但作为防御性编程
                console.error('[Context Monitor] Error calling getContext() despite typeof check:', callError);
            }
        } else {
            // --- !!! 捕获 ReferenceError 的场景 !!! ---
            // 如果 typeof getContext 不是 'function' (例如 'undefined')
            console.error(`[Context Monitor] CRITICAL: getContext is NOT defined or is of type "${typeof getContext}" at the moment CHAT_CHANGED handler is executed!`);
            console.error('[Context Monitor] This indicates a potential timing or scope issue with the event emitter calling this specific handler.');
        }
    } catch (generalError) {
        // 捕获其他意外错误
        console.error('[Context Monitor] An unexpected error occurred during context check:', generalError);
    } finally {
        // 无论如何都要结束分组
        console.groupEnd();
    }
}

// 注册事件监听器
function startMonitoring() {
    if (!isMonitoringActive) {
        console.log('[Context Monitor] Starting CHAT_CHANGED monitoring.');
        // 绑定事件处理器
        eventSource.on(event_types.CHAT_CHANGED, handleChatChangedMonitor);
        isMonitoringActive = true;
    } else {
        console.log('[Context Monitor] Monitoring is already active.');
    }
}

// 移除事件监听器
function stopMonitoring() {
    if (isMonitoringActive) {
        console.log('[Context Monitor] Stopping CHAT_CHANGED monitoring.');
        // 移除事件处理器
        eventSource.off(event_types.CHAT_CHANGED, handleChatChangedMonitor);
        isMonitoringActive = false;
    } else {
        console.log('[Context Monitor] Monitoring is not active.');
    }
}

// jQuery ready 函数 - 插件入口
jQuery(async () => {
    console.log(`[Context Monitor] Plugin loading: ${PLUGIN_NAME}`);

    // 1. 加载设置
    await loadSettings();

    // 2. 加载并注入设置 UI
    try {
        const settingsHtml = await renderExtensionTemplateAsync(
            `third-party/${PLUGIN_NAME}`,
            'settings'
        );
        $('#extensions_settings').append(settingsHtml);
        console.log(`[Context Monitor] Settings UI loaded.`);

        // 3. 绑定 UI 事件和初始化状态
        const $enableCheckbox = $('#context_monitor_enable');

        // 初始化复选框状态
        $enableCheckbox.prop('checked', extension_settings[PLUGIN_NAME].enabled);

        // 绑定 change 事件
        $enableCheckbox.on('change', function() {
            const isChecked = $(this).prop('checked');
            extension_settings[PLUGIN_NAME].enabled = isChecked;
            saveSettingsDebounced(); // 保存设置

            if (isChecked) {
                startMonitoring(); // 启用监控
            } else {
                stopMonitoring(); // 禁用监控
            }
        });

    } catch (error) {
        console.error(`[Context Monitor] Failed to load settings UI:`, error);
        // 如果 UI 加载失败，但核心功能（监控）可能仍然可以工作
        // 在这种情况下，我们可以直接根据加载的设置决定是否启动监控
    }

    // 4. 根据加载的设置决定是否立即开始监控
    if (extension_settings[PLUGIN_NAME].enabled) {
        startMonitoring();
    }

    console.log(`[Context Monitor] Plugin initialized: ${PLUGIN_NAME}. Monitoring is ${extension_settings[PLUGIN_NAME].enabled ? 'ENABLED' : 'DISABLED'}.`);
});
